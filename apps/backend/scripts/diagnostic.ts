import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        const users = await prisma.user.findMany({
            take: 10,
            select: {
                id: true,
                email: true,
                role: true,
                licenseStatus: true,
                isActive: true,
                tenantId: true
            }
        });
        console.log('USERS_DATA:' + JSON.stringify(users));

        const tenants = await prisma.tenant.findMany({
            take: 5,
        });
        console.log('TENANTS_DATA:' + JSON.stringify(tenants));

        const sessions = await prisma.whatsappSession.findMany({
            take: 5,
            select: {
                id: true,
                name: true,
                status: true
            }
        });
        console.log('SESSIONS_DATA:' + JSON.stringify(sessions));

    } catch (error) {
        console.error('DIAG_ERROR:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
