
const axios = require('axios');
const API_KEY = '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';
const IMAGE_URL = 'https://raw.githubusercontent.com/fabiomarcal/pix-comprovante-parser/master/test/comprovantes/nubank.jpg';

async function verifyOCR() {
    try {
        console.log('--- TESTE: GEMINI 1.5 FLASH (8B) ---');
        
        // Base64 Download
        const imgRes = await axios.get(IMAGE_URL, { responseType: 'arraybuffer' });
        const b64 = Buffer.from(imgRes.data).toString('base64');

        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'google/gemini-flash-1.5-8b',
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: 'Responda apenas com o valor numérico deste comprovante.' },
                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }
                ]
            }]
        }, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });

        console.log('✅ SUCESSO:', response.data.choices[0].message.content);
    } catch (e) {
        console.error('❌ ERRO:', e.response?.data || e.message);
    }
}
verifyOCR();
