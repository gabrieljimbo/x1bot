
const axios = require('axios');
const API_KEY = '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';
const TEST_IMAGE_URL = 'https://raw.githubusercontent.com/fabiomarcal/pix-comprovante-parser/master/test/comprovantes/nubank.jpg';

async function finalTest() {
    try {
        console.log('--- TESTE FINAL OPENROUTER ---');
        
        // 1. List Gemini models specifically
        const res = await axios.get('https://openrouter.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        const geminis = res.data.data.filter(m => m.id.toLowerCase().includes('gemini')).map(m => m.id);
        console.log('Modelos Gemini encontrados:', geminis);
        
        // Use the first one or a fallback
        const modelToUse = geminis.length > 0 ? geminis[0] : 'openai/gpt-4o-mini';
        console.log('Usando modelo:', modelToUse);

        // 2. Chat with Vision test
        const response = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: modelToUse,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Analise o comprovante e retorne APENAS um JSON: {"is_payment": true, "amount": number}' },
                  { type: 'image_url', image_url: { url: TEST_IMAGE_URL } }
                ]
              }
            ]
          },
          {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
          }
        );

        console.log('✅ SUCESSO!');
        console.log('Resposta:', response.data.choices[0].message.content);

    } catch (e) {
        console.error('❌ FALHA:', e.response?.data || e.message);
    }
}
finalTest();
