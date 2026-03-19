
const fs = require('fs');
try {
    const raw = fs.readFileSync('c:\\Users\\gabri\\X1bot\\tmp\\vision-response.json', 'utf16le');
    const json = JSON.parse(raw.trim().replace(/^\ufeff/, ''));
    console.log('--- TESTE DE VISÃO CONCLUÍDO ---');
    console.log('ID:', json.id);
    console.log('Modelo:', json.model);
    console.log('Resposta do OCR:', json.choices[0].message.content);
    console.log('---');
} catch (e) {
    console.error('Erro ao ler JSON:', e.message);
}
