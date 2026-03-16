import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SessionHealthMonitorService } from '../whatsapp/session-health-monitor.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Redis key: last progress timestamp per campaign
const kLastProgress = (campaignId: string) => `wa:diag:progress:${campaignId}`;
// Redis key: stall reason per campaign
const kStallReason = (campaignId: string) => `wa:diag:stall:${campaignId}`;

const STALL_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export type StallReason =
  | 'TOURIST_MODE'
  | 'CIRCUIT_OPEN'
  | 'DMS_PAUSE'
  | 'REPUTATION_BLOCK'
  | 'OUT_OF_HOURS'
  | 'DAILY_LIMIT'
  | 'EMERGENCY_MODE'
  | 'UNKNOWN';

export const STALL_MESSAGES: Record<StallReason, string> = {
  TOURIST_MODE: 'Campanha pausada: sessão em modo de proteção, enviando apenas para contatos com histórico',
  CIRCUIT_OPEN: 'Campanha pausada: muitas falhas consecutivas, aguardando 15min para retomar',
  DMS_PAUSE: 'Campanha pausada: pausa automática após 2h de envio contínuo, retoma em breve',
  REPUTATION_BLOCK: 'Campanha pausada: contatos restantes estão em quarentena ou blacklist',
  OUT_OF_HOURS: 'Campanha pausada: fora da janela de envio (08:00–20:00). Retoma amanhã às 08:00',
  DAILY_LIMIT: 'Campanha pausada: limite diário da sessão atingido. Retoma amanhã às 09:00',
  EMERGENCY_MODE: 'Campanha pausada: modo de emergência ativo. Intervenção manual necessária',
  UNKNOWN: 'Campanha com progresso lento — verificando automaticamente',
};

@Injectable()
export class QueueDiagnosticService {
  private readonly logger = new Logger(QueueDiagnosticService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly healthMonitor: SessionHealthMonitorService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Call this after each successful send to record progress */
  async recordProgress(campaignId: string): Promise<void> {
    const client = this.redis.getClient();
    await client.set(kLastProgress(campaignId), Date.now().toString(), 'EX', 3600);
    // Clear any previous stall reason when progress is made
    await client.del(kStallReason(campaignId));
  }

  /** Get current stall reason (if any) for a campaign */
  async getStallReason(campaignId: string): Promise<{ reason: StallReason | null; message: string | null }> {
    const client = this.redis.getClient();
    const reason = await client.get(kStallReason(campaignId)) as StallReason | null;
    return {
      reason,
      message: reason ? STALL_MESSAGES[reason] : null,
    };
  }

  @Cron('*/5 * * * *') // every 5 minutes
  async checkStalledCampaigns(): Promise<void> {
    try {
      const runningCampaigns = await this.prisma.campaign.findMany({
        where: { status: 'RUNNING' },
        select: { id: true, tenantId: true, sessions: { select: { sessionId: true } } },
      });

      for (const campaign of runningCampaigns) {
        await this.checkCampaign(campaign);
      }
    } catch (err) {
      this.logger.error('[QUEUE_DIAG] Erro no cron de diagnóstico:', err);
    }
  }

  private async checkCampaign(campaign: { id: string; tenantId: string; sessions: { sessionId: string }[] }): Promise<void> {
    const client = this.redis.getClient();
    const lastProgressStr = await client.get(kLastProgress(campaign.id));

    if (!lastProgressStr) {
      // No progress recorded yet — set baseline
      await client.set(kLastProgress(campaign.id), Date.now().toString(), 'EX', 3600);
      return;
    }

    const lastProgress = parseInt(lastProgressStr, 10);
    const stalledMs = Date.now() - lastProgress;

    if (stalledMs < STALL_THRESHOLD_MS) return;

    // Campaign is stalled — diagnose reason
    const reason = await this.diagnose(campaign);

    this.logger.warn(`[QUEUE_DIAG] Campanha ${campaign.id} travada por: ${reason}`);

    // Save reason to Redis (TTL 30min)
    await client.set(kStallReason(campaign.id), reason, 'EX', 1800);

    // Emit WebSocket event
    this.eventEmitter.emit('campaign.stalled', {
      campaignId: campaign.id,
      tenantId: campaign.tenantId,
      reason,
      message: STALL_MESSAGES[reason],
    });
  }

  private async diagnose(campaign: { id: string; tenantId: string; sessions: { sessionId: string }[] }): Promise<StallReason> {
    const sessionIds = campaign.sessions.map(s => s.sessionId);

    // 1. Check emergency mode
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: campaign.tenantId },
      select: { id: true } as any,
    });
    // emergencyMode field added in Fix 8 — check with optional chaining
    if ((tenant as any)?.emergencyMode) return 'EMERGENCY_MODE';

    // 2. Check current hour (São Paulo)
    const nowSP = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const hour = nowSP.getHours();
    if (hour < 8 || hour >= 20) return 'OUT_OF_HOURS';

    // 3. Check sessions
    for (const sessionId of sessionIds) {
      // Circuit breaker
      const cbState = await this.healthMonitor.getCircuitBreakerState(sessionId);
      if (cbState === 'OPEN') return 'CIRCUIT_OPEN';

      // DMS pause
      const dmsPaused = await this.healthMonitor.isDmsPaused(sessionId);
      if (dmsPaused) return 'DMS_PAUSE';

      // Tourist mode
      const touristMode = await this.healthMonitor.isTouristMode(sessionId);
      if (touristMode) return 'TOURIST_MODE';

      // Daily limit
      const score = await this.healthMonitor.getScore(sessionId);
      if (score <= 0) return 'DAILY_LIMIT';
    }

    // 4. Check reputation block (% of remaining recipients in quarantine)
    const pendingCount = await this.prisma.campaignRecipient.count({
      where: { campaignId: campaign.id, status: 'pending' },
    });
    if (pendingCount === 0) return 'UNKNOWN';

    const pendingPhones = await this.prisma.campaignRecipient.findMany({
      where: { campaignId: campaign.id, status: 'pending' },
      select: { phone: true },
      take: 100, // sample
    });
    const phones = pendingPhones.map(r => r.phone);
    const quarantined = await this.prisma.contactReputation.count({
      where: {
        tenantId: campaign.tenantId,
        phone: { in: phones },
        quarantineUntil: { gt: new Date() },
      },
    });
    if (phones.length > 0 && quarantined / phones.length >= 0.8) return 'REPUTATION_BLOCK';

    return 'UNKNOWN';
  }
}
