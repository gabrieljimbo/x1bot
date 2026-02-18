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
import { ContextService } from './context.service';

@Injectable()
export class ExecutionEngineService {
  private activeTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private eventBus: EventBusService,
    private executionService: ExecutionService,
    private nodeExecutor: NodeExecutorService,
    private whatsappSender: WhatsappSenderService,
    private contactTagsService: ContactTagsService,
    private contextService: ContextService,
  ) { }

  /**
   * Start new workflow execution
   */
  async startExecution(
    tenantId: string,
    workflowId: string,
    sessionId: string,
    contactId: string,
    triggerMessage?: string,
    triggerPayload?: any, // TriggerMessagePayload
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
      // Create execution with normalized payload
      const execution = await this.executionService.createExecution(
        tenantId,
        workflowId,
        sessionId,
        contactId,
        {
          variables: {
            triggerMessage: triggerMessage || '',
            triggerPayload: triggerPayload || {
              messageId: `text-${Date.now()}`,
              from: contactId,
              type: 'text',
              text: triggerMessage || '',
              media: null,
              timestamp: Date.now(),
            },
            contactTags, // Make tags available in all nodes
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
    triggerPayload?: any, // TriggerMessagePayload
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

      // Update context with new message and payload
      if (triggerPayload) {
        execution.context.variables.triggerPayload = triggerPayload;
      }
      execution.context.variables.triggerMessage = message;

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
    let iterationCount = 0;
    const MAX_ITERATIONS = 100; // Safety limit to prevent infinite loops (reduced from 10000)

    while (execution.status === ExecutionStatus.RUNNING && execution.currentNodeId) {
      iterationCount++;
      if (iterationCount > MAX_ITERATIONS) {
        await this.failExecution(execution, `Execution exceeded maximum iterations (${MAX_ITERATIONS}). Possible infinite loop detected.`);
        return;
      }

      if (iterationCount % 10 === 0) {
        console.warn(`[EXECUTION LOOP] High iteration count: ${iterationCount}, currentNodeId: ${execution.currentNodeId}, workflowId: ${execution.workflowId}`);
      }

      const currentNode = workflow.nodes.find((n) => n.id === execution.currentNodeId);

      if (!currentNode) {
        await this.failExecution(execution, 'Current node not found');
        return;
      }

      // If we're inside a loop and current node is the loop node itself, skip it
      // (loop node should only execute once at the start)
      // Only skip if we've already executed the loop node at least once (indicated by _loopCurrentIndex being set)
      const loopNodeId = this.contextService.getVariable(execution.context, '_loopNodeId');
      const loopCurrentIndex = this.contextService.getVariable(execution.context, '_loopCurrentIndex');

      if (loopNodeId && currentNode.id === loopNodeId && currentNode.type === WorkflowNodeType.LOOP) {
        console.log(`[LOOP DEBUG] Returning to loop node ${loopNodeId}, currentIndex: ${loopCurrentIndex}, iterationCount: ${iterationCount}`);
        // Only skip if loop has already been initialized (currentIndex is set)
        // This means we're returning to the loop node after an iteration, not executing it for the first time
        if (loopCurrentIndex !== undefined) {
          // We're returning to the loop node - skip execution and go directly to loop body
          // Note: sourceHandle from React Flow is saved as 'condition' in WorkflowEdge
          const loopEdge = workflow.edges.find((e) => e.source === loopNodeId && e.condition === 'loop');
          const nextNodeId = loopEdge ? loopEdge.target : null;

          if (nextNodeId) {
            execution.currentNodeId = nextNodeId;
            await this.executionService.updateExecution(execution.id, {
              currentNodeId: nextNodeId,
              context: execution.context,
            });
            // Reload execution to ensure we have latest sessionId and contactId
            const updatedExecution = await this.executionService.getExecution(execution.tenantId, execution.id);
            if (updatedExecution) {
              execution.sessionId = updatedExecution.sessionId;
              execution.contactId = updatedExecution.contactId;
            }
            continue;
          } else {
            // No loop edge - go to done
            // Note: sourceHandle from React Flow is saved as 'condition' in WorkflowEdge
            const doneEdge = workflow.edges.find((e) => e.source === loopNodeId && e.condition === 'done');
            const doneNodeId = doneEdge ? doneEdge.target : null;

            if (doneNodeId) {
              execution.currentNodeId = doneNodeId;
              await this.executionService.updateExecution(execution.id, {
                currentNodeId: doneNodeId,
                context: execution.context,
              });
              continue;
            } else {
              await this.completeExecution(execution);
              return;
            }
          }
        }
        // If loopCurrentIndex is undefined, this is the first execution - let it execute normally
      }

      // Check if we're inside a loop and current node is END - skip execution and continue iteration
      if (loopNodeId && currentNode.type === WorkflowNodeType.END) {
        // We're inside a loop and reached END - continue to next iteration without executing END
        const loopDataEnd = this.contextService.getVariable(execution.context, '_loopData');
        const loopCurrentIndexEnd = this.contextService.getVariable(execution.context, '_loopCurrentIndex');

        console.log(`[LOOP DEBUG] END node reached in loop, currentIndex: ${loopCurrentIndexEnd}, totalItems: ${Array.isArray(loopDataEnd) ? loopDataEnd.length : 'N/A'}, iterationCount: ${iterationCount}`);

        if (Array.isArray(loopDataEnd) && loopCurrentIndexEnd !== undefined) {
          const nextIndex = loopCurrentIndexEnd + 1;

          if (nextIndex < loopDataEnd.length) {
            console.log(`[LOOP DEBUG] Continuing to next iteration: ${nextIndex}/${loopDataEnd.length}`);
            // Continue to next iteration
            const itemVariableName = this.contextService.getVariable(execution.context, '_loopItemVariable') || 'item';
            const indexVariableName = this.contextService.getVariable(execution.context, '_loopIndexVariable') || 'index';

            // Update loop variables for next iteration
            this.contextService.setVariable(execution.context, '_loopCurrentIndex', nextIndex);
            this.contextService.setVariable(execution.context, itemVariableName, loopDataEnd[nextIndex]);
            this.contextService.setVariable(execution.context, indexVariableName, nextIndex);

            // Increment iteration count
            const currentIterations = this.contextService.getVariable(execution.context, '_loopIterationsExecuted') || 0;
            this.contextService.setVariable(execution.context, '_loopIterationsExecuted', currentIterations + 1);

            // Find the loop edge to go back to loop body
            // Note: sourceHandle from React Flow is saved as 'condition' in WorkflowEdge
            const loopEdge = workflow.edges.find((e) => e.source === loopNodeId && e.condition === 'loop');
            const nextNodeId = loopEdge ? loopEdge.target : null;

            if (nextNodeId) {
              execution.currentNodeId = nextNodeId;
              await this.executionService.updateExecution(execution.id, {
                currentNodeId: nextNodeId,
                context: execution.context,
              });
              // Reload execution to ensure we have latest sessionId and contactId
              const updatedExecution = await this.executionService.getExecution(execution.tenantId, execution.id);
              if (updatedExecution) {
                execution.sessionId = updatedExecution.sessionId;
                execution.contactId = updatedExecution.contactId;
              }
              // Continue execution with next iteration
              continue;
            }
          } else {
            // Loop completed - go to 'done' edge
            // Note: sourceHandle from React Flow is saved as 'condition' in WorkflowEdge
            const doneEdge = workflow.edges.find((e) => e.source === loopNodeId && e.condition === 'done');
            const doneNodeId = doneEdge ? doneEdge.target : null;

            // Clear loop variables
            delete execution.context.variables['_loopNodeId'];
            delete execution.context.variables['_loopData'];
            delete execution.context.variables['_loopCurrentIndex'];
            delete execution.context.variables['_loopItemVariable'];
            delete execution.context.variables['_loopIndexVariable'];

            if (doneNodeId) {
              execution.currentNodeId = doneNodeId;
              await this.executionService.updateExecution(execution.id, {
                currentNodeId: doneNodeId,
                context: execution.context,
              });
              // Reload execution to ensure we have latest sessionId and contactId
              const updatedExecution = await this.executionService.getExecution(execution.tenantId, execution.id);
              if (updatedExecution) {
                execution.sessionId = updatedExecution.sessionId;
                execution.contactId = updatedExecution.contactId;
              }
              // Continue execution after loop
              continue;
            } else {
              // No done edge - complete execution
              await this.completeExecution(execution);
              return;
            }
          }
        }
      }

      const startTime = Date.now();

      // Ensure we have valid sessionId and contactId - reload from DB if needed
      if (!execution.sessionId || !execution.contactId) {
        const refreshedExecution = await this.executionService.getExecution(execution.tenantId, execution.id);
        if (refreshedExecution) {
          execution.sessionId = refreshedExecution.sessionId;
          execution.contactId = refreshedExecution.contactId;
        }
      }

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

      // Get output from result or from context (some nodes save output in context via setOutput)
      // Merge both to ensure we capture all output data
      const resultOutput = result.output || {};
      const contextOutput = execution.context.output || {};
      const nodeOutput = { ...contextOutput, ...resultOutput };

      // Emit node executed event with output and variables (for input display)
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
        output: nodeOutput,
        variables: execution.context.variables || {}, // Include variables for input display
        input: execution.context.input || {}, // Include explicit input if available
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
            console.log(`[WAIT] Scheduling auto-resume in ${waitMs}ms for execution ${execution.id}`);

            const timeoutId = setTimeout(async () => {
              // Remove from active timeouts
              this.activeTimeouts.delete(execution.id);

              // Acquire lock before resuming to prevent race conditions
              const lockKey = `execution:lock:${execution.tenantId}:${execution.sessionId}:${execution.contactId}`;
              let lockAcquired = false;

              try {
                lockAcquired = await this.redis.acquireLock(lockKey, 30);
                if (!lockAcquired) {
                  console.warn(`[WAIT] Could not acquire lock for execution ${execution.id}, retrying in 2s...`);
                  // Retry once after 2 seconds
                  await new Promise(r => setTimeout(r, 2000));
                  lockAcquired = await this.redis.acquireLock(lockKey, 30);
                  if (!lockAcquired) {
                    console.error(`[WAIT] Failed to acquire lock after retry for execution ${execution.id}`);
                    return;
                  }
                }

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
              } finally {
                if (lockAcquired) {
                  await this.redis.releaseLock(lockKey).catch((err: any) =>
                    console.error('[WAIT] Error releasing lock:', err)
                  );
                }
              }
            }, waitMs);

            // Store timeout for cleanup
            this.activeTimeouts.set(execution.id, timeoutId);
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

      // Check if END node (this check happens after node execution, so we already have result)
      // The check before execution (line 305) handles END nodes before they're executed
      // This check handles END nodes that were reached via nextNodeId from previous node
      if (currentNode.type === WorkflowNodeType.END) {
        // Check if we're inside a loop - if so, continue to next iteration instead of completing
        if (loopNodeId) {
          // We're inside a loop - continue iteration
          const loopDataEndCheck = this.contextService.getVariable(execution.context, '_loopData');
          const loopCurrentIndexEndCheck = this.contextService.getVariable(execution.context, '_loopCurrentIndex');

          console.log(`[LOOP DEBUG] END node reached (after execution), currentIndex: ${loopCurrentIndexEndCheck}, totalItems: ${Array.isArray(loopDataEndCheck) ? loopDataEndCheck.length : 'N/A'}, iterationCount: ${iterationCount}`);

          if (Array.isArray(loopDataEndCheck) && loopCurrentIndexEndCheck !== undefined) {
            const nextIndex = loopCurrentIndexEndCheck + 1;

            if (nextIndex < loopDataEndCheck.length) {
              console.log(`[LOOP DEBUG] Continuing to next iteration from END: ${nextIndex}/${loopDataEndCheck.length}`);
              // Continue to next iteration
              const itemVariableName = this.contextService.getVariable(execution.context, '_loopItemVariable') || 'item';
              const indexVariableName = this.contextService.getVariable(execution.context, '_loopIndexVariable') || 'index';

              // Update loop variables for next iteration
              this.contextService.setVariable(execution.context, '_loopCurrentIndex', nextIndex);
              this.contextService.setVariable(execution.context, itemVariableName, loopDataEndCheck[nextIndex]);
              this.contextService.setVariable(execution.context, indexVariableName, nextIndex);

              // Increment iteration count
              const currentIterations = this.contextService.getVariable(execution.context, '_loopIterationsExecuted') || 0;
              this.contextService.setVariable(execution.context, '_loopIterationsExecuted', currentIterations + 1);

              // Find the loop edge to go back to loop body
              // Note: sourceHandle from React Flow is saved as 'condition' in WorkflowEdge
              const loopEdge = workflow.edges.find((e) => e.source === loopNodeId && e.condition === 'loop');
              const nextNodeId = loopEdge ? loopEdge.target : null;

              if (nextNodeId) {
                execution.currentNodeId = nextNodeId;
                await this.executionService.updateExecution(execution.id, {
                  currentNodeId: nextNodeId,
                  context: execution.context,
                });
                // Reload execution to ensure we have latest sessionId and contactId
                const updatedExecution = await this.executionService.getExecution(execution.tenantId, execution.id);
                if (updatedExecution) {
                  execution.sessionId = updatedExecution.sessionId;
                  execution.contactId = updatedExecution.contactId;
                }
                // Continue execution with next iteration
                continue;
              }
            } else {
              // Loop completed - go to 'done' edge
              // Note: sourceHandle from React Flow is saved as 'condition' in WorkflowEdge
              const doneEdge = workflow.edges.find((e) => e.source === loopNodeId && e.condition === 'done');
              const doneNodeId = doneEdge ? doneEdge.target : null;

              // Clear loop variables
              delete execution.context.variables['_loopNodeId'];
              delete execution.context.variables['_loopData'];
              delete execution.context.variables['_loopCurrentIndex'];
              delete execution.context.variables['_loopItemVariable'];
              delete execution.context.variables['_loopIndexVariable'];

              if (doneNodeId) {
                execution.currentNodeId = doneNodeId;
                await this.executionService.updateExecution(execution.id, {
                  currentNodeId: doneNodeId,
                  context: execution.context,
                });
                // Continue execution after loop
                continue;
              } else {
                // No done edge - complete execution
                await this.completeExecution(execution);
                return;
              }
            }
          }
        } else {
          // Not in a loop - complete execution normally
          await this.completeExecution(execution);
          return;
        }
      }

      // Check if we're inside a loop and reached end of iteration (no next node)
      const loopDataNoNext = this.contextService.getVariable(execution.context, '_loopData');
      const loopCurrentIndexNoNext = this.contextService.getVariable(execution.context, '_loopCurrentIndex');

      // If we're in a loop and reached a node with no next, continue loop iteration
      if (loopNodeId && Array.isArray(loopDataNoNext) && loopCurrentIndexNoNext !== undefined && !result.nextNodeId) {
        const loopNode = workflow.nodes.find((n) => n.id === loopNodeId);

        console.log(`[LOOP DEBUG] Node with no next in loop, currentIndex: ${loopCurrentIndexNoNext}, totalItems: ${loopDataNoNext.length}, currentNodeId: ${execution.currentNodeId}, iterationCount: ${iterationCount}`);

        if (loopNode) {
          // Check if we've processed all items
          const nextIndex = loopCurrentIndexNoNext + 1;

          if (nextIndex < loopDataNoNext.length) {
            console.log(`[LOOP DEBUG] Continuing iteration: ${nextIndex}/${loopDataNoNext.length}`);
            // Continue to next iteration
            const itemVariableName = this.contextService.getVariable(execution.context, '_loopItemVariable') || 'item';
            const indexVariableName = this.contextService.getVariable(execution.context, '_loopIndexVariable') || 'index';

            // Update loop variables for next iteration
            this.contextService.setVariable(execution.context, '_loopCurrentIndex', nextIndex);
            this.contextService.setVariable(execution.context, itemVariableName, loopDataNoNext[nextIndex]);
            this.contextService.setVariable(execution.context, indexVariableName, nextIndex);

            // Increment iteration count
            const currentIterations = this.contextService.getVariable(execution.context, '_loopIterationsExecuted') || 0;
            this.contextService.setVariable(execution.context, '_loopIterationsExecuted', currentIterations + 1);

            // Find the loop edge to go back to loop body
            // Note: sourceHandle from React Flow is saved as 'condition' in WorkflowEdge
            const loopEdge = workflow.edges.find((e) => e.source === loopNodeId && e.condition === 'loop');
            const nextNodeId = loopEdge ? loopEdge.target : null;

            if (nextNodeId) {
              execution.currentNodeId = nextNodeId;
              await this.executionService.updateExecution(execution.id, {
                currentNodeId: nextNodeId,
                context: execution.context,
              });
              // Reload execution to ensure we have latest sessionId and contactId
              const updatedExecution = await this.executionService.getExecution(execution.tenantId, execution.id);
              if (updatedExecution) {
                execution.sessionId = updatedExecution.sessionId;
                execution.contactId = updatedExecution.contactId;
              }
              // Continue execution with next iteration
              continue;
            }
          } else {
            // Loop completed - go to 'done' edge
            // Note: sourceHandle from React Flow is saved as 'condition' in WorkflowEdge
            const doneEdge = workflow.edges.find((e) => e.source === loopNodeId && e.condition === 'done');
            const doneNodeId = doneEdge ? doneEdge.target : null;

            // Clear loop variables
            delete execution.context.variables['_loopNodeId'];
            delete execution.context.variables['_loopData'];
            delete execution.context.variables['_loopCurrentIndex'];
            delete execution.context.variables['_loopItemVariable'];
            delete execution.context.variables['_loopIndexVariable'];

            if (doneNodeId) {
              execution.currentNodeId = doneNodeId;
              await this.executionService.updateExecution(execution.id, {
                currentNodeId: doneNodeId,
                context: execution.context,
              });
              // Reload execution to ensure we have latest sessionId and contactId
              const updatedExecution = await this.executionService.getExecution(execution.tenantId, execution.id);
              if (updatedExecution) {
                execution.sessionId = updatedExecution.sessionId;
                execution.contactId = updatedExecution.contactId;
              }
              // Continue execution after loop
              continue;
            } else {
              // No done edge - complete execution
              await this.completeExecution(execution);
              return;
            }
          }
        }
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
    // Clean up any active timeouts
    this.cleanupExecutionTimeouts(execution.id);

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
    // Clean up any active timeouts
    this.cleanupExecutionTimeouts(execution.id);

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
    // Clean up any active timeouts
    this.cleanupExecutionTimeouts(execution.id);

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

  /**
   * Clean up timeouts for an execution
   */
  private cleanupExecutionTimeouts(executionId: string): void {
    const timeoutId = this.activeTimeouts.get(executionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.activeTimeouts.delete(executionId);
    }
  }

  /**
   * Test execution of a specific node (public method for testing)
   */
  async testNodeExecution(
    execution: WorkflowExecution,
    workflow: Workflow,
  ): Promise<void> {
    // Set status to RUNNING
    execution.status = ExecutionStatus.RUNNING;

    // Continue execution from the current node
    await this.continueExecution(execution, workflow);
  }
}

