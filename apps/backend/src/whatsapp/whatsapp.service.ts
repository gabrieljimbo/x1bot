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

  private mapToSession(data: any): WhatsappSession {
    return {
      id: data.id,
      tenantId: data.tenantId,
      name: data.name,
      status: data.status as WhatsappSessionStatus,
      qrCode: data.qrCode,
      phoneNumber: data.phoneNumber,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
}

