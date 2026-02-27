import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  WASocket,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  jidNormalizedUser,
  WAMessage,
  proto,
  downloadContentFromMessage,
  WAVersion,
  makeWASocket,
  DisconnectReason
} from '@whiskeysockets/baileys';
import { WhatsappSessionStatus, EventType, TriggerMessagePayload, PixConfig } from '@n9n/shared';
import { WhatsappService } from './whatsapp.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { WhatsappMessageHandler } from './whatsapp-message-handler.service';
import { WhatsappSenderService } from '../execution/whatsapp-sender.service';
import { StorageService } from '../storage/storage.service';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import * as path from 'path';
import * as fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import { useDatabaseAuthState } from './database-auth-state';
import { MessageQueueService } from './message-queue.service';

interface SessionClient {
  socket: WASocket;
  tenantId: string;
  sessionId: string;
  status: WhatsappSessionStatus;
  qrCode?: string;
  ownJid?: string; // The connected phone's own JID (e.g., '5511999999999@s.whatsapp.net')
  isBusiness?: boolean;
}

@Injectable()
export class WhatsappSessionManager implements OnModuleInit, OnModuleDestroy {
  private sessions: Map<string, SessionClient> = new Map();
  private logger = pino({ level: 'silent' });
  private baileys: any;
  private readyPromise: Promise<void>;
  private resolveReady: () => void;

  constructor(
    private configService: ConfigService,
    private whatsappService: WhatsappService,
    private eventBus: EventBusService,
    private messageHandler: WhatsappMessageHandler,
    private whatsappSender: WhatsappSenderService,
    private storageService: StorageService,
    private messageQueue: MessageQueueService,
  ) {
    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
  }

  async onModuleInit() {
    // Dynamic import Baileys since it's ESM only
    try {
      this.baileys = await (eval(`import('@whiskeysockets/baileys')`));
      this.resolveReady();
    } catch (error) {
      console.error('Failed to load Baileys:', error);
    }

    // Register send message callback
    this.whatsappSender.registerSendMessage(
      (sessionId: string, contactPhone: string, message: string) =>
        this.sendMessage(sessionId, contactPhone, message)
    );

    // Register send buttons callback
    this.whatsappSender.registerSendButtons(
      (sessionId: string, contactPhone: string, message: string, buttons: any[], footer?: string) =>
        this.sendButtons(sessionId, contactPhone, message, buttons, footer)
    );

    // Register send list callback
    this.whatsappSender.registerSendList(
      (sessionId: string, contactPhone: string, message: string, buttonText: string, sections: any[], footer?: string) =>
        this.sendList(sessionId, contactPhone, message, buttonText, sections, footer)
    );

    // Register send media callback
    this.whatsappSender.registerSendMedia(
      (sessionId: string, contactPhone: string, mediaType: 'image' | 'video' | 'audio' | 'document', mediaUrl: string, options?: { caption?: string; fileName?: string; sendAudioAsVoice?: boolean }) =>
        this.sendMedia(sessionId, contactPhone, mediaType, mediaUrl, options)
    );

    // Register send presence callback
    this.whatsappSender.registerSendPresence(
      (sessionId: string, contactPhone: string, presence: 'composing' | 'recording' | 'paused') =>
        this.sendPresenceUpdate(sessionId, contactPhone, presence)
    );

    // Auto-reconnect active sessions with staggered delay
    this.reconnectActiveSessions();
  }

  /**
   * Reconnect all sessions that were previously CONNECTED
   */
  private async reconnectActiveSessions() {
    console.log('[SESSION_MANAGER] Starting automatic reconnection of active sessions...');
    const sessions = await this.whatsappService.getAllSessions();
    const activeSessions = sessions.filter(s => s.status === WhatsappSessionStatus.CONNECTED);

    console.log(`[SESSION_MANAGER] Found ${activeSessions.length} active sessions to reconnect`);

    for (const session of activeSessions) {
      try {
        console.log(`[SESSION_MANAGER] Reconnecting session ${session.id} (${session.name})...`);
        await this.initializeSession(session.tenantId, session.id);

        // Staggered delay of 1.5 seconds between reconnections
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (error) {
        console.error(`[SESSION_MANAGER] Failed to reconnect session ${session.id}:`, error);
      }
    }
  }

  async onModuleDestroy() {
    // Cleanup all sessions
    for (const sessionId of this.sessions.keys()) {
      await this.disconnectSession(sessionId);
    }
  }

  /**
   * Initialize WhatsApp session
   */
  async initializeSession(tenantId: string, sessionId: string): Promise<void> {
    // Wait for Baileys to be loaded
    await this.readyPromise;

    if (this.sessions.has(sessionId)) {
      console.log(`Session ${sessionId} already initialized, skipping...`);
      return;
    }

    console.log(`Initializing Baileys session ${sessionId} for tenant ${tenantId}`);

    const { state, saveCreds } = await useDatabaseAuthState(sessionId, this.whatsappService);
    const { version } = await this.baileys.fetchLatestBaileysVersion();

    const makeWASocketFn = this.baileys.default || this.baileys.makeWASocket;

    const socket = makeWASocketFn({
      version,
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: this.baileys.makeCacheableSignalKeyStore(state.keys, this.logger),
      },
      logger: this.logger,
      browser: ['n9n', 'Chrome', '1.0.0'],
    });

    // Store session
    this.sessions.set(sessionId, {
      socket,
      tenantId,
      sessionId,
      status: WhatsappSessionStatus.CONNECTING,
    });

    // Setup event handlers
    this.setupEventHandlers(socket, tenantId, sessionId, saveCreds);
  }

  /**
   * Send presence update (composing, recording, etc)
   */
  async sendPresenceUpdate(sessionId: string, contactPhone: string, presence: 'composing' | 'recording' | 'paused'): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session && session.socket) {
      await session.socket.sendPresenceUpdate(presence, contactPhone);
    }
  }

  /**
   * Resolve a session client by sessionId.
   * Falls back to any connected session for the same tenant if the exact ID is not found.
   * This handles cases where executions store old session IDs (e.g., after server restarts).
   */
  private resolveSessionClient(sessionId: string): SessionClient | undefined {
    // 1. Direct lookup
    const direct = this.sessions.get(sessionId);
    if (direct) return direct;

    // 2. Fallback: find any connected session for the same tenant
    //    First, find the tenant of the requested session from any session we know
    //    (since we can't query DB synchronously, try all sessions for a connected one)
    console.warn(`[SESSION_RESOLVE] Session ${sessionId} not found in Map, searching by tenant fallback...`);

    // Try to find any connected session (when there's typically only one tenant)
    for (const [id, client] of this.sessions.entries()) {
      if (client.status === WhatsappSessionStatus.CONNECTED) {
        console.warn(`[SESSION_RESOLVE] Using fallback session ${id} (tenant: ${client.tenantId}) instead of ${sessionId}`);
        return client;
      }
    }

    // No connected session found at all
    console.error(`[SESSION_RESOLVE] No connected session found as fallback for ${sessionId}`);
    return undefined;
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
      sessionClient.socket.end(undefined);
    } catch (error) {
      console.error('Error terminating Baileys socket:', error);
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
  async sendMessage(sessionId: string, contactPhone: string, message: string, bypassDelay: boolean = false): Promise<void> {
    const sessionClient = this.resolveSessionClient(sessionId);

    if (!sessionClient) {
      throw new Error('Session not found');
    }

    if (sessionClient.status !== WhatsappSessionStatus.CONNECTED) {
      throw new Error('Session not connected');
    }

    const jid = this.formatJid(contactPhone);

    await this.messageQueue.enqueue(
      sessionId,
      jid,
      sessionClient.socket,
      { type: 'text', payload: { text: message } },
      async () => {
        await sessionClient.socket.sendMessage(jid, { text: message });
      },
      bypassDelay
    );
  }

  /**
   * Send WhatsApp message with buttons
   */
  async sendButtons(sessionId: string, contactPhone: string, message: string, buttons: any[], footer?: string): Promise<void> {
    const sessionClient = this.resolveSessionClient(sessionId);

    if (!sessionClient) {
      throw new Error('Session not found');
    }

    if (sessionClient.status !== WhatsappSessionStatus.CONNECTED) {
      throw new Error('Session not connected');
    }

    const jid = this.formatJid(contactPhone);

    await this.messageQueue.enqueue(
      sessionId,
      jid,
      sessionClient.socket,
      { type: 'buttons', payload: { text: message, buttons } },
      async () => {
        // Fallback: formatted text with numbered emojis
        const emojiNumbers = ['1️⃣', '2️⃣', '3️⃣'];
        let formattedMessage = `${message}\n\n`;
        buttons.forEach((btn, index) => {
          formattedMessage += `${emojiNumbers[index] || (index + 1 + '.')} ${btn.text}\n`;
        });

        if (footer) {
          formattedMessage += `\n_${footer}_`;
        }

        formattedMessage += `\n\n_Dica: Você pode clicar em um botão ou digitar o número correspondente._`;

        // Send with text-only fallback since native buttons are no longer supported in AnyMessageContent
        await sessionClient.socket.sendMessage(jid, {
          text: formattedMessage
        });
      }
    );
  }

  /**
   * Send WhatsApp list message
   */
  async sendList(sessionId: string, contactPhone: string, message: string, buttonText: string, sections: any[], footer?: string): Promise<void> {
    const sessionClient = this.resolveSessionClient(sessionId);

    if (!sessionClient) {
      throw new Error('Session not found');
    }

    if (sessionClient.status !== WhatsappSessionStatus.CONNECTED) {
      throw new Error('Session not connected');
    }

    const jid = this.formatJid(contactPhone);

    await this.messageQueue.enqueue(
      sessionId,
      jid,
      sessionClient.socket,
      { type: 'list', payload: { text: message, sections } },
      async () => {
        // Fallback: formatted text
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

        await sessionClient.socket.sendMessage(jid, { text: formattedMessage });
      }
    );
  }

  async sendPix(sessionId: string, contactPhone: string, config: PixConfig): Promise<void> {
    const sessionClient = this.resolveSessionClient(sessionId);

    if (!sessionClient) {
      throw new Error('Session not found');
    }

    if (sessionClient.status !== WhatsappSessionStatus.CONNECTED) {
      throw new Error('Session not connected');
    }

    const jid = this.formatJid(contactPhone);

    const formattedMessage = `💰 *${config.descricao || 'Cobrança PIX'}*

${config.mensagemCustom || ''}

Valor: *R$ ${config.valor}*
Recebedor: ${config.nomeRecebedor}

━━━━━━━━━━━━━━━━━
📋 *Chave PIX:*
${config.chavePix}
━━━━━━━━━━━━━━━━━

Após o pagamento, envie o comprovante aqui. ✅
⏱ _Válido por ${config.timeoutMinutos} minutos._`;

    await this.messageQueue.enqueue(
      sessionId,
      jid,
      sessionClient.socket,
      { type: 'text', payload: { text: formattedMessage } },
      async () => {
        await sessionClient.socket.sendMessage(jid, { text: formattedMessage });
      }
    );
  }

  /**
   * Send WhatsApp media (image, video, audio, document)
   */
  async sendMedia(
    sessionId: string,
    contactPhone: string,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    mediaUrl: string,
    options?: {
      caption?: string;
      fileName?: string;
      sendAudioAsVoice?: boolean;
      bypassDelay?: boolean;
    }
  ): Promise<void> {
    const sessionClient = this.resolveSessionClient(sessionId);

    if (!sessionClient) {
      throw new Error('Session not found');
    }

    if (sessionClient.status !== WhatsappSessionStatus.CONNECTED) {
      throw new Error('Session not connected');
    }

    const jid = this.formatJid(contactPhone);

    await this.messageQueue.enqueue(
      sessionId,
      jid,
      sessionClient.socket,
      { type: 'media', payload: { caption: options?.caption }, options: { ...options, mediaType } },
      async () => {
        const messageContent: any = {};
        // ... (existing switch logic remains the same)
        switch (mediaType) {
          case 'image':
            messageContent.image = { url: mediaUrl };
            messageContent.caption = options?.caption;
            break;
          case 'video':
            messageContent.video = { url: mediaUrl };
            messageContent.caption = options?.caption;
            break;
          case 'audio':
            // Download audio and convert to OGG/Opus for WhatsApp mobile compatibility
            try {
              const audioResponse = await fetch(mediaUrl);
              if (!audioResponse.ok) {
                throw new Error(`Failed to download audio: HTTP ${audioResponse.status}`);
              }
              let audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
              const isPtt = options?.sendAudioAsVoice || false;
              let audioMimetype: string;

              if (isPtt) {
                // For voice messages (PTT), ALWAYS convert to OGG/Opus
                try {
                  console.log(`[SEND_MEDIA] Converting audio to OGG/Opus for PTT (${audioBuffer.length} bytes)`);
                  audioBuffer = Buffer.from(await this.convertToOpus(audioBuffer));
                  console.log(`[SEND_MEDIA] Audio converted to OGG/Opus: ${audioBuffer.length} bytes`);
                } catch (convError: any) {
                  console.error(`[SEND_MEDIA] OGG/Opus conversion failed:`, convError.message);
                }
                audioMimetype = 'audio/ogg; codecs=opus';
              } else {
                const contentType = audioResponse.headers.get('content-type');
                audioMimetype = this.getAudioMimeType(mediaUrl, contentType);
              }

              console.log(`[SEND_MEDIA] Audio ready: ${audioBuffer.length} bytes, mimetype: ${audioMimetype}, ptt: ${isPtt}`);
              messageContent.audio = audioBuffer;
              messageContent.mimetype = audioMimetype;
              messageContent.ptt = isPtt;
            } catch (downloadError: any) {
              console.error(`[SEND_MEDIA] Audio download failed, falling back to URL:`, downloadError.message);
              messageContent.audio = { url: mediaUrl };
              messageContent.mimetype = 'audio/ogg; codecs=opus';
              messageContent.ptt = options?.sendAudioAsVoice || false;
            }
            break;
          case 'document':
            messageContent.document = { url: mediaUrl };
            messageContent.mimetype = this.getMimeTypeForMedia(mediaUrl);
            messageContent.fileName = options?.fileName || 'document';
            messageContent.caption = options?.caption;
            break;
        }

        await sessionClient.socket.sendMessage(jid, messageContent);
      },
      options?.bypassDelay || false
    );
  }

  /**
   * Label management
   */
  async addLabels(sessionId: string, contactPhone: string, labelIds: string[]): Promise<void> {
    const sessionClient = this.sessions.get(sessionId);
    if (!sessionClient) throw new Error(`Session ${sessionId} not found`);

    if (!sessionClient.isBusiness) {
      throw new Error('ACCOUNT_NOT_BUSINESS: WhatsApp labels are only available for Business accounts');
    }

    try {
      await sessionClient.socket.chatModify(
        { addChatLabel: { labelId: labelIds[0] } }, // Baileys currently supports one at a time for high-level? or we can loop
        contactPhone
      );

      // If multiple, Baileys might need separate calls or a different structure. 
      // Most common use case is adding one or we loop.
      for (let i = 1; i < labelIds.length; i++) {
        await sessionClient.socket.chatModify({ addChatLabel: { labelId: labelIds[i] } }, contactPhone);
      }

      await this.whatsappService.addChatLabels(sessionId, contactPhone, labelIds);
    } catch (error: any) {
      console.error(`[LABELS] Failed to add labels for session ${sessionId}:`, error.message);
      throw error;
    }
  }

  async removeLabels(sessionId: string, contactPhone: string, labelIds: string[]): Promise<void> {
    const sessionClient = this.sessions.get(sessionId);
    if (!sessionClient) throw new Error(`Session ${sessionId} not found`);

    if (!sessionClient.isBusiness) {
      throw new Error('ACCOUNT_NOT_BUSINESS: WhatsApp labels are only available for Business accounts');
    }

    try {
      for (const labelId of labelIds) {
        await sessionClient.socket.chatModify(
          { removeChatLabel: { labelId } },
          contactPhone
        );
      }
      await this.whatsappService.removeChatLabels(sessionId, contactPhone, labelIds);
    } catch (error: any) {
      console.error(`[LABELS] Failed to remove labels for session ${sessionId}:`, error.message);
      throw error;
    }
  }

  async getAllLabels(sessionId: string): Promise<any[]> {
    return this.whatsappService.getLabels(sessionId);
  }

  async getChatLabels(sessionId: string, contactPhone: string): Promise<any[]> {
    return this.whatsappService.getChatLabels(sessionId, contactPhone);
  }

  /**
   * Sync labels and associations from WhatsApp
   */
  async syncLabelsAndAssociations(sessionId: string): Promise<void> {
    const sessionClient = this.sessions.get(sessionId);
    if (!sessionClient || !sessionClient.isBusiness) return;

    try {
      // Baileys provides labels in the store or via query.
      // Since we don't use a full persistent store in this service yet, 
      // we can try to fetch them if Baileys supports a query for this.
      // Note: Baileys labels are usually synced via the 'labels.edit' and 'labels.association' events.
      // A full manual sync might require querying the WA server directly.
      console.log(`[LABELS] Auto-syncing labels for session ${sessionId}`);
    } catch (error: any) {
      console.error(`[LABELS] Sync error for session ${sessionId}:`, error.message);
    }
  }

  /**
   * Sync all participating groups for a session
   */
  async syncGroups(sessionId: string): Promise<any[]> {
    const sessionClient = this.sessions.get(sessionId);
    if (!sessionClient) {
      throw new Error(`Session ${sessionId} not found or initialized`);
    }

    try {
      // Fetch all participating groups from Baileys
      const groups = await sessionClient.socket.groupFetchAllParticipating();
      const groupList = Object.values(groups).map((g) => ({
        groupId: g.id,
        name: g.subject,
      }));

      // Upsert into database to preserve existing "enabled" and "workflowIds" settings
      return this.whatsappService.upsertGroupConfigs(sessionId, groupList);
    } catch (error: any) {
      console.error(`[GROUPS] Failed to sync groups for session ${sessionId}:`, error.message);
      throw error;
    }
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
   * Setup event handlers for Baileys
   */
  private setupEventHandlers(socket: WASocket, tenantId: string, sessionId: string, saveCreds: () => Promise<void>): void {

    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`[QR_GENERATE] Session ${sessionId}: New QR generated (${qr.substring(0, 10)}...)`);
        const sessionClient = this.sessions.get(sessionId);
        if (sessionClient) {
          sessionClient.status = WhatsappSessionStatus.QR_CODE;
          sessionClient.qrCode = qr;
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

        console.log(`[QR_BROADCAST] Session ${sessionId}: QR code broadcasted to event bus`);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const reasons = [
          this.baileys.DisconnectReason.loggedOut,
          this.baileys.DisconnectReason.connectionReplaced,
          this.baileys.DisconnectReason.forbidden
        ];

        const shouldReconnect = !reasons.includes(statusCode);
        console.log(`Connection closed for session ${sessionId}. Status: ${statusCode}. Reconnecting: ${shouldReconnect}`);

        if (shouldReconnect) {
          this.sessions.delete(sessionId);
          await this.initializeSession(tenantId, sessionId);
        } else {
          console.log(`[SESSION_CLEANUP] Cleaning up session ${sessionId} due to logout/conflict/forbidden`);
          this.sessions.delete(sessionId);

          // Clear DB auth state
          await this.whatsappService.deleteAuthState(sessionId);

          await this.whatsappService.updateSession(sessionId, {
            status: WhatsappSessionStatus.DISCONNECTED,
            qrCode: undefined
          });

          await this.eventBus.emit({
            type: EventType.WHATSAPP_SESSION_DISCONNECTED,
            tenantId,
            sessionId,
            timestamp: new Date(),
          });
        }
      }

      if (connection === 'open') {
        console.log(`WhatsApp session ${sessionId} is open and connected!`);

        const sessionClient = this.sessions.get(sessionId);
        const user = this.baileys.jidNormalizedUser(socket.user?.id!);
        const phoneNumber = user.split('@')[0];

        if (sessionClient) {
          sessionClient.status = WhatsappSessionStatus.CONNECTED;
          sessionClient.ownJid = user; // Store own JID to filter self-messages

          // Check if it's a business account
          // @ts-ignore
          const isBusiness = !!socket.authState.creds.me?.platform || socket.user?.id.includes(':');
          // Note: Baileys platform check or querying business profile is better.
          // For now, we can try to detect via the user object if available or simple query.

          try {
            // A more reliable way is to fetch the verified name or business profile
            const result = await socket.getBusinessProfile(user).catch(() => null);
            sessionClient.isBusiness = !!result;
          } catch (e) {
            sessionClient.isBusiness = false;
          }

          console.log(`[SESSION] Account type detected: ${sessionClient.isBusiness ? 'BUSINESS' : 'PERSONAL'}`);

          await this.whatsappService.updateSession(sessionId, {
            status: WhatsappSessionStatus.CONNECTED,
            phoneNumber,
            qrCode: undefined,
            // @ts-ignore
            isBusiness: sessionClient.isBusiness
          });

          if (sessionClient.isBusiness) {
            this.syncLabelsAndAssociations(sessionId);
          }
        }

        await this.eventBus.emit({
          type: EventType.WHATSAPP_SESSION_CONNECTED,
          tenantId,
          sessionId,
          phoneNumber,
          timestamp: new Date(),
        });
      }
    });

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('messages.upsert', async (m) => {
      if (m.type === 'notify') {
        const sessionClient = this.sessions.get(sessionId);
        for (const msg of m.messages) {
          // Skip status broadcasts (stories/status updates)
          const remoteJid = msg.key.remoteJid || '';
          if (remoteJid === 'status@broadcast') continue;

          await this.handleIncomingMessage(tenantId, sessionId, msg);
        }
      }
    });

    socket.ev.on('messaging-history.set', async ({ messages, chats }) => {
      console.log(`[HISTORY] Session ${sessionId}: Received historical data (${messages.length} messages, ${chats.length} chats)`);

      // Group messages by remoteJid
      const messagesByJid: { [jid: string]: any[] } = {};

      for (const msg of messages) {
        const jid = msg.key.remoteJid;
        if (!jid || jid === 'status@broadcast') continue;

        if (!messagesByJid[jid]) {
          messagesByJid[jid] = [];
        }
        messagesByJid[jid].push(msg);
      }

      // Process up to 50 most recent messages per conversation
      for (const jid in messagesByJid) {
        // Sort by timestamp descending and take 50
        const sortedMsgs = messagesByJid[jid]
          .sort((a, b) => Number(b.messageTimestamp) - Number(a.messageTimestamp))
          .slice(0, 50);

        // Process them (in chronological order for the handler if it mattered, but handleMessage is independent)
        for (const msg of sortedMsgs.reverse()) {
          try {
            await this.handleIncomingMessage(tenantId, sessionId, msg, true);
          } catch (e) {
            console.error(`[HISTORY] Error processing message ${msg.key.id}:`, e);
          }
        }
      }

      console.log(`[HISTORY] Session ${sessionId}: Finished processing historical messages`);
    });

    // Label Events
    socket.ev.on('labels.edit', async (label) => {
      console.log(`[LABELS] Label edit received:`, label);
      if (label.name) {
        await this.whatsappService.upsertLabels(sessionId, [{
          labelId: label.id,
          name: label.name,
          color: (label as any).colorIndex || (label as any).color
        }]);
      } else {
        // Label deleted (or name is missing)
        await this.whatsappService.deleteLabel(sessionId, label.id);
      }
    });

    socket.ev.on('labels.association', async ({ association, type }) => {
      console.log(`[LABELS] Label association: ${association.chatId} -> ${association.labelId} (${type})`);
      if (type === 'add') {
        await this.whatsappService.addChatLabels(sessionId, association.chatId, [association.labelId]);
      } else {
        await this.whatsappService.removeChatLabels(sessionId, association.chatId, [association.labelId]);
      }
    });
  }

  /**
   * Handle incoming message
   */
  private async handleIncomingMessage(tenantId: string, sessionId: string, msg: WAMessage, skipTrigger: boolean = false): Promise<void> {
    const contactPhone = msg.key.remoteJid!;
    const messageId = msg.key.id!;

    try {
      const payload = await this.processMessage(msg, tenantId, sessionId);

      if (!skipTrigger) {
        await this.eventBus.emit({
          type: EventType.WHATSAPP_MESSAGE_RECEIVED,
          tenantId,
          sessionId,
          contactPhone,
          message: payload.text || '',
          timestamp: new Date(),
        });
      }

      await this.messageHandler.handleMessage(tenantId, sessionId, contactPhone, payload, skipTrigger);
    } catch (error) {
      console.error('[BAILEYS] Error processing incoming message:', error);
    }
  }

  /**
   * Process message and return normalized payload
   */
  private async processMessage(msg: WAMessage, tenantId: string, sessionId: string): Promise<TriggerMessagePayload> {
    const messageId = msg.key.id!;
    const from = msg.key.remoteJid!;
    const timestamp = (Number(msg.messageTimestamp) * 1000) || Date.now();
    const m = msg.message;

    if (!m) {
      return { messageId, from, fromMe: !!msg.key.fromMe, type: 'text', text: '', media: null, timestamp };
    }

    // Get text content from various Baileys message types
    let text = m.conversation ||
      m.extendedTextMessage?.text ||
      m.imageMessage?.caption ||
      m.videoMessage?.caption ||
      m.documentMessage?.caption ||
      '';

    // Handle interactive messages (common in Meta Ads)
    if (m.buttonsResponseMessage) {
      text = (m.buttonsResponseMessage as any).selectedButtonId || (m.buttonsResponseMessage as any).displayText || text;
    } else if (m.listResponseMessage) {
      text = m.listResponseMessage.title || m.listResponseMessage.singleSelectReply?.selectedRowId || text;
    } else if (m.templateButtonReplyMessage) {
      text = (m.templateButtonReplyMessage as any).selectedId || (m.templateButtonReplyMessage as any).displayText || text;
    } else if (m.interactiveResponseMessage) {
      const interactive = m.interactiveResponseMessage;
      if (interactive.body) {
        text = (interactive as any).nativeFlowResponse?.paramsJson || interactive.body.text || text;
      }
    } else if (m.buttonsMessage) {
      text = m.buttonsMessage.contentText || text;
    } else if (m.templateMessage) {
      text = m.templateMessage.hydratedTemplate?.hydratedContentText || text;
    } else if (m.interactiveMessage) {
      text = m.interactiveMessage.body?.text || text;
    }

    // Check for media
    const mediaType = this.getBaileysMediaType(m);

    if (mediaType) {
      try {
        const sessionClient = this.sessions.get(sessionId);
        if (!sessionClient) throw new Error('Session client not found');

        const stream = await this.baileys.downloadContentFromMessage(
          (m as any)[mediaType + 'Message'],
          mediaType
        );

        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk]);
        }

        const msgContent = (m as any)[mediaType + 'Message'];
        const mimeType = msgContent.mimetype;
        const fileName = msgContent.fileName || `${mediaType}-${Date.now()}`;

        const uploadResult = await this.storageService.uploadMedia(
          buffer,
          mimeType,
          fileName
        );

        return {
          messageId,
          from,
          fromMe: !!msg.key.fromMe,
          type: 'media',
          text,
          media: {
            mediaType: this.mapBaileysToMediaType(mediaType),
            mimeType,
            fileName,
            size: uploadResult.size,
            url: uploadResult.url,
          },
          timestamp,
        };
      } catch (error: any) {
        console.error('[BAILEYS] Media download failed:', error.message);
        return { messageId, from, fromMe: !!msg.key.fromMe, type: 'text', text, media: null, timestamp };
      }
    }

    return {
      messageId,
      from,
      fromMe: !!msg.key.fromMe,
      type: 'text',
      text,
      media: null,
      timestamp,
    };
  }

  private getBaileysMediaType(m: proto.IMessage): 'image' | 'video' | 'audio' | 'document' | null {
    if (m.imageMessage) return 'image';
    if (m.videoMessage) return 'video';
    if (m.audioMessage) return 'audio';
    if (m.documentMessage) return 'document';
    return null;
  }

  private mapBaileysToMediaType(type: string): 'image' | 'video' | 'audio' | 'document' {
    if (type === 'image') return 'image';
    if (type === 'video') return 'video';
    if (type === 'audio') return 'audio';
    return 'document';
  }

  private formatJid(contactPhone: string): string {
    if (contactPhone.includes('@')) return contactPhone;
    return `${contactPhone.replace('+', '')}@s.whatsapp.net`;
  }

  private getMimeTypeForMedia(url: string): string {
    const ext = path.extname(url).toLowerCase();
    switch (ext) {
      case '.pdf': return 'application/pdf';
      case '.doc': return 'application/msword';
      case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case '.xls': return 'application/vnd.ms-excel';
      case '.xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case '.zip': return 'application/zip';
      default: return 'application/octet-stream';
    }
  }

  private getAudioMimeType(url: string, contentType: string | null): string {
    // Try to detect from URL extension first
    const urlWithoutQuery = url.split('?')[0];
    const ext = path.extname(urlWithoutQuery).toLowerCase();
    switch (ext) {
      case '.mp3': return 'audio/mpeg';
      case '.ogg': return 'audio/ogg; codecs=opus';
      case '.opus': return 'audio/ogg; codecs=opus';
      case '.m4a': return 'audio/mp4';
      case '.aac': return 'audio/aac';
      case '.wav': return 'audio/wav';
      case '.wma': return 'audio/x-ms-wma';
      case '.mp4': return 'audio/mp4';
    }

    // Try from Content-Type header
    if (contentType) {
      const ct = contentType.split(';')[0].trim().toLowerCase();
      if (ct.startsWith('audio/')) {
        return ct;
      }
    }

    // Default to audio/ogg for voice messages (WhatsApp's native format)
    return 'audio/ogg; codecs=opus';
  }

  /**
   * Helper to simulate human behavior by sending presence updates and waiting
   */
  private async simulatePresence(sessionClient: SessionClient, jid: string, type: 'composing' | 'recording'): Promise<void> {
    try {
      // Send the presence update
      await sessionClient.socket.sendPresenceUpdate(type, jid);

      // Wait a bit to simulate human reaction/typing/recording
      // We use a shorter delay for typing and a longer one for recording
      const delay = type === 'recording' ? 4000 : 2000;
      await new Promise(resolve => setTimeout(resolve, delay));

      // After the delay, we stop the simulation (usually done automatically by sending the message, but safer to pause)
      await sessionClient.socket.sendPresenceUpdate('paused', jid);
    } catch (error: any) {
      console.warn(`[PRESENCE] Failed to simulate presence:`, error.message);
      // Don't throw, just log warning and continue – better to send the message without simulation than fail
    }
  }

  /**
   * Convert audio buffer to OGG/Opus format using ffmpeg
   * This is required for WhatsApp mobile PTT (voice message) compatibility
   */
  private async convertToOpus(inputBuffer: Buffer): Promise<Buffer> {
    const execFileAsync = promisify(execFile);
    const tmpDir = os.tmpdir();
    const inputFile = path.join(tmpDir, `wa_audio_in_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    const outputFile = path.join(tmpDir, `wa_audio_out_${Date.now()}_${Math.random().toString(36).slice(2)}.ogg`);

    try {
      // Write input buffer to temp file
      await fs.writeFile(inputFile, inputBuffer);

      // Convert to OGG/Opus using ffmpeg
      await execFileAsync('ffmpeg', [
        '-i', inputFile,
        '-vn',                    // No video
        '-acodec', 'libopus',     // Opus codec
        '-b:a', '128k',           // 128kbps bitrate
        '-ar', '48000',           // 48kHz sample rate (Opus standard)
        '-ac', '1',               // Mono
        '-application', 'voip',   // Optimized for voice
        '-y',                     // Overwrite output
        outputFile,
      ], { timeout: 30000 });

      // Read the converted file
      const outputBuffer = Buffer.from(await fs.readFile(outputFile));
      return outputBuffer;
    } finally {
      // Clean up temp files
      await fs.unlink(inputFile).catch(() => { });
      await fs.unlink(outputFile).catch(() => { });
    }
  }
}
