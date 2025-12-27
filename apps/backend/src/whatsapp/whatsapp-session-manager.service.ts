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
          
          // Check if label already exists
          if (currentLabels.includes(labelId)) {
            console.log(`[ADD_LABELS] Label "${label.name}" (ID: ${labelId}) already exists on chat ${contactId}`);
            continue;
          }
          
          try {
            // Add label to existing labels
            const updatedLabels = [...currentLabels, labelId];
            
            console.log(`[ADD_LABELS] chat.changeLabels available: ${typeof (chat as any).changeLabels === 'function'}`);
            console.log(`[ADD_LABELS] Attempting to add label ${labelId} to labels: [${currentLabels.join(', ')}]`);
            
            // Try multiple approaches like in the reference code
            let success = false;
            
            // Method 1: Try changeLabels (most reliable)
            if (typeof (chat as any).changeLabels === 'function') {
              try {
                await (chat as any).changeLabels(updatedLabels);
                success = true;
                console.log(`[ADD_LABELS] Method 1 (changeLabels) succeeded`);
              } catch (e: any) {
                console.log(`[ADD_LABELS] Method 1 (changeLabels) failed: ${e.message}`);
              }
            }
            
            // Method 2: Try addOrRemoveLabels if changeLabels failed
            if (!success) {
              try {
                const serializedChatId = (chat as any).id._serialized || chatId;
                await (sessionClient.client as any).addOrRemoveLabels([labelId], [serializedChatId]);
                success = true;
                console.log(`[ADD_LABELS] Method 2 (addOrRemoveLabels) succeeded`);
              } catch (e: any) {
                console.log(`[ADD_LABELS] Method 2 (addOrRemoveLabels) failed: ${e.message}`);
              }
            }
            
            // Wait for sync
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Get updated chat to verify
            const updatedChat = await sessionClient.client.getChatById(chatId);
            const newLabels = (updatedChat as any).labels || [];
            
            console.log(`[ADD_LABELS] Added label "${label.name}" (ID: ${labelId}) to chat ${contactId}`);
            console.log(`[ADD_LABELS] Labels before: [${currentLabels.join(', ')}]`);
            console.log(`[ADD_LABELS] Labels after: [${newLabels.join(', ')}]`);
            console.log(`[ADD_LABELS] Success: ${newLabels.includes(labelId) || newLabels.includes(String(labelId))}`);
          } catch (error: any) {
            console.error(`[ADD_LABELS] Error adding label "${label.name}":`, error.message);
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
          
          console.log(`[REMOVE_LABELS] Current labels on chat: [${currentLabels.join(', ')}]`);
          console.log(`[REMOVE_LABELS] Trying to remove label ID: ${labelId} (type: ${typeof labelId})`);
          console.log(`[REMOVE_LABELS] Label exists check: ${currentLabels.includes(labelId)}`);
          console.log(`[REMOVE_LABELS] Label exists check (String): ${currentLabels.includes(String(labelId))}`);
          
          // Check if label exists (compare as strings)
          const labelIdStr = String(labelId);
          const hasLabel = currentLabels.some((id: string) => String(id) === labelIdStr);
          
          if (!hasLabel) {
            console.log(`[REMOVE_LABELS] Label "${label.name}" (ID: ${labelId}) not found on chat ${contactId}`);
            console.log(`[REMOVE_LABELS] This might be a sync issue. Attempting removal anyway...`);
            // Don't skip - try to remove anyway
          }
          
          // Remove label from existing labels (compare as strings)
          // If label not found in current list, try to remove all labels and re-add the ones we want to keep
          let updatedLabels: string[];
          
          if (hasLabel) {
            updatedLabels = currentLabels.filter((id: string) => String(id) !== labelIdStr);
          } else {
            // Label not in list, but might exist due to sync issues
            // Try to get all labels except the one we want to remove
            updatedLabels = [];
          }
          
          console.log(`[REMOVE_LABELS] Updated labels will be: [${updatedLabels.join(', ')}]`);
          
          // Use changeLabels if available, otherwise fallback
          let success = false;
          
          if (typeof (refreshedChat as any).changeLabels === 'function') {
            try {
              await (refreshedChat as any).changeLabels(updatedLabels);
              success = true;
              console.log(`[REMOVE_LABELS] Method 1 (changeLabels) succeeded`);
            } catch (e: any) {
              console.log(`[REMOVE_LABELS] Method 1 (changeLabels) failed: ${e.message}`);
            }
          }
          
          if (!success && typeof (refreshedChat as any).removeLabel === 'function') {
            try {
              await (refreshedChat as any).removeLabel(labelId);
              success = true;
              console.log(`[REMOVE_LABELS] Method 2 (removeLabel) succeeded`);
            } catch (e: any) {
              console.log(`[REMOVE_LABELS] Method 2 (removeLabel) failed: ${e.message}`);
            }
          }
          
          if (!success) {
            try {
              const serializedChatId = (refreshedChat as any).id._serialized || chatId;
              await (sessionClient.client as any).addOrRemoveLabels([labelId], [serializedChatId]);
              success = true;
              console.log(`[REMOVE_LABELS] Method 3 (addOrRemoveLabels) succeeded`);
            } catch (e: any) {
              console.log(`[REMOVE_LABELS] Method 3 (addOrRemoveLabels) failed: ${e.message}`);
            }
          }
          
          // Wait for sync
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Get updated chat to verify
          const updatedChat = await sessionClient.client.getChatById(chatId);
          const newLabels = (updatedChat as any).labels || [];
          
          console.log(`[REMOVE_LABELS] Removed label "${label.name}" (ID: ${labelId}) from chat ${contactId}`);
          console.log(`[REMOVE_LABELS] Labels before: [${currentLabels.join(', ')}]`);
          console.log(`[REMOVE_LABELS] Labels after: [${newLabels.join(', ')}]`);
          console.log(`[REMOVE_LABELS] Success: ${!newLabels.includes(labelId) && !newLabels.includes(String(labelId))}`);
        } catch (error: any) {
          console.error(`[REMOVE_LABELS] Error removing label "${label.name}":`, error.message);
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
      console.error('[GET_LABELS] Session not found:', sessionId);
      throw new Error('Session not found');
    }

    if (sessionClient.status !== WhatsappSessionStatus.CONNECTED) {
      console.error('[GET_LABELS] Session not connected:', sessionId, sessionClient.status);
      throw new Error('Session not connected');
    }

    console.log('[GET_LABELS] Fetching labels for session:', sessionId);
    const labels = await sessionClient.client.getLabels();
    console.log('[GET_LABELS] Found labels:', labels?.length || 0, labels);
    
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

