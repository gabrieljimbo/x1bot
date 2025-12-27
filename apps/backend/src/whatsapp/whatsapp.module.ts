import { Module, OnModuleInit } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappSessionManager } from './whatsapp-session-manager.service';
import { WhatsappMessageHandler } from './whatsapp-message-handler.service';
import { WhatsappInitService } from './whatsapp-init.service';
import { ExecutionModule } from '../execution/execution.module';
import { NodeExecutorService } from '../execution/node-executor.service';

@Module({
  imports: [ExecutionModule],
  providers: [
    WhatsappService,
    WhatsappSessionManager,
    WhatsappMessageHandler,
    WhatsappInitService,
  ],
  exports: [WhatsappService, WhatsappSessionManager],
})
export class WhatsappModule implements OnModuleInit {
  constructor(
    private whatsappSessionManager: WhatsappSessionManager,
    private nodeExecutorService: NodeExecutorService,
  ) {}

  onModuleInit() {
    // Inject WhatsappSessionManager into NodeExecutorService
    this.nodeExecutorService.setWhatsappSessionManager(this.whatsappSessionManager);
  }
}

