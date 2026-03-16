import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Score penalty/recovery constants ───────────────────────────────────────

const PENALTY_SEND_FAIL = 2;
const PENALTY_TIMEOUT = 3;
const PENALTY_RATE_LIMIT_429 = 15;
const PENALTY_RESTRICTION = 40;
const PENALTY_NO_REPLY_STREAK = 5;      // per 10 consecutive without reply
const PENALTY_OUT_OF_WINDOW = 1;

const RECOVERY_SEND_SUCCESS = 1;
const RECOVERY_REPLY_RECEIVED = 3;
const RECOVERY_30MIN_NO_FAIL = 5;

// ─── Circuit breaker constants ───────────────────────────────────────────────

const CB_OPEN_THRESHOLD = 5;           // failures to open CB
const CB_WINDOW_SECONDS = 600;         // 10 minutes window for failures
const CB_OPEN_DURATION_MS = 15 * 60 * 1000;  // 15 min before trying HALF_OPEN
const CB_HALF_OPEN_SUCCESSES = 3;      // successes needed to close CB

// ─── Pressure valve constants ────────────────────────────────────────────────

const PRESSURE_WINDOW_SECONDS = 300;   // 5-minute window
const PRESSURE_REDUCTION_MINUTES = 10; // stay at 70% for 10 min after trigger

// ─── Dead Man's Switch ───────────────────────────────────────────────────────

const DMS_MAX_CONTINUOUS_MS = 2 * 60 * 60 * 1000;  // 2 hours
const DMS_PAUSE_MS = 15 * 60 * 1000;               // 15 min pause

// ─── Tourist mode thresholds ─────────────────────────────────────────────────

const TOURIST_ACTIVATE_SCORE = 60;
const TOURIST_DEACTIVATE_SCORE = 80;
const TOURIST_DAILY_LIMIT_FACTOR = 0.3;
const TOURIST_MIN_DELAY_FACTOR = 3;

export type CircuitBreakerState = 'CLOSED' | 'HALF_OPEN' | 'OPEN';

export interface SessionHealthStatus {
  score: number;
  level: 'healthy' | 'attention' | 'risk' | 'critical' | 'danger';
  circuitBreaker: CircuitBreakerState;
  touristMode: boolean;
  dmsPaused: boolean;
  pressureReduced: boolean;
  adaptiveDelayMultiplier: number;
}

@Injectable()
export class SessionHealthMonitorService {
  private readonly logger = new Logger(SessionHealthMonitorService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Keys ─────────────────────────────────────────────────────────────────

  private k = {
    score:          (id: string) => `wa:health:score:${id}`,
    cbState:        (id: string) => `wa:cb:state:${id}`,
    cbFails:        (id: string) => `wa:cb:fails:${id}`,
    cbOpenAt:       (id: string) => `wa:cb:open_at:${id}`,
    cbHalfSucc:     (id: string) => `wa:cb:half_succ:${id}`,
    lastFailAt:     (id: string) => `wa:health:last_fail:${id}`,
    noReplyCount:   (id: string) => `wa:health:no_reply:${id}`,
    dmsStart:       (id: string) => `wa:dms:start:${id}`,
    dmsPausedUntil: (id: string) => `wa:dms:paused_until:${id}`,
    pressure:       (id: string) => `wa:pressure:${id}`,
    pressureReduce: (id: string) => `wa:pressure:reduced:${id}`,
    tourist:        (id: string) => `wa:tourist:${id}`,
    lastMsgs:       (id: string) => `wa:last_msgs:${id}`,
  };

  // ─── Public API ───────────────────────────────────────────────────────────

  async getScore(sessionId: string): Promise<number> {
    const raw = await this.redis.get(this.k.score(sessionId));
    if (raw === null) return 100;
    // Check if 30-min recovery should be applied
    const score = parseInt(raw, 10);
    const lastFail = await this.redis.get(this.k.lastFailAt(sessionId));
    if (lastFail) {
      const elapsed = Date.now() - parseInt(lastFail, 10);
      if (elapsed >= 30 * 60 * 1000) {
        const recovered = Math.min(100, score + RECOVERY_30MIN_NO_FAIL);
        await this.redis.setWithTTL(this.k.score(sessionId), String(recovered), 86400);
        // Clear lastFailAt so we don't keep adding the bonus
        await this.redis.delete(this.k.lastFailAt(sessionId));
        return recovered;
      }
    }
    return score;
  }

  async getStatus(sessionId: string): Promise<SessionHealthStatus> {
    const score = await this.getScore(sessionId);
    const cbState = await this.getCircuitBreakerState(sessionId);
    const touristMode = await this.isTouristMode(sessionId);
    const dmsPaused = await this.isDmsPaused(sessionId);
    const pressureReduced = await this.isPressureReduced(sessionId);

    return {
      score,
      level: this.scoreToLevel(score),
      circuitBreaker: cbState,
      touristMode,
      dmsPaused,
      pressureReduced,
      adaptiveDelayMultiplier: this.getAdaptiveDelayMultiplierFromScore(score),
    };
  }

  /** Returns false if circuit breaker is OPEN (should NOT send) */
  async canSend(sessionId: string): Promise<boolean> {
    // Check DMS pause
    if (await this.isDmsPaused(sessionId)) {
      this.logger.warn(`[HEALTH] Session ${sessionId}: DMS pause active — rejecting job`);
      return false;
    }

    const cbState = await this.getCircuitBreakerState(sessionId);
    if (cbState === 'OPEN') {
      this.logger.warn(`[HEALTH] Session ${sessionId}: Circuit breaker OPEN — rejecting job`);
      return false;
    }

    return true;
  }

  async recordSuccess(sessionId: string): Promise<void> {
    let score = await this.getScore(sessionId);
    score = Math.min(100, score + RECOVERY_SEND_SUCCESS);
    await this.redis.setWithTTL(this.k.score(sessionId), String(score), 86400);

    // Reset no-reply counter on success
    await this.redis.delete(this.k.noReplyCount(sessionId));

    // Update circuit breaker
    await this.handleCbSuccess(sessionId);

    // Update DMS (reset continuous counter on success break if needed)
    await this.tickDmsSuccess(sessionId);

    // Deactivate tourist mode if score recovered
    if (score >= TOURIST_DEACTIVATE_SCORE) {
      const wasTourist = await this.isTouristMode(sessionId);
      if (wasTourist) {
        await this.redis.delete(this.k.tourist(sessionId));
        this.logger.log(`[HEALTH] Session ${sessionId}: Tourist mode deactivated (score ${score})`);
      }
    }

    // React to score level
    await this.applyScoreReaction(sessionId, score);
  }

  async recordFailure(sessionId: string, error: string, isRestriction = false): Promise<void> {
    let score = await this.getScore(sessionId);
    let penalty = PENALTY_SEND_FAIL;

    if (isRestriction) {
      penalty = PENALTY_RESTRICTION;
      this.logger.error(`[HEALTH] Session ${sessionId}: RESTRICTION detected — penalty ${penalty}`);
    } else if (error?.toLowerCase().includes('timeout')) {
      penalty = PENALTY_TIMEOUT;
    } else if (error?.includes('429') || error?.toLowerCase().includes('rate limit')) {
      penalty = PENALTY_RATE_LIMIT_429;
    }

    score = Math.max(0, score - penalty);
    await this.redis.setWithTTL(this.k.score(sessionId), String(score), 86400);
    await this.redis.setWithTTL(this.k.lastFailAt(sessionId), String(Date.now()), 86400);

    // Update circuit breaker
    await this.handleCbFailure(sessionId);

    // Increment no-reply streak is handled separately via recordNoReply

    // Activate tourist mode if score dropped below threshold
    if (score < TOURIST_ACTIVATE_SCORE && !(await this.isTouristMode(sessionId))) {
      await this.redis.setWithTTL(this.k.tourist(sessionId), '1', 86400 * 7);
      this.logger.warn(`[HEALTH] Session ${sessionId}: TOURIST MODE activated (score ${score})`);
    }

    // React to score level
    await this.applyScoreReaction(sessionId, score);
  }

  async recordReply(sessionId: string): Promise<void> {
    let score = await this.getScore(sessionId);
    score = Math.min(100, score + RECOVERY_REPLY_RECEIVED);
    await this.redis.setWithTTL(this.k.score(sessionId), String(score), 86400);
    await this.redis.delete(this.k.noReplyCount(sessionId));
    this.logger.debug(`[HEALTH] Session ${sessionId}: Reply received +${RECOVERY_REPLY_RECEIVED} → score ${score}`);
  }

  async recordNoReply(sessionId: string): Promise<void> {
    const client = this.redis.getClient();
    const key = this.k.noReplyCount(sessionId);
    const count = await client.incr(key);
    await client.expire(key, 3600); // reset after 1h idle

    // Every 10 messages without a reply, apply penalty
    if (count > 0 && count % 10 === 0) {
      let score = await this.getScore(sessionId);
      score = Math.max(0, score - PENALTY_NO_REPLY_STREAK);
      await this.redis.setWithTTL(this.k.score(sessionId), String(score), 86400);
      this.logger.warn(`[HEALTH] Session ${sessionId}: ${count} msgs without reply — penalty ${PENALTY_NO_REPLY_STREAK} → score ${score}`);
    }
  }

  /**
   * Called when a send is attempted outside of allowed time window.
   */
  async recordOutOfWindow(sessionId: string): Promise<void> {
    let score = await this.getScore(sessionId);
    score = Math.max(0, score - PENALTY_OUT_OF_WINDOW);
    await this.redis.setWithTTL(this.k.score(sessionId), String(score), 86400);
  }

  /**
   * Returns adaptive delay multiplier based on current health score.
   */
  getAdaptiveDelayMultiplierFromScore(score: number): number {
    if (score >= 70) return 1;
    if (score >= 60) return 1.5;
    if (score >= 40) return 2;
    if (score >= 20) return 3;
    return 3; // danger zone — shouldn't even be sending
  }

  async getAdaptiveDelayMultiplier(sessionId: string): Promise<number> {
    const score = await this.getScore(sessionId);
    return this.getAdaptiveDelayMultiplierFromScore(score);
  }

  /**
   * Updates pressure valve counter and checks if we're approaching the limit.
   * Returns { throttle: boolean, factor: number } where factor is the fraction of limit to use.
   */
  async updatePressureValve(sessionId: string, configuredPerMinute: number): Promise<{ throttle: boolean }> {
    const client = this.redis.getClient();
    const key = this.k.pressure(sessionId);
    const now = Date.now();
    const windowStart = now - PRESSURE_WINDOW_SECONDS * 1000;

    // Add current timestamp and remove old entries
    await client.zadd(key, now, `${now}-${Math.random()}`);
    await client.zremrangebyscore(key, '-inf', windowStart);
    await client.expire(key, PRESSURE_WINDOW_SECONDS * 2);

    const count = await client.zcard(key);
    const configuredInWindow = configuredPerMinute * (PRESSURE_WINDOW_SECONDS / 60);
    const ratio = count / configuredInWindow;

    if (ratio >= 0.9) {
      // At 90% of limit — activate pressure reduction for 10 min
      await this.redis.setWithTTL(
        this.k.pressureReduce(sessionId),
        '1',
        PRESSURE_REDUCTION_MINUTES * 60,
      );
      this.logger.warn(
        `[PRESSURE] Session ${sessionId}: Rate at ${(ratio * 100).toFixed(0)}% of limit — reducing to 70% for ${PRESSURE_REDUCTION_MINUTES}min`,
      );
      return { throttle: true };
    }

    return { throttle: false };
  }

  async isPressureReduced(sessionId: string): Promise<boolean> {
    return this.redis.exists(this.k.pressureReduce(sessionId));
  }

  /**
   * Returns the pressure valve reduction factor for this session.
   * Returns 0.7 if pressure valve is active, 1.0 otherwise.
   */
  async getPressureValveFactor(sessionId: string): Promise<number> {
    const reduced = await this.isPressureReduced(sessionId);
    return reduced ? 0.7 : 1.0;
  }

  /**
   * Dead Man's Switch: track continuous sending.
   * Call this on every successful send attempt.
   * Returns true if DMS pause was just activated.
   */
  async tickDmsSuccess(sessionId: string): Promise<boolean> {
    const pausedUntil = await this.redis.get(this.k.dmsPausedUntil(sessionId));
    if (pausedUntil && Date.now() < parseInt(pausedUntil, 10)) return false;

    const startStr = await this.redis.get(this.k.dmsStart(sessionId));
    if (!startStr) {
      // Start tracking
      await this.redis.setWithTTL(this.k.dmsStart(sessionId), String(Date.now()), 7200);
      return false;
    }

    const elapsed = Date.now() - parseInt(startStr, 10);
    if (elapsed >= DMS_MAX_CONTINUOUS_MS) {
      // Force pause
      const pauseUntil = Date.now() + DMS_PAUSE_MS;
      await this.redis.setWithTTL(this.k.dmsPausedUntil(sessionId), String(pauseUntil), DMS_PAUSE_MS / 1000 + 60);
      await this.redis.delete(this.k.dmsStart(sessionId));
      this.logger.warn(`[DMS] Session ${sessionId}: Pausa forçada após 2h de envio contínuo`);
      return true;
    }

    return false;
  }

  async isDmsPaused(sessionId: string): Promise<boolean> {
    const pausedUntil = await this.redis.get(this.k.dmsPausedUntil(sessionId));
    if (!pausedUntil) return false;
    const paused = Date.now() < parseInt(pausedUntil, 10);
    if (!paused) {
      await this.redis.delete(this.k.dmsPausedUntil(sessionId));
    }
    return paused;
  }

  /**
   * Resets DMS tracking (e.g., after campaign pause or session reconnect).
   */
  async resetDms(sessionId: string): Promise<void> {
    await this.redis.delete(this.k.dmsStart(sessionId));
    await this.redis.delete(this.k.dmsPausedUntil(sessionId));
  }

  /**
   * Resets all DMS-related keys for the session (called during daily reset at 09:00).
   */
  async resetDmsState(sessionId: string): Promise<void> {
    const client = this.redis.getClient();
    await client.del(this.k.dmsStart(sessionId));
    await client.del(this.k.dmsPausedUntil(sessionId));
    this.logger.log(`[RESET] Sessão ${sessionId}: DMS resetado`);
  }

  async isTouristMode(sessionId: string): Promise<boolean> {
    return this.redis.exists(this.k.tourist(sessionId));
  }

  /**
   * Checks pattern repetition for the last N messages.
   * Returns true if content is too similar to recent messages.
   */
  async checkRepetitiveContent(sessionId: string, content: string): Promise<boolean> {
    const key = this.k.lastMsgs(sessionId);
    const raw = await this.redis.get(key);
    const msgs: string[] = raw ? JSON.parse(raw) : [];

    const normalized = content.trim().toLowerCase().replace(/\s+/g, ' ');
    const similar = msgs.filter(m => this.similarity(m, normalized) > 0.8);
    const isRepetitive = similar.length >= Math.min(3, msgs.length);

    // Update history (keep last 5)
    msgs.unshift(normalized);
    if (msgs.length > 5) msgs.pop();
    await this.redis.setWithTTL(key, JSON.stringify(msgs), 3600);

    if (isRepetitive) {
      this.logger.warn(`[PATTERN] Session ${sessionId}: Conteúdo repetitivo detectado, delay extra aplicado`);
    }

    return isRepetitive;
  }

  /**
   * Effective daily limit considering warmup override, warmup schedule, and tourist mode.
   */
  async getEffectiveDailyLimit(
    sessionId: string,
    configuredLimit: number,
    hardLimit: number,
  ): Promise<number> {
    // Clamp by hardcoded max
    let effective = Math.min(configuredLimit, hardLimit);

    // Warmup
    const session = await this.prisma.whatsappSession.findUnique({
      where: { id: sessionId },
      select: { createdAt: true, warmupOverride: true },
    });
    if (session) {
      // Check warmup override — skip warmup limits if override is active
      if (session.warmupOverride) {
        this.logger.log(`[WARMUP] Sessão ${sessionId} com warmupOverride ativo, limite normal aplicado`);
      } else {
        const daysSince = Math.floor((Date.now() - session.createdAt.getTime()) / 86400000);
        let warmupLimit: number | null = null;
        if (daysSince < 7) warmupLimit = 20;
        else if (daysSince < 14) warmupLimit = 40;
        else if (daysSince < 21) warmupLimit = 60;

        if (warmupLimit !== null) {
          effective = Math.min(effective, warmupLimit);
          this.logger.log(`[WARMUP] Sessão ${sessionId} em warmup dia ${daysSince + 1}, limite: ${effective} msgs/dia`);
        }
      }
    }

    // Tourist mode
    if (await this.isTouristMode(sessionId)) {
      effective = Math.floor(effective * TOURIST_DAILY_LIMIT_FACTOR);
    }

    return effective;
  }

  // ─── Circuit Breaker ──────────────────────────────────────────────────────

  async getCircuitBreakerState(sessionId: string): Promise<CircuitBreakerState> {
    const state = (await this.redis.get(this.k.cbState(sessionId))) as CircuitBreakerState | null;
    if (!state) return 'CLOSED';

    if (state === 'OPEN') {
      // Check if it's time to try HALF_OPEN
      const openAt = await this.redis.get(this.k.cbOpenAt(sessionId));
      if (openAt && Date.now() - parseInt(openAt, 10) >= CB_OPEN_DURATION_MS) {
        await this.redis.setWithTTL(this.k.cbState(sessionId), 'HALF_OPEN', 86400);
        await this.redis.setWithTTL(this.k.cbHalfSucc(sessionId), '0', 86400);
        this.logger.log(`[CB] Session ${sessionId}: OPEN → HALF_OPEN (testing)`);
        return 'HALF_OPEN';
      }
    }

    return state;
  }

  private async handleCbSuccess(sessionId: string): Promise<void> {
    const state = await this.getCircuitBreakerState(sessionId);

    if (state === 'HALF_OPEN') {
      const client = this.redis.getClient();
      const succKey = this.k.cbHalfSucc(sessionId);
      const count = await client.incr(succKey);
      await client.expire(succKey, 86400);

      if (count >= CB_HALF_OPEN_SUCCESSES) {
        await this.redis.setWithTTL(this.k.cbState(sessionId), 'CLOSED', 86400);
        await this.redis.delete(this.k.cbFails(sessionId));
        await this.redis.delete(this.k.cbOpenAt(sessionId));
        await this.redis.delete(this.k.cbHalfSucc(sessionId));
        this.logger.log(`[CB] Session ${sessionId}: HALF_OPEN → CLOSED (${CB_HALF_OPEN_SUCCESSES} successes)`);
      }
    }
  }

  private async handleCbFailure(sessionId: string): Promise<void> {
    const state = await this.getCircuitBreakerState(sessionId);

    if (state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN → reopen
      await this.redis.setWithTTL(this.k.cbState(sessionId), 'OPEN', 86400);
      await this.redis.setWithTTL(this.k.cbOpenAt(sessionId), String(Date.now()), 86400);
      await this.redis.delete(this.k.cbHalfSucc(sessionId));
      this.logger.warn(`[CB] Session ${sessionId}: HALF_OPEN → OPEN (failure during test)`);
      return;
    }

    if (state === 'CLOSED') {
      const client = this.redis.getClient();
      const failKey = this.k.cbFails(sessionId);
      const count = await client.incr(failKey);
      await client.expire(failKey, CB_WINDOW_SECONDS);

      if (count >= CB_OPEN_THRESHOLD) {
        await this.redis.setWithTTL(this.k.cbState(sessionId), 'OPEN', 86400);
        await this.redis.setWithTTL(this.k.cbOpenAt(sessionId), String(Date.now()), 86400);
        this.logger.error(
          `[CB] Session ${sessionId}: CLOSED → OPEN (${count} falhas em ${CB_WINDOW_SECONDS / 60}min)`,
        );
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private scoreToLevel(score: number): SessionHealthStatus['level'] {
    if (score >= 80) return 'healthy';
    if (score >= 60) return 'attention';
    if (score >= 40) return 'risk';
    if (score >= 20) return 'critical';
    return 'danger';
  }

  private async applyScoreReaction(sessionId: string, score: number): Promise<void> {
    const level = this.scoreToLevel(score);

    if (level === 'danger') {
      // Suspend session immediately
      try {
        await this.prisma.whatsappSession.update({
          where: { id: sessionId },
          data: { status: 'HEALTH_SUSPENDED' },
        });
        this.logger.error(
          `[HEALTH] Session ${sessionId}: ⛔ PERIGO — suspensa (score ${score}). Requer intervenção manual.`,
        );
      } catch {
        // Session may not exist
      }
    } else if (level === 'critical') {
      this.logger.error(`[HEALTH] Session ${sessionId}: 🔴 CRÍTICO (score ${score}) — pausando envios por 30min`);
    } else if (level === 'risk') {
      this.logger.warn(`[HEALTH] Session ${sessionId}: 🟠 RISCO (score ${score}) — velocidade reduzida em 60%`);
    } else if (level === 'attention') {
      this.logger.warn(`[HEALTH] Session ${sessionId}: 🟡 ATENÇÃO (score ${score}) — velocidade reduzida em 30%`);
    }
  }

  /**
   * Simple Jaccard similarity on word sets.
   */
  private similarity(a: string, b: string): number {
    const setA = new Set(a.split(' '));
    const setB = new Set(b.split(' '));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 1 : intersection.size / union.size;
  }
}
