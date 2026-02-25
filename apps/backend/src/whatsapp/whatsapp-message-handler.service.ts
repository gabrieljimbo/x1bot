import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionService } from '../execution/execution.service';
import { ExecutionEngineService } from '../execution/execution-engine.service';
import { WorkflowNodeType, ExecutionStatus, TriggerMessagePayload } from '@n9n/shared';

@Injectable()
export class WhatsappMessageHandler {
  constructor(
    private prisma: PrismaService,
    private executionService: ExecutionService,
    private executionEngine: ExecutionEngineService,
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
    // Normalize payload: if string, convert to payload format
    const normalizedPayload: TriggerMessagePayload = typeof payload === 'string'
      ? {
        messageId: `text-${Date.now()}`,
        from: contactId,
        type: 'text',
        text: payload,
        media: null,
        timestamp: Date.now(),
      }
      : payload;

    // Check for active execution
    const activeExecution = await this.executionService.getActiveExecution(
      tenantId,
      sessionId,
      contactId,
    );

    if (activeExecution) {
      // Resume existing execution
      if (activeExecution.status === ExecutionStatus.WAITING) {
        // For resume, we pass the text content
        const resumeText = normalizedPayload.text || '';
        await this.executionEngine.resumeExecution(activeExecution, resumeText, normalizedPayload);
      }
    } else {
      // Try to match trigger
      await this.matchTriggerAndStart(tenantId, sessionId, contactId, normalizedPayload);
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
      const textToMatch = messageText.toLowerCase();

      // If no pattern is configured, accept all messages (text and media)
      if (!config.pattern || config.pattern.trim() === '') {
        console.log('[TRIGGER] No pattern configured, accepting all messages');
        matches = true;
      } else if (config.matchType === 'exact') {
        matches = textToMatch === config.pattern.toLowerCase();
      } else if (config.matchType === 'contains') {
        matches = textToMatch.includes(config.pattern.toLowerCase());
      } else if (config.matchType === 'regex') {
        const regex = new RegExp(config.pattern, 'i');
        matches = regex.test(messageText);
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

