import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappSessionManager } from '../whatsapp/whatsapp-session-manager.service';
import { ExecutionEngineService } from '../execution/execution-engine.service';
import { CampaignStatus, CampaignType } from '@prisma/client';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappSessionManager: WhatsappSessionManager,
    private readonly executionEngine: ExecutionEngineService,
  ) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  async createCampaign(tenantId: string, dto: {
    name: string;
    type?: CampaignType;
    workflowId?: string;
    scheduledAt?: Date;
    limitPerSession?: number;
    delayMin?: number;
    delayMax?: number;
    randomOrder?: boolean;
    excludeBlocked?: boolean;
    sessionIds?: string[];
    messages?: { order: number; type: string; content?: string; mediaUrl?: string; caption?: string }[];
  }) {
    const campaign = await this.prisma.campaign.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type ?? CampaignType.SIMPLE,
        workflowId: dto.workflowId ?? null,
        scheduledAt: dto.scheduledAt,
        limitPerSession: dto.limitPerSession ?? 50,
        delayMin: dto.delayMin ?? 5,
        delayMax: dto.delayMax ?? 30,
        randomOrder: dto.randomOrder ?? true,
        excludeBlocked: dto.excludeBlocked ?? true,
      },
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

    return this.getCampaignById(tenantId, campaign.id);
  }

  async updateCampaign(tenantId: string, campaignId: string, dto: {
    name?: string;
    workflowId?: string | null;
    scheduledAt?: Date | null;
    limitPerSession?: number;
    delayMin?: number;
    delayMax?: number;
    randomOrder?: boolean;
    excludeBlocked?: boolean;
    sessionIds?: string[];
    messages?: { order: number; type: string; content?: string; mediaUrl?: string; caption?: string }[];
  }) {
    await this.assertCampaignBelongs(tenantId, campaignId);
    const { sessionIds, messages, ...rest } = dto;

    await this.prisma.campaign.update({ where: { id: campaignId }, data: rest });

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
    await this.prisma.campaign.delete({ where: { id: campaignId } });
    return { success: true };
  }

  async getCampaigns(tenantId: string, type?: CampaignType) {
    return this.prisma.campaign.findMany({
      where: { tenantId, ...(type ? { type } : {}) },
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
        contactLists: { include: { contactList: true } },
        _count: { select: { recipients: true } },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
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
      where: { tenantId, type: CampaignType.WORKFLOW },
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
    return this.prisma.campaignWorkflow.upsert({
      where: { campaignId },
      update: { nodes, edges },
      create: { campaignId, nodes, edges },
    });
  }

  async getWorkflow(campaignId: string, tenantId: string) {
    await this.assertCampaignBelongs(tenantId, campaignId);
    const workflow = await this.prisma.campaignWorkflow.findUnique({ where: { campaignId } });
    return workflow ?? { campaignId, nodes: [], edges: [] };
  }

  // ─── EXECUTION ────────────────────────────────────────────────────────────────

  async startCampaign(tenantId: string, campaignId: string) {
    const campaign = await this.getCampaignById(tenantId, campaignId);
    if (campaign.status === CampaignStatus.RUNNING) throw new BadRequestException('Campaign is already running');
    if (!campaign.sessions || campaign.sessions.length === 0) throw new BadRequestException('Campaign has no sessions configured');

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.RUNNING, startedAt: new Date() },
    });

    this.processCampaign(campaignId).catch((err) => {
      console.error(`Campaign ${campaignId} failed:`, err);
      this.prisma.campaign.update({ where: { id: campaignId }, data: { status: CampaignStatus.FAILED } }).catch(() => {});
    });

    return { success: true, status: CampaignStatus.RUNNING };
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
      this.prisma.campaign.update({ where: { id: campaignId }, data: { status: CampaignStatus.FAILED } }).catch(() => {});
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

  // ─── WORKER ───────────────────────────────────────────────────────────────────

  async processCampaign(campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { recipients: true, sessions: true, messages: { orderBy: { order: 'asc' } } },
    });
    // campaign.workflowId is now available directly from the model
    if (!campaign) return;

    let shadowWorkflowId: string | null = null;
    if (campaign.type === 'WORKFLOW' && campaign.workflowId) {
      const campaignWf = await this.prisma.campaignWorkflow.findUnique({
        where: { campaignId: campaign.workflowId },
      });
      if (campaignWf) {
        // Upsert shadow workflow
        const shadowId = `shadow-${campaign.workflowId}`;
        const shadowWf = await this.prisma.workflow.upsert({
          where: { id: shadowId },
          create: {
            id: shadowId,
            tenantId: campaign.tenantId,
            name: `[Auto] Campanha: ${campaign.name}`,
            description: 'Workflow virtual gerado automaticamente',
            isActive: true,
            nodes: campaignWf.nodes ? (campaignWf.nodes as any) : [],
            edges: campaignWf.edges ? (campaignWf.edges as any) : [],
          },
          update: {
            name: `[Auto] Campanha: ${campaign.name}`,
            nodes: campaignWf.nodes ? (campaignWf.nodes as any) : [],
            edges: campaignWf.edges ? (campaignWf.edges as any) : [],
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

    for (const recipient of pendingRecipients) {
      const current = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
      if (!current || current.status !== CampaignStatus.RUNNING) break;

      if (campaign.excludeBlocked) {
        const blocked = await this.isBlacklisted(campaign.tenantId, recipient.phone);
        if (blocked) {
          await this.prisma.campaignRecipient.update({ where: { id: recipient.id }, data: { status: 'blocked' } });
          continue;
        }
      }

      // Rotate sessions respecting limit
      let session = campaign.sessions[sessionIndex % Math.max(campaign.sessions.length, 1)];
      if (!session) break;

      const sessionSentCount = await this.prisma.campaignLog.count({
        where: { campaignId, sessionId: session.sessionId, status: 'sent' },
      });

      if (sessionSentCount >= campaign.limitPerSession) {
        sessionIndex++;
        if (sessionIndex >= campaign.sessions.length) break;
        session = campaign.sessions[sessionIndex];
      }

      try {
        if (campaign.workflowId) {
          if (shadowWorkflowId) {
             // Execute CampaignWorkflow via shadow Workflow using ExecutionEngine
             await this.executionEngine.startExecution(
               campaign.tenantId,
               shadowWorkflowId,
               session.sessionId,
               recipient.phone,
               undefined,
               undefined,
               { triggerType: 'CAMPAIGN_START' }
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
              { triggerType: 'CAMPAIGN' },
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
        }

        await this.prisma.campaignRecipient.update({ where: { id: recipient.id }, data: { status: 'sent', sentAt: new Date() } });
        await this.prisma.campaignLog.create({ data: { campaignId, phone: recipient.phone, sessionId: session.sessionId, status: 'sent' } });
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
      await this.prisma.campaign.update({ where: { id: campaignId }, data: { status: CampaignStatus.COMPLETED, completedAt: new Date() } });
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

  async getGroupParticipants(tenantId: string, sessionId: string, groupJid: string) {
    // Verify session belongs to tenant
    const session = await this.prisma.whatsappSession.findFirst({
      where: { id: sessionId, tenantId },
    });
    if (!session) throw new NotFoundException('Session not found');

    const metadata = await this.whatsappSessionManager.getGroupMetadata(sessionId, groupJid);

    return (metadata.participants || []).map((p: any) => {
      const phone = p.id.split('@')[0];
      return {
        phone,
        name: p.name || p.notify || null,
        isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
        isSuperAdmin: p.admin === 'superadmin',
      };
    });
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

    // Check send history: filter out phones already sent in this campaign
    if (!options.allowResend) {
      const alreadySent = await this.prisma.campaignRecipient.findMany({
        where: { campaignId, status: 'sent' },
        select: { phone: true },
      });
      const sentPhones = new Set(alreadySent.map(r => r.phone));
      participants = participants.filter((p: any) => !sentPhones.has(p.phone));
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

  // ─── HELPERS ──────────────────────────────────────────────────────────────────

  private async assertCampaignBelongs(tenantId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id: campaignId, tenantId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }
}
