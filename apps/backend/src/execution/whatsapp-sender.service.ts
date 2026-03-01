import { Injectable } from '@nestjs/common';
import { PixConfig } from '@n9n/shared';

export interface ButtonData {
  id: string;
  text: string;
}

export interface ListSection {
  title: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

export interface MediaData {
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  caption?: string;
  fileName?: string;
  sendAudioAsVoice?: boolean;
}

@Injectable()
export class WhatsappSenderService {
  private sendMessageCallback: ((sessionId: string, contactPhone: string, message: string) => Promise<void>) | null = null;
  private sendButtonsCallback: ((sessionId: string, contactPhone: string, message: string, buttons: ButtonData[], footer?: string) => Promise<void>) | null = null;
  private sendListCallback: ((sessionId: string, contactPhone: string, message: string, buttonText: string, sections: ListSection[], footer?: string) => Promise<void>) | null = null;
  private sendMediaCallback: ((sessionId: string, contactPhone: string, mediaType: 'image' | 'video' | 'audio' | 'document', mediaUrl: string, options?: { caption?: string; fileName?: string; sendAudioAsVoice?: boolean }) => Promise<void>) | null = null;
  private sendPresenceCallback: ((sessionId: string, contactPhone: string, presence: 'composing' | 'recording' | 'paused') => Promise<void>) | null = null;
  private sendPixCallback: ((sessionId: string, contactPhone: string, config: PixConfig) => Promise<void>) | null = null;

  /**
   * Register the send presence callback
   */
  registerSendPresence(callback: (sessionId: string, contactPhone: string, presence: 'composing' | 'recording' | 'paused') => Promise<void>) {
    this.sendPresenceCallback = callback;
  }

  /**
   * Register the send message callback
   */
  registerSendMessage(callback: (sessionId: string, contactPhone: string, message: string) => Promise<void>) {
    this.sendMessageCallback = callback;
  }

  /**
   * Register the send buttons callback
   */
  registerSendButtons(callback: (sessionId: string, contactPhone: string, message: string, buttons: ButtonData[], footer?: string) => Promise<void>) {
    this.sendButtonsCallback = callback;
  }

  /**
   * Register the send list callback
   */
  registerSendList(callback: (sessionId: string, contactPhone: string, message: string, buttonText: string, sections: ListSection[], footer?: string) => Promise<void>) {
    this.sendListCallback = callback;
  }

  /**
   * Register the send media callback
   */
  registerSendMedia(callback: (sessionId: string, contactPhone: string, mediaType: 'image' | 'video' | 'audio' | 'document', mediaUrl: string, options?: { caption?: string; fileName?: string; sendAudioAsVoice?: boolean }) => Promise<void>) {
    this.sendMediaCallback = callback;
  }

  /**
   * Send WhatsApp message
   */
  async sendMessage(sessionId: string, contactPhone: string, message: string): Promise<void> {
    if (!this.sendMessageCallback) {
      console.warn('WhatsApp send message callback not registered yet');
      return;
    }

    try {
      await this.sendMessageCallback(sessionId, contactPhone, message);
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Send WhatsApp message with buttons
   */
  async sendButtons(sessionId: string, contactPhone: string, message: string, buttons: ButtonData[], footer?: string): Promise<void> {
    if (!this.sendButtonsCallback) {
      console.warn('WhatsApp send buttons callback not registered yet');
      return;
    }

    try {
      await this.sendButtonsCallback(sessionId, contactPhone, message, buttons, footer);
    } catch (error) {
      console.error('Error sending WhatsApp buttons:', error);
      throw error;
    }
  }

  /**
   * Send WhatsApp list message
   */
  async sendList(sessionId: string, contactPhone: string, message: string, buttonText: string, sections: ListSection[], footer?: string): Promise<void> {
    if (!this.sendListCallback) {
      console.warn('WhatsApp send list callback not registered yet');
      return;
    }

    try {
      await this.sendListCallback(sessionId, contactPhone, message, buttonText, sections, footer);
    } catch (error) {
      console.error('Error sending WhatsApp list:', error);
      throw error;
    }
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
    }
  ): Promise<void> {
    if (!this.sendMediaCallback) {
      console.warn('WhatsApp send media callback not registered yet');
      return;
    }

    try {
      await this.sendMediaCallback(sessionId, contactPhone, mediaType, mediaUrl, options);
    } catch (error) {
      console.error('Error sending WhatsApp media:', error);
      throw error;
    }
  }

  /**
   * Register the send presence callback
   */
  registerSendPresence(callback: (sessionId: string, contactPhone: string, presence: 'composing' | 'recording' | 'paused') => Promise<void>) {
    this.sendPresenceCallback = callback;
  }

  /**
   * Register the send pix callback
   */
  registerSendPix(callback: (sessionId: string, contactPhone: string, config: PixConfig) => Promise<void>) {
    this.sendPixCallback = callback;
  }

  /**
   * Send WhatsApp PIX message
   */
  async sendPix(sessionId: string, contactPhone: string, config: PixConfig): Promise<void> {
    if (!this.sendPixCallback) {
      console.warn('WhatsApp send pix callback not registered yet');
      return;
    }

    try {
      await this.sendPixCallback(sessionId, contactPhone, config);
    } catch (error) {
      console.error('Error sending WhatsApp PIX:', error);
      throw error;
    }
  }
}


