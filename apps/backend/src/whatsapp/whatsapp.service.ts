import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappSession, WhatsappSessionStatus } from '@n9n/shared';

@Injectable()
export class WhatsappService {
  constructor(private prisma: PrismaService) { }

  /**
   * Create WhatsApp session
   */
  async createSession(tenantId: string, name: string): Promise<WhatsappSession> {
    const session = await this.prisma.whatsappSession.create({
      data: {
        tenantId,
        name,
        status: WhatsappSessionStatus.DISCONNECTED,
      },
    });

    return this.mapToSession(session);
  }

  /**
   * Get session by ID
   */
  async getSession(tenantId: string, sessionId: string): Promise<WhatsappSession | null> {
    const session = await this.prisma.whatsappSession.findFirst({
      where: {
        id: sessionId,
        tenantId,
      },
    });

    return session ? this.mapToSession(session) : null;
  }

  /**
   * Get all sessions for tenant
   */
  async getSessions(tenantId: string): Promise<WhatsappSession[]> {
    const sessions = await this.prisma.whatsappSession.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map(this.mapToSession);
  }

  /**
   * Get all sessions (for initialization)
   */
  async getAllSessions(): Promise<WhatsappSession[]> {
    const sessions = await this.prisma.whatsappSession.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map(this.mapToSession);
  }

  /**
   * Update session
   */
  async updateSession(
    sessionId: string,
    data: Partial<{
      status: WhatsappSessionStatus;
      qrCode: string;
      phoneNumber: string;
      isBusiness: boolean;
    }>,
  ): Promise<WhatsappSession> {
    const session = await this.prisma.whatsappSession.update({
      where: { id: sessionId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    return this.mapToSession(session);
  }

  /**
   * Delete session
   */
  async deleteSession(tenantId: string, sessionId: string): Promise<void> {
    await this.prisma.whatsappSession.delete({
      where: {
        id: sessionId,
        tenantId,
      },
    });
  }

  /**
   * Get all group configurations for a session
   */
  async getGroupConfigs(sessionId: string) {
    return this.prisma.whatsappGroupConfig.findMany({
      where: { sessionId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Update a group configuration
   */
  async updateGroupConfig(
    configId: string,
    data: Partial<{
      enabled: boolean;
      workflowIds: string[];
    }>,
  ) {
    return this.prisma.whatsappGroupConfig.update({
      where: { id: configId },
      data,
    });
  }

  /**
   * Upsert many group configurations (for sync)
   */
  async upsertGroupConfigs(sessionId: string, groups: { groupId: string; name: string }[]) {
    const results = [];

    for (const group of groups) {
      const config = await this.prisma.whatsappGroupConfig.upsert({
        where: {
          sessionId_groupId: {
            sessionId,
            groupId: group.groupId,
          },
        },
        update: {
          name: group.name,
        },
        create: {
          sessionId,
          groupId: group.groupId,
          name: group.name,
          enabled: false,
          workflowIds: [],
        },
      });
      results.push(config);
    }

    return results;
  }

  /**
   * Upsert many labels for a session
   */
  async upsertLabels(sessionId: string, labels: { labelId: string; name: string; color?: number }[]) {
    const results = [];
    for (const label of labels) {
      const result = await this.prisma.whatsappLabel.upsert({
        where: {
          sessionId_labelId: {
            sessionId,
            labelId: label.labelId,
          },
        },
        update: {
          name: label.name,
          color: label.color,
          updatedAt: new Date(),
        },
        create: {
          sessionId,
          labelId: label.labelId,
          name: label.name,
          color: label.color,
        },
      });
      results.push(result);
    }
    return results;
  }

  /**
   * Delete a label by ID
   */
  async deleteLabel(sessionId: string, labelId: string) {
    return this.prisma.whatsappLabel.deleteMany({
      where: { sessionId, labelId },
    });
  }

  /**
   * Get all labels for a session
   */
  async getLabels(sessionId: string) {
    return this.prisma.whatsappLabel.findMany({
      where: { sessionId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Sync chat labels (associations)
   */
  async syncChatLabels(sessionId: string, chatId: string, labelIds: string[]) {
    // Remove existing associations for this chat
    await this.prisma.whatsappChatLabel.deleteMany({
      where: { sessionId, chatId },
    });

    // Bulk create new ones
    if (labelIds.length > 0) {
      return this.prisma.whatsappChatLabel.createMany({
        data: labelIds.map((labelId) => ({
          sessionId,
          chatId,
          labelId,
        })),
      });
    }
    return { count: 0 };
  }

  /**
   * Add association between chat and labels
   */
  async addChatLabels(sessionId: string, chatId: string, labelIds: string[]) {
    const data = labelIds.map(labelId => ({
      sessionId,
      chatId,
      labelId
    }));

    return this.prisma.whatsappChatLabel.createMany({
      data,
      skipDuplicates: true
    });
  }

  /**
   * Remove association between chat and labels
   */
  async removeChatLabels(sessionId: string, chatId: string, labelIds: string[]) {
    return this.prisma.whatsappChatLabel.deleteMany({
      where: {
        sessionId,
        chatId,
        labelId: { in: labelIds }
      }
    });
  }

  /**
   * Get labels associated with a chat
   */
  async getChatLabels(sessionId: string, chatId: string) {
    const associations = await this.prisma.whatsappChatLabel.findMany({
      where: { sessionId, chatId },
    });

    const labelIds = associations.map(a => a.labelId);

    return this.prisma.whatsappLabel.findMany({
      where: {
        sessionId,
        labelId: { in: labelIds },
      },
    });
  }

  private mapToSession(data: any): WhatsappSession {
    return {
      id: data.id,
      tenantId: data.tenantId,
      name: data.name,
      status: data.status as WhatsappSessionStatus,
      qrCode: data.qrCode,
      phoneNumber: data.phoneNumber,
      isBusiness: data.isBusiness || false,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
}

