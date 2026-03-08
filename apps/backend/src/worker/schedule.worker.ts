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
  private isLoadingWorkflows = false;

  constructor(
    private prisma: PrismaService,
    private executionEngine: ExecutionEngineService,
  ) { }

  async onModuleInit() {
    console.log('[SCHEDULE WORKER] Initializing...');
    await this.loadScheduledWorkflows();

    // Run immediately on startup (handles server restarts within target minute)
    this.processGroupTriggers().catch(err =>
      console.error('[SCHEDULE WORKER] Error in initial processGroupTriggers:', err),
    );

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
    // Collect keys before iterating — stopScheduledWorkflow deletes from the Map
    for (const key of Array.from(this.scheduledWorkflows.keys())) {
      this.stopScheduledWorkflow(key);
    }
    if (this.checkIntervalId) clearInterval(this.checkIntervalId);
    if (this.groupTriggerIntervalId) clearInterval(this.groupTriggerIntervalId);
  }

  /**
   * Process TRIGGER_GRUPO – fires workflows linked to groups.
   * Source of truth: GroupWorkflowLink (unifying system as requested).
   * Also keeps checking WhatsappGroupConfig.workflowIds for temporary backward compatibility.
   */
  private async processGroupTriggers(): Promise<void> {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const today = new Date();
      today.setHours(0, 0, 0, 0);


      // --- Collect links from GroupWorkflowLink (New System) ---
      const activeLinks = await this.prisma.groupWorkflowLink.findMany({
        where: { isActive: true },
      });

      // --- Collect links from WhatsappGroupConfig (Legacy System) ---
      const groupConfigs = await this.prisma.whatsappGroupConfig.findMany({
        where: { enabled: true },
      });

      // Internal interface for unified processing
      interface UnifiedLink {
        id?: string;
        groupJid: string;
        groupName: string;
        workflowId: string;
        sessionId?: string;
        tenantId: string;
        activatedAt: Date;
      }

      const effectiveLinks: UnifiedLink[] = [];

      // Add actual links
      for (const al of activeLinks) {
        effectiveLinks.push({
          id: al.id,
          groupJid: al.groupJid,
          groupName: al.groupName || al.groupJid,
          workflowId: al.workflowId,
          tenantId: al.tenantId,
          activatedAt: al.activatedAt || al.createdAt,
        });
      }

      // Add legacy links if not already present
      for (const gc of groupConfigs) {
        const workflowIds = Array.isArray(gc.workflowIds) ? (gc.workflowIds as string[]) : [];
        if (!workflowIds.length) continue;

        const session = await this.prisma.whatsappSession.findUnique({
          where: { id: gc.sessionId },
        });
        if (!session) continue;

        for (const wfId of workflowIds) {
          const alreadyAdded = effectiveLinks.some(l => l.groupJid === gc.groupId && l.workflowId === wfId);
          if (!alreadyAdded) {
            effectiveLinks.push({
              groupJid: gc.groupId,
              groupName: gc.name || gc.groupId,
              workflowId: wfId,
              sessionId: gc.sessionId,
              tenantId: session.tenantId,
              activatedAt: gc.createdAt,
            });
          }
        }
      }

      for (const link of effectiveLinks) {
        try {
          const workflowData = await this.prisma.workflow.findUnique({
            where: { id: link.workflowId },
          });
          if (!workflowData || !workflowData.isActive) continue;

          const nodes = workflowData.nodes as any[];
          const triggerNode = nodes.find((n: any) => n.type === 'TRIGGER_GRUPO');

          // ── Case A: No TRIGGER_GRUPO node, or immediate mode ──────────────
          // Fire once as soon as the link is active (no time-matching needed).
          const isImmediate =
            !triggerNode?.config?.executions?.length ||
            triggerNode?.config?.mode === 'immediate';

          if (isImmediate) {
            const alreadyFired = await this.prisma.groupTriggerExecution.findFirst({
              where: { groupJid: link.groupJid, workflowId: link.workflowId, type: 'immediate' },
            });
            if (alreadyFired) continue;

            const session = await this.prisma.whatsappSession.findFirst({
              where: { tenantId: link.tenantId, status: 'CONNECTED' },
            });
            if (!session) {
              console.warn(`[GROUP TRIGGER] No connected session for tenant ${link.tenantId} (immediate).`);
              continue;
            }

            console.log(`[GROUP TRIGGER] Firing IMMEDIATE for workflow ${link.workflowId}, group ${link.groupJid}`);
            await this.prisma.groupTriggerExecution.create({
              data: { groupJid: link.groupJid, workflowId: link.workflowId, executionDay: null, type: 'immediate', status: 'COMPLETED', tenantId: link.tenantId },
            });
            try {
              await this.executionEngine.startExecution(link.tenantId, link.workflowId, session.id, link.groupJid, undefined, undefined, {
                triggerType: 'TRIGGER_GRUPO',
                initialContext: { variables: { groupJid: link.groupJid, groupName: link.groupName, contact: { name: link.groupName, phoneNumber: link.groupJid, groupJid: link.groupJid, isGroup: true } } },
              });
            } catch (execErr) {
              console.error(`[GROUP TRIGGER] Immediate startExecution failed for ${link.workflowId}:`, execErr);
            }
            continue;
          }

          // ── Case B: Scheduled modes (daily / days_after / fixed_date) ─────
          const daysSinceActivation = Math.floor(
            (now.getTime() - new Date(link.activatedAt).getTime()) / (1000 * 60 * 60 * 24),
          );

          const isDaily = triggerNode.config.mode === 'daily' || triggerNode.config.repeatSequence === true;

          for (const exec of triggerNode.config.executions) {
            let shouldFire = false;

            if (exec.type === 'days_after') {
              const execDay = parseInt(exec.day ?? '0');
              const [execHour, execMinute] = (exec.time || '09:00').split(':').map(Number);

              if (isDaily) {
                if (execHour === currentHour && execMinute === currentMinute) {
                  shouldFire = true;
                }
              } else {
                if (daysSinceActivation === execDay && execHour === currentHour && execMinute === currentMinute) {
                  shouldFire = true;
                }
              }
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

            const executionDay = exec.type === 'days_after' ? (isDaily ? null : daysSinceActivation) : null;

            // Check if already fired — for daily mode, scope dedup to the specific time slot
            // (supports multiple daily firings at different hours)
            let alreadyFired: any;
            if (isDaily && exec.type === 'days_after') {
              const slotStart = new Date(today);
              slotStart.setHours(currentHour, currentMinute, 0, 0);
              const slotEnd = new Date(today);
              slotEnd.setHours(currentHour, currentMinute, 59, 999);
              alreadyFired = await this.prisma.groupTriggerExecution.findFirst({
                where: {
                  groupJid: link.groupJid,
                  workflowId: link.workflowId,
                  type: exec.type,
                  executedAt: { gte: slotStart, lte: slotEnd },
                },
              });
            } else {
              alreadyFired = await this.prisma.groupTriggerExecution.findFirst({
                where: {
                  groupJid: link.groupJid,
                  workflowId: link.workflowId,
                  executionDay: executionDay,
                  type: exec.type,
                  executedAt: { gte: today },
                },
              });
            }

            if (alreadyFired) {
              console.log(`[GROUP TRIGGER] Already fired day=${executionDay} time=${currentHour}:${String(currentMinute).padStart(2,'0')} for ${link.groupJid}. Skipping.`);
              continue;
            }

            // Find a connected session
            const session = await this.prisma.whatsappSession.findFirst({
              where: {
                tenantId: link.tenantId,
                status: 'CONNECTED',
                ...(link.sessionId ? { id: link.sessionId } : {})
              },
            });

            if (!session) {
              if (!triggerNode.config.ignoreIfOffline) {
                console.warn(`[GROUP TRIGGER] No connected session for tenant ${link.tenantId}.`);
              }
              continue;
            }

            console.log(`[GROUP TRIGGER] Firing workflow ${link.workflowId} for group ${link.groupJid} (day ${executionDay})`);

            // *** CRITICAL: Save execution record BEFORE firing ***
            console.log(`[SCHEDULE WORKER] Saved execution record BEFORE dispatch (group=${link.groupJid}, workflow=${link.workflowId})`);
            await this.prisma.groupTriggerExecution.create({
              data: {
                groupJid: link.groupJid,
                workflowId: link.workflowId,
                executionDay,
                type: exec.type,
                status: 'COMPLETED',
                tenantId: link.tenantId,
              },
            });

            try {
              await this.executionEngine.startExecution(
                link.tenantId,
                link.workflowId,
                session.id,
                link.groupJid,
                undefined,
                undefined,
                {
                  triggerType: 'TRIGGER_GRUPO',
                  initialContext: {
                    variables: {
                      groupJid: link.groupJid,
                      groupName: link.groupName,
                      contact: {
                        name: link.groupName,
                        phoneNumber: link.groupJid,
                        groupJid: link.groupJid,
                        isGroup: true
                      }
                    }
                  }
                }
              );
              console.log(`[GROUP TRIGGER] startExecution completed for workflow ${link.workflowId} group ${link.groupJid}`);
            } catch (execErr) {
              console.error(`[GROUP TRIGGER] startExecution failed for workflow ${link.workflowId}:`, execErr);
            }
          }
        } catch (err) {
          console.error(`[GROUP TRIGGER] Error processing link for group ${link.groupJid}:`, err);
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
    if (this.isLoadingWorkflows) return;
    this.isLoadingWorkflows = true;
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
    } catch (error) {
      console.error('[SCHEDULE WORKER] Error loading scheduled workflows:', error);
    } finally {
      this.isLoadingWorkflows = false;
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
    // Guard against duplicate registration (e.g. concurrent loadScheduledWorkflows calls)
    if (this.scheduledWorkflows.has(scheduleKey)) {
      console.warn(`[SCHEDULE WORKER] Duplicate schedule attempt for ${workflowId}, skipping.`);
      return;
    }
    try {
      if (scheduleType === 'cron' && cronExpression) {
        if (!cron.validate(cronExpression)) {
          console.error(`[SCHEDULE WORKER] Invalid cron for workflow ${workflowId}: ${cronExpression}`);
          return;
        }

        const task = cron.schedule(cronExpression, async () => {
          await this.executeScheduledWorkflow(tenantId, workflowId, sessionId);
        }, { timezone: 'America/Sao_Paulo' });

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
        undefined,
        {
          triggerType: WorkflowNodeType.TRIGGER_SCHEDULE
        }
      );

      console.log(`[SCHEDULE WORKER] Started execution for ${workflowId} with contactPhone: ${contactPhone}`);
    } catch (error) {
      console.error(`[SCHEDULE WORKER] Error executing workflow ${workflowId}:`, error);
    }
  }
}
