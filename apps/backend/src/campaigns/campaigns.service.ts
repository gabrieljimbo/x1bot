import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappSessionManager } from '../whatsapp/whatsapp-session-manager.service';
import { CampaignStatus, CampaignType } from '@prisma/client';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappSessionManager: WhatsappSessionManager,
  ) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  async createCampaign(tenantId: string, dto: {
    name: string;
    type?: CampaignType;
    scheduledAt?: Date;
    limitPerSession?: number;
    delayMin?: number;
    delayMax?: number;
    excludeBlocked?: boolean;
    sessionIds?: string[];
    messages?: { order: number; type: string; content?: string; mediaUrl?: string; caption?: string }[];
  }) {
    const campaign = await this.prisma.campaign.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type ?? CampaignType.SIMPLE,
        scheduledAt: dto.scheduledAt,
        limitPerSession: dto.limitPerSession ?? 50,
        delayMin: dto.delayMin ?? 5,
        delayMax: dto.delayMax ?? 30,
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
    scheduledAt?: Date | null;
    limitPerSession?: number;
    delayMin?: number;
    delayMax?: number;
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

  async addRecipientsFromContacts(campaignId: string, tenantId: string, filters: { tags?: string[] }) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id: campaignId, tenantId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const contactTags = await this.prisma.contactTag.findMany({
      where: {
        tenantId,
        ...(filters.tags && filters.tags.length > 0 ? { tags: { hasSome: filters.tags } } : {}),
      },
    });

    const phones = [...new Set(contactTags.map((c) => c.contactPhone))];
    return this.addRecipientsFromPhones(campaignId, phones);
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
    if (!campaign) return;

    const pendingRecipients = campaign.recipients.filter((r) => r.status === 'pending');
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

  // ─── HELPERS ──────────────────────────────────────────────────────────────────

  private async assertCampaignBelongs(tenantId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id: campaignId, tenantId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }
}
