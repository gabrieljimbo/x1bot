
const axios = require('axios');
const API_KEY = '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';
const MODEL = 'openai/gpt-4o-mini';
const IMAGE_URL = 'https://raw.githubusercontent.com/fabiomarcal/pix-comprovante-parser/master/test/comprovantes/nubank.jpg';

async function testOCR() {
    try {
        console.log('--- TESTE OCR FINAL (GPT-4o-mini) ---');
        const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: MODEL,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: 'Extraia os dados deste comprovante em JSON: {"amount": number, "receiver": "string", "sender": "string"}' },
                    { type: 'image_url', image_url: { url: IMAGE_URL } }
                ]
            }]
        }, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        console.log('✅ SUCESSO!');
        console.log(JSON.stringify(res.data.choices[0].message.content, null, 2));
    } catch (e) {
        console.error('❌ ERRO:', e.response?.data || e.message);
    }
}
testOCR();
