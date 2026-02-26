const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: 'postgresql://x1bot:x1botPassWd2026@72.61.46.86:3000/x1bot'
            }
        }
    });

    try {
        console.log('--- Columns in "users" table ---');
        const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `;
        console.log(JSON.stringify(columns, null, 2));

        console.log('\n--- Checking User again ---');
        const user = await prisma.$queryRaw`SELECT * FROM "users" WHERE email = 'superadmin@n9n.com'`;
        console.log(JSON.stringify(user, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
