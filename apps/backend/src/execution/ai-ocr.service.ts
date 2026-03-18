import { Injectable, Inject, forwardRef } from '@nestjs/common';
import axios from 'axios';
import { ApiConfigsService } from '../api-configs/api-configs.service';

@Injectable()
export class AiOcrService {
  private readonly DEFAULT_MODEL = 'google/gemini-2.0-flash-exp:free';
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
Você é um assistente especializado em análise de comprovantes de pagamento PIX no Brasil.
Analise a imagem ou documento fornecido e retorne APENAS um objeto JSON válido (sem markdown, sem explicações) no seguinte formato:

{
  "is_payment": boolean,
  "amount": number,
  "receiver_name": string,
  "date": string,
  "transaction_id": string
}

Regras:
1. "is_payment" deve ser true apenas se for um comprovante de transferência realizada com sucesso.
2. "amount" deve ser um número (float), use ponto como separador decimal.
3. Se algum campo não for encontrado, retorne null para ele.
4. "receiver_name" é o nome da pessoa ou empresa que recebeu o dinheiro.
`.trim();

    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model,
          messages: [
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
            'HTTP-Referer': 'https://x1bot.cloud', // Optional OpenRouter header
            'X-Title': 'X1Bot PIX AI',
          }
        }
      );

      const content = response.data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('AI returned empty response');
      }

      // Cleanup markdown code blocks if present
      const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonStr);

    } catch (error: any) {
      console.error('[AI_OCR] Error calling OpenRouter:', error.response?.data || error.message);
      throw new Error(`AI OCR failed: ${error.message}`);
    }
  }
}
