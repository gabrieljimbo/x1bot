import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, LocalAuth } from 'whatsapp-web.js';
import { WhatsappSessionStatus, EventType } from '@n9n/shared';
import { WhatsappService } from './whatsapp.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { WhatsappMessageHandler } from './whatsapp-message-handler.service';
import { WhatsappSenderService } from '../execution/whatsapp-sender.service';

interface SessionClient {
  client: Client;
  tenantId: string;
  sessionId: string;
  status: WhatsappSessionStatus;
}

@Injectable()
export class WhatsappSessionManager implements OnModuleInit, OnModuleDestroy {
  private sessions: Map<string, SessionClient> = new Map();

  constructor(
    private configService: ConfigService,
    private whatsappService: WhatsappService,
    private eventBus: EventBusService,
    private messageHandler: WhatsappMessageHandler,
    private whatsappSender: WhatsappSenderService,
  ) {}

  onModuleInit() {
    // Register send message callback
    this.whatsappSender.registerSendMessage(
      (sessionId: string, contactId: string, message: string) =>
        this.sendMessage(sessionId, contactId, message)
    );
  }

  async onModuleDestroy() {
    // Cleanup all sessions
    for (const [sessionId, sessionClient] of this.sessions.entries()) {
      await this.disconnectSession(sessionId);
    }
  }

  /**
   * Initialize WhatsApp session
   */
  async initializeSession(tenantId: string, sessionId: string): Promise<void> {
    if (this.sessions.has(sessionId)) {
      console.log(`Session ${sessionId} already initialized, skipping...`);
      return;
    }

    console.log(`Initializing WhatsApp session ${sessionId} for tenant ${tenantId}`);

    const sessionPath = this.configService.get('WHATSAPP_SESSION_PATH', './.wwebjs_auth');

    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: sessionId,
        dataPath: sessionPath,
      }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: this.configService.get('PUPPETEER_EXECUTABLE_PATH'),
      },
    });

    // Store session
    this.sessions.set(sessionId, {
      client,
      tenantId,
      sessionId,
      status: WhatsappSessionStatus.CONNECTING,
    });

    // Setup event handlers
    this.setupEventHandlers(client, tenantId, sessionId);

    // Initialize client
    console.log(`Starting WhatsApp client for session ${sessionId}...`);
    await client.initialize();

    // Update status
    await this.whatsappService.updateSession(sessionId, {
      status: WhatsappSessionStatus.CONNECTING,
    });
  }

  /**
   * Disconnect session
   */
  async disconnectSession(sessionId: string): Promise<void> {
    const sessionClient = this.sessions.get(sessionId);

    if (!sessionClient) {
      return;
    }

    try {
      await sessionClient.client.destroy();
    } catch (error) {
      console.error('Error destroying WhatsApp client:', error);
    }

    this.sessions.delete(sessionId);

    await this.whatsappService.updateSession(sessionId, {
      status: WhatsappSessionStatus.DISCONNECTED,
    });

    await this.eventBus.emit({
      type: EventType.WHATSAPP_SESSION_DISCONNECTED,
      tenantId: sessionClient.tenantId,
      sessionId,
      timestamp: new Date(),
    });
  }

  /**
   * Send message
   */
  async sendMessage(sessionId: string, contactId: string, message: string): Promise<void> {
    const sessionClient = this.sessions.get(sessionId);

    if (!sessionClient) {
      throw new Error('Session not found');
    }

    if (sessionClient.status !== WhatsappSessionStatus.CONNECTED) {
      throw new Error('Session not connected');
    }

    // Format phone number for WhatsApp
    const chatId = contactId.includes('@') ? contactId : `${contactId}@c.us`;

    await sessionClient.client.sendMessage(chatId, message);
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId: string): WhatsappSessionStatus | null {
    const sessionClient = this.sessions.get(sessionId);
    return sessionClient ? sessionClient.status : null;
  }

  /**
   * Check if session is connected
   */
  isSessionConnected(sessionId: string): boolean {
    const sessionClient = this.sessions.get(sessionId);
    return sessionClient?.status === WhatsappSessionStatus.CONNECTED;
  }

  /**
   * Setup event handlers for WhatsApp client
   */
  private setupEventHandlers(client: Client, tenantId: string, sessionId: string): void {
    client.on('qr', async (qr) => {
      console.log(`QR Code generated for session ${sessionId}`);
      
      const sessionClient = this.sessions.get(sessionId);
      if (sessionClient) {
        sessionClient.status = WhatsappSessionStatus.QR_CODE;
      }

      await this.whatsappService.updateSession(sessionId, {
        status: WhatsappSessionStatus.QR_CODE,
        qrCode: qr,
      });

      await this.eventBus.emit({
        type: EventType.WHATSAPP_QR_CODE,
        tenantId,
        sessionId,
        qrCode: qr,
        timestamp: new Date(),
      });
    });

    client.on('ready', async () => {
      console.log(`WhatsApp session ${sessionId} is ready and connected!`);
      
      const sessionClient = this.sessions.get(sessionId);
      if (sessionClient) {
        sessionClient.status = WhatsappSessionStatus.CONNECTED;
      }

      const info = client.info;
      const phoneNumber = info?.wid?.user || '';

      console.log(`Session ${sessionId} connected with phone: ${phoneNumber}`);

      await this.whatsappService.updateSession(sessionId, {
        status: WhatsappSessionStatus.CONNECTED,
        phoneNumber,
        qrCode: undefined,
      });

      await this.eventBus.emit({
        type: EventType.WHATSAPP_SESSION_CONNECTED,
        tenantId,
        sessionId,
        phoneNumber,
        timestamp: new Date(),
      });
    });

    client.on('disconnected', async (reason) => {
      const sessionClient = this.sessions.get(sessionId);
      if (sessionClient) {
        sessionClient.status = WhatsappSessionStatus.DISCONNECTED;
      }

      await this.whatsappService.updateSession(sessionId, {
        status: WhatsappSessionStatus.DISCONNECTED,
      });

      await this.eventBus.emit({
        type: EventType.WHATSAPP_SESSION_DISCONNECTED,
        tenantId,
        sessionId,
        reason: String(reason),
        timestamp: new Date(),
      });

      this.sessions.delete(sessionId);
    });

    client.on('message', async (msg) => {
      // Only process incoming messages (not sent by us)
      if (!msg.fromMe) {
        const contactId = msg.from;
        const message = msg.body;

        console.log(`Message received on session ${sessionId} from ${contactId}: ${message}`);

        await this.eventBus.emit({
          type: EventType.WHATSAPP_MESSAGE_RECEIVED,
          tenantId,
          sessionId,
          contactId,
          message,
          timestamp: new Date(),
        });

        // Handle message
        console.log('[SESSION_MANAGER] Calling handleMessage with:', { tenantId, sessionId, contactId, message });
        try {
          await this.messageHandler.handleMessage(tenantId, sessionId, contactId, message);
          console.log('[SESSION_MANAGER] handleMessage completed successfully');
        } catch (error) {
          console.error('[SESSION_MANAGER] Error in handleMessage:', error);
        }
      }
    });

    client.on('auth_failure', async () => {
      const sessionClient = this.sessions.get(sessionId);
      if (sessionClient) {
        sessionClient.status = WhatsappSessionStatus.ERROR;
      }

      await this.whatsappService.updateSession(sessionId, {
        status: WhatsappSessionStatus.ERROR,
      });
    });
  }
}

