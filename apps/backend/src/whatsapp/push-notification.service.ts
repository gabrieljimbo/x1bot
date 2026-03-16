import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private initialized = false;

  constructor(private readonly prisma: PrismaService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const email = process.env.VAPID_EMAIL ?? 'mailto:admin@x1bot.com';

    if (publicKey && privateKey) {
      webpush.setVapidDetails(email, publicKey, privateKey);
      this.initialized = true;
    } else {
      this.logger.warn('[PUSH] VAPID keys not configured — push notifications disabled');
    }
  }

  async subscribe(
    tenantId: string,
    userId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  ): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: { tenantId, userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      create: {
        tenantId,
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
    this.logger.log(`[PUSH] Subscription salva para tenant ${tenantId}, user ${userId}`);
  }

  async unsubscribe(tenantId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { tenantId, endpoint },
    });
  }

  async sendToTenant(
    tenantId: string,
    payload: { title: string; body: string; icon?: string; data?: any },
  ): Promise<void> {
    if (!this.initialized) return;

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { tenantId },
    });

    if (subscriptions.length === 0) return;

    const json = JSON.stringify(payload);

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            json,
          );
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            // Subscription expired — remove
            await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
            this.logger.log(`[PUSH] Subscription expirada removida: ${sub.endpoint.slice(-20)}`);
          } else {
            this.logger.error(`[PUSH] Erro ao enviar para ${sub.endpoint.slice(-20)}:`, err.message);
          }
        }
      }),
    );
  }

  /** Listener for workflow node SEND_PWA_NOTIFICATION (decoupled via EventEmitter2) */
  @OnEvent('push.send.tenant')
  async onPushSendTenant(event: { tenantId: string; payload: { title: string; body: string; icon?: string; data?: any } }): Promise<void> {
    await this.sendToTenant(event.tenantId, event.payload);
  }
}
