import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CampaignSettingsService } from './campaign-settings.service';

// ─── Score constants ───────────────────────────────────────────────────────────

const DEFAULT_SCORE = 70;

// Penalties — only for real negative signals
const P_STOP_KEYWORD    = 40;   // Explicit opt-out → quarantine
const P_DELIVERY_ERROR  = 25;   // Bad number / blocked → skip after 2 errors
// NOTE: no-reply is NOT penalized — most people never reply to marketing

// Recovery
const R_ANY_REPLY         = 15;
const R_INTERESTED_REPLY  = 25;
const R_30DAYS_INACTIVE   = 10;  // Gentle recovery after 30 days without sends

// Thresholds
const SCORE_QUARANTINE    = 20;  // Only reachable via stop keyword + delivery errors
const SCORE_BAD_NUMBER    = 25;  // Score drops here after 2+ delivery errors

// Exposure limits — operational protection, not reputation-based
const MAX_CAMPAIGNS_PER_DAY   = 1;  // Max 1 campaign/day per contact
const MAX_CAMPAIGNS_7_DAYS    = 3;  // Max 3 campaigns/week per contact

// Quarantine duration after stop keyword
const QUARANTINE_DAYS_STOP    = 30; // Respect opt-out for 30 days

export type ReputationLevel = 'high' | 'medium' | 'low' | 'quarantine';

export interface ReputationCheck {
  canSend: boolean;
  reason?: string;
  delayMultiplier: number;
}

export interface ListHealthReport {
  total: number;
  highReputation: number;    // score > 70
  mediumReputation: number;  // score 50–70
  lowReputation: number;     // score 20–50 (delivery issues)
  quarantine: number;        // active quarantine (stop keyword)
  blacklisted: number;       // on blacklist (explicit opt-out or bad number)
  estimatedSafeToSend: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

@Injectable()
export class ContactReputationService {
  private readonly logger = new Logger(ContactReputationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly campaignSettings: CampaignSettingsService,
  ) {}

  // ─── Redis keys for timing analysis ───────────────────────────────────────

  private kTimingCount  = (tenantId: string, hour: number) => `wa:timing:${tenantId}:${hour}:count`;
  private kTimingReply  = (tenantId: string, hour: number) => `wa:timing:${tenantId}:${hour}:reply`;
  private kLowHour      = (tenantId: string, hour: number) => `wa:timing:low:${tenantId}:${hour}`;

  // ─── Event listener: contact replied ─────────────────────────────────────

  @OnEvent('contact.replied')
  async onContactReplied(payload: {
    tenantId: string;
    phone: string;
    responseTimeMs: number;
    isStop: boolean;
    isInterested: boolean;
  }): Promise<void> {
    try {
      if (payload.isStop) {
        const settings = await this.campaignSettings.getSettings(payload.tenantId);
        await this.recordStopKeyword(payload.tenantId, payload.phone, settings);
      } else {
        await this.recordReply(payload.tenantId, payload.phone, payload.isInterested, payload.responseTimeMs);
      }
    } catch (err) {
      this.logger.error(`[REPUTATION] Erro ao processar reply de ${payload.phone}:`, err);
    }
  }

  // ─── Core: get or create reputation record ────────────────────────────────

  async getOrCreate(tenantId: string, phone: string) {
    return this.prisma.contactReputation.upsert({
      where: { tenantId_phone: { tenantId, phone } },
      update: {},
      create: { tenantId, phone, score: DEFAULT_SCORE },
    });
  }

  // ─── Check before enqueuing ────────────────────────────────────────────────

  async check(tenantId: string, phone: string, settings?: { exposureLimitsEnabled?: boolean; reputationQuarantineEnabled?: boolean }): Promise<ReputationCheck> {
    let rep = await this.prisma.contactReputation.findUnique({
      where: { tenantId_phone: { tenantId, phone } },
    });

    if (!rep) {
      // New contact: default score, no restrictions
      return { canSend: true, delayMultiplier: 1 };
    }

    // Active quarantine (stop keyword) — only if toggle enabled
    if ((settings?.reputationQuarantineEnabled ?? true) && rep.quarantineUntil && rep.quarantineUntil > new Date()) {
      this.logger.log(`[REPUTATION] ${phone}: em quarentena até ${rep.quarantineUntil.toISOString()} (opt-out)`);
      return { canSend: false, reason: 'QUARANTINE_OPT_OUT', delayMultiplier: 0 };
    }

    // Score below threshold — only reachable via stop keyword + delivery errors
    if (rep.score < SCORE_QUARANTINE) {
      return { canSend: false, reason: 'BAD_NUMBER_OR_OPTED_OUT', delayMultiplier: 0 };
    }

    // Exposure limit check — prevent over-sending regardless of score
    const todaySP = this.getTodayDateSP();

    // Reset daily counter if needed
    if (rep.todayResetDate !== todaySP) {
      rep = await this.prisma.contactReputation.update({
        where: { tenantId_phone: { tenantId, phone } },
        data: { campaignTodayCount: 0, todayResetDate: todaySP },
      });
    }

    // Reset 7-day counter if last send was > 7 days ago
    if (rep.lastCampaignSentAt) {
      const daysSinceLast = (Date.now() - rep.lastCampaignSentAt.getTime()) / 86400000;
      if (daysSinceLast >= 7) {
        rep = await this.prisma.contactReputation.update({
          where: { tenantId_phone: { tenantId, phone } },
          data: { campaign7DayCount: 0 },
        });
      }
    }

    if ((settings?.exposureLimitsEnabled ?? true) && rep.campaignTodayCount >= MAX_CAMPAIGNS_PER_DAY) {
      this.logger.log(`[EXPOSURE] Contato ${phone} atingiu limite de exposição diária, pulado`);
      return { canSend: false, reason: 'DAILY_LIMIT', delayMultiplier: 0 };
    }

    if ((settings?.exposureLimitsEnabled ?? true) && rep.campaign7DayCount >= MAX_CAMPAIGNS_7_DAYS) {
      this.logger.log(`[EXPOSURE] Contato ${phone} atingiu limite de exposição semanal (${rep.campaign7DayCount}), pulado`);
      return { canSend: false, reason: 'WEEKLY_LIMIT', delayMultiplier: 0 };
    }

    // Contacts with delivery issues get a slightly longer delay (no blocking)
    let delayMultiplier = 1;
    if (rep.score < SCORE_BAD_NUMBER) {
      delayMultiplier = 1.5; // Mild extra delay for numbers with delivery issues
    }

    return { canSend: true, delayMultiplier };
  }

  // ─── Record send ──────────────────────────────────────────────────────────

  async recordSend(tenantId: string, phone: string, hourSP: number): Promise<void> {
    const todaySP = this.getTodayDateSP();

    const rep = await this.prisma.contactReputation.findUnique({
      where: { tenantId_phone: { tenantId, phone } },
    });

    const isNewToday = !rep || rep.todayResetDate !== todaySP;

    await this.prisma.contactReputation.upsert({
      where: { tenantId_phone: { tenantId, phone } },
      update: {
        lastCampaignSentAt: new Date(),
        campaign7DayCount: { increment: 1 },
        campaignTodayCount: isNewToday ? 1 : { increment: 1 },
        todayResetDate: todaySP,
      },
      create: {
        tenantId,
        phone,
        score: DEFAULT_SCORE,
        lastCampaignSentAt: new Date(),
        campaign7DayCount: 1,
        campaignTodayCount: 1,
        todayResetDate: todaySP,
      },
    });

    // Update timing analysis
    const client = this.redis.getClient();
    await client.incr(this.kTimingCount(tenantId, hourSP));
    await client.expire(this.kTimingCount(tenantId, hourSP), 90 * 24 * 3600); // 90 days

    // Check if 100 sends milestone reached — analyze timing
    const totalForHour = await client.get(this.kTimingCount(tenantId, hourSP));
    if (totalForHour && parseInt(totalForHour, 10) % 100 === 0) {
      await this.analyzeTiming(tenantId, hourSP);
    }
  }

  // ─── Record reply ─────────────────────────────────────────────────────────

  async recordReply(
    tenantId: string,
    phone: string,
    isInterested: boolean,
    responseTimeMs: number,
  ): Promise<void> {
    const rep = await this.prisma.contactReputation.findUnique({
      where: { tenantId_phone: { tenantId, phone } },
    });

    const bonus = isInterested ? R_INTERESTED_REPLY : R_ANY_REPLY;
    const newScore = Math.min(100, (rep?.score ?? DEFAULT_SCORE) + bonus);

    // Update rolling average response time
    let newAvg: bigint | null = rep?.avgResponseTimeMs ?? null;
    if (responseTimeMs > 0) {
      const prev = rep?.avgResponseTimeMs ? Number(rep.avgResponseTimeMs) : responseTimeMs;
      newAvg = BigInt(Math.round((prev * 0.7 + responseTimeMs * 0.3)));
    }

    await this.prisma.contactReputation.upsert({
      where: { tenantId_phone: { tenantId, phone } },
      update: {
        score: newScore,
        consecutiveNoReply: 0,
        lastRespondedAt: new Date(),
        engagementDrop: false,
        quarantineUntil: null,
        ...(newAvg !== null && { avgResponseTimeMs: newAvg }),
      },
      create: {
        tenantId,
        phone,
        score: newScore,
        consecutiveNoReply: 0,
        lastRespondedAt: new Date(),
        avgResponseTimeMs: newAvg,
      },
    });

    // Update timing reply counter
    const nowSP = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const client = this.redis.getClient();
    await client.incr(this.kTimingReply(tenantId, nowSP.getHours()));
    await client.expire(this.kTimingReply(tenantId, nowSP.getHours()), 90 * 24 * 3600);

    this.logger.debug(`[REPUTATION] ${phone}: reply +${bonus} → score ${newScore}`);
  }

  // ─── Record stop keyword ──────────────────────────────────────────────────

  async recordStopKeyword(tenantId: string, phone: string, settings?: { autoBlacklistOptOut?: boolean }): Promise<void> {
    const rep = await this.prisma.contactReputation.findUnique({
      where: { tenantId_phone: { tenantId, phone } },
    });
    const newScore = Math.max(0, (rep?.score ?? DEFAULT_SCORE) - P_STOP_KEYWORD);
    const quarantineUntil = new Date(Date.now() + QUARANTINE_DAYS_STOP * 86400000);

    await this.prisma.contactReputation.upsert({
      where: { tenantId_phone: { tenantId, phone } },
      update: { score: newScore, quarantineUntil },
      create: { tenantId, phone, score: newScore, quarantineUntil },
    });

    // Auto-blacklist only if they've explicitly opted out AND score is very low
    // (meaning they opted out more than once or had multiple delivery errors too)
    if ((settings?.autoBlacklistOptOut ?? true) && newScore < SCORE_QUARANTINE) {
      await this.applyAutoBlacklistIfNeeded(tenantId, phone, newScore, 'OPT_OUT');
    }

    this.logger.warn(`[REPUTATION] ${phone}: stop keyword → quarentena por ${QUARANTINE_DAYS_STOP} dias (score ${newScore})`);
  }

  // ─── Record delivery error ────────────────────────────────────────────────

  async recordDeliveryError(tenantId: string, phone: string, settings?: { autoBlacklistBadNumbers?: boolean }): Promise<void> {
    const rep = await this.prisma.contactReputation.findUnique({
      where: { tenantId_phone: { tenantId, phone } },
    });
    const newScore = Math.max(0, (rep?.score ?? DEFAULT_SCORE) - P_DELIVERY_ERROR);

    await this.prisma.contactReputation.upsert({
      where: { tenantId_phone: { tenantId, phone } },
      update: { score: newScore },
      create: { tenantId, phone, score: newScore },
    });

    // Auto-blacklist only after score drops below threshold (requires 2+ delivery errors from default)
    if ((settings?.autoBlacklistBadNumbers ?? true) && newScore < SCORE_QUARANTINE) {
      await this.applyAutoBlacklistIfNeeded(tenantId, phone, newScore, 'DELIVERY_ERRORS');
    }

    this.logger.debug(`[REPUTATION] ${phone}: delivery error -${P_DELIVERY_ERROR} → score ${newScore}`);
  }

  // ─── Bulk sort for campaign queue ─────────────────────────────────────────

  /**
   * Returns the list of phones sorted by reputation priority.
   * Skips only contacts in active quarantine or below quarantine threshold.
   * Contacts with no reputation record or score >= threshold are always included.
   */
  async sortAndFilterPhones(
    tenantId: string,
    phones: string[],
  ): Promise<{ sorted: string[]; skipped: string[] }> {
    if (phones.length === 0) return { sorted: [], skipped: [] };

    const reps = await this.prisma.contactReputation.findMany({
      where: { tenantId, phone: { in: phones } },
      select: { phone: true, score: true, quarantineUntil: true, engagementDrop: true },
    });

    const repMap = new Map(reps.map(r => [r.phone, r]));
    const now = new Date();

    const sorted: { phone: string; priority: number }[] = [];
    const skipped: string[] = [];

    for (const phone of phones) {
      const rep = repMap.get(phone);
      if (!rep) {
        // New contact: default priority — always include
        sorted.push({ phone, priority: DEFAULT_SCORE });
        continue;
      }

      // Skip only if in active quarantine (explicit opt-out)
      if (rep.quarantineUntil && rep.quarantineUntil > now) {
        skipped.push(phone);
        continue;
      }

      // Skip if score below threshold (bad number / repeated opt-outs)
      if (rep.score < SCORE_QUARANTINE) {
        skipped.push(phone);
        continue;
      }

      sorted.push({ phone, priority: rep.score });
    }

    // Sort: high score first (contacts who engaged before get priority)
    sorted.sort((a, b) => b.priority - a.priority);

    return { sorted: sorted.map(s => s.phone), skipped };
  }

  // ─── List health report ───────────────────────────────────────────────────

  async getListHealth(tenantId: string, phones: string[]): Promise<ListHealthReport> {
    const total = phones.length;
    if (total === 0) {
      return {
        total: 0, highReputation: 0, mediumReputation: 0, lowReputation: 0,
        quarantine: 0, blacklisted: 0, estimatedSafeToSend: 0, riskLevel: 'LOW',
      };
    }

    const reps = await this.prisma.contactReputation.findMany({
      where: { tenantId, phone: { in: phones } },
      select: { phone: true, score: true, quarantineUntil: true },
    });

    const blacklisted = await this.prisma.campaignBlacklist.count({
      where: { tenantId, phone: { in: phones } },
    });

    const repMap = new Map(reps.map(r => [r.phone, r]));
    const now = new Date();

    let high = 0, medium = 0, low = 0, quarantine = 0;

    for (const phone of phones) {
      const rep = repMap.get(phone);
      if (!rep) {
        // Unknown = default score 70 → high (most contacts start here)
        high++;
        continue;
      }
      const inQuarantine = rep.quarantineUntil && rep.quarantineUntil > now;
      if (inQuarantine || rep.score < SCORE_QUARANTINE) {
        quarantine++;
      } else if (rep.score >= 70) {
        high++;
      } else if (rep.score >= 50) {
        medium++;
      } else {
        low++;
      }
    }

    const estimatedSafeToSend = high + medium + low; // all non-quarantine
    const riskRatio = (quarantine + blacklisted) / total;

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (riskRatio >= 0.4) riskLevel = 'HIGH';
    else if (riskRatio >= 0.2) riskLevel = 'MEDIUM';

    return {
      total,
      highReputation: high,
      mediumReputation: medium,
      lowReputation: low,
      quarantine,
      blacklisted,
      estimatedSafeToSend,
      riskLevel,
    };
  }

  // ─── Is low-engagement hour ───────────────────────────────────────────────

  async isLowEngagementHour(tenantId: string, hourSP: number): Promise<boolean> {
    return this.redis.exists(this.kLowHour(tenantId, hourSP));
  }

  /**
   * Find the next hour with good engagement history (not marked as low).
   * Returns the hour (0-23) with best engagement, or next hour if all are unknown.
   */
  async getBestNextHour(tenantId: string, fromHourSP: number): Promise<number> {
    for (let offset = 1; offset <= 12; offset++) {
      const candidate = (fromHourSP + offset) % 24;
      if (candidate < 8 || candidate >= 20) continue; // keep inside window
      const isLow = await this.isLowEngagementHour(tenantId, candidate);
      if (!isLow) return candidate;
    }
    return (fromHourSP + 1) % 24;
  }

  // ─── Cron: score recovery for inactive contacts ───────────────────────────
  // NOTE: No-reply is NOT penalized — most contacts never reply to marketing.
  // Only genuine negative signals (stop keyword, delivery errors) affect score.

  @Cron('0 3 * * *') // once per day at 3am (not every hour)
  async applyTimedRecovery(): Promise<void> {
    try {
      const threshold30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const now30 = new Date();
      // Recover score for contacts not messaged in 30+ days and not in active quarantine
      const inactiveRecs = await this.prisma.contactReputation.findMany({
        where: {
          AND: [
            {
              OR: [
                { lastCampaignSentAt: { lte: threshold30d } },
                { lastCampaignSentAt: null },
              ],
            },
            { score: { lt: 100, gt: 0 } },
            {
              OR: [
                { quarantineUntil: null },
                { quarantineUntil: { lte: now30 } },
              ],
            },
          ],
        },
        select: { id: true, score: true },
      });

      let recovered = 0;
      for (const rec of inactiveRecs) {
        const newScore = Math.min(100, rec.score + R_30DAYS_INACTIVE);
        if (newScore !== rec.score) {
          await this.prisma.contactReputation.update({
            where: { id: rec.id },
            data: { score: newScore },
          });
          recovered++;
        }
      }

      if (recovered > 0) {
        this.logger.debug(`[REPUTATION] Recuperação 30d aplicada a ${recovered} contatos inativos`);
      }
    } catch (err) {
      this.logger.error('[REPUTATION] Erro no cron de recuperação:', err);
    }
  }

  // ─── Timing analysis ──────────────────────────────────────────────────────

  private async analyzeTiming(tenantId: string, hourSP: number): Promise<void> {
    const client = this.redis.getClient();
    const countStr = await client.get(this.kTimingCount(tenantId, hourSP));
    const replyStr = await client.get(this.kTimingReply(tenantId, hourSP));

    const count = parseInt(countStr ?? '0', 10);
    const replies = parseInt(replyStr ?? '0', 10);
    if (count < 100) return;

    const replyRate = replies / count;
    if (replyRate < 0.03) {
      // Mark as low engagement for 7 days
      await this.redis.setWithTTL(this.kLowHour(tenantId, hourSP), '1', 7 * 24 * 3600);
      this.logger.warn(
        `[TIMING] Horário ${hourSP}h com baixo engajamento (${(replyRate * 100).toFixed(1)}%), marcado como LOW_ENGAGEMENT_HOUR por 7 dias`,
      );
    } else {
      // Good hour: remove low flag if present
      await this.redis.delete(this.kLowHour(tenantId, hourSP));
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private getTodayDateSP(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  }

  private async applyAutoBlacklistIfNeeded(
    tenantId: string,
    phone: string,
    score: number,
    reason: 'OPT_OUT' | 'DELIVERY_ERRORS',
  ): Promise<void> {
    if (score < SCORE_QUARANTINE) {
      const blacklistReason = reason === 'OPT_OUT'
        ? 'AUTO_BLACKLIST_OPT_OUT'
        : 'AUTO_BLACKLIST_BAD_NUMBER';

      await this.prisma.campaignBlacklist.upsert({
        where: { tenantId_phone: { tenantId, phone } },
        update: { reason: blacklistReason },
        create: { tenantId, phone, reason: blacklistReason },
      });
      this.logger.warn(`[REPUTATION] ${phone}: ${blacklistReason} (score ${score})`);
    }
  }
}
