import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionHealthMonitorService } from './session-health-monitor.service';
import { parseSpintax, hasSpintax } from './spintax.util';
import Bottleneck from 'bottleneck';

export interface MessageJob {
    type: 'text' | 'media' | 'buttons' | 'list' | 'poll';
    payload: any;
    options?: any;
}

@Injectable()
export class MessageQueueService implements OnModuleInit {
    private readonly logger = new Logger(MessageQueueService.name);
    private limiters: Map<string, Bottleneck> = new Map();
    private config: any = null;

    constructor(
        private prisma: PrismaService,
        private healthMonitor: SessionHealthMonitorService,
    ) { }

    async onModuleInit() {
        await this.loadConfig();
        // Periodically reload config every 5 minutes
        setInterval(() => this.loadConfig(), 5 * 60 * 1000);
    }

    private async loadConfig() {
        try {
            let config = await this.prisma.globalConfig.findFirst();
            if (!config) {
                config = await this.prisma.globalConfig.create({
                    data: {
                        minDelay: 3000,
                        maxDelay: 8000,
                        maxMsgsPerMinute: 20,
                        proportionalDelayEnabled: true,
                    },
                });
            }
            this.config = config;
            this.updateLimiters();
        } catch (error) {
            this.logger.error('Failed to load global config:', error);
        }
    }

    private updateLimiters() {
        for (const [_, limiter] of this.limiters.entries()) {
            limiter.updateSettings({
                minTime: 1000,
                maxConcurrent: 1,
                reservoir: this.config.maxMsgsPerMinute,
                reservoirRefreshInterval: 60 * 1000,
                reservoirRefreshAmount: this.config.maxMsgsPerMinute,
            });
        }
    }

    private getLimiter(sessionId: string): Bottleneck {
        if (!this.limiters.has(sessionId)) {
            const limiter = new Bottleneck({
                id: `wa-queue-${sessionId}`,
                maxConcurrent: 1,
                minTime: 1000,
                reservoir: this.config?.maxMsgsPerMinute || 20,
                reservoirRefreshInterval: 60 * 1000,
                reservoirRefreshAmount: this.config?.maxMsgsPerMinute || 20,
            });
            this.limiters.set(sessionId, limiter);
        }
        return this.limiters.get(sessionId)!;
    }

    async enqueue(
        sessionId: string,
        contactPhone: string,
        socket: any,
        job: MessageJob,
        sendFn: () => Promise<any>,
        bypassDelay: boolean = false
    ) {
        const limiter = this.getLimiter(sessionId);

        return limiter.schedule(async () => {
            // Apply spintax to text payloads before sending
            job = this.applySpintax(job);

            // Calculate wait time with adaptive multiplier from health monitor
            let waitTime = 0;
            if (!bypassDelay) {
                const baseWait = this.calculateWaitTime(job);
                const multiplier = await this.healthMonitor.getAdaptiveDelayMultiplier(sessionId);
                waitTime = Math.round(baseWait * multiplier);
                if (multiplier > 1) {
                    this.logger.debug(`[QUEUE] Session ${sessionId}: Adaptive cooldown ×${multiplier} → ${waitTime}ms`);
                }
            }

            if (waitTime > 0) {
                this.logger.debug(`[QUEUE] Session ${sessionId}: Waiting ${waitTime}ms for humanization`);

                // Start presence update
                const presenceInterval = this.startPresenceUpdate(sessionId, contactPhone, socket, job);

                try {
                    await new Promise((resolve) => setTimeout(resolve, waitTime));

                    // Stop presence update before send
                    if (presenceInterval) clearInterval(presenceInterval);
                    if (socket?.sendPresenceUpdate) {
                        await socket.sendPresenceUpdate('paused', contactPhone);
                    }
                } catch (error) {
                    if (presenceInterval) clearInterval(presenceInterval);
                    throw error;
                }
            }

            try {
                const result = await sendFn();
                await this.healthMonitor.recordSuccess(sessionId);
                return result;
            } catch (error) {
                const isRestriction = this.isRestrictionError(error);
                await this.healthMonitor.recordFailure(sessionId, (error as any)?.message ?? '', isRestriction);
                this.logger.error(`[QUEUE] Failed to send message in queue:`, error);
                throw error;
            }
        });
    }

    private applySpintax(job: MessageJob): MessageJob {
        if (job.type === 'text' && job.payload?.text && hasSpintax(job.payload.text)) {
            return {
                ...job,
                payload: { ...job.payload, text: parseSpintax(job.payload.text) },
            };
        }
        if (job.type === 'media' && job.payload?.caption && hasSpintax(job.payload.caption)) {
            return {
                ...job,
                payload: { ...job.payload, caption: parseSpintax(job.payload.caption) },
            };
        }
        if (job.type === 'buttons' && job.payload?.text && hasSpintax(job.payload.text)) {
            return {
                ...job,
                payload: { ...job.payload, text: parseSpintax(job.payload.text) },
            };
        }
        return job;
    }

    /**
     * Humanized jitter: base = random(min, max), then apply ±20% jitter.
     * Result is never below minDelay.
     */
    private calculateWaitTime(job: MessageJob): number {
        let baseDelay = 0;

        if (this.config?.proportionalDelayEnabled) {
            let length = 0;
            if (job.type === 'text') {
                length = job.payload.text?.length || 0;
            } else if (job.type === 'media' && job.payload.caption) {
                length = job.payload.caption.length;
            }
            baseDelay = length * 50;
        }

        const min = this.config?.minDelay || 3000;
        const max = this.config?.maxDelay || 8000;

        // Random base within [min, max]
        const randomBase = Math.floor(Math.random() * (max - min) + min);

        // ±20% jitter
        const jitter = randomBase * (Math.random() * 0.4 - 0.2);

        // Final value is never below minDelay
        const total = Math.max(min, Math.round(randomBase + jitter));

        return baseDelay + total;
    }

    private startPresenceUpdate(sessionId: string, contactPhone: string, socket: any, job: MessageJob): NodeJS.Timeout | null {
        if (!socket?.sendPresenceUpdate) return null;

        let presenceType: 'composing' | 'recording' | null = null;

        if (job.type === 'text' || job.type === 'buttons' || job.type === 'list' || job.type === 'poll') {
            presenceType = 'composing';
        } else if (job.type === 'media') {
            const mediaType = job.options?.mediaType;
            const isAudio = mediaType === 'audio' || job.options?.sendAudioAsVoice;

            if (isAudio) {
                presenceType = 'recording';
            } else {
                // Images, videos, documents → composing (humanizes before sending)
                presenceType = 'composing';
            }
        }

        if (!presenceType) return null;

        // Initial update
        socket.sendPresenceUpdate(presenceType, contactPhone).catch(() => { });

        // Renew every 3s
        return setInterval(() => {
            if (socket?.sendPresenceUpdate) {
                socket.sendPresenceUpdate(presenceType, contactPhone).catch(() => { });
            }
        }, 3000);
    }

    private isRestrictionError(error: any): boolean {
        const msg = (error?.message ?? '').toLowerCase();
        return msg.includes('restricted') || msg.includes('spam') || msg.includes('banned') || msg.includes('block');
    }
}
