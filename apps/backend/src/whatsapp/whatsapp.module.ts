import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappSessionManager } from './whatsapp-session-manager.service';
import { WhatsappMessageHandler } from './whatsapp-message-handler.service';
import { WhatsappInitService } from './whatsapp-init.service';
import { ExecutionModule } from '../execution/execution.module';
import { StorageModule } from '../storage/storage.module';
import { NodeExecutorService } from '../execution/node-executor.service';

import { MessageQueueService } from './message-queue.service';
import { WhatsappController } from './whatsapp.controller';
import { InboxModule } from '../inbox/inbox.module';

@Module({
  imports: [
    ExecutionModule,
    StorageModule,
    forwardRef(() => InboxModule)
  ],
  controllers: [WhatsappController],
  providers: [
    WhatsappService,
    WhatsappSessionManager,
    WhatsappMessageHandler,
    WhatsappInitService,
    MessageQueueService,
  ],
  exports: [WhatsappService, WhatsappSessionManager, MessageQueueService],
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

