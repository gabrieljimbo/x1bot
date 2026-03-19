
const axios = require('axios');
const API_KEY = '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';
const IMAGE_URL = 'https://raw.githubusercontent.com/fabiomarcal/pix-comprovante-parser/master/test/comprovantes/nubank.jpg';

async function run() {
    try {
        console.log('--- TESTE FINAL: GEMINI 2.0 FLASH + BASE64 ---');
        
        // 1. Download image to be 100% sure it's accessible
        const imgRes = await axios.get(IMAGE_URL, { responseType: 'arraybuffer' });
        const b64 = Buffer.from(imgRes.data).toString('base64');
        console.log('✅ Imagem baixada.');

        // 2. Call OpenRouter with the FUSION PROMPT
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'google/gemini-2.0-flash-001',
            messages: [
                {
                    role: 'system',
                    content: 'Você é um analisador de documentos financeiro. Responda APENAS JSON puro.'
                },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Analise este comprovante confirmado e retorne JSON: {"amount": number, "receiver_name": "string", "is_payment": true}' },
                        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }
                    ]
                }
            ]
        }, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });

        console.log('✅ RESPOSTA DA IA:');
        console.log(response.data.choices[0].message.content);

    } catch (e) {
        console.error('❌ ERRO:', e.response?.data || e.message);
    }
}
run();
