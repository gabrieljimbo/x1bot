const { Client } = require('pg');

async function updatePassword(config) {
    const client = new Client(config);
    try {
        await client.connect();
        console.log(`Connected to host: ${config.host} port: ${config.port}`);

        const email = 'superadmin@n9n.com';
        const hash = '$2b$10$CBmFVnGwHxZxreB6iJVDGOoDt6gKFajz/TSIl1Y7q5enVODnKf0Gm';

        // Update password and role
        const res = await client.query(
            'UPDATE users SET password = $1, role = $2 WHERE email = $3',
            [hash, 'SUPER_ADMIN', email]
        );

        console.log(`Update result: ${res.rowCount} row(s) updated.`);

        // Confirmation select
        const confirm = await client.query(
            'SELECT email, role, LEFT(password, 20) as partial_pw FROM users WHERE email = $1',
            [email]
        );
        console.log('Confirmation:', JSON.stringify(confirm.rows[0], null, 2));

    } catch (err) {
        console.error(`Error with host ${config.host}:${config.port}:`, err.message);
    } finally {
        await client.end();
    }
}

async function main() {
    // Option 1: User's provided host (might fail if internal)
    await updatePassword({
        host: 'eccwkogwwws800ogk4kogskk',
        port: 5432,
        user: 'x1bot',
        password: 'x1botPassWd2026', // Reusing pwd from .env
        database: 'x1bot'
    });

    // Option 2: IP from .env with standard port
    await updatePassword({
        host: '72.61.46.86',
        port: 5432,
        user: 'x1bot',
        password: 'x1botPassWd2026',
        database: 'x1bot'
    });

    // Option 3: IP from .env with port 3000
    await updatePassword({
        host: '72.61.46.86',
        port: 3000,
        user: 'x1bot',
        password: 'x1botPassWd2026',
        database: 'x1bot'
    });
}

main();
