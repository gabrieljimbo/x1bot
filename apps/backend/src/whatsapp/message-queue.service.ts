import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Bottleneck from 'bottleneck';

export interface MessageJob {
    type: 'text' | 'media' | 'buttons' | 'list';
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
        contactId: string,
        socket: any,
        job: MessageJob,
        sendFn: () => Promise<any>
    ) {
        const limiter = this.getLimiter(sessionId);

        return limiter.schedule(async () => {
            const waitTime = this.calculateWaitTime(job);
            this.logger.debug(`[QUEUE] Session ${sessionId}: Waiting ${waitTime}ms for humanization`);

            // Start presence update
            const presenceInterval = this.startPresenceUpdate(sessionId, contactId, socket, job);

            try {
                await new Promise((resolve) => setTimeout(resolve, waitTime));

                // Stop presence update before send
                if (presenceInterval) clearInterval(presenceInterval);
                if (socket?.sendPresenceUpdate) {
                    await socket.sendPresenceUpdate('paused', contactId);
                }

                return await sendFn();
            } catch (error) {
                this.logger.error(`[QUEUE] Failed to send message in queue:`, error);
                if (presenceInterval) clearInterval(presenceInterval);
                throw error;
            }
        });
    }

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

        const randomExtra = Math.floor(
            Math.random() * (max - min) + min
        );

        return baseDelay + randomExtra;
    }

    private startPresenceUpdate(sessionId: string, contactId: string, socket: any, job: MessageJob): NodeJS.Timeout | null {
        if (!socket?.sendPresenceUpdate) return null;

        const presenceType = job.type === 'media' && job.options?.sendAudioAsVoice ? 'recording' : 'composing';

        // Initial update
        socket.sendPresenceUpdate(presenceType, contactId).catch(() => { });

        // Renew every 3s
        return setInterval(() => {
            socket.sendPresenceUpdate(presenceType, contactId).catch(() => { });
        }, 3000);
    }
}
