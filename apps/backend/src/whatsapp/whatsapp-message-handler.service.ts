import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionService } from '../execution/execution.service';
import { ExecutionEngineService } from '../execution/execution-engine.service';
import { WorkflowNodeType, ExecutionStatus, TriggerMessagePayload } from '@n9n/shared';
import { EventBusService } from '../event-bus/event-bus.service';
import { ConversationStatus, MessageStatus } from '@prisma/client';

@Injectable()
export class WhatsappMessageHandler {
  constructor(
    private prisma: PrismaService,
    private executionService: ExecutionService,
    private executionEngine: ExecutionEngineService,
    private eventBus: EventBusService,
  ) { }

  /**
   * Handle incoming WhatsApp message
   */
  async handleMessage(
    tenantId: string,
    sessionId: string,
    contactId: string,
    payload: TriggerMessagePayload | string,
  ): Promise<void> {
    // Normalize payload
    const normalizedPayload: TriggerMessagePayload = typeof payload === 'string'
      ? {
        messageId: `text-${Date.now()}`,
        from: contactId,
        fromMe: false, // Default for simple string messages
        type: 'text',
        text: payload,
        media: null,
        timestamp: Date.now(),
      }
      : payload;

    // 1. Loop Protection: Ignore messages from bot itself
    if (normalizedPayload.fromMe) {
      console.log(`[IGNORE] Session ${sessionId}: Ignoring message from self (loop protection)`);
      return;
    }

    // --- CRM / Inbox Registration ---
    // Extract a phone name if possible (this expects contact name/pushName if available, omitting for brevity or using phone)
    const activeSession = await this.prisma.whatsappSession.findUnique({
      where: { id: sessionId },
      select: { tenantId: true }
    });


    if (activeSession) {
      const isGroupParam = contactId.endsWith('@g.us');
    }

    // Proper CRM / Inbox Registration
    const isGroup = contactId.endsWith('@g.us');
    let conversation = await this.prisma.conversation.findFirst({
      where: { sessionId, contactId },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          sessionId,
          tenantId: activeSession ? activeSession.tenantId : tenantId,
          contactId,
          contactPhone: contactId.split('@')[0],
          isGroup,
          status: ConversationStatus.OPEN,
        }
      });
    }

    // Create the message in history
    const mediaPayload = normalizedPayload.media as any;

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: normalizedPayload.text || '',
        mediaUrl: normalizedPayload.media?.url,
        mediaType: mediaPayload?.type || mediaPayload?.mediaType || undefined,
        fromMe: false,
        timestamp: new Date(normalizedPayload.timestamp),
        status: MessageStatus.DELIVERED,
      }
    });

    // Update conversation last message & unread 
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessage: normalizedPayload.text || (normalizedPayload.media ? `[${mediaPayload?.type || mediaPayload?.mediaType || 'media'}]` : ''),
        lastMessageAt: new Date(normalizedPayload.timestamp),
        unreadCount: { increment: 1 },
      }
    });

    // Notify Frontend
    await this.eventBus.emit({
      type: 'conversation:updated' as any,
      tenantId: activeSession ? activeSession.tenantId : tenantId,
      conversationId: conversation.id,
      timestamp: new Date(),
    } as any);

    await this.eventBus.emit({
      type: 'message:received' as any,
      tenantId: activeSession ? activeSession.tenantId : tenantId,
      conversationId: conversation.id,
      timestamp: new Date(),
    } as any);
    // --- End CRM / Inbox Registration ---

    // 2. Group Filtering: Check if message is from a group
    let whitelistedWorkflows: string[] = [];

    if (isGroup) {
      // Fetch group configuration
      const groupConfig = await this.prisma.whatsappGroupConfig.findUnique({
        where: {
          sessionId_groupId: {
            sessionId,
            groupId: contactId,
          },
        },
      });

      // 3. Whitelist Check: Discard if group not authorized or disabled
      if (!groupConfig || !groupConfig.enabled) {
        console.log(`[IGNORE] Session ${sessionId}: Group ${contactId} not in whitelist or disabled`);
        return;
      }

      whitelistedWorkflows = groupConfig.workflowIds;
      console.log(`[GROUP] Session ${sessionId}: Group authorized. Permitted workflows:`, whitelistedWorkflows);
    }

    // 4. ContactFlowState Check (Resume waiting nodes)
    // Fetch if there's an active waiting flow for this contact
    const flowState = await this.prisma.contactFlowState.findUnique({
      where: {
        sessionId_contactPhone: {
          sessionId,
          contactPhone: contactId,
        },
      },
    });

    if (flowState) {
      if (new Date() > flowState.expiresAt) {
        // State expired, delete it and proceed to match triggers
        console.log(`[STATE] Session ${sessionId}: ContactFlowState for ${contactId} expired, deleting`);
        await this.prisma.contactFlowState.delete({
          where: { id: flowState.id },
        });
      } else if (flowState.executionId) {
        // State is active, load execution and resume
        console.log(`[STATE] Session ${sessionId}: Found active ContactFlowState for ${contactId}, resuming execution ${flowState.executionId}`);
        const activeExecution = await this.executionService.getExecution(tenantId, flowState.executionId);

        if (activeExecution) {
          // If in a group, verify workflow is allowed
          if (isGroup && !whitelistedWorkflows.includes(activeExecution.workflowId)) {
            console.log(`[IGNORE] Session ${sessionId}: Active workflow ${activeExecution.workflowId} not permitted in group ${contactId}`);
            return;
          }

          const resumeText = normalizedPayload.text || '';
          await this.executionEngine.resumeExecution(activeExecution, resumeText, normalizedPayload);
          return; // Stop processing further here
        } else {
          console.log(`[STATE] Session ${sessionId}: Execution ${flowState.executionId} not found, deleting state`);
          await this.prisma.contactFlowState.delete({
            where: { id: flowState.id },
          });
        }
      }
    }

    // Check for active execution (Fallback/Legacy check)
    const activeExecution = await this.executionService.getActiveExecution(
      tenantId,
      sessionId,
      contactId,
    );

    if (activeExecution) {
      // 5. Workflow Check for Groups (Resume): Ensure the active workflow is permitted in this group
      if (isGroup && !whitelistedWorkflows.includes(activeExecution.workflowId)) {
        console.log(`[IGNORE] Session ${sessionId}: Active workflow ${activeExecution.workflowId} not permitted in group ${contactId}`);
        return;
      }

      // Resume existing execution
      if (activeExecution.status === ExecutionStatus.WAITING) {
        const resumeText = normalizedPayload.text || '';
        await this.executionEngine.resumeExecution(activeExecution, resumeText, normalizedPayload);
      }
    } else {
      // Try to match trigger
      await this.matchTriggerAndStart(tenantId, sessionId, contactId, normalizedPayload, isGroup, whitelistedWorkflows);
    }
  }

  /**
   * Match message against workflow triggers and start execution
   */
  private async matchTriggerAndStart(
    tenantId: string,
    sessionId: string,
    contactId: string,
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

    console.log('[TRIGGER] Found active workflows:', workflows.length);

    for (const workflowData of workflows) {
      console.log('[TRIGGER] Checking workflow:', workflowData.id, workflowData.name);

      const workflow = {
        ...workflowData,
        description: workflowData.description || undefined,
        nodes: workflowData.nodes as any,
        edges: workflowData.edges as any,
      };

      // Find trigger node
      const triggerNode = workflow.nodes.find(
        (n: any) => n.type === WorkflowNodeType.TRIGGER_MESSAGE,
      );

      console.log('[TRIGGER] Trigger node found:', !!triggerNode);

      if (!triggerNode) {
        continue;
      }

      const config = triggerNode.config;
      console.log('[TRIGGER] Trigger config:', config);

      // 4. Workflow Check for Groups (Start): If in a group, only trigger if workflow is whitelisted
      if (isGroup && !whitelistedWorkflows.includes(workflow.id)) {
        console.log(`[IGNORE] Session ${sessionId}: Workflow ${workflow.id} not whitelisted for group ${contactId}`);
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
          contactId,
          messageText, // Keep for backward compatibility
          payload, // Pass full payload
        );
        break; // Only trigger first matching workflow
      }
    }
  }
}

