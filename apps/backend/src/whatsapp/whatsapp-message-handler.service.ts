import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionService } from '../execution/execution.service';
import { ExecutionEngineService } from '../execution/execution-engine.service';
import { WorkflowNodeType, ExecutionStatus } from '@n9n/shared';

@Injectable()
export class WhatsappMessageHandler {
  constructor(
    private prisma: PrismaService,
    private executionService: ExecutionService,
    private executionEngine: ExecutionEngineService,
  ) {}

  /**
   * Handle incoming WhatsApp message
   */
  async handleMessage(
    tenantId: string,
    sessionId: string,
    contactId: string,
    message: string,
  ): Promise<void> {
    // Check for active execution
    const activeExecution = await this.executionService.getActiveExecution(
      tenantId,
      sessionId,
      contactId,
    );

    if (activeExecution) {
      // Resume existing execution
      if (activeExecution.status === ExecutionStatus.WAITING) {
        await this.executionEngine.resumeExecution(activeExecution, message);
      }
    } else {
      // Try to match trigger
      await this.matchTriggerAndStart(tenantId, sessionId, contactId, message);
    }
  }

  /**
   * Match message against workflow triggers and start execution
   */
  private async matchTriggerAndStart(
    tenantId: string,
    sessionId: string,
    contactId: string,
    message: string,
  ): Promise<void> {
    console.log('[TRIGGER] Matching message:', message);
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

      // Match message against trigger pattern
      let matches = false;

      // If no pattern is configured, accept all messages
      if (!config.pattern || config.pattern.trim() === '') {
        console.log('[TRIGGER] No pattern configured, accepting all messages');
        matches = true;
      } else if (config.matchType === 'exact') {
        matches = message.toLowerCase() === config.pattern.toLowerCase();
      } else if (config.matchType === 'contains') {
        matches = message.toLowerCase().includes(config.pattern.toLowerCase());
      } else if (config.matchType === 'regex') {
        const regex = new RegExp(config.pattern, 'i');
        matches = regex.test(message);
      }

      if (matches) {
        // Start execution
        await this.executionEngine.startExecution(
          tenantId,
          workflow.id,
          sessionId,
          contactId,
          message,
        );
        break; // Only trigger first matching workflow
      }
    }
  }
}

