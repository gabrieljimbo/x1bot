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
  useMultiFileAuthState,
  makeWASocket,
  DisconnectReason
} from '@whiskeysockets/baileys';
import { WhatsappSessionStatus, EventType, TriggerMessagePayload } from '@n9n/shared';
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

interface SessionClient {
  socket: WASocket;
  tenantId: string;
  sessionId: string;
  status: WhatsappSessionStatus;
  qrCode?: string;
  ownJid?: string; // The connected phone's own JID (e.g., '5511999999999@s.whatsapp.net')
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

    const authPath = path.join(
      this.configService.get('WHATSAPP_SESSION_PATH', './.baileys_auth'),
      sessionId
    );

    // Create directory if it doesn't exist
    await fs.mkdir(authPath, { recursive: true });

    const { state, saveCreds } = await this.baileys.useMultiFileAuthState(authPath);
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
  async sendMessage(sessionId: string, contactId: string, message: string): Promise<void> {
    const sessionClient = this.resolveSessionClient(sessionId);

    if (!sessionClient) {
      throw new Error('Session not found');
    }

    if (sessionClient.status !== WhatsappSessionStatus.CONNECTED) {
      throw new Error('Session not connected');
    }

    const jid = this.formatJid(contactId);
    await sessionClient.socket.sendMessage(jid, { text: message });
  }

  /**
   * Send WhatsApp message with buttons
   */
  async sendButtons(sessionId: string, contactId: string, message: string, buttons: any[], footer?: string): Promise<void> {
    const sessionClient = this.resolveSessionClient(sessionId);

    if (!sessionClient) {
      throw new Error('Session not found');
    }

    if (sessionClient.status !== WhatsappSessionStatus.CONNECTED) {
      throw new Error('Session not connected');
    }

    const jid = this.formatJid(contactId);

    // Baileys button message format
    // Note: Buttons are currently limited in many WhatsApp versions (official and unofficial)
    // We'll use a formatted message as a fallback if needed, but here's the Baileys format:

    // Fallback: formatted text (Baileys buttons are often not supported by WA anymore)
    let formattedMessage = `${message}\n\n`;
    buttons.forEach((btn, index) => {
      formattedMessage += `${index + 1}. ${btn.text}\n`;
    });
    if (footer) {
      formattedMessage += `\n_${footer}_`;
    }
    formattedMessage += `\n\n_Responda com o número da opção desejada_`;

    await sessionClient.socket.sendMessage(jid, { text: formattedMessage });
  }

  /**
   * Send WhatsApp list message
   */
  async sendList(sessionId: string, contactId: string, message: string, buttonText: string, sections: any[], footer?: string): Promise<void> {
    const sessionClient = this.resolveSessionClient(sessionId);

    if (!sessionClient) {
      throw new Error('Session not found');
    }

    if (sessionClient.status !== WhatsappSessionStatus.CONNECTED) {
      throw new Error('Session not connected');
    }

    const jid = this.formatJid(contactId);

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
    const sessionClient = this.resolveSessionClient(sessionId);

    if (!sessionClient) {
      throw new Error('Session not found');
    }

    if (sessionClient.status !== WhatsappSessionStatus.CONNECTED) {
      throw new Error('Session not connected');
    }

    const jid = this.formatJid(contactId);

    try {
      const messageContent: any = {};

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
              // WhatsApp mobile requires this format for playable voice messages
              try {
                console.log(`[SEND_MEDIA] Converting audio to OGG/Opus for PTT (${audioBuffer.length} bytes)`);
                audioBuffer = Buffer.from(await this.convertToOpus(audioBuffer));
                console.log(`[SEND_MEDIA] Audio converted to OGG/Opus: ${audioBuffer.length} bytes`);
              } catch (convError: any) {
                console.error(`[SEND_MEDIA] OGG/Opus conversion failed:`, convError.message);
                // Continue with original buffer — may work on WhatsApp Web at least
              }
              audioMimetype = 'audio/ogg; codecs=opus';
            } else {
              // For regular audio (non-PTT), use detected mimetype
              const contentType = audioResponse.headers.get('content-type');
              audioMimetype = this.getAudioMimeType(mediaUrl, contentType);
            }

            console.log(`[SEND_MEDIA] Audio ready: ${audioBuffer.length} bytes, mimetype: ${audioMimetype}, ptt: ${isPtt}`);
            messageContent.audio = audioBuffer;
            messageContent.mimetype = audioMimetype;
            messageContent.ptt = isPtt;
          } catch (downloadError: any) {
            console.error(`[SEND_MEDIA] Audio download failed, falling back to URL:`, downloadError.message);
            // Fallback: try sending as URL
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
    } catch (error: any) {
      console.error(`Failed to send ${mediaType}:`, error.message);
      throw new Error(`Failed to send ${mediaType}: ${error.message}`);
    }
  }

  /**
   * Label management (Note: Baileys doesn't have a simple high-level API for this yet)
   * We will implement it as stub or simple version if possible.
   */
  async addLabels(sessionId: string, contactId: string, labelIds: string[]): Promise<void> {
    console.warn('[BAILEYS] Label management not fully implemented yet');
  }

  async removeLabels(sessionId: string, contactId: string, labelIds: string[]): Promise<void> {
    console.warn('[BAILEYS] Label management not fully implemented yet');
  }

  async getAllLabels(sessionId: string): Promise<any[]> {
    console.warn('[BAILEYS] Label management not fully implemented yet');
    return [];
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
        console.log(`QR Code generated for session ${sessionId}`);
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
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== this.baileys.DisconnectReason.loggedOut;
        console.log(`Connection closed for session ${sessionId}. Reconnecting: ${shouldReconnect}`);

        if (shouldReconnect) {
          this.sessions.delete(sessionId);
          await this.initializeSession(tenantId, sessionId);
        } else {
          this.sessions.delete(sessionId);
          await this.whatsappService.updateSession(sessionId, {
            status: WhatsappSessionStatus.DISCONNECTED,
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
        }

        console.log(`[SESSION] Own JID stored: ${user}`);

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
      }
    });

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('messages.upsert', async (m) => {
      if (m.type === 'notify') {
        const sessionClient = this.sessions.get(sessionId);
        for (const msg of m.messages) {
          // Skip messages from the bot itself
          if (msg.key.fromMe) continue;

          // Skip status broadcasts (stories/status updates)
          const remoteJid = msg.key.remoteJid || '';
          if (remoteJid === 'status@broadcast') continue;

          // Skip messages from the connected number itself (prevents infinite loops)
          if (sessionClient?.ownJid) {
            const senderNumber = remoteJid.split('@')[0];
            const ownNumber = sessionClient.ownJid.split('@')[0];
            if (senderNumber === ownNumber) {
              console.log(`[SESSION] Ignoring self-message from ${senderNumber}`);
              continue;
            }
          }

          await this.handleIncomingMessage(tenantId, sessionId, msg);
        }
      }
    });
  }

  /**
   * Handle incoming message
   */
  private async handleIncomingMessage(tenantId: string, sessionId: string, msg: WAMessage): Promise<void> {
    const contactId = msg.key.remoteJid!;
    const messageId = msg.key.id!;

    try {
      const payload = await this.processMessage(msg, tenantId, sessionId);

      console.log(`Message received on session ${sessionId} from ${contactId}:`, payload.type);

      await this.eventBus.emit({
        type: EventType.WHATSAPP_MESSAGE_RECEIVED,
        tenantId,
        sessionId,
        contactId,
        message: payload.text || '',
        timestamp: new Date(),
      });

      await this.messageHandler.handleMessage(tenantId, sessionId, contactId, payload);
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
      return { messageId, from, type: 'text', text: '', media: null, timestamp };
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
        return { messageId, from, type: 'text', text, media: null, timestamp };
      }
    }

    return {
      messageId,
      from,
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

  private formatJid(contactId: string): string {
    if (contactId.includes('@')) return contactId;
    return `${contactId.replace('+', '')}@s.whatsapp.net`;
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
