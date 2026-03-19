
const axios = require('axios');
const API_KEY = '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';
const IMAGE_URL = 'https://raw.githubusercontent.com/fabiomarcal/pix-comprovante-parser/master/test/comprovantes/nubank.jpg';

async function finalProof() {
    try {
        console.log('--- TESTE PROVA REAL: GPT-4o-mini (PAID) ---');
        
        // 1. Download image
        const imgRes = await axios.get(IMAGE_URL, { responseType: 'arraybuffer' });
        const b64 = Buffer.from(imgRes.data).toString('base64');

        // 2. OCR with AI
        const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'openai/gpt-4o-mini',
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: 'Responda apenas com o valor numérico deste comprovante.' },
                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }
                ]
            }]
        }, {
            headers: { 
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ SUCESSO!');
        console.log('Resposta da IA:', res.data.choices[0].message.content);
        console.log('ID da Geração:', res.data.id);
    } catch (e) {
        console.error('❌ ERRO DETALHADO:', JSON.stringify(e.response?.data || e.message, null, 2));
    }
}
finalProof();
