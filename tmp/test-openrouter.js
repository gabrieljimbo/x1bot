
const axios = require('axios');

const API_KEY = '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';
const TEST_IMAGE_URL = 'https://raw.githubusercontent.com/fabiomarcal/pix-comprovante-parser/master/test/comprovantes/nubank.jpg';

async function testOpenRouter() {
  console.log('--- DIAGNÓSTICO AVANÇADO OPENROUTER ---');

  try {
    // 1. Text only test
    const MODEL = 'google/gemini-2.0-flash-exp:free';
    console.log(`1. Testando APENAS TEXTO com: ${MODEL}`);
    const textRes = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: MODEL,
        messages: [{ role: 'user', content: 'Say OK if you hear me' }]
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://x1bot.cloud'
        }
      }
    );
    console.log('✅ Texto OK:', textRes.data.choices[0].message.content);

    // 2. Vision test
    console.log(`\n2. Testando VISÃO com: ${MODEL}`);
    try {
        const visionRes = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: MODEL,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Analise este comprovante e retorne APENAS o valor: {"amount": number}' },
                  { type: 'image_url', image_url: { url: TEST_IMAGE_URL } }
                ]
              }
            ]
          },
          {
            headers: {
              'Authorization': `Bearer ${API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://x1bot.cloud'
            }
          }
        );
        console.log('✅ Visão OK:', visionRes.data.choices[0].message.content);
    } catch (ve) {
        console.error('❌ Falha na visão:');
        console.dir(ve.response?.data || ve.message, { depth: null });
    }

  } catch (error) {
    console.error('❌ Erro no diagnóstico geral:');
    if (error.response) {
      console.dir(error.response.data, { depth: null });
    } else {
      console.error(error.message);
    }
  }
}

testOpenRouter();
