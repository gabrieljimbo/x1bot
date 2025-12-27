import { Injectable } from '@nestjs/common';
import {
  Workflow,
  WorkflowExecution,
  ExecutionStatus,
  WorkflowNode,
  WorkflowNodeType,
  EventType,
} from '@n9n/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { ExecutionService } from './execution.service';
import { NodeExecutorService } from './node-executor.service';
import { WhatsappSenderService } from './whatsapp-sender.service';

@Injectable()
export class ExecutionEngineService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private eventBus: EventBusService,
    private executionService: ExecutionService,
    private nodeExecutor: NodeExecutorService,
    private whatsappSender: WhatsappSenderService,
  ) {}

  /**
   * Start new workflow execution
   */
  async startExecution(
    tenantId: string,
    workflowId: string,
    sessionId: string,
    contactId: string,
    triggerMessage?: string,
  ): Promise<WorkflowExecution> {
    // Acquire lock to prevent duplicate executions
    const lockKey = `execution:lock:${tenantId}:${sessionId}:${contactId}`;
    const lockAcquired = await this.redis.acquireLock(lockKey, 30);

    if (!lockAcquired) {
      throw new Error('Another execution is already in progress for this contact');
    }

    try {
      // Check for existing active execution
      const existingExecution = await this.executionService.getActiveExecution(
        tenantId,
        sessionId,
        contactId,
      );

      if (existingExecution) {
        await this.redis.releaseLock(lockKey);
        throw new Error('Active execution already exists for this contact');
      }

      // Get workflow
      const workflowData = await this.prisma.workflow.findFirst({
        where: { id: workflowId, tenantId },
      });

      if (!workflowData) {
        throw new Error('Workflow not found');
      }

      const workflow: Workflow = {
        ...workflowData,
        description: workflowData.description || undefined,
        nodes: workflowData.nodes as any,
        edges: workflowData.edges as any,
      };

      // Find trigger node
      const triggerNode = workflow.nodes.find(
        (n) => n.type === WorkflowNodeType.TRIGGER_MESSAGE,
      );

      if (!triggerNode) {
        throw new Error('Workflow has no trigger node');
      }

      // Create execution
      const execution = await this.executionService.createExecution(
        tenantId,
        workflowId,
        sessionId,
        contactId,
        {
          variables: {
            triggerMessage: triggerMessage || '',
          },
        },
      );

      // Emit started event
      await this.eventBus.emit({
        type: EventType.EXECUTION_STARTED,
        tenantId,
        executionId: execution.id,
        workflowId,
        sessionId,
        contactId,
        timestamp: new Date(),
      });

      // Find first node after trigger
      const firstEdge = workflow.edges.find((e) => e.source === triggerNode.id);
      if (firstEdge) {
        execution.currentNodeId = firstEdge.target;
        await this.executionService.updateExecution(execution.id, {
          currentNodeId: firstEdge.target,
        });

        // Start execution loop
        await this.continueExecution(execution, workflow);
      }

      return execution;
    } finally {
      await this.redis.releaseLock(lockKey);
    }
  }

  /**
   * Resume execution after receiving message
   */
  async resumeExecution(
    execution: WorkflowExecution,
    message: string,
  ): Promise<void> {
    // Acquire lock
    const lockKey = `execution:lock:${execution.tenantId}:${execution.sessionId}:${execution.contactId}`;
    const lockAcquired = await this.redis.acquireLock(lockKey, 30);

    if (!lockAcquired) {
      throw new Error('Execution is locked');
    }

    try {
      // Check if expired
      if (new Date() > execution.expiresAt) {
        await this.expireExecution(execution);
        return;
      }

      // Increment interaction count
      const interactionCount = await this.executionService.incrementInteractionCount(
        execution.id,
      );

      // Check interaction limit
      if (this.executionService.isInteractionLimitReached(interactionCount)) {
        await this.completeExecution(execution, 'Interaction limit reached');
        return;
      }

      // Get workflow
      const workflowData = await this.prisma.workflow.findFirst({
        where: { id: execution.workflowId, tenantId: execution.tenantId },
      });

      if (!workflowData) {
        throw new Error('Workflow not found');
      }

      const workflow: Workflow = {
        ...workflowData,
        description: workflowData.description || undefined,
        nodes: workflowData.nodes as any,
        edges: workflowData.edges as any,
      };

      // Get current node
      const currentNode = workflow.nodes.find((n) => n.id === execution.currentNodeId);

      if (!currentNode) {
        throw new Error('Current node not found');
      }

      // Process reply if current node is WAIT_REPLY
      if (currentNode.type === WorkflowNodeType.WAIT_REPLY) {
        this.nodeExecutor.processReply(currentNode, message, execution.context);
        
        // Move to next node after processing reply
        const nextEdge = workflow.edges.find((e) => e.source === currentNode.id);
        if (nextEdge) {
          execution.currentNodeId = nextEdge.target;
        }
      }

      // Update status to RUNNING
      execution.status = ExecutionStatus.RUNNING;
      await this.executionService.updateExecution(execution.id, {
        status: ExecutionStatus.RUNNING,
        currentNodeId: execution.currentNodeId,
        context: execution.context,
      });

      // Emit resumed event
      await this.eventBus.emit({
        type: EventType.EXECUTION_RESUMED,
        tenantId: execution.tenantId,
        executionId: execution.id,
        workflowId: execution.workflowId,
        sessionId: execution.sessionId,
        contactId: execution.contactId,
        previousStatus: ExecutionStatus.WAITING,
        timestamp: new Date(),
      });

      // Continue execution
      await this.continueExecution(execution, workflow);
    } finally {
      await this.redis.releaseLock(lockKey);
    }
  }

  /**
   * Continue execution loop
   */
  private async continueExecution(
    execution: WorkflowExecution,
    workflow: Workflow,
  ): Promise<void> {
    while (execution.status === ExecutionStatus.RUNNING && execution.currentNodeId) {
      const currentNode = workflow.nodes.find((n) => n.id === execution.currentNodeId);

      if (!currentNode) {
        await this.failExecution(execution, 'Current node not found');
        return;
      }

      // Check if END node
      if (currentNode.type === WorkflowNodeType.END) {
        await this.completeExecution(execution);
        return;
      }

      const startTime = Date.now();

      console.log('[EXECUTION] About to execute node:', currentNode.id);
      console.log('[EXECUTION] Node type:', currentNode.type);
      console.log('[EXECUTION] Node object:', JSON.stringify(currentNode, null, 2));

      // Execute node
      const result = await this.nodeExecutor.executeNode(
        currentNode,
        execution.context,
        workflow.edges,
        execution.sessionId,
        execution.contactId,
      );

      // Send message if node produced one
      if (result.messageToSend) {
        try {
          console.log(`Sending message to ${result.messageToSend.contactId}: ${result.messageToSend.message}`);
          await this.whatsappSender.sendMessage(
            result.messageToSend.sessionId,
            result.messageToSend.contactId,
            result.messageToSend.message,
          );
        } catch (error) {
          console.error('Error sending WhatsApp message:', error);
        }
      }

      const duration = Date.now() - startTime;

      // Emit node executed event
      await this.eventBus.emit({
        type: EventType.NODE_EXECUTED,
        tenantId: execution.tenantId,
        executionId: execution.id,
        workflowId: execution.workflowId,
        sessionId: execution.sessionId,
        contactId: execution.contactId,
        nodeId: currentNode.id,
        nodeType: currentNode.type,
        duration,
        timestamp: new Date(),
      });

      // Handle wait
      if (result.shouldWait) {
        execution.status = ExecutionStatus.WAITING;
        // Keep currentNodeId as the WAIT node, not the next node
        // This is important so we can process the reply when resumed
        
        await this.executionService.updateExecution(execution.id, {
          status: ExecutionStatus.WAITING,
          currentNodeId: currentNode.id, // Keep current node, not next
          context: execution.context,
        });

        // Set timeout in Redis
        if (result.waitTimeoutSeconds) {
          const timeoutKey = `execution:timeout:${execution.id}`;
          await this.redis.setWithTTL(
            timeoutKey,
            JSON.stringify({
              onTimeout: result.onTimeout,
              timeoutTargetNodeId: result.timeoutTargetNodeId,
            }),
            result.waitTimeoutSeconds,
          );
        }

        // Emit waiting event
        await this.eventBus.emit({
          type: EventType.EXECUTION_WAITING,
          tenantId: execution.tenantId,
          executionId: execution.id,
          workflowId: execution.workflowId,
          sessionId: execution.sessionId,
          contactId: execution.contactId,
          currentNodeId: execution.currentNodeId!,
          timeoutSeconds: result.waitTimeoutSeconds || 0,
          timestamp: new Date(),
        });

        return;
      }

      // Move to next node
      execution.currentNodeId = result.nextNodeId;

      await this.executionService.updateExecution(execution.id, {
        currentNodeId: result.nextNodeId,
        context: execution.context,
      });

      // If no next node, complete
      if (!result.nextNodeId) {
        await this.completeExecution(execution);
        return;
      }
    }
  }

  /**
   * Complete execution
   */
  private async completeExecution(
    execution: WorkflowExecution,
    reason?: string,
  ): Promise<void> {
    await this.executionService.updateExecution(execution.id, {
      status: ExecutionStatus.COMPLETED,
    });

    await this.eventBus.emit({
      type: EventType.EXECUTION_COMPLETED,
      tenantId: execution.tenantId,
      executionId: execution.id,
      workflowId: execution.workflowId,
      sessionId: execution.sessionId,
      contactId: execution.contactId,
      output: execution.context.output,
      timestamp: new Date(),
    });
  }

  /**
   * Expire execution
   */
  async expireExecution(execution: WorkflowExecution): Promise<void> {
    await this.executionService.updateExecution(execution.id, {
      status: ExecutionStatus.EXPIRED,
    });

    await this.eventBus.emit({
      type: EventType.EXECUTION_EXPIRED,
      tenantId: execution.tenantId,
      executionId: execution.id,
      workflowId: execution.workflowId,
      sessionId: execution.sessionId,
      contactId: execution.contactId,
      currentNodeId: execution.currentNodeId,
      timestamp: new Date(),
    });
  }

  /**
   * Fail execution
   */
  private async failExecution(execution: WorkflowExecution, error: string): Promise<void> {
    await this.executionService.updateExecution(execution.id, {
      status: ExecutionStatus.ERROR,
      error,
    });

    await this.eventBus.emit({
      type: EventType.EXECUTION_ERROR,
      tenantId: execution.tenantId,
      executionId: execution.id,
      workflowId: execution.workflowId,
      sessionId: execution.sessionId,
      contactId: execution.contactId,
      error,
      currentNodeId: execution.currentNodeId,
      timestamp: new Date(),
    });
  }
}

