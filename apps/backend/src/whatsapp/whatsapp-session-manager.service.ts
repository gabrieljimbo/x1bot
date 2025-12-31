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
    
    // Register send buttons callback
    this.whatsappSender.registerSendButtons(
      (sessionId: string, contactId: string, message: string, buttons: any[], footer?: string) =>
        this.sendButtons(sessionId, contactId, message, buttons, footer)
    );
    
    // Register send list callback
    this.whatsappSender.registerSendList(
      (sessionId: string, contactId: string, message: string, buttonText: string, sections: any[], footer?: string) =>
        this.sendList(sessionId, contactId, message, buttonText, sections, footer)
    );
    
    // Register send media callback
    this.whatsappSender.registerSendMedia(
      (sessionId: string, contactId: string, mediaType: 'image' | 'video' | 'audio' | 'document', mediaUrl: string, options?: { caption?: string; fileName?: string; sendAudioAsVoice?: boolean }) =>
        this.sendMedia(sessionId, contactId, mediaType, mediaUrl, options)
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
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--disable-client-side-phishing-detection',
          '--disable-default-apps',
          '--disable-features=TranslateUI',
          '--disable-hang-monitor',
          '--disable-ipc-flooding-protection',
          '--disable-popup-blocking',
          '--disable-prompt-on-repost',
          '--disable-renderer-backgrounding',
          '--disable-sync',
          '--disable-translate',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-default-browser-check',
          '--safebrowsing-disable-auto-update',
          '--enable-automation',
          '--password-store=basic',
          '--use-mock-keychain',
        ],
        executablePath: this.configService.get('PUPPETEER_EXECUTABLE_PATH'),
        timeout: 60000,
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
   * Send WhatsApp message with buttons
   */
  async sendButtons(sessionId: string, contactId: string, message: string, buttons: any[], footer?: string): Promise<void> {
    const sessionClient = this.sessions.get(sessionId);

    if (!sessionClient) {
      throw new Error('Session not found');
    }

    if (sessionClient.status !== WhatsappSessionStatus.CONNECTED) {
      throw new Error('Session not connected');
    }

    // Format phone number for WhatsApp
    const chatId = contactId.includes('@') ? contactId : `${contactId}@c.us`;

    // Simple formatted message
    let formattedMessage = `${message}\n\n`;
    
    buttons.forEach((btn, index) => {
      formattedMessage += `${index + 1}. ${btn.text}\n`;
    });
    
    if (footer) {
      formattedMessage += `\n_${footer}_`;
    }
    
    formattedMessage += `\n\n_Responda com o número da opção desejada_`;

    await sessionClient.client.sendMessage(chatId, formattedMessage);
  }

  /**
   * Send WhatsApp list message
   */
  async sendList(sessionId: string, contactId: string, message: string, buttonText: string, sections: any[], footer?: string): Promise<void> {
    const sessionClient = this.sessions.get(sessionId);

    if (!sessionClient) {
      throw new Error('Session not found');
    }

    if (sessionClient.status !== WhatsappSessionStatus.CONNECTED) {
      throw new Error('Session not connected');
    }

    // Format phone number for WhatsApp
    const chatId = contactId.includes('@') ? contactId : `${contactId}@c.us`;

    // Lists are also deprecated, we'll send a formatted message with sections
    let formattedMessage = `${message}\n\n`;
    
    let optionNumber = 1;
    sections.forEach((section) => {
      formattedMessage += `*${section.title}*\n`;
      section.rows.forEach((row: any) => {
        formattedMessage += `${optionNumber}. ${row.title}`;
        if (row.description) {
          formattedMessage += ` - ${row.description}`;
        }
        formattedMessage += '\n';
        optionNumber++;
      });
      formattedMessage += '\n';
    });
    
    if (footer) {
      formattedMessage += `_${footer}_\n`;
    }
    
    formattedMessage += `\n_Responda com o número da opção desejada_`;

    await sessionClient.client.sendMessage(chatId, formattedMessage);
  }

  /**
   * Send WhatsApp media (image, video, audio, document)
   */
  async sendMedia(
    sessionId: string, 
    contactId: string, 
    mediaType: 'image' | 'video' | 'audio' | 'document',
    mediaUrl: string,
    options?: {
      caption?: string;
      fileName?: string;
      sendAudioAsVoice?: boolean;
    }
  ): Promise<void> {
    const sessionClient = this.sessions.get(sessionId);

    if (!sessionClient) {
      throw new Error('Session not found');
    }

    if (sessionClient.status !== WhatsappSessionStatus.CONNECTED) {
      throw new Error('Session not connected');
    }

    // Format phone number for WhatsApp
    const chatId = contactId.includes('@') ? contactId : `${contactId}@c.us`;

    try {
      const { MessageMedia } = await import('whatsapp-web.js');
      const axios = (await import('axios')).default;
      
      const response = await axios.get(mediaUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: 50 * 1024 * 1024,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const contentType = response.headers['content-type'] || '';
      const base64Data = Buffer.from(response.data).toString('base64');
      const mimetype = contentType || this.getMimetypeForMediaType(mediaType);
      const media = new MessageMedia(mimetype, base64Data, options?.fileName);

      const sendOptions: any = { caption: options?.caption };
      
      if (mediaType === 'audio' && options?.sendAudioAsVoice) {
        sendOptions.sendAudioAsVoice = true;
      }

      await sessionClient.client.sendMessage(chatId, media, sendOptions);
    } catch (error: any) {
      console.error(`Failed to send ${mediaType}:`, error.message);
      throw new Error(`Failed to send ${mediaType}: ${error.message}`);
    }
  }

  /**
   * Get default mimetype for media type
   */
  private getMimetypeForMediaType(mediaType: 'image' | 'video' | 'audio' | 'document'): string {
    switch (mediaType) {
      case 'image':
        return 'image/jpeg';
      case 'video':
        return 'video/mp4';
      case 'audio':
        return 'audio/mpeg';
      case 'document':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Add labels to a chat
   */
  async addLabels(sessionId: string, contactId: string, labelIds: string[]): Promise<void> {
    const sessionClient = this.sessions.get(sessionId);

    if (!sessionClient) {
      throw new Error('Session not found');
    }

    if (sessionClient.status !== WhatsappSessionStatus.CONNECTED) {
      throw new Error('Session not connected');
    }

    const chatId = contactId.includes('@') ? contactId : `${contactId}@c.us`;
    const allLabels = await sessionClient.client.getLabels();

    for (const labelId of labelIds) {
      const label = allLabels.find(l => l.id === labelId);
      
      if (label) {
        try {
          // Use the chat.changeLabels method (the correct way)
          const chat = await sessionClient.client.getChatById(chatId);
          const currentLabels = (chat as any).labels || [];
          
          if (currentLabels.includes(labelId)) {
            continue;
          }
          
          try {
            const updatedLabels = [...currentLabels, labelId];
            let success = false;
            
            if (typeof (chat as any).changeLabels === 'function') {
              try {
                await (chat as any).changeLabels(updatedLabels);
                success = true;
              } catch (e: any) {
                // Silent fail, try next method
              }
            }
            
            if (!success) {
              try {
                const serializedChatId = (chat as any).id._serialized || chatId;
                await (sessionClient.client as any).addOrRemoveLabels([labelId], [serializedChatId]);
              } catch (e: any) {
                // Silent fail
              }
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error: any) {
            console.error(`Error adding label:`, error.message);
          }
        } catch (error: any) {
          console.error(`[ADD_LABELS] Error processing label "${label.name}":`, error.message);
        }
      } else {
        console.warn(`[ADD_LABELS] Label with ID ${labelId} not found`);
      }
    }
  }

  /**
   * Remove labels from a chat
   */
  async removeLabels(sessionId: string, contactId: string, labelIds: string[]): Promise<void> {
    const sessionClient = this.sessions.get(sessionId);

    if (!sessionClient) {
      throw new Error('Session not found');
    }

    if (sessionClient.status !== WhatsappSessionStatus.CONNECTED) {
      throw new Error('Session not connected');
    }

    const chatId = contactId.includes('@') ? contactId : `${contactId}@c.us`;
    const allLabels = await sessionClient.client.getLabels();

    for (const labelId of labelIds) {
      const label = allLabels.find(l => l.id === labelId);
      
      if (label) {
        try {
          // Wait a bit to ensure any previous label operations are synced
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Force refresh the chat to get the latest labels
          const chat = await sessionClient.client.getChatById(chatId);
          
          // Try to fetch the chat again to ensure we have the latest state
          await new Promise(resolve => setTimeout(resolve, 500));
          const refreshedChat = await sessionClient.client.getChatById(chatId);
          const currentLabels = (refreshedChat as any).labels || [];
          
          const labelIdStr = String(labelId);
          const hasLabel = currentLabels.some((id: string) => String(id) === labelIdStr);
          
          const updatedLabels = hasLabel 
            ? currentLabels.filter((id: string) => String(id) !== labelIdStr)
            : [];
          
          let success = false;
          
          if (typeof (refreshedChat as any).changeLabels === 'function') {
            try {
              await (refreshedChat as any).changeLabels(updatedLabels);
              success = true;
            } catch (e: any) {
              // Silent fail
            }
          }
          
          if (!success && typeof (refreshedChat as any).removeLabel === 'function') {
            try {
              await (refreshedChat as any).removeLabel(labelId);
              success = true;
            } catch (e: any) {
              // Silent fail
            }
          }
          
          if (!success) {
            try {
              const serializedChatId = (refreshedChat as any).id._serialized || chatId;
              await (sessionClient.client as any).addOrRemoveLabels([labelId], [serializedChatId]);
            } catch (e: any) {
              // Silent fail
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error: any) {
          console.error(`Error removing label:`, error.message);
        }
      } else {
        console.warn(`[REMOVE_LABELS] Label with ID ${labelId} not found`);
      }
    }
  }

  /**
   * Get all labels from a chat
   */
  async getChatLabels(sessionId: string, contactId: string): Promise<any[]> {
    const sessionClient = this.sessions.get(sessionId);

    if (!sessionClient) {
      throw new Error('Session not found');
    }

    if (sessionClient.status !== WhatsappSessionStatus.CONNECTED) {
      throw new Error('Session not connected');
    }

    const chatId = contactId.includes('@') ? contactId : `${contactId}@c.us`;
    const chat = await sessionClient.client.getChatById(chatId);

    return (chat as any).labels || [];
  }

  /**
   * Get all available labels
   */
  async getAllLabels(sessionId: string): Promise<any[]> {
    const sessionClient = this.sessions.get(sessionId);

    if (!sessionClient) {
      throw new Error('Session not found');
    }

    if (sessionClient.status !== WhatsappSessionStatus.CONNECTED) {
      throw new Error('Session not connected');
    }

    const labels = await sessionClient.client.getLabels();
    return labels || [];
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

    // Listen for poll votes
    client.on('vote_update', async (vote) => {
      console.log('Poll vote received:', vote);
      
      if (!vote.selectedOptions || vote.selectedOptions.length === 0) {
        return;
      }

      const contactId = vote.voter;
      // The selected option text
      const selectedOption = String(vote.selectedOptions[0]);
      
      console.log(`Poll vote from ${contactId}: ${selectedOption}`);

      await this.eventBus.emit({
        type: EventType.WHATSAPP_MESSAGE_RECEIVED,
        tenantId,
        sessionId,
        contactId,
        message: selectedOption,
        timestamp: new Date(),
      });

      // Handle as a regular message
      try {
        await this.messageHandler.handleMessage(tenantId, sessionId, contactId, selectedOption);
      } catch (error) {
        console.error('Error handling poll vote:', error);
      }
    });

    client.on('message', async (msg) => {
      // Only process incoming messages (not sent by us)
      if (!msg.fromMe) {
        const contactId = msg.from;
        let message = msg.body;

        // Check if it's a poll response
        if (msg.type === 'poll_creation') {
          console.log('Poll created, ignoring...');
          return;
        }

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

