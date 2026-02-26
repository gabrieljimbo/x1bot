import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionEngineService } from '../execution/execution-engine.service';
import { WorkflowNodeType } from '@n9n/shared';
import * as cron from 'node-cron';

interface ScheduledWorkflow {
  workflowId: string;
  tenantId: string;
  cronExpression?: string;
  intervalMinutes?: number;
  sessionId?: string;
  task?: cron.ScheduledTask;
  intervalId?: NodeJS.Timeout;
}

@Injectable()
export class ScheduleWorker implements OnModuleInit, OnModuleDestroy {
  private scheduledWorkflows: Map<string, ScheduledWorkflow> = new Map();
  private checkIntervalId: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    private executionEngine: ExecutionEngineService,
  ) {}

  async onModuleInit() {
    console.log('[SCHEDULE WORKER] Initializing...');
    
    // Load and schedule all active workflows with TRIGGER_SCHEDULE
    await this.loadScheduledWorkflows();

    // Check for new/updated workflows every minute
    this.checkIntervalId = setInterval(() => {
      this.loadScheduledWorkflows();
    }, 60 * 1000);
  }

  onModuleDestroy() {
    console.log('[SCHEDULE WORKER] Shutting down...');
    
    // Stop all scheduled tasks
    for (const [key, scheduled] of this.scheduledWorkflows.entries()) {
      this.stopScheduledWorkflow(key);
    }

    // Clear check interval
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
    }
  }

  /**
   * Load all active workflows with TRIGGER_SCHEDULE and schedule them
   */
  private async loadScheduledWorkflows(): Promise<void> {
    try {
      const workflows = await this.prisma.workflow.findMany({
        where: {
          isActive: true,
        },
      });

      const currentScheduledKeys = new Set<string>();

      for (const workflowData of workflows) {
        const workflow = {
          ...workflowData,
          nodes: workflowData.nodes as any,
          edges: workflowData.edges as any,
        };

        // Find TRIGGER_SCHEDULE node
        const triggerNode = workflow.nodes.find(
          (n: any) => n.type === WorkflowNodeType.TRIGGER_SCHEDULE,
        );

        if (!triggerNode || !triggerNode.config) {
          continue;
        }

        const config = triggerNode.config;
        const scheduleKey = `${workflow.tenantId}:${workflow.id}`;
        currentScheduledKeys.add(scheduleKey);

        // Check if already scheduled with same config
        const existing = this.scheduledWorkflows.get(scheduleKey);
        if (existing) {
          // Check if config changed
          const configChanged =
            existing.cronExpression !== config.cronExpression ||
            existing.intervalMinutes !== config.intervalMinutes ||
            existing.sessionId !== config.sessionId;

          if (!configChanged) {
            continue; // No changes, skip
          }

          // Config changed, stop and reschedule
          this.stopScheduledWorkflow(scheduleKey);
        }

        // Schedule the workflow
        await this.scheduleWorkflow(
          workflow.tenantId,
          workflow.id,
          config.scheduleType,
          config.cronExpression,
          config.intervalMinutes,
          config.sessionId,
        );
      }

      // Remove workflows that are no longer active or don't have TRIGGER_SCHEDULE
      for (const key of this.scheduledWorkflows.keys()) {
        if (!currentScheduledKeys.has(key)) {
          this.stopScheduledWorkflow(key);
        }
      }

      console.log(`[SCHEDULE WORKER] Scheduled ${this.scheduledWorkflows.size} workflow(s)`);
    } catch (error) {
      console.error('[SCHEDULE WORKER] Error loading scheduled workflows:', error);
    }
  }

  /**
   * Schedule a workflow
   */
  private async scheduleWorkflow(
    tenantId: string,
    workflowId: string,
    scheduleType: 'cron' | 'interval',
    cronExpression?: string,
    intervalMinutes?: number,
    sessionId?: string,
  ): Promise<void> {
    const scheduleKey = `${tenantId}:${workflowId}`;

    try {
      if (scheduleType === 'cron' && cronExpression) {
        // Validate cron expression
        if (!cron.validate(cronExpression)) {
          console.error(`[SCHEDULE WORKER] Invalid cron expression for workflow ${workflowId}: ${cronExpression}`);
          return;
        }

        // Schedule with cron
        const task = cron.schedule(cronExpression, async () => {
          await this.executeScheduledWorkflow(tenantId, workflowId, sessionId);
        });

        this.scheduledWorkflows.set(scheduleKey, {
          workflowId,
          tenantId,
          cronExpression,
          sessionId,
          task,
        });

        console.log(`[SCHEDULE WORKER] Scheduled workflow ${workflowId} with cron: ${cronExpression}`);
      } else if (scheduleType === 'interval' && intervalMinutes) {
        // Schedule with interval
        const intervalMs = intervalMinutes * 60 * 1000;
        const intervalId = setInterval(async () => {
          await this.executeScheduledWorkflow(tenantId, workflowId, sessionId);
        }, intervalMs);

        this.scheduledWorkflows.set(scheduleKey, {
          workflowId,
          tenantId,
          intervalMinutes,
          sessionId,
          intervalId,
        });

        console.log(`[SCHEDULE WORKER] Scheduled workflow ${workflowId} with interval: ${intervalMinutes} minutes`);
      }
    } catch (error) {
      console.error(`[SCHEDULE WORKER] Error scheduling workflow ${workflowId}:`, error);
    }
  }

  /**
   * Stop a scheduled workflow
   */
  private stopScheduledWorkflow(scheduleKey: string): void {
    const scheduled = this.scheduledWorkflows.get(scheduleKey);
    if (!scheduled) return;

    if (scheduled.task) {
      scheduled.task.stop();
    }

    if (scheduled.intervalId) {
      clearInterval(scheduled.intervalId);
    }

    this.scheduledWorkflows.delete(scheduleKey);
    console.log(`[SCHEDULE WORKER] Stopped workflow ${scheduled.workflowId}`);
  }

  /**
   * Execute a scheduled workflow
   */
  private async executeScheduledWorkflow(
    tenantId: string,
    workflowId: string,
    configuredSessionId?: string,
  ): Promise<void> {
    try {
      console.log(`[SCHEDULE WORKER] Executing scheduled workflow ${workflowId}`);

      let sessionId: string;

      if (configuredSessionId) {
        // Use the configured session
        const session = await this.prisma.whatsappSession.findFirst({
          where: {
            id: configuredSessionId,
            tenantId,
            status: 'CONNECTED',
          },
        });

        if (!session) {
          console.error(`[SCHEDULE WORKER] Configured session ${configuredSessionId} not found or not connected for tenant ${tenantId}`);
          return;
        }

        sessionId = session.id;
        console.log(`[SCHEDULE WORKER] Using configured session: ${session.name} (${session.phoneNumber})`);
      } else {
        // Get the first connected WhatsApp session for this tenant
        const session = await this.prisma.whatsappSession.findFirst({
          where: {
            tenantId,
            status: 'CONNECTED',
          },
        });

        if (!session) {
          console.error(`[SCHEDULE WORKER] No connected WhatsApp session found for tenant ${tenantId}`);
          return;
        }

        sessionId = session.id;
        console.log(`[SCHEDULE WORKER] Using first available session: ${session.name} (${session.phoneNumber})`);
      }

      // For scheduled workflows, use a unique contact ID for each execution
      // This prevents conflicts when multiple scheduled executions run
      const timestamp = Date.now();
      const contactPhone = `scheduled-${workflowId}-${timestamp}`;

      await this.executionEngine.startExecution(
        tenantId,
        workflowId,
        sessionId,
        contactPhone,
        undefined, // no trigger message for scheduled workflows
      );

      console.log(`[SCHEDULE WORKER] Successfully started execution for workflow ${workflowId} with contactPhone: ${contactPhone}`);
    } catch (error) {
      console.error(`[SCHEDULE WORKER] Error executing workflow ${workflowId}:`, error);
    }
  }
}

