const { Client } = require('pg');

async function check() {
    const client = new Client({
        connectionString: 'postgresql://x1bot:x1botPassWd2026@72.61.46.86:3000/x1bot'
    });

    try {
        await client.connect();
        console.log('Connected to database');

        const tables = await client.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
        console.log('Tables:', tables.rows.map(t => t.tablename).join(', '));

        const userCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'");
        console.log('User Columns:', JSON.stringify(userCols.rows, null, 2));

        const roles = await client.query("SELECT DISTINCT role FROM users");
        console.log('Distinct Roles:', roles.rows.map(r => r.role));

        const licenseStatuses = await client.query("SELECT DISTINCT \"licenseStatus\" FROM users");
        console.log('Distinct License Statuses:', licenseStatuses.rows.map(l => l.licenseStatus));

    } catch (err) {
        console.error('ERROR:', err);
    } finally {
        await client.end();
    }
}

check();
