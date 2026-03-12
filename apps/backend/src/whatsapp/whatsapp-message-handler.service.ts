import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionService } from '../execution/execution.service';
import { ExecutionEngineService } from '../execution/execution-engine.service';
import { WorkflowNodeType, ExecutionStatus, TriggerMessagePayload } from '@n9n/shared';
import { InboxService } from '../inbox/inbox.service';
import { MessageStatus } from '@prisma/client';

@Injectable()
export class WhatsappMessageHandler {
  constructor(
    private prisma: PrismaService,
    private executionService: ExecutionService,
    private executionEngine: ExecutionEngineService,
    @Inject(forwardRef(() => InboxService))
    private inboxService: InboxService,
  ) { }

  /**
   * Handle incoming WhatsApp message
   */
  async handleMessage(
    tenantId: string,
    sessionId: string,
    contactPhone: string,
    payload: TriggerMessagePayload | string,
    skipTrigger: boolean = false,
    ownJid?: string,
  ): Promise<void> {
    // Normalize payload
    const normalizedPayload: TriggerMessagePayload = typeof payload === 'string'
      ? {
        messageId: `text-${Date.now()}`,
        from: contactPhone,
        fromMe: false, // Default for simple string messages
        type: 'text',
        text: payload,
        media: null,
        timestamp: Date.now(),
      }
      : payload;

    // --- CRM / Inbox Registration ---
    const mediaPayload = normalizedPayload.media as any;
    const isGroup = contactPhone.endsWith('@g.us');
    const messageContent = normalizedPayload.text || (normalizedPayload.media ? `[${mediaPayload?.mediaType || mediaPayload?.type || 'media'}]` : '');

    const contactName = !normalizedPayload.fromMe ? ((normalizedPayload as any).contactName || undefined) : undefined;

    // Use InboxService to upsert conversation and save message
    const conversation = await this.inboxService.upsertConversation(tenantId, sessionId, contactPhone, {
      contactName,
      lastMessage: messageContent,
      lastMessageAt: new Date(normalizedPayload.timestamp),
      unreadCount: normalizedPayload.fromMe ? undefined : { increment: 1 } as any,
    });

    await this.inboxService.saveMessage(conversation.id, {
      whatsappMessageId: normalizedPayload.messageId || undefined,
      content: normalizedPayload.text || '',
      mediaUrl: normalizedPayload.media?.url,
      mediaType: mediaPayload?.mediaType || mediaPayload?.type || undefined,
      fromMe: normalizedPayload.fromMe,
      timestamp: new Date(normalizedPayload.timestamp),
      status: MessageStatus.DELIVERED,
    } as any);
    // --- End CRM / Inbox Registration ---

    // 1. Loop Protection & Skip Trigger: Ignore messages from bot itself for workflow triggering
    // or if skipTrigger is explicitly requested (e.g. for history sync)
    const isFromMe = normalizedPayload.fromMe;
    const isToMe = ownJid && (contactPhone === ownJid || contactPhone.split('@')[0] === ownJid.split('@')[0]);

    if (isFromMe || isToMe || skipTrigger) {
      console.log(`[IGNORE] Session ${sessionId}: Ignoring message. fromMe: ${isFromMe}, toMe: ${isToMe}, skipTrigger: ${skipTrigger} (loop protection/self-message)`);
      return;
    }

    // 2. Group Filtering: Check if message is from a group
    let whitelistedWorkflows: string[] = [];
    let isGroupEnabled = false;

    if (isGroup) {
      // Fetch group configuration
      const groupConfig = await this.prisma.whatsappGroupConfig.findUnique({
        where: {
          sessionId_groupId: {
            sessionId,
            groupId: contactPhone,
          },
        },
      });

      // 3. Whitelist Check: Mark if group is authorized
      if (groupConfig && groupConfig.enabled) {
        isGroupEnabled = true;
        whitelistedWorkflows = groupConfig.workflowIds;
        console.log(`[GROUP] Session ${sessionId}: Group authorized. Permitted workflows:`, whitelistedWorkflows);
      } else {
        console.log(`[IGNORE] Session ${sessionId}: Group ${contactPhone} not in whitelist or disabled`);
        // We do not return immediately because there might be an active campaign execution waiting for a reply
      }
    }

    // 4. ContactFlowState Check (Resume waiting nodes)
    // Fetch if there's an active waiting flow for this contact
    const flowState = await this.prisma.contactFlowState.findUnique({
      where: {
        sessionId_contactPhone: {
          sessionId,
          contactPhone: contactPhone,
        },
      },
    });

    // 4. ContactFlowState Check (Resume waiting nodes)
    let finalFlowState = flowState;

    if (!finalFlowState) {
      // Fallback 1: Search for this phone in ANY session of this tenant
      // (This handles cases where the lead responds to a different session than the one that started the flow)
      const tenantSessions = await this.prisma.whatsappSession.findMany({
        where: { tenantId },
        select: { id: true },
      });
      const sessionIds = tenantSessions.map(s => s.id);

      finalFlowState = await this.prisma.contactFlowState.findFirst({
        where: {
          sessionId: { in: sessionIds },
          contactPhone: { contains: contactPhone.split('@')[0] }, // Flexible match for @s.whatsapp.net or @lid
        },
      });

      if (finalFlowState) {
        console.log(`[STATE] Session ${sessionId}: Found active ContactFlowState for ${contactPhone} on DIFFERENT session ${finalFlowState.sessionId}, migrating...`);
        // If message arrived on a different session, we should migrate the state for future messages
        // But for Prisma, we need to handle the unique constraint
        await this.prisma.contactFlowState.deleteMany({
          where: {
            sessionId,
            contactPhone
          }
        }).catch(() => { });

        // Update the existing state to the current session
        await this.prisma.contactFlowState.update({
          where: { id: finalFlowState.id },
          data: { sessionId },
        });
      }
    }

    if (finalFlowState) {
      if (new Date() > finalFlowState.expiresAt) {
        // State expired, delete it and proceed to match triggers
        console.log(`[STATE] Session ${sessionId}: ContactFlowState for ${contactPhone} expired, deleting`);
        await this.prisma.contactFlowState.delete({
          where: { id: finalFlowState.id },
        });
      } else if (finalFlowState.executionId) {
        // State is active, load execution and resume
        console.log(`[STATE] Session ${sessionId}: Found active ContactFlowState for ${contactPhone}, resuming execution ${finalFlowState.executionId}`);
        const activeExecution = await this.executionService.getExecution(tenantId, finalFlowState.executionId);

        if (activeExecution) {
          // If execution was on a different session, update it to the current one
          if (activeExecution.sessionId !== sessionId) {
            console.log(`[STATE] Migrating execution ${activeExecution.id} session from ${activeExecution.sessionId} to ${sessionId}`);
            await this.executionService.updateExecution(activeExecution.id, { sessionId } as any);
            activeExecution.sessionId = sessionId;
          }

          // If in a group, verify workflow is allowed OR it's a campaign
          if (isGroup) {
            const isCampaign = !!activeExecution.campaignId;
            if (!isCampaign && (!isGroupEnabled || !whitelistedWorkflows.includes(activeExecution.workflowId))) {
              console.log(`[IGNORE] Session ${sessionId}: Active workflow ${activeExecution.workflowId} not permitted in group ${contactPhone}`);
              return;
            }
          }

          const resumeText = normalizedPayload.text || '';
          await this.executionEngine.resumeExecution(activeExecution, resumeText, normalizedPayload);
          return; // Stop processing further here
        } else {
          console.log(`[STATE] Session ${sessionId}: Execution ${finalFlowState.executionId} not found, deleting state`);
          await this.prisma.contactFlowState.delete({
            where: { id: finalFlowState.id },
          });
        }
      }
    }

    // Check for active execution (Fallback/Legacy check)
    let activeExecution = await this.executionService.getActiveExecution(
      tenantId,
      sessionId,
      contactPhone,
    );

    if (!activeExecution) {
      // Fallback 2: Direct lookup by tenant and phone (cross-session)
      const allActive = await this.prisma.workflowExecution.findFirst({
        where: {
          tenantId,
          contactPhone: { contains: contactPhone.split('@')[0] },
          status: { in: ['RUNNING', 'WAITING'] },
        },
        orderBy: { startedAt: 'desc' }
      });

      if (allActive) {
        console.log(`[FALLBACK] Found active execution ${allActive.id} on session ${allActive.sessionId}, migrating to ${sessionId}`);
        await this.executionService.updateExecution(allActive.id, { sessionId } as any);
        activeExecution = await this.executionService.getExecution(tenantId, allActive.id);
      }
    }

    if (activeExecution) {
      // 5. Workflow Check for Groups (Resume): Ensure the active workflow is permitted in this group or it's a campaign
      if (isGroup) {
        const isCampaign = !!activeExecution.campaignId;
        if (!isCampaign && (!isGroupEnabled || !whitelistedWorkflows.includes(activeExecution.workflowId))) {
          console.log(`[IGNORE] Session ${sessionId}: Active workflow ${activeExecution.workflowId} not permitted in group ${contactPhone}`);
          return;
        }
      }

      // Resume existing execution
      if (activeExecution.status === ExecutionStatus.WAITING) {
        const resumeText = normalizedPayload.text || '';
        await this.executionEngine.resumeExecution(activeExecution, resumeText, normalizedPayload);
        return;
      }
    } else {
      // If it's a group and not enabled, do not try to match triggers
      if (isGroup && !isGroupEnabled) {
        console.log(`[IGNORE] Session ${sessionId}: Group ${contactPhone} not in whitelist or disabled, ignoring triggers`);
        return;
      }

      // Try to match trigger
      await this.matchTriggerAndStart(tenantId, sessionId, contactPhone, normalizedPayload, isGroup, whitelistedWorkflows);
    }
  }

  /**
   * Match message against workflow triggers and start execution
   */
  private async matchTriggerAndStart(
    tenantId: string,
    sessionId: string,
    contactPhone: string,
    payload: TriggerMessagePayload,
    isGroup: boolean = false,
    whitelistedWorkflows: string[] = [],
  ): Promise<void> {
    const messageText = payload.text || '';
    console.log('[TRIGGER] Matching message:', messageText, 'Type:', payload.type);
    console.log('[TRIGGER] Tenant:', tenantId);

    // Get active workflows for this tenant
    const workflows = await this.prisma.workflow.findMany({
      where: {
        tenantId,
        isActive: true,
      },
    });

    // Sort workflows to prioritize specific patterns over catch-alls
    workflows.sort((a, b) => {
      const getPattern = (w: any) => {
        const nodes = w.nodes as any[];
        const edges = w.edges as any[];
        if (!Array.isArray(nodes) || !Array.isArray(edges)) return '';
        const trigger = nodes.find((n: any) =>
          (n.type === WorkflowNodeType.TRIGGER_WHATSAPP ||
            n.type === WorkflowNodeType.TRIGGER_KEYWORD ||
            n.type === WorkflowNodeType.TRIGGER_MESSAGE) &&
          edges.some(e => e.source === n.id)
        );
        return trigger?.config?.pattern?.trim() || '';
      };

      const hasPatternA = !!getPattern(a);
      const hasPatternB = !!getPattern(b);

      if (hasPatternA && !hasPatternB) return -1;
      if (!hasPatternA && hasPatternB) return 1;

      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    console.log('[TRIGGER] Found active workflows:', workflows.length);

    for (const workflowData of workflows) {
      console.log('[TRIGGER] Checking workflow:', workflowData.id, workflowData.name);

      const workflow = {
        ...workflowData,
        description: workflowData.description || undefined,
        nodes: workflowData.nodes as any,
        edges: workflowData.edges as any,
      };

      const hasOutgoingEdges = (nodeId: string) => workflow.edges.some((e: any) => e.source === nodeId);

      // Find trigger node that actually has outgoing edges
      const triggerNode = workflow.nodes.find(
        (n: any) =>
          (n.type === WorkflowNodeType.TRIGGER_WHATSAPP ||
            n.type === WorkflowNodeType.TRIGGER_KEYWORD ||
            n.type === WorkflowNodeType.TRIGGER_MESSAGE) &&
          hasOutgoingEdges(n.id)
      );

      console.log(`[TRIGGER] Trigger node found for ${workflow.name}:`, !!triggerNode);

      if (!triggerNode) {
        // Log if we skipped disconnected triggers
        const hasDisconnected = workflow.nodes.some(
          (n: any) =>
          (n.type === WorkflowNodeType.TRIGGER_WHATSAPP ||
            n.type === WorkflowNodeType.TRIGGER_KEYWORD ||
            n.type === WorkflowNodeType.TRIGGER_MESSAGE)
        );
        if (hasDisconnected) {
          console.log(`[TRIGGER] Found trigger nodes in ${workflow.name} but they are disconnected (no outgoing edges), skipping...`);
        }
        continue;
      }

      // Rule: Incoming messages never trigger MANUAL, SCHEDULE or GRUPO
      // (They are already excluded because we only find WHATSAPP, KEYWORD, MESSAGE nodes above)

      const config = triggerNode.config;
      console.log(`[TRIGGER] Trigger config for ${workflow.name}:`, config);

      // 4. Workflow Check for Groups (Start): If in a group, only trigger if workflow is whitelisted
      if (isGroup && !whitelistedWorkflows.includes(workflow.id)) {
        console.log(`[IGNORE] Session ${sessionId}: Workflow ${workflow.id} not whitelisted for group ${contactPhone}`);
        continue;
      }

      // Check if this trigger is for a specific session
      if (config.sessionId && config.sessionId !== sessionId) {
        // If the workflow specifies a sessionId, we should check if that session still exists and is for this tenant
        // However, to be more robust, if the message IS for this tenant and the sessionId in config 
        // doesn't match the current one, we might still want to trigger if it's the only session or if
        // the user didn't explicitly mean to LOCK it to that old ID.
        // For now, let's allow it to trigger if the config pattern matches, regardless of session ID, 
        // UNLESS the tenant has multiple sessions and this workflow is clearly meant for another one.
        console.log('[TRIGGER] Session ID in config:', config.sessionId, 'Current session:', sessionId);
        // continue; // Commented out to allow matching across sessions for the same tenant
      }

      // Match message against trigger pattern
      // For media messages, we match against caption if available, otherwise accept all media
      let matches = false;
      const textToMatch = messageText.trim().toLowerCase();

      // If no pattern is configured, accept all messages (text and media)
      if (!config.pattern || config.pattern.trim() === '') {
        console.log('[TRIGGER] No pattern configured, accepting all messages');
        matches = true;
      } else {
        // Support multiple patterns separated by comma
        const patterns = config.pattern.split(',').map((p: string) => p.trim());
        const matchType = config.matchType || 'exact';

        for (let p of patterns) {
          if (!p) continue;

          // Auto-Regex detection: if pattern is /regex/, treat as regex regardless of matchType
          const isAutoRegex = p.startsWith('/') && p.endsWith('/') && p.length > 2;
          const currentMatchType = isAutoRegex ? 'regex' : matchType;
          let patternToUse = isAutoRegex ? p.substring(1, p.length - 1) : p;

          if (currentMatchType === 'exact') {
            if (textToMatch === patternToUse.toLowerCase()) {
              matches = true;
              break;
            }
          } else if (currentMatchType === 'starts_with') {
            if (textToMatch.startsWith(patternToUse.toLowerCase())) {
              matches = true;
              break;
            }
          } else if (currentMatchType === 'contains') {
            if (textToMatch.includes(patternToUse.toLowerCase())) {
              matches = true;
              break;
            }
          } else if (currentMatchType === 'regex') {
            try {
              const regex = new RegExp(patternToUse, 'i');
              if (regex.test(messageText)) {
                matches = true;
                break;
              }
            } catch (error) {
              console.error(`[TRIGGER] Invalid regex: ${patternToUse}`, error);
            }
          }
        }
      }

      // For media messages without caption, accept if pattern matches empty string or accept all
      if (payload.type === 'media' && !messageText && (!config.pattern || config.pattern.trim() === '')) {
        matches = true;
      }

      if (matches) {
        // Start execution with normalized payload
        await this.executionEngine.startExecution(
          tenantId,
          workflow.id,
          sessionId,
          contactPhone,
          messageText, // Keep for backward compatibility
          payload, // Pass full payload
        );
        break; // Only trigger first matching workflow
      }
    }
  }
}

