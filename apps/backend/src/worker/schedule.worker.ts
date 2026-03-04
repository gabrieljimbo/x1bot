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
  private groupTriggerIntervalId: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    private executionEngine: ExecutionEngineService,
  ) { }

  async onModuleInit() {
    console.log('[SCHEDULE WORKER] Initializing...');
    await this.loadScheduledWorkflows();

    // Check for new/updated workflows every minute
    this.checkIntervalId = setInterval(() => {
      this.loadScheduledWorkflows();
    }, 60 * 1000);

    // Check group triggers every minute
    this.groupTriggerIntervalId = setInterval(() => {
      this.processGroupTriggers();
    }, 60 * 1000);
  }

  onModuleDestroy() {
    console.log('[SCHEDULE WORKER] Shutting down...');
    for (const [key] of this.scheduledWorkflows.entries()) {
      this.stopScheduledWorkflow(key);
    }
    if (this.checkIntervalId) clearInterval(this.checkIntervalId);
    if (this.groupTriggerIntervalId) clearInterval(this.groupTriggerIntervalId);
  }

  /**
   * Process TRIGGER_GRUPO – fires workflows for active group links based on
   * days elapsed since activatedAt, or on a specific fixed date.
   */
  private async processGroupTriggers(): Promise<void> {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const activeLinks = await this.prisma.groupWorkflowLink.findMany({
        where: { isActive: true },
      });

      for (const link of activeLinks) {
        try {
          const workflowData = await this.prisma.workflow.findUnique({
            where: { id: link.workflowId },
          });
          if (!workflowData || !workflowData.isActive) continue;

          const nodes = workflowData.nodes as any[];
          const triggerNode = nodes.find((n: any) => n.type === 'TRIGGER_GRUPO');
          if (!triggerNode?.config?.executions?.length) continue;

          const daysSinceActivation = Math.floor(
            (now.getTime() - new Date(link.activatedAt).getTime()) / (1000 * 60 * 60 * 24),
          );

          for (const exec of triggerNode.config.executions) {
            let shouldFire = false;

            if (exec.type === 'days_after') {
              const execDay = parseInt(exec.day ?? '0');
              if (daysSinceActivation !== execDay) continue;
              const [execHour, execMinute] = (exec.time || '09:00').split(':').map(Number);
              if (execHour !== currentHour || execMinute !== currentMinute) continue;
              shouldFire = true;
            } else if (exec.type === 'fixed_date' && exec.date) {
              const execDate = new Date(`${exec.date}T${exec.time || '09:00'}:00`);
              if (
                execDate.getFullYear() === now.getFullYear() &&
                execDate.getMonth() === now.getMonth() &&
                execDate.getDate() === now.getDate() &&
                execDate.getHours() === currentHour &&
                execDate.getMinutes() === currentMinute
              ) {
                shouldFire = true;
              }
            }

            if (!shouldFire) continue;

            const executionDay = exec.type === 'days_after' ? daysSinceActivation : null;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const alreadyFired = await this.prisma.groupTriggerExecution.findFirst({
              where: {
                groupJid: link.groupJid,
                workflowId: link.workflowId,
                executionDay,
                executedAt: { gte: today },
              },
            });

            if (alreadyFired) {
              console.log(`[GROUP TRIGGER] Already fired day=${executionDay} for ${link.groupJid}. Skipping.`);
              continue;
            }

            const session = await this.prisma.whatsappSession.findFirst({
              where: { tenantId: link.tenantId, status: 'CONNECTED' },
            });

            if (!session) {
              if (!triggerNode.config.ignoreIfOffline) {
                console.warn(`[GROUP TRIGGER] No connected session for tenant ${link.tenantId}.`);
              }
              continue;
            }

            console.log(`[GROUP TRIGGER] Firing workflow ${link.workflowId} for group ${link.groupJid} (day ${executionDay})`);

            await this.executionEngine.startExecution(
              link.tenantId,
              link.workflowId,
              session.id,
              link.groupJid,
              undefined,
            );

            await this.prisma.groupTriggerExecution.create({
              data: {
                groupJid: link.groupJid,
                workflowId: link.workflowId,
                executionDay,
                tenantId: link.tenantId,
              },
            });
          }
        } catch (err) {
          console.error(`[GROUP TRIGGER] Error processing link ${link.id}:`, err);
        }
      }
    } catch (error) {
      console.error('[GROUP TRIGGER] Error in processGroupTriggers:', error);
    }
  }

  /**
   * Load all active workflows with TRIGGER_SCHEDULE and schedule them.
   */
  private async loadScheduledWorkflows(): Promise<void> {
    try {
      const workflows = await this.prisma.workflow.findMany({ where: { isActive: true } });
      const currentScheduledKeys = new Set<string>();

      for (const workflowData of workflows) {
        const workflow = {
          ...workflowData,
          nodes: workflowData.nodes as any,
          edges: workflowData.edges as any,
        };

        const triggerNode = workflow.nodes.find(
          (n: any) => n.type === WorkflowNodeType.TRIGGER_SCHEDULE,
        );
        if (!triggerNode || !triggerNode.config) continue;

        const config = triggerNode.config;
        const scheduleKey = `${workflow.tenantId}:${workflow.id}`;
        currentScheduledKeys.add(scheduleKey);

        const existing = this.scheduledWorkflows.get(scheduleKey);
        if (existing) {
          const configChanged =
            existing.cronExpression !== config.cronExpression ||
            existing.intervalMinutes !== config.intervalMinutes ||
            existing.sessionId !== config.sessionId;

          if (!configChanged) continue;
          this.stopScheduledWorkflow(scheduleKey);
        }

        await this.scheduleWorkflow(
          workflow.tenantId,
          workflow.id,
          config.scheduleType,
          config.cronExpression,
          config.intervalMinutes,
          config.sessionId,
        );
      }

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
        if (!cron.validate(cronExpression)) {
          console.error(`[SCHEDULE WORKER] Invalid cron for workflow ${workflowId}: ${cronExpression}`);
          return;
        }

        const task = cron.schedule(cronExpression, async () => {
          await this.executeScheduledWorkflow(tenantId, workflowId, sessionId);
        });

        this.scheduledWorkflows.set(scheduleKey, { workflowId, tenantId, cronExpression, sessionId, task });
        console.log(`[SCHEDULE WORKER] Scheduled ${workflowId} with cron: ${cronExpression}`);
      } else if (scheduleType === 'interval' && intervalMinutes) {
        const intervalMs = intervalMinutes * 60 * 1000;
        const intervalId = setInterval(async () => {
          await this.executeScheduledWorkflow(tenantId, workflowId, sessionId);
        }, intervalMs);

        this.scheduledWorkflows.set(scheduleKey, { workflowId, tenantId, intervalMinutes, sessionId, intervalId });
        console.log(`[SCHEDULE WORKER] Scheduled ${workflowId} with interval: ${intervalMinutes} minutes`);
      }
    } catch (error) {
      console.error(`[SCHEDULE WORKER] Error scheduling workflow ${workflowId}:`, error);
    }
  }

  private stopScheduledWorkflow(scheduleKey: string): void {
    const scheduled = this.scheduledWorkflows.get(scheduleKey);
    if (!scheduled) return;
    if (scheduled.task) scheduled.task.stop();
    if (scheduled.intervalId) clearInterval(scheduled.intervalId);
    this.scheduledWorkflows.delete(scheduleKey);
    console.log(`[SCHEDULE WORKER] Stopped workflow ${scheduled.workflowId}`);
  }

  private async executeScheduledWorkflow(
    tenantId: string,
    workflowId: string,
    configuredSessionId?: string,
  ): Promise<void> {
    try {
      console.log(`[SCHEDULE WORKER] Executing workflow ${workflowId}`);

      let sessionId: string;

      if (configuredSessionId) {
        const session = await this.prisma.whatsappSession.findFirst({
          where: { id: configuredSessionId, tenantId, status: 'CONNECTED' },
        });
        if (!session) {
          console.error(`[SCHEDULE WORKER] Session ${configuredSessionId} not found or disconnected.`);
          return;
        }
        sessionId = session.id;
        console.log(`[SCHEDULE WORKER] Using session: ${session.name} (${session.phoneNumber})`);
      } else {
        const session = await this.prisma.whatsappSession.findFirst({
          where: { tenantId, status: 'CONNECTED' },
        });
        if (!session) {
          console.error(`[SCHEDULE WORKER] No connected session for tenant ${tenantId}`);
          return;
        }
        sessionId = session.id;
        console.log(`[SCHEDULE WORKER] Using first available session: ${session.name} (${session.phoneNumber})`);
      }

      const timestamp = Date.now();
      const contactPhone = `scheduled-${workflowId}-${timestamp}`;

      await this.executionEngine.startExecution(
        tenantId,
        workflowId,
        sessionId,
        contactPhone,
        undefined,
      );

      console.log(`[SCHEDULE WORKER] Started execution for ${workflowId} with contactPhone: ${contactPhone}`);
    } catch (error) {
      console.error(`[SCHEDULE WORKER] Error executing workflow ${workflowId}:`, error);
    }
  }
}
