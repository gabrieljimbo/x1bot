const fs = require('fs');
const data = JSON.parse(fs.readFileSync('C:\\Users\\gabri\\.gemini\\antigravity\\brain\\bf7203ea-e898-4d01-a426-90f686564b0e\\.system_generated\\steps\\103\\output.txt', 'utf8'));
const logs = JSON.parse(data.deployments[0].logs);
const output = logs.map(log => `[${log.type}] ${log.output}`).join('\n');
fs.writeFileSync('c:\\Users\\gabri\\X1bot\\full_logs.txt', output);
console.log(`Wrote ${logs.length} log lines to full_logs.txt`);
