
const axios = require('axios');
const API_KEY = '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';

async function listModels() {
    try {
        const res = await axios.get('https://openrouter.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        const models = res.data.data.map(m => m.id);
        console.log('Todos os Modelos:');
        console.dir(models, { maxArrayLength: 1000, depth: null });
    } catch (e) {
        console.error(e.message);
    }
}
listModels();
