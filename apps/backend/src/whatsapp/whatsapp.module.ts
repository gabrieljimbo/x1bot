import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappSessionManager } from './whatsapp-session-manager.service';
import { WhatsappMessageHandler } from './whatsapp-message-handler.service';
import { WhatsappInitService } from './whatsapp-init.service';
import { ExecutionModule } from '../execution/execution.module';
import { StorageModule } from '../storage/storage.module';
import { NodeExecutorService } from '../execution/node-executor.service';

import { MessageQueueService } from './message-queue.service';
import { SessionHealthMonitorService } from './session-health-monitor.service';
import { WhatsappController } from './whatsapp.controller';
import { PushNotificationService } from './push-notification.service';
import { PushController } from './push.controller';
import { InboxModule } from '../inbox/inbox.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    ExecutionModule,
    StorageModule,
    PrismaModule,
    forwardRef(() => InboxModule)
  ],
  controllers: [WhatsappController, PushController],
  providers: [
    WhatsappService,
    WhatsappSessionManager,
    WhatsappMessageHandler,
    WhatsappInitService,
    MessageQueueService,
    SessionHealthMonitorService,
    PushNotificationService,
  ],
  exports: [WhatsappService, WhatsappSessionManager, MessageQueueService, SessionHealthMonitorService, PushNotificationService],
})
export class WhatsappModule implements OnModuleInit {
  constructor(
    private whatsappSessionManager: WhatsappSessionManager,
    private nodeExecutorService: NodeExecutorService,
  ) { }

  onModuleInit() {
    // Inject WhatsappSessionManager into NodeExecutorService
    this.nodeExecutorService.setWhatsappSessionManager(this.whatsappSessionManager);
  }
}

