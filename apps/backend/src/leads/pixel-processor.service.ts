import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventBusService } from '../event-bus/event-bus.service';
import { EventType, PixelEvent } from '@n9n/shared';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PixelProcessor implements OnModuleInit {
    constructor(
        private eventBus: EventBusService,
        private prisma: PrismaService,
    ) { }

    onModuleInit() {
        this.eventBus.on(EventType.PIXEL_EVENT, (event: PixelEvent) => {
            this.handlePixelEvent(event).catch(err =>
                console.error('[PIXEL_PROCESSOR] Error handling pixel event:', err)
            );
        });
    }

    private async handlePixelEvent(event: PixelEvent) {
        const {
            pixelId,
            accessToken,
            eventType,
            contactPhone,
            metadata,
            testEventCode,
            tenantId,
            sessionId
        } = event;

        if (!pixelId || !accessToken) return;

        // 1. Prepare User Data (Hashing sensitive data as per Meta requirement)
        const userData: Record<string, any> = {
            country: [this.hashSHA256('br')],
        };

        const rawPhone = (contactPhone || '').replace(/\D/g, '');
        if (rawPhone) {
            userData.ph = [this.hashSHA256(rawPhone)];
        }

        if (metadata?.contactState) {
            userData.st = [this.hashSHA256(String(metadata.contactState).toLowerCase())];
        }

        if (metadata?.adCtwaClid) {
            userData.ctwa_clid = metadata.adCtwaClid;
        }

        // 2. Prepare Payload
        const pixelPayload: Record<string, any> = {
            data: [{
                event_name: eventType,
                event_time: Math.floor(Date.now() / 1000),
                event_id: `auto_${Date.now()}_${rawPhone}`,
                action_source: 'system_generated',
                user_data: userData,
                custom_data: {
                    currency: 'BRL',
                    ...(metadata || {}),
                },
            }],
            access_token: accessToken,
        };

        if (testEventCode) {
            pixelPayload.test_event_code = testEventCode;
        }

        // 3. Send to Meta Conversions API
        try {
            const url = `https://graph.facebook.com/v18.0/${pixelId}/events`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pixelPayload),
            });

            const responseData: any = await response.json();

            if (response.ok && !responseData.error) {
                console.log(`[PIXEL_PROCESSOR] Event ${eventType} sent successfully to ${pixelId}`);

                // Log to database
                await this.prisma.executionLog.create({
                    data: {
                        tenantId,
                        executionId: 'automatic_dispatch',
                        nodeId: 'pixel_auto_send',
                        eventType: 'PIXEL_AUTO_SEND',
                        data: {
                            pixelId,
                            eventType,
                            success: true,
                            fbtrace_id: responseData.fbtrace_id,
                            contactState: metadata?.contactState || null,
                        } as any,
                    },
                });
            } else {
                console.error(`[PIXEL_PROCESSOR] Meta API Error: ${responseData.error?.message || 'Unknown error'}`);
            }
        } catch (err: any) {
            console.error(`[PIXEL_PROCESSOR] Fetch Error:`, err.message);
        }
    }

    private hashSHA256(data: string): string {
        return createHash('sha256').update(data).digest('hex');
    }
}
