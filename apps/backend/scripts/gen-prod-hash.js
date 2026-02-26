const bcrypt = require('bcrypt');
const fs = require('fs');
async function main() {
    const hash = await bcrypt.hash('@superadmin123', 10);
    fs.writeFileSync('scripts/prod-hash.txt', hash);
    console.log('Hash written to scripts/prod-hash.txt');
}
main();
