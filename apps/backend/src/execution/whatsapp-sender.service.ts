import { Injectable } from '@nestjs/common';

@Injectable()
export class WhatsappSenderService {
  private sendMessageCallback: ((sessionId: string, contactId: string, message: string) => Promise<void>) | null = null;

  /**
   * Register the send message callback
   */
  registerSendMessage(callback: (sessionId: string, contactId: string, message: string) => Promise<void>) {
    this.sendMessageCallback = callback;
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
}


