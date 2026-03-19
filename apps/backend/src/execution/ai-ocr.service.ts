import { Injectable, Inject, forwardRef } from '@nestjs/common';
import axios from 'axios';
import { ApiConfigsService } from '../api-configs/api-configs.service';

@Injectable()
export class AiOcrService {
  private readonly DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';
  private readonly GENERIC_API_KEY = process.env.OPENROUTER_API_KEY || '';

  constructor(
    @Inject(forwardRef(() => ApiConfigsService))
    private apiConfigsService: ApiConfigsService
  ) {}

  async analyzeReceipt(
    fileUrl: string, 
    options: { tenantId?: string, model?: string, apiKey?: string } = {}
  ): Promise<any> {
    let apiKey = options.apiKey;

    // If no key in node options, try global tenant config
    if (!apiKey && options.tenantId) {
       const globalConfig = await this.apiConfigsService.getByProvider(options.tenantId, 'openrouter');
       if (globalConfig?.isActive && globalConfig.secret) {
          apiKey = globalConfig.secret;
       }
    }

    apiKey = apiKey || this.GENERIC_API_KEY;
    const model = options.model || this.DEFAULT_MODEL;

    if (!apiKey) {
      throw new Error('OpenRouter API Key not configured');
    }

    const prompt = `
Você é um especialista em OCR de comprovantes de pagamento brasileiros (PIX, TED, DOC).
Analise a imagem fornecida e retorne APENAS um objeto JSON plano (sem explicações, sem markdown) seguindo estas regras:

1. "is_payment": true somente se for um comprovante de transferência REALIZADA/EFETIVADA. Agendamentos ou rascunhos = false.
2. "amount": Extraia o valor numérico (formato float, use ponto decimal).
3. "receiver_name": Nome completo de quem RECEBEU o pagamento.
4. "sender_name": Nome completo de quem ENVIOU (Pagador) o pagamento.
5. "date": Data e HORA da transação (formato DD/MM/YYYY HH:mm). Se não tiver hora, use 00:00.
6. "transaction_id": ID da transação ou código de autenticação (se visível).

Se algum dado não estiver claro, retorne null para aquele campo.

Formato esperado:
{
  "is_payment": boolean,
  "amount": number,
  "receiver_name": "string",
  "sender_name": "string",
  "date": "string",
  "transaction_id": "string"
}
`.trim();

    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model,
          messages: [
            {
              role: 'system',
              content: 'Você é um analisador de documentos financeiro altamente preciso. Responda apenas com JSON puro.'
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: { url: fileUrl }
                }
              ]
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://x1bot.cloud',
            'X-Title': 'X1Bot PIX AI',
          }
        }
      );

      const content = response.data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('AI returned empty response');
      }

      // Cleanup and parse
      const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
      const rawData = JSON.parse(jsonStr);

      // --- Post-Processing (Selection from n8n logic) ---
      return this.normalizeOutput(rawData);

    } catch (error: any) {
      console.error('[AI_OCR] Error calling OpenRouter:', error.response?.data || error.message);
      throw new Error(`AI OCR failed: ${error.message}`);
    }
  }

  /**
   * Data cleaning and normalization logic inspired by the n8n implementation
   */
  private normalizeOutput(data: any): any {
    if (!data) return null;

    const result = { ...data };

    // 1. Normalize Names (Capitalize and clean)
    if (result.receiver_name) result.receiver_name = this.cleanAndCapitalize(result.receiver_name);
    if (result.sender_name) result.sender_name = this.cleanAndCapitalize(result.sender_name);

    // 2. Split Names (Useful for future nodes)
    const sender = this.splitName(result.sender_name || '');
    result.sender_first_name = sender.firstName;
    result.sender_last_name = sender.lastName;

    const receiver = this.splitName(result.receiver_name || '');
    result.receiver_first_name = receiver.firstName;
    result.receiver_last_name = receiver.lastName;

    // 3. Normalize Amount
    if (typeof result.amount === 'string') {
        const cleaned = (result.amount as string).replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
        result.amount = parseFloat(cleaned) || 0;
    }

    return result;
  }

  private cleanAndCapitalize(name: string): string {
    if (!name) return '';
    // Remove symbols common in bad OCR
    const clean = name.replace(/[^a-zA-ZáàâãéèêíïóôõúüçÁÀÂÃÉÈÊÍÏÓÔÕÚÜÇ\s]/g, '').trim();
    
    const smallWords = new Set(['da', 'de', 'do', 'dos', 'das', 'e']);
    return clean.toLowerCase().split(' ').map((word, index) => {
        if (index > 0 && smallWords.has(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  }

  private splitName(fullName: string) {
    const parts = fullName.split(' ').filter(Boolean);
    const firstName = parts.shift() || '';
    const lastName = parts.join(' ') || '';
    return { firstName, lastName };
  }
}
