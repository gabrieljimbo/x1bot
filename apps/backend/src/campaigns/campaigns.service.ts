import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappSessionManager } from '../whatsapp/whatsapp-session-manager.service';
import { ExecutionEngineService } from '../execution/execution-engine.service';
import { CampaignStatus, CampaignType, Prisma } from '@prisma/client';
import { StorageService } from '../storage/storage.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappSessionManager: WhatsappSessionManager,
    private readonly executionEngine: ExecutionEngineService,
    private readonly storageService: StorageService,
  ) { }

  private processingCampaigns = new Set<string>();

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCampaignScheduler() {
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
        dailyResetTime: dto.dailyResetTime ?? '00:00',
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
        dailyResetTime: (original as any).dailyResetTime ?? '00:00',
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
      // Get all executions linked to this campaign
      const executions = await this.prisma.workflowExecution.findMany({
        where: { campaignId },
        select: { id: true, status: true, currentNodeId: true, workflowId: true }
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

        const nodeMap = new Map<string, string>();
        for (const n of workflowNodes) {
          let name: string = n.data?.label || n.data?.name || n.data?.displayName || '';
          
          if (n.type === 'MARK_STAGE' || n.type === 'SET_STAGE') {
            const stage = n.data?.stageName || n.data?.name || n.data?.label;
            name = stage ? `🚩 Etapa: ${stage}` : 'Marcar Etapa';
          } else if (n.type === 'WAIT' || n.type === 'DELAY' || n.type === 'GRUPO_WAIT') {
            const amount = n.data?.amount || n.data?.delay || n.data?.waitTime || n.data?.duration;
            const unit = n.data?.unit || 'seconds';
            const unitMap: any = { seconds: 'seg', minutes: 'min', hours: 'h', days: 'd', s: 'seg', m: 'min' };
            name = `⏳ Aguardar ${amount}${unitMap[unit] || unit}`;
          } else if (n.type === 'WAIT_REPLY' || n.type === 'ASK') {
            name = `📩 Aguardar Resposta`;
            const timeout = n.data?.timeoutAmount || n.data?.timeout;
            if (timeout) name += ` (${timeout}s)`;
          } else if (n.type === 'SEND_MESSAGE' || n.type === 'SEND_TEXT') {
            const text = n.data?.text || n.data?.content;
            if (text && (!name || name === n.type)) {
              name = text.length > 25 ? text.substring(0, 25) + '...' : text;
            }
          } else if (n.type === 'SEND_MEDIA') {
            const caption = n.data?.caption;
            const type = n.data?.mediaType || 'Mídia';
            if (!name || name === n.type) {
              name = caption ? `🖼️ ${caption.substring(0, 20)}...` : `🏷️ Enviar ${type}`;
            }
          }
          
          if (!name) {
            name = n.type || `Nó ${n.id.substring(0, 6)}`;
          }
          
          nodeMap.set(n.id, name);
        }

        const initStat = (nodeId: string) => {
          if (!nodeStatsMap[nodeId]) {
            nodeStatsMap[nodeId] = {
              nodeId,
              nodeName: nodeMap.get(nodeId) || `Nó: ${nodeId.substring(0, 8)}`,
              totalExecutions: 0,
              successCount: 0,
              failCount: 0,
              waitingCount: 0,
              runningCount: 0,
            };
          }
        };

        // 1. Process Logs (Historical path)
        const visits = new Set<string>(); // composite key execId:nodeId to avoid double counting in case of loops for totalExecutions
        for (const log of logs) {
          if (!log.nodeId) continue;
          const key = `${log.executionId}:${log.nodeId}`;
          if (!visits.has(key)) {
            visits.add(key);
            initStat(log.nodeId);
            nodeStatsMap[log.nodeId].totalExecutions++;
            // Mark as success (passed through) unless it's the current node which we'll handle below
            nodeStatsMap[log.nodeId].successCount++;
          }
        }

        // 2. Process Current state for exact status (handles waiting/running/failed at the specific node)
        for (const exec of executions) {
          const nodeId = exec.currentNodeId;
          if (!nodeId) continue;

          initStat(nodeId);
          
          // If we didn't have a log for this current node (e.g. migration or race condition), count it
          const key = `${exec.id}:${nodeId}`;
          if (!visits.has(key)) {
            visits.add(key);
            nodeStatsMap[nodeId].totalExecutions++;
          } else {
            // Correct the "successCount++" from logs above if they are actually stuck/failed here
            nodeStatsMap[nodeId].successCount--;
          }

          if (exec.status === 'COMPLETED') {
            nodeStatsMap[nodeId].successCount++;
          } else if (['ERROR', 'FAILED', 'EXPIRED'].includes(exec.status)) {
            nodeStatsMap[nodeId].failCount++;
          } else if (exec.status === 'WAITING') {
            nodeStatsMap[nodeId].waitingCount++;
          } else if (exec.status === 'RUNNING') {
            nodeStatsMap[nodeId].runningCount++;
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
      nodeStats: Object.values(nodeStatsMap).sort((a: any, b: any) => b.totalExecutions - a.totalExecutions),
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

    let shadowWorkflowId: string | null = null;
    if (campaign.type === 'WORKFLOW') {
      const campaignWf = await this.prisma.campaignWorkflow.findUnique({
        where: { campaignId: campaign.id },
      });
      if (campaignWf && campaignWf.nodes) {
        // Upsert shadow workflow
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
            name: `[Auto] Campanha: ${campaign.name}`,
            nodes: campaignWf.nodes ?? Prisma.JsonNull,
            edges: campaignWf.edges ?? Prisma.JsonNull,
            isActive: true,
          }
        });
        shadowWorkflowId = shadowWf.id;
      }
    }

    let pendingRecipients = campaign.recipients.filter((r) => r.status === 'pending');
    if (campaign.randomOrder) {
      for (let i = pendingRecipients.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pendingRecipients[i], pendingRecipients[j]] = [pendingRecipients[j], pendingRecipients[i]];
      }
    }
    let sessionIndex = 0;
    const now = new Date();
    const todayThreshold = this.getResetThresholdInUTC((campaign as any).dailyResetTime);

    for (const recipient of pendingRecipients) {
      const current = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
      if (!current || (current.status as string) !== CampaignStatus.RUNNING) break;

      if (campaign.excludeBlocked) {
        const blocked = await this.isBlacklisted(campaign.tenantId, recipient.phone);
        if (blocked) {
          await this.prisma.campaignRecipient.update({ where: { id: recipient.id }, data: { status: 'blocked' } });
          continue;
        }
      }

      // Find a session with available capacity for this recipient.
      // Uses an inner while-loop so we never skip a recipient when rotating sessions.
      let session: (typeof campaign.sessions)[0] | null = null;
      let sessionsChecked = 0;
      while (sessionsChecked < campaign.sessions.length) {
        const candidate = campaign.sessions[sessionIndex % campaign.sessions.length];
        if (!candidate) break;

        const countWhere: any = {
          campaignId,
          sessionId: candidate.sessionId,
          status: 'sent',
        };
        if ((campaign as any).limitType === 'DAILY') {
          countWhere.sentAt = { gte: todayThreshold };
        }

        const sentCount = await this.prisma.campaignLog.count({ where: countWhere });
        if (sentCount < (campaign as any).limitPerSession) {
          session = candidate;
          break;
        }

        sessionIndex++;
        sessionsChecked++;
      }

      if (!session) {
        console.log(`[CampaignsService] All sessions exhausted for campaign ${campaignId} (${(campaign as any).limitType} limit)`);
        break;
      }

      try {
        if (campaign.workflowId) {
          // Mark as processing, engine will mark as sent/failed later
          await this.prisma.campaignRecipient.update({ where: { id: recipient.id }, data: { status: 'processing' } });

          if (shadowWorkflowId) {
            // Execute CampaignWorkflow via shadow Workflow using ExecutionEngine
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
            // Fallback: workflowId references a regular Workflow
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
          // Simple campaign: send messages directly
          for (const msg of campaign.messages) {
            if (msg.mediaUrl && msg.type !== 'text') {
              await this.whatsappSessionManager.sendMedia(
                session.sessionId,
                recipient.phone,
                msg.type as 'image' | 'video' | 'audio' | 'document',
                msg.mediaUrl,
                { caption: msg.caption ?? undefined, bypassDelay: true },
              );
            } else if (msg.content) {
              await this.whatsappSessionManager.sendMessage(session.sessionId, recipient.phone, msg.content, true);
            }
          }
          // Only mark as sent directly for simple campaigns
          await this.prisma.campaignRecipient.update({ where: { id: recipient.id }, data: { status: 'sent', sentAt: new Date() } });
          await this.prisma.campaignLog.create({ data: { campaignId, phone: recipient.phone, sessionId: session.sessionId, status: 'sent' } });
        }
      } catch (e: any) {
        const isBlocked = e.message?.includes('blocked') || e.message?.includes('forbidden');
        await this.prisma.campaignRecipient.update({ where: { id: recipient.id }, data: { status: 'failed', error: e.message } });
        await this.prisma.campaignLog.create({
          data: { campaignId, phone: recipient.phone, sessionId: session.sessionId, status: isBlocked ? 'blocked' : 'failed', error: e.message },
        });
        if (isBlocked) await this.addToBlacklist(campaign.tenantId, recipient.phone, 'blocked');
      }

      const delay = Math.floor(Math.random() * (campaign.delayMax - campaign.delayMin + 1)) + campaign.delayMin;
      await new Promise((r) => setTimeout(r, delay * 1000));
    }

    const finalState = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (finalState && finalState.status === CampaignStatus.RUNNING) {
      const hasPending = await this.prisma.campaignRecipient.count({
        where: { campaignId, status: 'pending' }
      });
      
      if (hasPending === 0) {
        await this.prisma.campaign.update({ 
          where: { id: campaignId }, 
          data: { status: CampaignStatus.COMPLETED, completedAt: new Date() } 
        });
      }
    }
    } finally {
      this.processingCampaigns.delete(campaignId);
    }
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
      const phone = p.id.split('@')[0];
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
