const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

async function updateDb(url) {
    process.env.DATABASE_URL = url;
    const prisma = new PrismaClient();
    try {
        const email = 'superadmin@n9n.com';
        const hash = '$2b$10$CBmFVnGwHxZxreB6iJVDGOoDt6gKFajz/TSIl1Y7q5enVODnKf0Gm'; // Generated earlier

        console.log(`\nConnecting to: ${url}`);

        // Update password, role, and status
        const rowCount = await prisma.$executeRaw`
      UPDATE "users" 
      SET password = ${hash}, 
          role = 'SUPER_ADMIN', 
          "isActive" = true 
      WHERE email = ${email}
    `;

        console.log(`Update result: ${rowCount} row(s) updated.`);

        if (rowCount > 0) {
            const user = await prisma.$queryRaw`SELECT email, role, LEFT(password, 20) as partial_pw FROM "users" WHERE email = ${email}`;
            console.log('Confirmation:', JSON.stringify(user[0], null, 2));
        }
    } catch (err) {
        console.error(`Error with ${url}:`, err.message);
    } finally {
        await prisma.$disconnect();
    }
}

async function main() {
    const password = 'x1botPassWd2026';
    const user = 'x1bot';
    const db = 'x1bot';

    // Try different host/port combinations
    const urls = [
        `postgresql://${user}:${password}@72.61.46.86:5432/${db}`,
        `postgresql://${user}:${password}@72.61.46.86:3000/${db}`,
        `postgresql://${user}:${password}@eccwkogwwws800ogk4kogskk:5432/${db}`
    ];

    for (const url of urls) {
        await updateDb(url);
    }
}

main();
