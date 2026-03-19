
const axios = require('axios');
const API_KEY = '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';

async function checkBalance() {
    try {
        console.log('--- VERIFICANDO OPENROUTER ---');
        const res = await axios.get('https://openrouter.ai/api/v1/auth/key', {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        console.log('Chave ativa:', res.data.data.label);
        console.log('Créditos restantes:', res.data.data.usage); // Usage is usually a number/string
        console.log('Limite:', res.data.data.limit);

        // Simple text test
        const testRes = await axios.post('https://openrouter.ai/api/v1/chat/completions', 
            { model: 'openai/gpt-4o-mini', messages: [{role: 'user', content: 'hello'}] },
            { headers: { 'Authorization': `Bearer ${API_KEY}` } }
        );
        console.log('✅ Chat simples OK:', testRes.data.choices[0].message.content);
    } catch (e) {
        console.error('❌ ERRO:', e.response?.data || e.message);
    }
}
checkBalance();
