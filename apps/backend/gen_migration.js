const fs = require('fs');

const inFile = 'full_schema.sql';
// Powershell redirection might create UTF-16LE, let's read appropriately
let content;
try {
    const buf = fs.readFileSync(inFile);
    if (buf[0] === 0xff && buf[1] === 0xfe) {
        content = buf.toString('utf16le');
    } else {
        content = buf.toString('utf8');
    }
} catch (err) {
    console.error(err);
    process.exit(1);
}

const lines = content.split('\n');
let outSql = [];

// 1. Enums
outSql.push('-- ENUMS');
for (const line of lines) {
    if (line.includes('CREATE TYPE')) {
        // Add IF NOT EXISTS logic for Postgres enums
        const match = line.match(/CREATE TYPE "([^"]+)" AS ENUM \((.+)\);/);
        if (match) {
            const typeName = match[1];
            const vals = match[2];
            outSql.push(`DO $$ BEGIN
    CREATE TYPE "${typeName}" AS ENUM (${vals});
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;`);
        }
    }
}

// 2. Tables (CREATE TABLE IF NOT EXISTS)
outSql.push('\n-- TABLES (CREATE IF NOT EXISTS)');
let tableLines = [];
let inTable = false;
for (let line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed.startsWith('CREATE TABLE')) {
        inTable = true;
        tableLines.push(trimmed.replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS'));
    } else if (inTable) {
        tableLines.push(trimmed);
        if (trimmed === ');') {
            inTable = false;
            outSql.push(tableLines.join('\n'));
            outSql.push('');
            tableLines = [];
        }
    }
}

// 3. Columns (ALTER TABLE ADD COLUMN IF NOT EXISTS)
outSql.push('\n-- COLUMNS (ADD IF NOT EXISTS TO EXISTING TABLES)');
let currentTable = null;
for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('CREATE TABLE')) {
        const match = trimmed.match(/"([^"]+)"/);
        if (match) currentTable = match[1];
    } else if (trimmed === ');') {
        currentTable = null;
    } else if (currentTable && trimmed.startsWith('"')) {
        // match: "columnName" TYPE modifiers,
        const colMatch = trimmed.match(/^"([^"]+)"\s+(.+)$/);
        if (colMatch) {
            const colName = colMatch[1];
            let colDef = colMatch[2];
            // Remove trailing comma
            if (colDef.endsWith(',')) colDef = colDef.slice(0, -1);

            // For constraints that might be inline but usually not starting with quotes unless they are fields.
            outSql.push(`ALTER TABLE "${currentTable}" ADD COLUMN IF NOT EXISTS "${colName}" ${colDef};`);
        }
    }
}

// 4. Indexes
outSql.push('\n-- INDEXES');
for (let line of lines) {
    if (line.startsWith('CREATE INDEX') || line.startsWith('CREATE UNIQUE INDEX')) {
        outSql.push(line.replace('CREATE INDEX', 'CREATE INDEX IF NOT EXISTS').replace('CREATE UNIQUE INDEX', 'CREATE UNIQUE INDEX IF NOT EXISTS'));
    }
}

fs.writeFileSync('manual_migration.sql', outSql.join('\n'));
console.log('Saved to manual_migration.sql');
