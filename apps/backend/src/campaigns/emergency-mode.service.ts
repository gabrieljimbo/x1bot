import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class EmergencyModeService {
  private readonly logger = new Logger(EmergencyModeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async activate(tenantId: string, reason: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        emergencyMode: true,
        emergencyActivatedAt: new Date(),
        emergencyExpiresAt: expiresAt,
        emergencyReason: reason,
        emergencyCapacity: 0.2,
      },
    });
    this.logger.warn(`[EMERGENCY] Tenant ${tenantId}: modo de emergência ativado. Expira: ${expiresAt.toISOString()}`);
    this.eventEmitter.emit('emergency.activated', { tenantId, reason, expiresAt });
  }

  async deactivate(tenantId: string): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        emergencyMode: false,
        emergencyCapacity: 1.0,
        emergencyExpiresAt: null,
        emergencyReason: null,
      },
    });
    this.logger.log(`[EMERGENCY] Tenant ${tenantId}: modo de emergência desativado`);
    this.eventEmitter.emit('emergency.deactivated', { tenantId });
  }

  async getStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        emergencyMode: true,
        emergencyActivatedAt: true,
        emergencyExpiresAt: true,
        emergencyReason: true,
        emergencyCapacity: true,
      },
    });
    return tenant ?? { emergencyMode: false, emergencyCapacity: 1.0 };
  }

  @Cron('*/30 * * * *') // every 30 minutes
  async checkEmergencyExpiry(): Promise<void> {
    try {
      const now = new Date();
      const expiredTenants = await this.prisma.tenant.findMany({
        where: {
          emergencyMode: true,
          emergencyExpiresAt: { lte: now },
        },
        select: { id: true, emergencyCapacity: true },
      });

      for (const tenant of expiredTenants) {
        const currentCapacity = tenant.emergencyCapacity ?? 0.2;
        const newCapacity = Math.min(1.0, currentCapacity + 0.1);

        if (newCapacity >= 1.0) {
          await this.deactivate(tenant.id);
        } else {
          await this.prisma.tenant.update({
            where: { id: tenant.id },
            data: {
              emergencyCapacity: newCapacity,
              emergencyExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
            },
          });
          this.logger.log(`[EMERGENCY] Tenant ${tenant.id}: capacidade restaurada para ${Math.round(newCapacity * 100)}%`);
          this.eventEmitter.emit('emergency.recovery', { tenantId: tenant.id, capacity: newCapacity });
        }
      }
    } catch (err) {
      this.logger.error('[EMERGENCY] Erro no cron de expiração:', err);
    }
  }
}
