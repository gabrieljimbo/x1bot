
const axios = require('axios');
const fs = require('fs');
const API_KEY = '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';
const MODEL = 'openai/gpt-4o-mini';
const IMAGE_URL = 'https://raw.githubusercontent.com/fabiomarcal/pix-comprovante-parser/master/test/comprovantes/nubank.jpg';

async function testOCRBase64() {
    try {
        console.log('--- TESTE OCR FINAL (BASE64) ---');
        
        // 1. Download image
        const imgRes = await axios.get(IMAGE_URL, { responseType: 'arraybuffer' });
        const b64 = Buffer.from(imgRes.data).toString('base64');
        console.log('📦 Imagem baixada e convertida para Base64');

        // 2. OCR with AI
        const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: MODEL,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: 'Analise e retorne apenas o JSON do comprovante: {"amount": number, "receiver": "string"}' },
                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }
                ]
            }]
        }, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        console.log('✅ SUCESSO!');
        console.log(res.data.choices[0].message.content);
    } catch (e) {
        console.error('❌ ERRO:', e.response?.data || e.message);
    }
}
testOCRBase64();
