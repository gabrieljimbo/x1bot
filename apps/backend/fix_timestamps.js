const fs = require('fs');

const file = 'c:\\Users\\gabri\\X1bot\\apps\\backend\\prisma\\migrations\\20260228_fix_all_missing_columns\\migration.sql';
let content = fs.readFileSync(file, 'utf8');

// We only want to touch the ALTER TABLE lines to be perfectly safe, or just do a global replace 
// since it applies to both CREATE TABLE and ALTER TABLE (if we are adding a column to an empty table 
// or creating a new table, DEFAULT NOW() is perfectly fine and often desirable anyway if not specified).
// But Prisma schema actually specifies defaults for most. Prisma generated createdAt with DEFAULT CURRENT_TIMESTAMP.
// The issue is updatedAt doesn't have a default in Prisma schema by default, it relies on application layer or trigger.
// But Postgres needs a default when altering a populated table.

content = content.replace(/TIMESTAMP\(3\) NOT NULL;/g, 'TIMESTAMP(3) NOT NULL DEFAULT NOW();');
content = content.replace(/TIMESTAMP\(3\);/g, 'TIMESTAMP(3) DEFAULT NOW();');
content = content.replace(/TIMESTAMP\(3\) NOT NULL,/g, 'TIMESTAMP(3) NOT NULL DEFAULT NOW(),');
content = content.replace(/TIMESTAMP\(3\),/g, 'TIMESTAMP(3) DEFAULT NOW(),');

fs.writeFileSync(file, content);
console.log('Migration timestamps fixed!');
