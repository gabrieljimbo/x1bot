const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const DATABASE_URL = 'postgresql://x1bot:x1botPassWd2026@72.61.46.86:3000/x1bot';
process.env.DATABASE_URL = DATABASE_URL;

async function main() {
    const prisma = new PrismaClient();
    try {
        console.log('--- Tables in public schema ---');
        const tables = await prisma.$queryRaw`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'`;
        console.log(JSON.stringify(tables, null, 2));

        const email = 'superadmin@n9n.com';
        const password = '@superadmin123';

        console.log(`\n--- Searching for ${email} in tables ---`);

        // Check "users" table
        try {
            const users = await prisma.$queryRaw`SELECT id, email, password, role FROM "users" WHERE email = ${email}`;
            console.log('Results from "users" table:', JSON.stringify(users, null, 2));
        } catch (e) {
            console.log('Error querying "users" table:', e.message);
        }

        // Check "User" table
        try {
            const users = await prisma.$queryRaw`SELECT id, email, password, role FROM "User" WHERE email = ${email}`;
            console.log('Results from "User" table:', JSON.stringify(users, null, 2));
        } catch (e) {
            console.log('Error querying "User" table:', e.message);
        }

        // Verify bcrypt hash generation
        console.log('\n--- Verifying bcrypt hash generation ---');
        const saltRounds = 10;
        const newHash = await bcrypt.hash(password, saltRounds);
        console.log('Generated hash:', newHash);

        const isMatch = await bcrypt.compare(password, newHash);
        console.log('Bcrypt.compare check:', isMatch ? '✅ MATCH' : '❌ NO MATCH');

    } catch (error) {
        console.error('Fatal error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
