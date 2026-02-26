import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Database Diagnostics ---');

    // 1. Check for NULL roles or licenseStatus
    const nullFields = await prisma.user.findMany({
        where: {
            OR: [
                { role: null as any },
                { licenseStatus: null as any }
            ]
        },
        select: { id: true, email: true, role: true, licenseStatus: true }
    });
    console.log(`Users with NULL fields: ${nullFields.length}`);
    if (nullFields.length > 0) {
        console.log(JSON.stringify(nullFields, null, 2));
    }

    // 2. Check for Role consistency (SUPERADMIN vs SUPER_ADMIN)
    const roles = await prisma.user.groupBy({
        by: ['role'],
        _count: { id: true }
    });
    console.log('Role Distribution:', JSON.stringify(roles, null, 2));

    // 3. Sample a few users to check structure
    const users = await prisma.user.findMany({
        take: 5,
        select: {
            id: true,
            email: true,
            role: true,
            licenseStatus: true,
            trialStartedAt: true,
            isActive: true
        }
    });
    console.log('Sample Users:', JSON.stringify(users, null, 2));
}

main()
    .catch((e) => {
        console.error('DIAGNOSTIC ERROR:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
