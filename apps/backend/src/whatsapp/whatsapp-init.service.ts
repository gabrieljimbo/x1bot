import { Injectable, OnModuleInit } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappSessionManager } from './whatsapp-session-manager.service';
import { WhatsappSessionStatus } from '@n9n/shared';

@Injectable()
export class WhatsappInitService implements OnModuleInit {
  constructor(
    private whatsappService: WhatsappService,
    private whatsappSessionManager: WhatsappSessionManager,
  ) {}

  async onModuleInit() {
    // Auto-initialize connected sessions on startup
    await this.initializeConnectedSessions();
  }

  /**
   * Initialize all previously connected sessions
   */
  private async initializeConnectedSessions(): Promise<void> {
    try {
      // Get all sessions from all tenants
      const sessions = await this.whatsappService.getAllSessions();

      for (const session of sessions) {
        // Only initialize sessions that were previously connected
        if (
          session.status === WhatsappSessionStatus.CONNECTED ||
          session.status === WhatsappSessionStatus.CONNECTING
        ) {
          try {
            console.log(`Initializing WhatsApp session: ${session.name} (${session.id})`);
            await this.whatsappSessionManager.initializeSession(
              session.tenantId,
              session.id,
            );
          } catch (error) {
            console.error(`Failed to initialize session ${session.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error initializing WhatsApp sessions:', error);
    }
  }
}


