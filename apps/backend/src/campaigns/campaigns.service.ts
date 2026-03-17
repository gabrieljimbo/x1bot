import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappSessionManager } from '../whatsapp/whatsapp-session-manager.service';
import { ExecutionEngineService } from '../execution/execution-engine.service';
import { CampaignStatus, CampaignType, Prisma } from '@prisma/client';
import { StorageService } from '../storage/storage.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventBusService } from '../event-bus/event-bus.service';
import { EventType } from '@n9n/shared';
import { SessionHealthMonitorService } from '../whatsapp/session-health-monitor.service';
import { parseSpintax, hasSpintax } from '../whatsapp/spintax.util';
import { ContactReputationService } from './contact-reputation.service';
import { CampaignSettingsService } from './campaign-settings.service';
import { RedisService } from '../redis/redis.service';
import { QueueDiagnosticService } from './queue-diagnostic.service';
import { EmergencyModeService } from './emergency-mode.service';
import { PushNotificationService } from '../whatsapp/push-notification.service';

// ─── Absolute safety ceilings (user config is applied up to these limits) ────
// These must be >= schema defaults (limitPerSession=50, maxPerHour=100, maxPerMinute=5)
// so that user-configured values are never silently overridden.
const HARD_MAX_PER_DAY = 200;
const HARD_MAX_PER_HOUR = 120;
const HARD_MAX_PER_MINUTE = 10;
const ALLOWED_HOUR_START_SP = 8;   // 08:00 Brasília
const ALLOWED_HOUR_END_SP = 20;    // 20:00 Brasília
const MIN_HEALTH_SCORE_TO_SEND = 40;
const RECIPIENT_COOLDOWN_MS = 60_000; // 60s same recipient across sessions (kept for reference)

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappSessionManager: WhatsappSessionManager,
    private readonly executionEngine: ExecutionEngineService,
    private readonly storageService: StorageService,
    private readonly eventBus: EventBusService,
    private readonly healthMonitor: SessionHealthMonitorService,
    private readonly reputation: ContactReputationService,
    private readonly campaignSettings: CampaignSettingsService,
    private readonly redis: RedisService,
    private readonly queueDiagnostic: QueueDiagnosticService,
    private readonly emergencyMode: EmergencyModeService,
    private readonly pushNotification: PushNotificationService,
  ) { }

  private processingCampaigns = new Set<string>();
  // Track last send timestamp per recipient (kept for legacy reference; active lock is now Redis-based)
  private recentRecipients = new Map<string, number>();

  // Redis key for cross-session active lock per recipient
  private kActiveRecipient = (tenantId: string, phone: string) => `wa:active:${tenantId}:${phone}`;

  /**
   * Daily reset at 09:00 São Paulo: clears DMS state for all active sessions.
   * Runs at 12:00 UTC (09:00 BRT / America/Sao_Paulo).
   */
  @Cron('0 12 * * *') // 09:00 BRT = 12:00 UTC
  async handleDailyReset() {
    try {
      const sessions = await this.prisma.whatsappSession.findMany({
        where: { status: { in: ['CONNECTED', 'OPEN'] } },
        select: { id: true },
      });
      for (const session of sessions) {
        await this.healthMonitor.resetDmsState(session.id);
        console.log(`[RESET] Sessão ${session.id}: contadores diários + DMS resetados às 09:00`);
      }
    } catch (err) {
      console.error('[RESET] Erro no daily reset:', err);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCampaignScheduler() {
    // Purge stale entries from recentRecipients (older than 2 minutes)
    const staleThreshold = Date.now() - 120_000;
    for (const [key, ts] of this.recentRecipients) {
      if (ts < staleThreshold) this.recentRecipients.delete(key);
    }
    const now = new Date();
    
    // 1. Auto-start scheduled campaigns
    const toStart = await this.prisma.campaign.findMany({
      where: {
        status: CampaignStatus.SCHEDULED,
        scheduledAt: { lte: now }
      }
    });

    for (const c of toStart) {
      console.log(`[CAMPAIGN SCHEDULER] Starting scheduled campaign: ${c.name} (${c.id})`);
      await this.prisma.campaign.update({
        where: { id: c.id },
        data: { status: CampaignStatus.RUNNING, startedAt: now }
      });
      this.processCampaign(c.id).catch(err => console.error(`[CAMPAIGN SCHEDULER] Error starting ${c.id}:`, err));
    }

    // 2. Auto-resume running campaigns (important for DAILY limits or server restarts)
    const running = await this.prisma.campaign.findMany({
      where: { status: CampaignStatus.RUNNING }
    });

    for (const c of running) {
      if (!this.processingCampaigns.has(c.id)) {
        const hasPending = await this.prisma.campaignRecipient.count({
          where: { campaignId: c.id, status: 'pending' }
        });
        
        if (hasPending > 0) {
          this.processCampaign(c.id).catch(err => console.error(`[CAMPAIGN SCHEDULER] Error resuming ${c.id}:`, err));
        }
      }
    }
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  async createCampaign(tenantId: string, dto: {
    name: string;
    type?: CampaignType;
    workflowId?: string;
    isTemplate?: boolean;
    scheduledAt?: Date;
    limitPerSession?: number;
    delayMin?: number;
    delayMax?: number;
    randomOrder?: boolean;
    excludeBlocked?: boolean;
    limitType?: any;
    dailyResetTime?: string;
    maxPerHour?: number;
    maxPerMinute?: number;
    errorThreshold?: number;
    allowedDays?: number[];
    sessionIds?: string[];
    messages?: { order: number; type: string; content?: string; mediaUrl?: string; caption?: string }[];
  }) {
    const campaign = await this.prisma.campaign.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type ?? CampaignType.SIMPLE,
        workflowId: dto.workflowId ?? null,
        isTemplate: dto.isTemplate ?? false,
        scheduledAt: dto.scheduledAt,
        limitPerSession: dto.limitPerSession ?? 50,
        delayMin: dto.delayMin ?? 5,
        delayMax: dto.delayMax ?? 30,
        randomOrder: dto.randomOrder ?? true,
        excludeBlocked: dto.excludeBlocked ?? true,
        limitType: (dto.limitType ?? 'TOTAL') as any,
        dailyResetTime: dto.dailyResetTime ?? '09:00',
        maxPerHour: dto.maxPerHour ?? 100,
        maxPerMinute: dto.maxPerMinute ?? 5,
        errorThreshold: dto.errorThreshold ?? 30,
        allowedDays: dto.allowedDays ?? [0, 1, 2, 3, 4, 5, 6],
      } as any,
    });

    if (dto.sessionIds && dto.sessionIds.length > 0) {
      await this.prisma.campaignSession.createMany({
        data: dto.sessionIds.map((sessionId) => ({ campaignId: campaign.id, sessionId })),
      });
    }

    if (dto.messages && dto.messages.length > 0) {
      await this.prisma.campaignMessage.createMany({
        data: dto.messages.map((m) => ({ campaignId: campaign.id, ...m })),
      });
    }

    // Workflow-specific handling
    if (dto.type === CampaignType.WORKFLOW) {
      if (dto.workflowId) {
        // Copy nodes/edges from template if provided
        const templateWf = await this.prisma.campaignWorkflow.findUnique({
          where: { campaignId: dto.workflowId }
        });
        if (templateWf) {
          await this.prisma.campaignWorkflow.create({
            data: {
              campaignId: campaign.id,
              nodes: templateWf.nodes as any,
              edges: templateWf.edges as any,
            }
          });
        }
      } else {
        // New empty workflow
        await this.prisma.campaignWorkflow.create({
          data: {
            campaignId: campaign.id,
            nodes: [],
            edges: [],
          },
        });
      }
    }

    return this.getCampaignById(tenantId, campaign.id);
  }

  async updateCampaign(tenantId: string, campaignId: string, dto: {
    name?: string;
    workflowId?: string | null;
    isTemplate?: boolean;
    scheduledAt?: Date | null;
    limitPerSession?: number;
    delayMin?: number;
    delayMax?: number;
    randomOrder?: boolean;
    excludeBlocked?: boolean;
    limitType?: any;
    dailyResetTime?: string;
    maxPerHour?: number;
    maxPerMinute?: number;
    errorThreshold?: number;
    allowedDays?: number[];
    sessionIds?: string[];
    messages?: { order: number; type: string; content?: string; mediaUrl?: string; caption?: string }[];
  }) {
    await this.assertCampaignBelongs(tenantId, campaignId);
    const { sessionIds, messages, ...rest } = dto;

    await this.prisma.campaign.update({ where: { id: campaignId }, data: rest as any });

    if (sessionIds !== undefined) {
      await this.prisma.campaignSession.deleteMany({ where: { campaignId } });
      if (sessionIds.length > 0) {
        await this.prisma.campaignSession.createMany({
          data: sessionIds.map((sessionId) => ({ campaignId, sessionId })),
        });
      }
    }

    if (messages !== undefined) {
      await this.prisma.campaignMessage.deleteMany({ where: { campaignId } });
      if (messages.length > 0) {
        await this.prisma.campaignMessage.createMany({
          data: messages.map((m) => ({ campaignId, ...m })),
        });
      }
    }

    return this.getCampaignById(tenantId, campaignId);
  }

  async deleteCampaign(tenantId: string, campaignId: string) {
    await this.assertCampaignBelongs(tenantId, campaignId);
    
    // 1. Clean up media files associated with the campaign workflow
    const mediaFiles = await this.prisma.mediaFile.findMany({
      where: { workflowId: campaignId, tenantId },
    });

    for (const file of mediaFiles) {
      try {
        await this.storageService.deleteMedia(file.objectName);
      } catch (err) {
        console.warn(`[CampaignsService] Failed to delete media ${file.objectName} from storage:`, err);
      }
    }

    if (mediaFiles.length > 0) {
      await this.prisma.mediaFile.deleteMany({
        where: { id: { in: mediaFiles.map(f => f.id) } }
      });
      console.log(`[CampaignsService] Deleted ${mediaFiles.length} media files for campaign ${campaignId}`);
    }

    // 1.5. Clean up shadow workflow if exists
    try {
      await this.prisma.workflow.deleteMany({
        where: { id: `shadow-${campaignId}`, tenantId }
      });
    } catch (err) {
      // Ignore if doesn't exist
    }

    // 2. Delete the campaign (related CampaignWorkflow and Recipient records will be deleted by Cascade if configured, 
    // but PRISMA usually requires manual handling or onDelete: Cascade in schema)
    await this.prisma.campaign.delete({ where: { id: campaignId } });
    
    return { success: true };
  }

  async getCampaigns(tenantId: string, type?: CampaignType, isTemplate?: boolean) {
    return this.prisma.campaign.findMany({
      where: {
        tenantId,
        ...(type ? { type } : {}),
        ...(isTemplate !== undefined ? { isTemplate } : {})
      },
      include: {
        messages: { orderBy: { order: 'asc' } },
        sessions: true,
        contactLists: { include: { contactList: true } },
        _count: { select: { recipients: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCampaignById(tenantId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
      include: {
        messages: { orderBy: { order: 'asc' } },
        sessions: true,
        workflow: true,
        contactLists: { include: { contactList: true } },
        _count: { select: { recipients: true } },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async duplicateCampaign(tenantId: string, campaignId: string) {
    const original = await this.prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
      include: {
        messages: true,
        sessions: true,
        workflow: true,
      },
    });

    if (!original) throw new NotFoundException('Campanha original não encontrada');

    // Create cloned campaign
    const clone = await this.prisma.campaign.create({
      data: {
        tenantId,
        name: `${original.name} (Cópia)`,
        type: original.type,
        workflowId: original.workflowId,
        isTemplate: original.isTemplate,
        limitPerSession: original.limitPerSession,
        delayMin: original.delayMin,
        delayMax: original.delayMax,
        randomOrder: original.randomOrder,
        excludeBlocked: original.excludeBlocked,
        limitType: (original as any).limitType as any,
        dailyResetTime: (original as any).dailyResetTime ?? '09:00',
        status: CampaignStatus.DRAFT,
      } as any,
      include: { messages: true, workflow: true, sessions: true }
    });

    // Clone sessions
    if (original.sessions.length > 0) {
      await this.prisma.campaignSession.createMany({
        data: original.sessions.map(s => ({
          campaignId: clone.id,
          sessionId: s.sessionId,
        })),
      });
    }

    // Clone messages
    if (original.messages.length > 0) {
      await this.prisma.campaignMessage.createMany({
        data: original.messages.map(m => ({
          campaignId: clone.id,
          order: m.order,
          type: m.type,
          content: m.content,
          mediaUrl: m.mediaUrl,
          caption: m.caption,
        })),
      });
    }

    // Clone campaign-specific workflow
    if (original.workflow) {
      await this.prisma.campaignWorkflow.create({
        data: {
          campaignId: clone.id,
          nodes: original.workflow.nodes as any,
          edges: original.workflow.edges as any,
        },
      });
    }

    return this.getCampaignById(tenantId, clone.id);
  }

  async resetCampaign(tenantId: string, campaignId: string) {
    await this.assertCampaignBelongs(tenantId, campaignId);
    
    // Reset recipients status to allow re-sending
    await this.prisma.campaignRecipient.updateMany({
      where: { campaignId },
      data: { 
        status: 'pending', 
        sentAt: null, 
        error: null 
      },
    });

    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: { 
        status: CampaignStatus.DRAFT,
        startedAt: null,
        completedAt: null,
      },
    });
  }

  // ─── RECIPIENTS ──────────────────────────────────────────────────────────────

  async addRecipientsFromContacts(campaignId: string, tenantId: string, filters: { tags?: string[]; whatsappLabelIds?: string[] }) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id: campaignId, tenantId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const phoneSet = new Set<string>();

    // Internal system tags
    if (!filters.tags?.length && !filters.whatsappLabelIds?.length) {
      // No filters → all inbox contacts
      const all = await this.prisma.contactTag.findMany({ where: { tenantId }, select: { contactPhone: true } });
      all.forEach((c) => phoneSet.add(c.contactPhone));
    } else {
      if (filters.tags && filters.tags.length > 0) {
        const contactTags = await this.prisma.contactTag.findMany({
          where: { tenantId, tags: { hasSome: filters.tags } },
          select: { contactPhone: true },
        });
        contactTags.forEach((c) => phoneSet.add(c.contactPhone));
      }

      // WhatsApp label contacts
      if (filters.whatsappLabelIds && filters.whatsappLabelIds.length > 0) {
        const sessions = await this.prisma.whatsappSession.findMany({ where: { tenantId }, select: { id: true } });
        const sessionIds = sessions.map((s) => s.id);
        if (sessionIds.length > 0) {
          const chatLabels = await this.prisma.whatsappChatLabel.findMany({
            where: { sessionId: { in: sessionIds }, labelId: { in: filters.whatsappLabelIds } },
            select: { chatId: true },
          });
          chatLabels.forEach((cl) => {
            // chatId format: "5511999990000@s.whatsapp.net" or just phone
            const phone = cl.chatId.split('@')[0];
            if (phone) phoneSet.add(phone);
          });
        }
      }
    }

    return this.addRecipientsFromPhones(campaignId, [...phoneSet]);
  }

  async addRecipientsFromCsv(campaignId: string, csvContent: string) {
    const lines = csvContent.split('\n').map((l) => l.trim()).filter(Boolean);
    const recipients: { phone: string; name?: string }[] = [];
    for (const line of lines) {
      const [phone, name] = line.split(',').map((s) => s.trim());
      if (phone) recipients.push({ phone, name: name || undefined });
    }
    return this._upsertRecipients(campaignId, recipients);
  }

  async addRecipientsFromPhones(campaignId: string, phones: string[]) {
    return this._upsertRecipients(campaignId, phones.map((phone) => ({ phone })));
  }

  async addRecipientsFromContactList(campaignId: string, contactListId: string) {
    const items = await this.prisma.contactListItem.findMany({ where: { contactListId } });
    const added = await this._upsertRecipients(campaignId, items.map((i) => ({ phone: i.phone, name: i.name ?? undefined })));

    // Link list to campaign
    await this.prisma.campaignContactList.upsert({
      where: { campaignId_contactListId: { campaignId, contactListId } },
      update: {},
      create: { campaignId, contactListId },
    });

    return added;
  }

  private async _upsertRecipients(campaignId: string, items: { phone: string; name?: string }[]) {
    const existing = await this.prisma.campaignRecipient.findMany({
      where: { campaignId },
      select: { phone: true },
    });
    const existingPhones = new Set(existing.map((r) => r.phone));
    const newOnes = items.filter((i) => !existingPhones.has(i.phone));

    if (newOnes.length > 0) {
      await this.prisma.campaignRecipient.createMany({
        data: newOnes.map((r) => ({ campaignId, phone: r.phone, name: r.name })),
      });
    }

    return { added: newOnes.length, total: existingPhones.size + newOnes.length };
  }

  // ─── BLACKLIST ────────────────────────────────────────────────────────────────

  async addToBlacklist(tenantId: string, phone: string, reason?: string) {
    return this.prisma.campaignBlacklist.upsert({
      where: { tenantId_phone: { tenantId, phone } },
      update: { reason },
      create: { tenantId, phone, reason },
    });
  }

  async removeFromBlacklist(tenantId: string, phone: string) {
    await this.prisma.campaignBlacklist.deleteMany({ where: { tenantId, phone } });
    return { success: true };
  }

  async getBlacklist(tenantId: string) {
    return this.prisma.campaignBlacklist.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async isBlacklisted(tenantId: string, phone: string): Promise<boolean> {
    const entry = await this.prisma.campaignBlacklist.findUnique({
      where: { tenantId_phone: { tenantId, phone } },
    });
    return !!entry;
  }

  // ─── WORKFLOW ─────────────────────────────────────────────────────────────────

  async getCampaignWorkflowsList(tenantId: string) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { tenantId, type: CampaignType.WORKFLOW, isTemplate: true },
      include: { workflow: true },
      orderBy: { createdAt: 'desc' },
    });
    return campaigns.map(c => ({
      id: c.id,
      name: c.name,
      nodes: (c.workflow?.nodes ?? []) as any[],
      edges: (c.workflow?.edges ?? []) as any[],
    }));
  }

  async saveWorkflow(campaignId: string, tenantId: string, nodes: any[], edges: any[]) {
    await this.assertCampaignBelongs(tenantId, campaignId);
    
    // Cleanup orphaned media before saving
    await this.cleanupOrphanedMedia(tenantId, campaignId, nodes);

    return this.prisma.campaignWorkflow.upsert({
      where: { campaignId },
      update: { nodes, edges },
      create: { campaignId, nodes, edges },
    });
  }

  private async cleanupOrphanedMedia(tenantId: string, workflowId: string, nodes: any[]) {
    try {
      // 1. Collect all media IDs currently in use in the workflow nodes
      const usedMediaIds = new Set<string>();
      
      const findMediaIds = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;

        if (obj.uploadedMediaId) {
          usedMediaIds.add(obj.uploadedMediaId);
        }
        if (obj.remarketingUploadedMediaId) {
          usedMediaIds.add(obj.remarketingUploadedMediaId);
        }

        for (const key in obj) {
          if (typeof obj[key] === 'object') {
            findMediaIds(obj[key]);
          }
        }
      };

      for (const node of nodes) {
        if (node.config) {
          findMediaIds(node.config);
        }
      }

      // 2. Find all media files registered for this workflow/campaign in the database
      const existingMedia = await this.prisma.mediaFile.findMany({
        where: { workflowId, tenantId },
        select: { id: true, objectName: true },
      });

      // 3. Identify which ones are no longer used in the current configuration
      const orphanMedia = existingMedia.filter((media) => !usedMediaIds.has(media.id));

      if (orphanMedia.length > 0) {
        console.log(`[CampaignsService] Found ${orphanMedia.length} orphaned media files in campaign ${workflowId}. Cleaning up...`);
        
        // 4. Delete orphaned media from storage and database
        for (const media of orphanMedia) {
          try {
            await this.storageService.deleteMedia(media.objectName);
            await this.prisma.mediaFile.delete({ where: { id: media.id } });
            console.log(`[CampaignsService] Deleted orphaned media ${media.id} (${media.objectName})`);
          } catch (err) {
            console.error(`[CampaignsService] Failed to delete orphaned media ${media.id}:`, err);
          }
        }
      }
    } catch (error) {
      // We don't want to block saving the workflow if cleanup fails
      console.error(`[CampaignsService] Error during media cleanup for campaign ${workflowId}:`, error);
    }
  }

  async getWorkflow(campaignId: string, tenantId: string) {
    await this.assertCampaignBelongs(tenantId, campaignId);
    const workflow = await this.prisma.campaignWorkflow.findUnique({ where: { campaignId } });
    return workflow ?? { campaignId, nodes: [], edges: [] };
  }

  // ─── EXECUTION ────────────────────────────────────────────────────────────────

  async startCampaign(tenantId: string, campaignId: string) {
    const campaign = await this.getCampaignById(tenantId, campaignId);
    if ([CampaignStatus.RUNNING, CampaignStatus.SCHEDULED].map(s => s.toString()).includes(campaign.status)) {
      throw new BadRequestException('Campaign is already running or scheduled');
    }
    if (!campaign.sessions || campaign.sessions.length === 0) throw new BadRequestException('Campaign has no sessions configured');

    const now = new Date();
    const isScheduled = campaign.scheduledAt && new Date(campaign.scheduledAt) > now;
    const status = isScheduled ? CampaignStatus.SCHEDULED : CampaignStatus.RUNNING;

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status, startedAt: isScheduled ? null : now, completedAt: null },
    });

    if (!isScheduled) {
      this.processCampaign(campaignId).catch((err) => {
        console.error(`Campaign ${campaignId} failed:`, err);
        this.prisma.campaign.update({ where: { id: campaignId }, data: { status: CampaignStatus.FAILED } }).catch(() => { });
      });
    }

    return { success: true, status: status as any };
  }

  async pauseCampaign(tenantId: string, campaignId: string) {
    await this.assertCampaignBelongs(tenantId, campaignId);
    await this.prisma.campaign.update({ where: { id: campaignId }, data: { status: CampaignStatus.PAUSED } });
    return { success: true, status: CampaignStatus.PAUSED };
  }

  async resumeCampaign(tenantId: string, campaignId: string) {
    const campaign = await this.getCampaignById(tenantId, campaignId);
    if (campaign.status !== CampaignStatus.PAUSED) throw new BadRequestException('Campaign is not paused');

    await this.prisma.campaign.update({ where: { id: campaignId }, data: { status: CampaignStatus.RUNNING } });

    this.processCampaign(campaignId).catch((err) => {
      console.error(`Campaign ${campaignId} resume failed:`, err);
      this.prisma.campaign.update({ where: { id: campaignId }, data: { status: CampaignStatus.FAILED } }).catch(() => { });
    });

    return { success: true, status: CampaignStatus.RUNNING };
  }

  async getCampaignStats(campaignId: string) {
    const [total, sent, failed, blocked] = await Promise.all([
      this.prisma.campaignRecipient.count({ where: { campaignId } }),
      this.prisma.campaignRecipient.count({ where: { campaignId, status: 'sent' } }),
      this.prisma.campaignRecipient.count({ where: { campaignId, status: 'failed' } }),
      this.prisma.campaignRecipient.count({ where: { campaignId, status: 'blocked' } }),
    ]);
    const pending = total - sent - failed - blocked;
    const progress = total > 0 ? Math.round(((sent + failed + blocked) / total) * 100) : 0;
    return { total, sent, failed, blocked, pending, progress };
  }

  async getCampaignInsights(tenantId: string, campaignId: string) {
    await this.assertCampaignBelongs(tenantId, campaignId);

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        _count: {
          select: {
            recipients: true,
          }
        },
        workflow: true, // CampaignWorkflow (has nodes/edges)
      }
    });

    if (!campaign) throw new NotFoundException('Campaign not found');

    const [sentCount, interactedCount] = await Promise.all([
      this.prisma.campaignRecipient.count({
        where: { campaignId, status: 'sent' }
      }),
      this.prisma.workflowExecution.count({
        where: { campaignId, interactionCount: { gt: 0 } }
      })
    ]);

    const nodeStatsMap: Record<string, any> = {};

    // Build funnel stats from WorkflowExecution records AND ExecutionLogs (for historical path)
    const hasWorkflow = campaign.workflowId || campaign.workflow;

    if (hasWorkflow) {
      // Get all executions linked to this campaign (include contactPhone for leads-per-stage)
      const executions = await this.prisma.workflowExecution.findMany({
        where: { campaignId },
        select: { id: true, status: true, currentNodeId: true, workflowId: true, contactPhone: true }
      });

      const execIds = executions.map(e => e.id);

      if (executions.length > 0) {
        // Fetch historical logs to build a true funnel (who PASSED through which node)
        const logs = await this.prisma.executionLog.findMany({
          where: { 
            executionId: { in: execIds }, 
            eventType: { in: ['EXECUTION_STARTED', 'NODE_EXECUTED', 'node.executed', 'execution.started'] } 
          },
          select: { executionId: true, nodeId: true, eventType: true },
          orderBy: { createdAt: 'asc' }
        });

        // Fetch the actual Workflow model to get nodes definition
        let workflowNodes: any[] = [];
        if (campaign.workflowId) {
          const actualWorkflow = await this.prisma.workflow.findUnique({
            where: { id: campaign.workflowId },
            select: { nodes: true }
          });
          workflowNodes = (actualWorkflow?.nodes as any[]) || [];
        }
        if (workflowNodes.length === 0 && campaign.workflow) {
          workflowNodes = (campaign.workflow.nodes as any[]) || [];
        }

        // Build workflow sequence order (trigger → … → end) for correct display order
        let workflowEdges: any[] = [];
        if (campaign.workflowId) {
          const wfWithEdges = await this.prisma.workflow.findUnique({
            where: { id: campaign.workflowId },
            select: { edges: true },
          });
          workflowEdges = (wfWithEdges?.edges as any[]) || [];
        }
        if (workflowEdges.length === 0 && campaign.workflow) {
          workflowEdges = (campaign.workflow.edges as any[]) || [];
        }

        // Traverse edges to get ordered sequence of node IDs
        const nodeSequenceOrder = new Map<string, number>();
        const triggerNode = workflowNodes.find((n: any) => n.type?.startsWith('TRIGGER_'));
        if (triggerNode) {
          let curr = triggerNode;
          const visitedSeq = new Set<string>();
          let order = 0;
          while (curr && !visitedSeq.has(curr.id)) {
            visitedSeq.add(curr.id);
            nodeSequenceOrder.set(curr.id, order++);
            const edge = workflowEdges.find((e: any) => e.source === curr.id);
            curr = edge ? workflowNodes.find((n: any) => n.id === edge.target) : null;
          }
        }

        const nodeMap = new Map<string, string>();
        for (const n of workflowNodes) {
          // config holds the actual node settings; data holds React Flow presentation values
          let name: string = n.data?.label || n.data?.name || n.data?.displayName || '';

          if (n.type === 'MARK_STAGE' || n.type === 'SET_STAGE') {
            // Prefer config.stageName (actual configured value), fall back to data fields
            const stage = n.config?.stageName || n.data?.stageName || n.data?.name || n.data?.label;
            name = stage ? `🚩 ${stage}` : '🚩 Marcar Etapa';
          } else if (n.type === 'WAIT' || n.type === 'DELAY' || n.type === 'GRUPO_WAIT') {
            const amount = n.config?.amount || n.data?.amount || n.data?.delay || n.data?.waitTime;
            const unit = n.config?.unit || n.data?.unit || 'seconds';
            const unitMap: any = { seconds: 'seg', minutes: 'min', hours: 'h', days: 'd', s: 'seg', m: 'min' };
            name = `⏳ Aguardar ${amount}${unitMap[unit] || unit}`;
          } else if (n.type === 'WAIT_REPLY' || n.type === 'ASK') {
            name = `📩 Aguardar Resposta`;
            const timeout = n.config?.timeoutAmount || n.data?.timeoutAmount || n.data?.timeout;
            if (timeout) name += ` (${timeout}s)`;
          } else if (n.type === 'SEND_MESSAGE' || n.type === 'SEND_TEXT') {
            const text = n.config?.message || n.config?.text || n.data?.text || n.data?.content;
            if (text && (!name || name === n.type)) {
              name = text.length > 25 ? text.substring(0, 25) + '...' : text;
            }
          } else if (n.type === 'SEND_MEDIA') {
            const caption = n.config?.caption || n.data?.caption;
            const type = n.config?.mediaType || n.data?.mediaType || 'Mídia';
            if (!name || name === n.type) {
              name = caption ? `🖼️ ${caption.substring(0, 20)}...` : `🏷️ Enviar ${type}`;
            }
          }

          if (!name) {
            name = n.type || `Nó ${n.id.substring(0, 6)}`;
          }

          nodeMap.set(n.id, name);
        }

        // executionId → contactPhone for leads-per-stage
        const execPhoneMap = new Map<string, string>(
          executions.map(e => [e.id, e.contactPhone])
        );

        const initStat = (nodeId: string) => {
          if (!nodeStatsMap[nodeId]) {
            nodeStatsMap[nodeId] = {
              nodeId,
              nodeName: nodeMap.get(nodeId) || `Nó: ${nodeId.substring(0, 8)}`,
              nodeOrder: nodeSequenceOrder.get(nodeId) ?? 9999,
              totalExecutions: 0,
              successCount: 0,
              failCount: 0,
              waitingCount: 0,
              runningCount: 0,
              leads: { passed: [] as string[], waiting: [] as string[], running: [] as string[], failed: [] as string[] },
            };
          }
        };

        // 1. Process Logs (Historical path)
        const visits = new Set<string>(); // composite key execId:nodeId to avoid double counting
        for (const log of logs) {
          if (!log.nodeId) continue;
          const key = `${log.executionId}:${log.nodeId}`;
          if (!visits.has(key)) {
            visits.add(key);
            initStat(log.nodeId);
            nodeStatsMap[log.nodeId].totalExecutions++;
            // Tentatively mark as passed — corrected below if execution is stuck/failed
            nodeStatsMap[log.nodeId].successCount++;
            const phone = execPhoneMap.get(log.executionId);
            if (phone) nodeStatsMap[log.nodeId].leads.passed.push(phone);
          }
        }

        // 2. Process Current state for exact status (waiting/running/failed at the current node)
        for (const exec of executions) {
          const nodeId = exec.currentNodeId;
          if (!nodeId) continue;

          initStat(nodeId);

          const key = `${exec.id}:${nodeId}`;
          if (!visits.has(key)) {
            visits.add(key);
            nodeStatsMap[nodeId].totalExecutions++;
          } else {
            // Correct the tentative successCount from logs — this lead is not "passed" yet
            nodeStatsMap[nodeId].successCount = Math.max(0, nodeStatsMap[nodeId].successCount - 1);
            const phone = exec.contactPhone;
            if (phone) {
              nodeStatsMap[nodeId].leads.passed = nodeStatsMap[nodeId].leads.passed.filter((p: string) => p !== phone);
            }
          }

          const phone = exec.contactPhone;
          if (exec.status === 'COMPLETED') {
            nodeStatsMap[nodeId].successCount++;
            if (phone && !nodeStatsMap[nodeId].leads.passed.includes(phone)) {
              nodeStatsMap[nodeId].leads.passed.push(phone);
            }
          } else if (['ERROR', 'FAILED', 'EXPIRED'].includes(exec.status)) {
            nodeStatsMap[nodeId].failCount++;
            if (phone) nodeStatsMap[nodeId].leads.failed.push(phone);
          } else if (exec.status === 'WAITING') {
            nodeStatsMap[nodeId].waitingCount++;
            if (phone) nodeStatsMap[nodeId].leads.waiting.push(phone);
          } else if (exec.status === 'RUNNING') {
            nodeStatsMap[nodeId].runningCount++;
            if (phone) nodeStatsMap[nodeId].leads.running.push(phone);
          }
        }

        // 3. Add unvisited nodes
        for (const n of workflowNodes) {
          if (!nodeStatsMap[n.id] && n.type !== 'start') {
            initStat(n.id);
          }
        }
      }
    }

    return {
      totalTargeted: campaign._count.recipients,
      totalSent: sentCount,
      totalInteracted: interactedCount,
      conversionRate: sentCount > 0 ? (interactedCount / sentCount) * 100 : 0,
      // Sort by workflow execution order; nodes not in sequence fall to the end
      nodeStats: Object.values(nodeStatsMap).sort((a: any, b: any) => a.nodeOrder - b.nodeOrder),
      workflow: campaign.workflow,
    };
  }


  // ─── WORKER ───────────────────────────────────────────────────────────────────

  async processCampaign(campaignId: string) {
    if (this.processingCampaigns.has(campaignId)) return;
    this.processingCampaigns.add(campaignId);

    try {
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { recipients: { where: { status: 'pending' } }, sessions: true, messages: { orderBy: { order: 'asc' } } },
      });
    // campaign.workflowId is now available directly from the model
    if (!campaign) return;

    // Typed config — Prisma returns all scalar fields at runtime even when TypeScript
    // types are stale (Prisma client not regenerated after schema change). This single
    // cast ensures all config fields are properly typed throughout the function.
    const cfg = campaign as typeof campaign & {
      limitPerSession: number;
      limitType: string;
      dailyResetTime: string;
      maxPerHour: number;
      maxPerMinute: number;
      errorThreshold: number;
      allowedDays: number[] | string;
    };

    const protectionSettings = await this.campaignSettings.getSettings(campaign.tenantId);

    // Emergency mode: apply capacity factor to daily/hour limits
    const emergencyStatus = await this.emergencyMode.getStatus(campaign.tenantId);
    const capacityFactor = (emergencyStatus as any).emergencyMode ? ((emergencyStatus as any).emergencyCapacity ?? 0.2) : 1.0;
    if (capacityFactor < 1.0) {
      console.warn(`[EMERGENCY] Campanha ${campaignId}: modo de emergência ativo — capacidade ${Math.round(capacityFactor * 100)}%`);
    }

    // Shadow workflow is upserted per-dispatch (inside the loop) so that any
    // edits made to the campaign workflow are picked up by the very next send.
    let shadowWorkflowId: string | null = null;

    let pendingRecipients = campaign.recipients.filter((r) => r.status === 'pending');

    // Validate and filter phone numbers (Brazilian format or international)
    pendingRecipients = pendingRecipients.filter((r) => {
      if (!this.isValidPhone(r.phone)) {
        console.warn(`[CampaignsService] Número inválido ignorado: ${r.phone}`);
        return false;
      }
      return true;
    });

    // ── Sort by reputation + filter quarantined before randomOrder ─────────
    {
      const allPhones = pendingRecipients.map(r => r.phone);
      const { sorted: sortedPhones, skipped } = await this.reputation.sortAndFilterPhones(
        campaign.tenantId, allPhones,
      );
      if (skipped.length > 0) {
        console.log(`[REPUTATION] ${skipped.length} contatos em quarentena/baixa reputação pulados`);
      }
      const sortedSet = new Set(sortedPhones);
      // Keep only allowed phones, in sorted order
      const sortedMap = new Map(sortedPhones.map((p, i) => [p, i]));
      pendingRecipients = pendingRecipients
        .filter(r => sortedSet.has(r.phone))
        .sort((a, b) => (sortedMap.get(a.phone) ?? 999) - (sortedMap.get(b.phone) ?? 999));
    }

    if (campaign.randomOrder) {
      // Shuffle within each reputation tier to avoid sending in obvious order
      // but preserve the overall high → medium → low priority from reputation sort
      const third = Math.ceil(pendingRecipients.length / 3);
      const tier1 = pendingRecipients.slice(0, third);
      const tier2 = pendingRecipients.slice(third, third * 2);
      const tier3 = pendingRecipients.slice(third * 2);
      [tier1, tier2, tier3].forEach(tier => {
        for (let i = tier.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [tier[i], tier[j]] = [tier[j], tier[i]];
        }
      });
      pendingRecipients = [...tier1, ...tier2, ...tier3];
    }
    let sessionIndex = 0;
    const todayThreshold = this.getResetThresholdInUTC(cfg.dailyResetTime ?? '09:00');

    // Rate limiting counters — applied per session for proper throttling
    // User-configured limits are respected up to the absolute safety ceiling,
    // then adjusted by emergency capacity factor.
    const configuredMaxPerMinute: number = cfg.maxPerMinute ?? 5;
    const configuredMaxPerHour: number = cfg.maxPerHour ?? 100;
    const maxPerMinute: number = Math.max(1, Math.floor(Math.min(configuredMaxPerMinute, HARD_MAX_PER_MINUTE) * capacityFactor));
    const maxPerHour: number = Math.max(1, Math.floor(Math.min(configuredMaxPerHour, HARD_MAX_PER_HOUR) * capacityFactor));
    if (configuredMaxPerMinute > HARD_MAX_PER_MINUTE) {
      console.warn(`[CampaignsService] maxPerMinute configurado (${configuredMaxPerMinute}) limitado ao teto de segurança (${HARD_MAX_PER_MINUTE})`);
    }
    if (configuredMaxPerHour > HARD_MAX_PER_HOUR) {
      console.warn(`[CampaignsService] maxPerHour configurado (${configuredMaxPerHour}) limitado ao teto de segurança (${HARD_MAX_PER_HOUR})`);
    }
    const errorThreshold: number = cfg.errorThreshold ?? 30;
    const allowedDays: number[] = Array.isArray(cfg.allowedDays)
      ? cfg.allowedDays as number[]
      : JSON.parse((cfg.allowedDays as string) ?? '[0,1,2,3,4,5,6]');

    // Per-session rate counters (session ID → count)
    const sentThisMinuteBySession = new Map<string, number>();
    const sentThisHourBySession = new Map<string, number>();
    const minuteStartBySession = new Map<string, number>();
    const hourStartBySession = new Map<string, number>();

    for (const recipient of pendingRecipients) {
      const current = await this.prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
      if (!current || (current.status as string) !== CampaignStatus.RUNNING) break;

      // ── Time window check (08:00–20:00 Brasília) ──────────────────────────
      const nowSP = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const currentHourSP = nowSP.getHours();
      if (currentHourSP < ALLOWED_HOUR_START_SP || currentHourSP >= ALLOWED_HOUR_END_SP) {
        console.log(`[CampaignsService] Fora do horário permitido (${currentHourSP}h BRT) — aguardando 08:00`);
        // Wait until 08:00 next day
        const nextStart = new Date(nowSP);
        if (currentHourSP >= ALLOWED_HOUR_END_SP) {
          nextStart.setDate(nextStart.getDate() + 1);
        }
        nextStart.setHours(ALLOWED_HOUR_START_SP, 0, 0, 0);
        const waitMs = nextStart.getTime() - Date.now() + 60_000; // +1min buffer
        await new Promise((r) => setTimeout(r, Math.max(waitMs, 60_000)));
        // Re-check status after waiting
        const statusAfterWait = await this.prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
        if (!statusAfterWait || (statusAfterWait.status as string) !== CampaignStatus.RUNNING) break;
      }

      // ── Allowed days check (São Paulo timezone) ───────────────────────────
      const todayDay = nowSP.getDay();
      if (!allowedDays.includes(todayDay)) {
        console.log(`[CampaignsService] Today (${todayDay}) is not an allowed day for campaign ${campaignId}. Stopping loop.`);
        break;
      }

      // ── Blacklist check ───────────────────────────────────────────────────
      if (campaign.excludeBlocked) {
        const blocked = await this.isBlacklisted(campaign.tenantId, recipient.phone);
        if (blocked) {
          await this.prisma.campaignRecipient.update({ where: { id: recipient.id }, data: { status: 'blocked' } });
          continue;
        }
      }

      // ── Auto-blacklist: 3+ delivery failures in different campaigns ───────
      if (await this.shouldAutoBlacklist(campaign.tenantId, recipient.phone)) {
        await this.addToBlacklist(campaign.tenantId, recipient.phone, 'AUTO_BLACKLIST_DELIVERY_FAILURE');
        await this.prisma.campaignRecipient.update({ where: { id: recipient.id }, data: { status: 'blocked' } });
        console.warn(`[CampaignsService] Auto-blacklist: ${recipient.phone} — 3+ falhas em campanhas diferentes`);
        continue;
      }

      // ── Reputation check: exposure limit + quarantine + delay multiplier ──
      const repCheck = await this.reputation.check(campaign.tenantId, recipient.phone, protectionSettings);
      if (!repCheck.canSend) {
        if (repCheck.reason === 'DAILY_LIMIT' || repCheck.reason === 'WEEKLY_LIMIT') {
          // Skip silently — exposure limit reached, not a failure
          console.log(`[EXPOSURE] Contato ${recipient.phone} atingiu limite de exposição, pulado`);
        } else {
          // Quarantine (opt-out) or bad number
          console.log(`[REPUTATION] Contato ${recipient.phone} bloqueado (${repCheck.reason}), pulado`);
        }
        continue;
      }

      // ── Timing check: LOW_ENGAGEMENT_HOUR ────────────────────────────────
      const nowSPCheck = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const currentHourForTiming = nowSPCheck.getHours();
      const isLowHour = protectionSettings.timingOptimizationEnabled
        && await this.reputation.isLowEngagementHour(campaign.tenantId, currentHourForTiming);
      if (isLowHour) {
        const betterHour = await this.reputation.getBestNextHour(campaign.tenantId, currentHourForTiming);
        console.log(`[TIMING] Horário ${currentHourForTiming}h com baixo engajamento, envio reagendado para ${betterHour}h`);
        const waitMinutes = ((betterHour - currentHourForTiming + 24) % 24) * 60;
        const waitMs = waitMinutes * 60 * 1000;
        if (waitMs > 0 && waitMs < 12 * 60 * 60 * 1000) {
          await new Promise((r) => setTimeout(r, waitMs));
        }
      }

      // ── Cross-session recipient lock (only when number is being processed simultaneously) ─
      const recipientKey = `${campaign.tenantId}:${recipient.phone}`;
      const lockKey = this.kActiveRecipient(campaign.tenantId, recipient.phone);
      const redisClient = this.redis.getClient();
      const isActiveLocked = await redisClient.exists(lockKey);
      if (isActiveLocked) {
        const ttl = await redisClient.ttl(lockKey);
        console.log(`[CROSS_SESSION] Número ${recipient.phone} sendo processado por outra sessão, cooldown ${ttl}s aplicado`);
        await new Promise(r => setTimeout(r, Math.min(ttl * 1000, 60000)));
      }
      // Set the lock for 30s (duration of one message processing)
      await redisClient.set(lockKey, '1', 'EX', 30);

      // ── Find a session with available capacity, prioritizing by health score ─
      let session: (typeof campaign.sessions)[0] | null = null;

      // Sort sessions by health score (descending) before checking
      const sessionsCandidates = [...campaign.sessions];
      const sessionScores = await Promise.all(
        sessionsCandidates.map(s => this.healthMonitor.getScore(s.sessionId))
      );
      // Round-robin within the healthy sessions (score >= MIN_HEALTH_SCORE_TO_SEND)
      const healthySessions = sessionsCandidates
        .map((s, i) => ({ session: s, score: sessionScores[i] }))
        .filter(({ score }) => !protectionSettings.sessionHealthFilterEnabled || score >= MIN_HEALTH_SCORE_TO_SEND)
        .sort((a, b) => b.score - a.score)
        .map(({ session: s }) => s);

      let sessionsChecked = 0;
      while (sessionsChecked < healthySessions.length) {
        const candidate = healthySessions[sessionIndex % healthySessions.length];
        sessionIndex++;
        sessionsChecked++;
        if (!candidate) break;

        // Skip sessions not in session manager
        const sessionClient = this.whatsappSessionManager.resolveSessionClient(candidate.sessionId);
        if (!sessionClient) {
          console.warn(`[CampaignsService] Session ${candidate.sessionId} not found, skipping`);
          continue;
        }

        if (sessionClient.status !== 'CONNECTED') {
          console.warn(`[CampaignsService] Session ${candidate.sessionId} is ${sessionClient.status}, skipping`);
          continue;
        }

        // Circuit breaker check
        const canSend = await this.healthMonitor.canSend(candidate.sessionId);
        if (!canSend) {
          console.warn(`[CampaignsService] Session ${candidate.sessionId} blocked by circuit breaker or DMS`);
          continue;
        }

        // Per-session daily limit (with warmup + tourist mode applied)
        const configuredDailyLimit = cfg.limitPerSession ?? 50;
        const effectiveDailyLimit = await this.healthMonitor.getEffectiveDailyLimit(
          candidate.sessionId,
          Math.min(configuredDailyLimit, HARD_MAX_PER_DAY),
          HARD_MAX_PER_DAY,
        );

        const countWhere: any = {
          campaignId,
          sessionId: candidate.sessionId,
          status: 'sent',
        };
        if (cfg.limitType === 'DAILY') {
          countWhere.sentAt = { gte: todayThreshold };
        }

        const sentCount = await this.prisma.campaignLog.count({ where: countWhere });
        if (sentCount >= effectiveDailyLimit) {
          console.log(`[CampaignsService] Session ${candidate.sessionId} atingiu limite (${sentCount}/${effectiveDailyLimit}), skipping`);
          continue;
        }

        // Tourist mode: skip cold contacts (no conversation history)
        const isTourist = await this.healthMonitor.isTouristMode(candidate.sessionId);
        if (isTourist) {
          const hasHistory = await this.hasConversationHistory(candidate.sessionId, recipient.phone);
          if (!hasHistory) {
            console.log(`[TOURIST] Session ${candidate.sessionId}: pulando contato frio ${recipient.phone}`);
            continue;
          }
        }

        session = candidate;
        break;
      }

      if (!session) {
        console.log(`[CampaignsService] All sessions exhausted or unavailable for campaign ${campaignId}`);
        break;
      }

      // ── Per-session per-minute rate limit ─────────────────────────────────
      const sId = session.sessionId;
      const nowTs = Date.now();

      if (!minuteStartBySession.has(sId)) minuteStartBySession.set(sId, nowTs);
      if (!sentThisMinuteBySession.has(sId)) sentThisMinuteBySession.set(sId, 0);
      if (!hourStartBySession.has(sId)) hourStartBySession.set(sId, nowTs);
      if (!sentThisHourBySession.has(sId)) sentThisHourBySession.set(sId, 0);

      if (nowTs - minuteStartBySession.get(sId)! >= 60_000) {
        sentThisMinuteBySession.set(sId, 0);
        minuteStartBySession.set(sId, nowTs);
      }
      if (sentThisMinuteBySession.get(sId)! >= maxPerMinute) {
        const waitMs = 60_000 - (Date.now() - minuteStartBySession.get(sId)!);
        console.log(`[CampaignsService] Session ${sId}: Per-minute limit (${maxPerMinute}) reached, waiting ${Math.ceil(waitMs / 1000)}s`);
        await new Promise((r) => setTimeout(r, waitMs > 0 ? waitMs : 1000));
        sentThisMinuteBySession.set(sId, 0);
        minuteStartBySession.set(sId, Date.now());
      }

      // ── Per-session per-hour rate limit ───────────────────────────────────
      if (Date.now() - hourStartBySession.get(sId)! >= 3_600_000) {
        sentThisHourBySession.set(sId, 0);
        hourStartBySession.set(sId, Date.now());
      }
      if (sentThisHourBySession.get(sId)! >= maxPerHour) {
        const waitMs = 3_600_000 - (Date.now() - hourStartBySession.get(sId)!);
        console.log(`[CampaignsService] Session ${sId}: Per-hour limit (${maxPerHour}) reached, waiting ${Math.ceil(waitMs / 60000)}min`);
        await new Promise((r) => setTimeout(r, waitMs > 0 ? waitMs : 1000));
        sentThisHourBySession.set(sId, 0);
        hourStartBySession.set(sId, Date.now());
      }

      // ── Pressure valve check — applies factor to per-minute and per-hour limits ─
      const pvFactor = await this.healthMonitor.getPressureValveFactor(sId);
      const effectiveMaxPerMin = Math.max(1, Math.floor(maxPerMinute * pvFactor));
      const effectiveMaxPerHour = Math.max(1, Math.floor(maxPerHour * pvFactor));
      if (pvFactor < 1.0) {
        console.log(`[PRESSURE_VALVE] Fator ${pvFactor} aplicado na sessão ${sId}: limite/min reduzido de ${maxPerMinute} para ${effectiveMaxPerMin}, limite/hora reduzido de ${maxPerHour} para ${effectiveMaxPerHour}`);
      }
      await this.healthMonitor.updatePressureValve(sId, maxPerMinute);

      // Apply effective limits (pressure-valve-adjusted)
      if ((sentThisMinuteBySession.get(sId) ?? 0) >= effectiveMaxPerMin) {
        const waitMs = 60_000 - (Date.now() - minuteStartBySession.get(sId)!);
        console.log(`[CampaignsService] Session ${sId}: Per-minute effective limit (${effectiveMaxPerMin}) reached, waiting ${Math.ceil(waitMs / 1000)}s`);
        await new Promise((r) => setTimeout(r, waitMs > 0 ? waitMs : 1000));
        sentThisMinuteBySession.set(sId, 0);
        minuteStartBySession.set(sId, Date.now());
      }
      if ((sentThisHourBySession.get(sId) ?? 0) >= effectiveMaxPerHour) {
        const waitMs = 3_600_000 - (Date.now() - hourStartBySession.get(sId)!);
        console.log(`[CampaignsService] Session ${sId}: Per-hour effective limit (${effectiveMaxPerHour}) reached, waiting ${Math.ceil(waitMs / 60000)}min`);
        await new Promise((r) => setTimeout(r, waitMs > 0 ? waitMs : 1000));
        sentThisHourBySession.set(sId, 0);
        hourStartBySession.set(sId, Date.now());
      }

      try {
        if (campaign.workflowId) {
          // Re-upsert shadow workflow on every dispatch so edits made while the
          // campaign is running are reflected in the next send immediately.
          if (campaign.type === 'WORKFLOW') {
            const campaignWf = await this.prisma.campaignWorkflow.findUnique({
              where: { campaignId: campaign.id },
            });
            if (campaignWf && campaignWf.nodes) {
              const shadowId = `shadow-${campaign.id}`;
              const shadowWf = await this.prisma.workflow.upsert({
                where: { id: shadowId },
                create: {
                  id: shadowId,
                  tenantId: campaign.tenantId,
                  name: `[Auto] Campanha: ${campaign.name}`,
                  description: 'Workflow virtual gerado automaticamente',
                  isActive: true,
                  nodes: campaignWf.nodes ?? Prisma.JsonNull,
                  edges: campaignWf.edges ?? Prisma.JsonNull,
                },
                update: {
                  nodes: campaignWf.nodes ?? Prisma.JsonNull,
                  edges: campaignWf.edges ?? Prisma.JsonNull,
                  isActive: true,
                },
              });
              shadowWorkflowId = shadowWf.id;
            }
          }

          // Mark as processing, engine will mark as sent/failed later
          await this.prisma.campaignRecipient.update({ where: { id: recipient.id }, data: { status: 'processing' } });

          if (shadowWorkflowId) {
            await this.executionEngine.startExecution(
              campaign.tenantId,
              shadowWorkflowId,
              session.sessionId,
              recipient.phone,
              undefined,
              undefined,
              { triggerType: 'CAMPAIGN_START', campaignId: campaign.id }
            );
          } else {
            await this.executionEngine.startExecution(
              campaign.tenantId,
              campaign.workflowId,
              session.sessionId,
              recipient.phone,
              undefined,
              undefined,
              { triggerType: 'CAMPAIGN', campaignId: campaign.id },
            );
          }
        } else {
          // Simple campaign: send messages with humanization enabled
          for (const msg of campaign.messages) {
            // NOTE: Variable substitution ({nome}, {empresa}, {telefone}) must happen
          // BEFORE spintax parsing ([[opt1|opt2]]). If variable substitution is added
          // in the future, apply it here first, then call parseSpintax.
          // Apply spintax to message content
            const msgContent = msg.content && hasSpintax(msg.content)
              ? parseSpintax(msg.content)
              : msg.content;
            const msgCaption = msg.caption && hasSpintax(msg.caption)
              ? parseSpintax(msg.caption)
              : msg.caption;

            // Check for repetitive content pattern
            const contentToCheck = msgContent ?? msgCaption ?? '';
            const isRepetitive = contentToCheck
              ? await this.healthMonitor.checkRepetitiveContent(sId, contentToCheck)
              : false;
            if (isRepetitive) {
              // Extra delay for repetitive content
              const extraDelay = Math.floor(Math.random() * 10_000) + 10_000;
              console.log(`[PATTERN] Session ${sId}: delay extra ${Math.ceil(extraDelay / 1000)}s por conteúdo repetitivo`);
              await new Promise((r) => setTimeout(r, extraDelay));
            }

            if (msg.mediaUrl && msg.type !== 'text') {
              await this.whatsappSessionManager.sendMedia(
                session.sessionId,
                recipient.phone,
                msg.type as 'image' | 'video' | 'audio' | 'document',
                msg.mediaUrl,
                { caption: msgCaption ?? undefined, bypassDelay: false },
              );
            } else if (msgContent) {
              await this.whatsappSessionManager.sendMessage(session.sessionId, recipient.phone, msgContent, false);
            }
          }
          // Only mark as sent directly for simple campaigns
          await this.prisma.campaignRecipient.update({ where: { id: recipient.id }, data: { status: 'sent', sentAt: new Date() } });
          await this.prisma.campaignLog.create({ data: { campaignId, phone: recipient.phone, sessionId: session.sessionId, status: 'sent' } });
        }

        sentThisMinuteBySession.set(sId, (sentThisMinuteBySession.get(sId) ?? 0) + 1);
        sentThisHourBySession.set(sId, (sentThisHourBySession.get(sId) ?? 0) + 1);
        this.recentRecipients.set(recipientKey, Date.now());

        // DMS tick (2h continuous check)
        await this.healthMonitor.tickDmsSuccess(sId);

        // Record progress for stall detection
        await this.queueDiagnostic.recordProgress(campaignId);

        // Record send in reputation system
        const nowSPSend = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        await this.reputation.recordSend(campaign.tenantId, recipient.phone, nowSPSend.getHours());

      } catch (e: any) {
        const isBlocked = e.message?.includes('blocked') || e.message?.includes('forbidden');
        const isRestriction = e.message?.includes('restricted') || e.message?.includes('spam');
        await this.prisma.campaignRecipient.update({ where: { id: recipient.id }, data: { status: 'failed', error: e.message } });
        await this.prisma.campaignLog.create({
          data: { campaignId, phone: recipient.phone, sessionId: session.sessionId, status: isBlocked ? 'blocked' : 'failed', error: e.message },
        });
        if (isBlocked) await this.addToBlacklist(campaign.tenantId, recipient.phone, 'blocked');

        // Record delivery error in reputation
        await this.reputation.recordDeliveryError(campaign.tenantId, recipient.phone, protectionSettings);

        // Restriction: pause 6h minimum
        if (isRestriction) {
          console.error(`[CampaignsService] Session ${sId}: RESTRIÇÃO detectada — pausando campanha por 6h`);
          await this.prisma.campaign.update({ where: { id: campaignId }, data: { status: CampaignStatus.PAUSED } });
          await this.healthMonitor.recordFailure(sId, e.message, true);
          break;
        }

        // Error threshold check: pause campaign if error rate exceeds limit
        if (errorThreshold > 0) {
          const [totalSent, totalErrors] = await Promise.all([
            this.prisma.campaignLog.count({ where: { campaignId } }),
            this.prisma.campaignLog.count({ where: { campaignId, status: 'failed' } }),
          ]);
          if (totalSent >= 10) {
            const errorRate = (totalErrors / totalSent) * 100;
            if (errorRate >= errorThreshold) {
              console.warn(`[CampaignsService] Error rate ${errorRate.toFixed(1)}% exceeded threshold ${errorThreshold}% — pausing campaign ${campaignId}`);
              await this.prisma.campaign.update({ where: { id: campaignId }, data: { status: CampaignStatus.PAUSED } });
              await this.eventBus.emit({
                type: EventType.CAMPAIGN_PAUSED,
                tenantId: campaign.tenantId,
                timestamp: new Date(),
                campaignId,
                campaignName: campaign.name,
                reason: `Taxa de erros ${errorRate.toFixed(1)}% ultrapassou limite de ${errorThreshold}%`,
                errorRate: parseFloat(errorRate.toFixed(1)),
                threshold: errorThreshold,
              } as any);
              break;
            }
          }
        }
      }

      // ── Inter-recipient delay: health score × reputation multipliers ────────
      const adaptiveMultiplier = await this.healthMonitor.getAdaptiveDelayMultiplier(sId);
      // Combine both multipliers (take the higher of the two)
      const combinedMultiplier = Math.max(adaptiveMultiplier, repCheck.delayMultiplier);
      const baseDelaySec = Math.floor(Math.random() * (campaign.delayMax - campaign.delayMin + 1)) + campaign.delayMin;
      const effectiveDelaySec = Math.round(baseDelaySec * combinedMultiplier);
      if (combinedMultiplier > 1) {
        console.log(`[CampaignsService] Session ${sId}: Delay ×${combinedMultiplier} (health:${adaptiveMultiplier}, rep:${repCheck.delayMultiplier}) → ${effectiveDelaySec}s`);
      }
      await new Promise((r) => setTimeout(r, effectiveDelaySec * 1000));
    }

    const finalState = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (finalState && finalState.status === CampaignStatus.RUNNING) {
      const hasPending = await this.prisma.campaignRecipient.count({
        where: { campaignId, status: 'pending' }
      });
      
      if (hasPending === 0) {
        await this.prisma.campaign.update({
          where: { id: campaignId },
          data: { status: CampaignStatus.COMPLETED, completedAt: new Date() },
        });

        // Push notification with campaign insights — fire-and-forget
        this.sendCampaignCompletedPush(campaignId, finalState.tenantId, finalState.name).catch(() => {});
      }
    }
    } finally {
      this.processingCampaigns.delete(campaignId);
    }
  }

  private async sendCampaignCompletedPush(campaignId: string, tenantId: string, campaignName: string): Promise<void> {
    const recipients = await this.prisma.campaignRecipient.findMany({
      where: { campaignId },
      select: { status: true },
    });

    const total = recipients.length;
    const sent = recipients.filter(r => r.status === 'sent').length;
    const failed = recipients.filter(r => r.status === 'failed').length;
    const successRate = total > 0 ? Math.round((sent / total) * 100) : 0;

    await this.pushNotification.sendToTenant(tenantId, {
      title: '🎯 Campanha concluída!',
      body: `"${campaignName}" — ✅ ${sent} enviados | ❌ ${failed} falhas | 📊 ${successRate}%`,
      icon: '/logo.png',
      data: { url: '/campaigns/simple', campaignId },
    });

    console.log(`[PUSH] Campanha ${campaignId} concluída — push enviado para tenant ${tenantId}`);
  }

  // ─── TAGS & LABELS ────────────────────────────────────────────────────────────

  async getCampaignTags(tenantId: string): Promise<{ tag: string; count: number }[]> {
    const result = await this.prisma.$queryRaw<{ tag: string; count: bigint }[]>`
      SELECT unnest(tags) as tag, COUNT(DISTINCT "contactPhone") as count
      FROM contact_tags
      WHERE "tenantId" = ${tenantId}
      GROUP BY tag
      ORDER BY count DESC
    `;
    return result.map((r) => ({ tag: r.tag, count: Number(r.count) }));
  }

  async getCampaignWhatsappLabels(tenantId: string): Promise<{ id: string; name: string; color: string; count: number }[]> {
    const sessions = await this.prisma.whatsappSession.findMany({ where: { tenantId }, select: { id: true } });
    const sessionIds = sessions.map((s) => s.id);
    if (sessionIds.length === 0) return [];

    const result = await this.prisma.$queryRaw<{ labelId: string; name: string; color: number | null; count: bigint }[]>`
      SELECT wl."labelId", wl.name, wl.color, COUNT(DISTINCT wcl."chatId") as count
      FROM whatsapp_labels wl
      LEFT JOIN whatsapp_chat_labels wcl ON wcl."sessionId" = wl."sessionId" AND wcl."labelId" = wl."labelId"
      WHERE wl."sessionId" = ANY(${sessionIds}::text[])
      GROUP BY wl."labelId", wl.name, wl.color
      ORDER BY count DESC
    `;

    return result.map((r) => ({
      id: r.labelId,
      name: r.name,
      color: r.color !== null ? this.labelColorToHex(r.color) : '#888888',
      count: Number(r.count),
    }));
  }

  private labelColorToHex(color: number): string {
    const palette: Record<number, string> = {
      0: '#FF2400', 1: '#FF7300', 2: '#FFB900', 3: '#ABF5D1',
      4: '#9CE4E9', 5: '#25D366', 6: '#00A3BF', 7: '#0052CC',
      8: '#6554C0', 9: '#FF5630', 10: '#FF8B00', 11: '#36B37E',
      12: '#00B8D9', 13: '#0065FF', 14: '#FF991F', 15: '#C0B6F2',
    };
    return palette[color] ?? '#888888';
  }

  // ─── GROUPS ──────────────────────────────────────────────────────────────────

  async getGroups(tenantId: string, sessionId?: string) {
    const where: any = { whatsappSession: { tenantId } };
    if (sessionId) where.sessionId = sessionId;

    const configs = await this.prisma.whatsappGroupConfig.findMany({
      where,
      select: { groupId: true, name: true, sessionId: true, enabled: true },
      orderBy: { name: 'asc' },
    });

    return configs.map(g => ({
      groupId: g.groupId,
      name: g.name,
      sessionId: g.sessionId,
      enabled: g.enabled,
    }));
  }

  async syncGroups(tenantId: string, sessionId: string) {
    console.log(`[CAMPAIGNS] Syncing groups for tenant ${tenantId}, session ${sessionId}`);
    const session = await this.prisma.whatsappSession.findFirst({
      where: { id: sessionId, tenantId },
    });
    if (!session) {
      console.error(`[CAMPAIGNS] Session ${sessionId} not found for tenant ${tenantId}`);
      throw new NotFoundException('Sessão não encontrada');
    }

    try {
      return await this.whatsappSessionManager.syncGroups(sessionId);
    } catch (error: any) {
      console.error(`[CAMPAIGNS] Sync Groups Error:`, error.message);
      throw new BadRequestException(error.message || 'Erro ao sincronizar grupos');
    }
  }

  async getGroupParticipants(tenantId: string, sessionId: string, groupJid: string, workflowId?: string) {
    // Verify session belongs to tenant
    const session = await this.prisma.whatsappSession.findFirst({
      where: { id: sessionId, tenantId },
    });
    if (!session) throw new NotFoundException('Session not found');

    const metadata = await this.whatsappSessionManager.getGroupMetadata(sessionId, groupJid);
    const participants = (metadata.participants || []).map((p: any) => {
      // Preserve @lid JIDs intact — stripping them produces a numeric ID that is
      // NOT a phone number, so formatJid() would build an invalid @s.whatsapp.net JID.
      // For regular @s.whatsapp.net / @c.us JIDs we strip the domain as usual.
      const phone = p.id.includes('@lid') ? p.id : p.id.split('@')[0];
      return {
        phone,
        name: p.name || p.notify || null,
        isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
        isSuperAdmin: p.admin === 'superadmin',
      };
    });

    // Try to fill missing names from local conversations
    const phonesWithNoName = participants.filter((p: any) => !p.name).map((p: any) => p.phone);
    if (phonesWithNoName.length > 0) {
      const conversations = await this.prisma.conversation.findMany({
        where: {
          tenantId,
          contactPhone: { in: phonesWithNoName },
          contactName: { not: null }
        },
        select: { contactPhone: true, contactName: true }
      });

      const nameMap = new Map(conversations.map((c: any) => [c.contactPhone, c.contactName]));
      participants.forEach((p: any) => {
        if (!p.name && nameMap.has(p.phone)) {
          p.name = nameMap.get(p.phone);
        }
      });
    }

    if (workflowId) {
      const executions = await this.prisma.workflowExecution.findMany({
        where: {
          tenantId,
          workflowId,
          contactPhone: { in: participants.map((p: any) => p.phone) },
        },
        select: { contactPhone: true },
      });
      const executedPhones = new Set(executions.map((e) => e.contactPhone));
      return participants.map((p: any) => ({
        ...p,
        alreadyExecuted: executedPhones.has(p.phone),
      }));
    }

    return participants;
  }

  async addRecipientsFromGroup(
    campaignId: string,
    tenantId: string,
    sessionId: string,
    groupJid: string,
    options: {
      excludeAdmins?: boolean;
      allowResend?: boolean;
      selectedPhones?: string[];
    } = {},
  ) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id: campaignId, tenantId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    let participants = await this.getGroupParticipants(tenantId, sessionId, groupJid);

    // Filter by selected phones if provided
    if (options.selectedPhones && options.selectedPhones.length > 0) {
      const selectedSet = new Set(options.selectedPhones);
      participants = participants.filter((p: any) => selectedSet.has(p.phone));
    }

    // Filter out admins if requested
    if (options.excludeAdmins) {
      participants = participants.filter((p: any) => !p.isAdmin);
    }

    // Check send history: filter out phones already sent in this campaign OR already executed the workflow
    if (!options.allowResend) {
      const alreadySent = await this.prisma.campaignRecipient.findMany({
        where: { campaignId, status: 'sent' },
        select: { phone: true },
      });
      const sentPhones = new Set(alreadySent.map(r => r.phone));
      
      let executedPhones = new Set<string>();
      const workflowToCheck = campaign.type === 'WORKFLOW' ? `shadow-${campaign.id}` : campaign.workflowId;
      
      if (workflowToCheck) {
        const executions = await this.prisma.workflowExecution.findMany({
          where: {
            tenantId,
            workflowId: workflowToCheck,
            contactPhone: { in: participants.map((p: any) => p.phone) }
          },
          select: { contactPhone: true }
        });
        executedPhones = new Set(executions.map(e => e.contactPhone));
      }

      participants = participants.filter((p: any) => !sentPhones.has(p.phone) && !executedPhones.has(p.phone));
    }

    // Upsert recipients (avoid duplicates in this campaign)
    const existing = await this.prisma.campaignRecipient.findMany({
      where: { campaignId },
      select: { phone: true },
    });
    const existingPhones = new Set(existing.map(r => r.phone));
    const newOnes = participants.filter((p: any) => !existingPhones.has(p.phone));

    if (newOnes.length > 0) {
      await this.prisma.campaignRecipient.createMany({
        data: newOnes.map((p: any) => ({
          campaignId,
          phone: p.phone,
          name: p.name || undefined,
          isGroupAdmin: p.isAdmin,
          sourceGroup: groupJid,
        })),
      });
    }

    return { added: newOnes.length, total: existingPhones.size + newOnes.length };
  }

  async getCampaignSendHistory(tenantId: string, campaignId: string) {
    await this.assertCampaignBelongs(tenantId, campaignId);

    const sentRecipients = await this.prisma.campaignRecipient.findMany({
      where: { campaignId, status: 'sent' },
      select: { phone: true, name: true, sentAt: true },
      orderBy: { sentAt: 'desc' },
    });

    return sentRecipients;
  }

  async getCampaignRecipients(tenantId: string, campaignId: string) {
    await this.assertCampaignBelongs(tenantId, campaignId);

    const recipients = await this.prisma.campaignRecipient.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
    });

    return recipients;
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────────

  private async assertCampaignBelongs(tenantId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id: campaignId, tenantId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async getCampaignListHealth(tenantId: string, campaignId: string) {
    await this.assertCampaignBelongs(tenantId, campaignId);
    const recipients = await this.prisma.campaignRecipient.findMany({
      where: { campaignId },
      select: { phone: true },
    });
    const phones = recipients.map(r => r.phone);
    return this.reputation.getListHealth(tenantId, phones);
  }

  async triggerListHealthCalculation(tenantId: string, campaignId: string): Promise<void> {
    const cacheKey = `list-health:${campaignId}`;
    // Run calculation in background (don't await)
    this.doListHealthCalculation(tenantId, campaignId, cacheKey).catch(err =>
      console.error(`[LIST_HEALTH] Erro ao calcular health para campanha ${campaignId}:`, err),
    );
  }

  private async doListHealthCalculation(tenantId: string, campaignId: string, cacheKey: string): Promise<void> {
    const client = this.redis.getClient();
    const recipients = await this.prisma.campaignRecipient.findMany({
      where: { campaignId },
      select: { phone: true },
    });
    const phones = recipients.map(r => r.phone);
    const result = await this.reputation.getListHealth(tenantId, phones);
    const payload = JSON.stringify({ ...result, calculatedAt: new Date().toISOString(), stale: false });
    await client.set(cacheKey, payload, 'EX', 1800); // 30 min TTL

    // Notify frontend via event
    this.eventBus.emit({
      type: 'list-health.ready' as any,
      tenantId,
      campaignId,
      result,
      timestamp: new Date(),
    } as any).catch(() => {});
  }

  async getCampaignListHealthCached(tenantId: string, campaignId: string): Promise<any> {
    await this.assertCampaignBelongs(tenantId, campaignId);
    const client = this.redis.getClient();
    const cacheKey = `list-health:${campaignId}`;
    const cached = await client.get(cacheKey);

    if (cached) {
      const data = JSON.parse(cached);
      const ageMs = Date.now() - new Date(data.calculatedAt).getTime();
      if (ageMs > 25 * 60 * 1000) { // stale after 25 min
        // Return stale result and trigger background refresh
        this.triggerListHealthCalculation(tenantId, campaignId);
        return { ...data, stale: true };
      }
      return data;
    }

    // No cache — trigger calculation and return status
    this.triggerListHealthCalculation(tenantId, campaignId);
    return { status: 'calculating' };
  }

  /**
   * Validates phone format. Accepts Brazilian (DDI 55 + DDD + 8-9 digits)
   * and international (E.164 format, 7-15 digits).
   */
  private isValidPhone(phone: string): boolean {
    if (!phone) return false;
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 7 || cleaned.length > 15) return false;

    // Brazilian: 55 + 2-digit DDD + 8 or 9 digits = 12 or 13 digits total
    if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) {
      const ddd = parseInt(cleaned.substring(2, 4), 10);
      const validDDDs = [
        11,12,13,14,15,16,17,18,19, // SP
        21,22,24,                    // RJ
        27,28,                       // ES
        31,32,33,34,35,37,38,        // MG
        41,42,43,44,45,46,           // PR
        47,48,49,                    // SC
        51,53,54,55,                 // RS
        61,                          // DF
        62,64,                       // GO
        63,                          // TO
        65,66,                       // MT
        67,                          // MS
        68,                          // AC
        69,                          // RO
        71,73,74,75,77,              // BA
        79,                          // SE
        81,87,                       // PE
        82,                          // AL
        83,                          // PB
        84,                          // RN
        85,88,                       // CE
        86,89,                       // PI
        91,93,94,                    // PA
        92,97,                       // AM
        95,                          // RR
        96,                          // AP
        98,99,                       // MA
      ];
      return validDDDs.includes(ddd);
    }

    // General international: 7-15 digits
    return cleaned.length >= 7 && cleaned.length <= 15;
  }

  /**
   * Returns true if this phone has delivery failures in 3+ different campaigns
   * (should be auto-blacklisted).
   */
  private async shouldAutoBlacklist(tenantId: string, phone: string): Promise<boolean> {
    const result = await this.prisma.campaignLog.findMany({
      where: { phone, status: 'failed', campaign: { tenantId } },
      select: { campaignId: true },
      distinct: ['campaignId'],
    });
    return result.length >= 3;
  }

  /**
   * Returns true if there is any prior conversation between this session and phone.
   */
  private async hasConversationHistory(sessionId: string, phone: string): Promise<boolean> {
    const count = await this.prisma.conversation.count({
      where: { sessionId, contactPhone: { contains: phone.replace(/\D/g, '').slice(-10) } },
    });
    return count > 0;
  }

  private getResetThresholdInUTC(resetTimeStr: string): Date {
    const [hours, minutes] = (resetTimeStr || '00:00').split(':').map(Number);
    const now = new Date();
    
    // Get current time components in São Paulo
    const spNowFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false
    });
    const parts = spNowFormatter.formatToParts(now);
    const sp: any = {};
    parts.forEach(p => sp[p.type] = p.value);
    
    const spHour = parseInt(sp.hour);
    const spMin = parseInt(sp.minute);

    const minutesSinceMidnightSP = spHour * 60 + spMin;
    const resetMinutes = hours * 60 + minutes;
    
    const threshold = new Date(now);
    let diffMinutes = minutesSinceMidnightSP - resetMinutes;
    
    // If we're before the reset time today, the last reset was yesterday
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60;
    }
    
    threshold.setMinutes(threshold.getMinutes() - diffMinutes);
    threshold.setSeconds(0, 0);
    threshold.setMilliseconds(0);
    
    return threshold;
  }
}
