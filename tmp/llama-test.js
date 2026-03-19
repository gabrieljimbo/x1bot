
const axios = require('axios');
const API_KEY = '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';
const IMAGE_URL = 'https://raw.githubusercontent.com/fabiomarcal/pix-comprovante-parser/master/test/comprovantes/nubank.jpg';

async function llamaTest() {
    try {
        console.log('--- TESTE: LLAMA 3.2 VISION (FREE) ---');
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'meta-llama/llama-3.2-11b-vision-instruct:free',
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: 'Diga o VALOR do Pix neste comprovante.' },
                    { type: 'image_url', image_url: { url: IMAGE_URL } }
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
llamaTest();
