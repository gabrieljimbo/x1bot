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
import { ContactTagsService } from './contact-tags.service';

@Injectable()
export class ExecutionEngineService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private eventBus: EventBusService,
    private executionService: ExecutionService,
    private nodeExecutor: NodeExecutorService,
    private whatsappSender: WhatsappSenderService,
    private contactTagsService: ContactTagsService,
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
    console.log('🚀 [ExecutionEngine] startExecution called!', { tenantId, workflowId, sessionId, contactId });
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

      // Find trigger node (MESSAGE, SCHEDULE, or MANUAL)
      const triggerNode = workflow.nodes.find(
        (n) => 
          n.type === WorkflowNodeType.TRIGGER_MESSAGE || 
          n.type === WorkflowNodeType.TRIGGER_SCHEDULE ||
          n.type === WorkflowNodeType.TRIGGER_MANUAL,
      );

      if (!triggerNode) {
        throw new Error('Workflow has no trigger node');
      }

      // Load contact tags
      const contactTags = await this.contactTagsService.getTags(
        tenantId,
        sessionId,
        contactId,
      );
      console.log('[ExecutionEngine] Loaded contactTags:', { tenantId, sessionId, contactId, contactTags });

      // Create execution
      const execution = await this.executionService.createExecution(
        tenantId,
        workflowId,
        sessionId,
        contactId,
        {
          variables: {
            triggerMessage: triggerMessage || '',
            contactTags, // Make tags available in all nodes
          },
        },
      );
      console.log('[ExecutionEngine] Created execution with context:', execution.context);

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

      // Save the current output as input for this node (output from previous node)
      // If there's an explicit input (like from a user message), use that instead
      const nodeInput = Object.keys(execution.context.input || {}).length > 0
        ? execution.context.input
        : execution.context.output || {};

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
        const { sessionId, contactId, message, media } = result.messageToSend;
        
        // Check if it's a media message
        if (media) {
          await this.whatsappSender.sendMedia(
            sessionId,
            contactId,
            media.type,
            media.url,
            {
              caption: media.caption,
              fileName: media.fileName,
              sendAudioAsVoice: media.sendAudioAsVoice,
            }
          );
        } else if (message) {
          // Check if message is a special type (buttons or list)
          try {
            const parsed = JSON.parse(message);
            
            if (parsed.type === 'buttons') {
              await this.whatsappSender.sendButtons(
                sessionId,
                contactId,
                parsed.message,
                parsed.buttons,
                parsed.footer,
              );
            } else if (parsed.type === 'list') {
              await this.whatsappSender.sendList(
                sessionId,
                contactId,
                parsed.message,
                parsed.buttonText,
                parsed.sections,
                parsed.footer,
              );
            } else {
              await this.whatsappSender.sendMessage(sessionId, contactId, message);
            }
          } catch (e) {
            // Not JSON, send as regular message
            await this.whatsappSender.sendMessage(sessionId, contactId, message);
          }
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
        
        // Check if it's a WAIT node (automatic resume) or WAIT_REPLY (manual resume)
        const isWaitNode = currentNode.type === WorkflowNodeType.WAIT;
        
        if (isWaitNode) {
          // For WAIT nodes, move to next node immediately in DB but schedule resume
          await this.executionService.updateExecution(execution.id, {
            status: ExecutionStatus.WAITING,
            currentNodeId: result.nextNodeId, // Move to next node
            context: execution.context,
          });

          // Schedule automatic resume after wait time
          if (result.waitTimeoutSeconds) {
            const waitMs = result.waitTimeoutSeconds * 1000;
            console.log(`[WAIT] Scheduling auto-resume in ${waitMs}ms`);
            
            setTimeout(async () => {
              try {
                console.log(`[WAIT] Auto-resuming execution ${execution.id}`);
                
                // Get the updated execution from DB
                const updatedExecution = await this.executionService.getExecution(
                  execution.tenantId,
                  execution.id,
                );
                
                if (!updatedExecution) {
                  console.error('[WAIT] Execution not found');
                  return;
                }
                
                if (updatedExecution.status !== ExecutionStatus.WAITING) {
                  console.log('[WAIT] Execution is no longer waiting, skipping auto-resume');
                  return;
                }
                
                // Get workflow
                const workflowData = await this.prisma.workflow.findFirst({
                  where: { id: updatedExecution.workflowId, tenantId: updatedExecution.tenantId },
                });
                
                if (!workflowData) {
                  console.error('[WAIT] Workflow not found');
                  return;
                }
                
                const workflow: Workflow = {
                  ...workflowData,
                  description: workflowData.description || undefined,
                  nodes: workflowData.nodes as any,
                  edges: workflowData.edges as any,
                };
                
                // Update status to RUNNING
                updatedExecution.status = ExecutionStatus.RUNNING;
                await this.executionService.updateExecution(execution.id, {
                  status: ExecutionStatus.RUNNING,
                });
                
                // Emit resumed event
                await this.eventBus.emit({
                  type: EventType.EXECUTION_RESUMED,
                  tenantId: updatedExecution.tenantId,
                  executionId: updatedExecution.id,
                  workflowId: updatedExecution.workflowId,
                  sessionId: updatedExecution.sessionId,
                  contactId: updatedExecution.contactId,
                  previousStatus: ExecutionStatus.WAITING,
                  timestamp: new Date(),
                });
                
                // Continue execution from the next node
                await this.continueExecution(updatedExecution, workflow);
              } catch (error) {
                console.error('[WAIT] Error auto-resuming execution:', error);
              }
            }, waitMs);
          }
        } else {
          // For WAIT_REPLY, keep currentNodeId as the WAIT_REPLY node
          // This is important so we can process the reply when resumed
          await this.executionService.updateExecution(execution.id, {
            status: ExecutionStatus.WAITING,
            currentNodeId: currentNode.id, // Keep current node, not next
            context: execution.context,
          });

          // Set timeout in Redis for WAIT_REPLY
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

