import { Injectable } from '@nestjs/common';

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

@Injectable()
export class WhatsappSenderService {
  private sendMessageCallback: ((sessionId: string, contactId: string, message: string) => Promise<void>) | null = null;
  private sendButtonsCallback: ((sessionId: string, contactId: string, message: string, buttons: ButtonData[], footer?: string) => Promise<void>) | null = null;
  private sendListCallback: ((sessionId: string, contactId: string, message: string, buttonText: string, sections: ListSection[], footer?: string) => Promise<void>) | null = null;

  /**
   * Register the send message callback
   */
  registerSendMessage(callback: (sessionId: string, contactId: string, message: string) => Promise<void>) {
    this.sendMessageCallback = callback;
  }

  /**
   * Register the send buttons callback
   */
  registerSendButtons(callback: (sessionId: string, contactId: string, message: string, buttons: ButtonData[], footer?: string) => Promise<void>) {
    this.sendButtonsCallback = callback;
  }

  /**
   * Register the send list callback
   */
  registerSendList(callback: (sessionId: string, contactId: string, message: string, buttonText: string, sections: ListSection[], footer?: string) => Promise<void>) {
    this.sendListCallback = callback;
  }

  /**
   * Send WhatsApp message
   */
  async sendMessage(sessionId: string, contactId: string, message: string): Promise<void> {
    if (!this.sendMessageCallback) {
      console.warn('WhatsApp send message callback not registered yet');
      return;
    }

    try {
      await this.sendMessageCallback(sessionId, contactId, message);
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Send WhatsApp message with buttons
   */
  async sendButtons(sessionId: string, contactId: string, message: string, buttons: ButtonData[], footer?: string): Promise<void> {
    if (!this.sendButtonsCallback) {
      console.warn('WhatsApp send buttons callback not registered yet');
      return;
    }

    try {
      await this.sendButtonsCallback(sessionId, contactId, message, buttons, footer);
    } catch (error) {
      console.error('Error sending WhatsApp buttons:', error);
      throw error;
    }
  }

  /**
   * Send WhatsApp list message
   */
  async sendList(sessionId: string, contactId: string, message: string, buttonText: string, sections: ListSection[], footer?: string): Promise<void> {
    if (!this.sendListCallback) {
      console.warn('WhatsApp send list callback not registered yet');
      return;
    }

    try {
      await this.sendListCallback(sessionId, contactId, message, buttonText, sections, footer);
    } catch (error) {
      console.error('Error sending WhatsApp list:', error);
      throw error;
    }
  }
}


