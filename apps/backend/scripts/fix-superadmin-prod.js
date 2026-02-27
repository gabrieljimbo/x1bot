const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const fs = require('fs');

async function main() {
    const prisma = new PrismaClient({
        datasources: {
            db: { url: 'postgresql://x1bot:x1botPassWd2026@72.61.46.86:3000/x1bot' }
        }
    });

    const output = [];
    const log = (msg) => { console.log(msg); output.push(msg); };

    try {
        // Step 1: List user-related tables
        log('=== Step 1: Tables matching *user* ===');
        const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables 
      WHERE schemaname='public' AND tablename LIKE '%user%'
    `;
        log(JSON.stringify(tables, null, 2));

        // Step 2: Check superadmin user
        log('\n=== Step 2: Superadmin user check ===');
        const users = await prisma.$queryRaw`
      SELECT id, email, LEFT(password, 10) as hash_start, role, "isActive"
      FROM users WHERE email = 'superadmin@n9n.com'
    `;
        log(JSON.stringify(users, null, 2));

        if (users.length === 0) {
            log('ERROR: superadmin@n9n.com NOT FOUND in users table!');
            return;
        }

        // Step 3: Generate new hash and verify it
        log('\n=== Step 3: Generate and verify new hash ===');
        const password = '@superadmin123';
        const newHash = await bcrypt.hash(password, 10);
        log('New hash: ' + newHash);

        const verified = await bcrypt.compare(password, newHash);
        log('Verification: ' + (verified ? '✅ MATCH' : '❌ FAIL'));

        if (!verified) {
            log('ERROR: Hash verification failed! Aborting.');
            return;
        }

        // Step 4: Update password and ensure role + active status
        log('\n=== Step 4: Updating password, role, and status ===');
        const rowCount = await prisma.$executeRaw`
      UPDATE users 
      SET password = ${newHash},
          role = 'SUPER_ADMIN',
          "isActive" = true
      WHERE email = 'superadmin@n9n.com'
    `;
        log('Rows updated: ' + rowCount);

        // Step 5: Also ensure tenant is active
        log('\n=== Step 5: Ensuring tenant is active ===');
        const user = users[0];
        const tenantUpdate = await prisma.$executeRaw`
      UPDATE tenants SET "isActive" = true WHERE id = ${user.id.split('-')[0] ? user.id : ''}
    `;
        // Better approach: get tenantId first
        const fullUser = await prisma.$queryRaw`
      SELECT "tenantId" FROM users WHERE email = 'superadmin@n9n.com'
    `;
        if (fullUser.length > 0) {
            await prisma.$executeRaw`
        UPDATE tenants SET "isActive" = true WHERE id = ${fullUser[0].tenantId}
      `;
            log('Tenant activated for tenantId: ' + fullUser[0].tenantId);
        }

        // Step 6: Final confirmation
        log('\n=== Step 6: Final confirmation ===');
        const confirm = await prisma.$queryRaw`
      SELECT id, email, LEFT(password, 10) as hash_start, role, "isActive"
      FROM users WHERE email = 'superadmin@n9n.com'
    `;
        log(JSON.stringify(confirm, null, 2));

        // Final bcrypt verify against stored hash
        const storedUser = await prisma.$queryRaw`
      SELECT password FROM users WHERE email = 'superadmin@n9n.com'
    `;
        const finalVerify = await bcrypt.compare(password, storedUser[0].password);
        log('Final bcrypt.compare against DB: ' + (finalVerify ? '✅ MATCH' : '❌ FAIL'));

        // Write results to file for full inspection
        fs.writeFileSync('scripts/reset-result.txt', output.join('\n'));
        log('\nResults saved to scripts/reset-result.txt');

    } catch (error) {
        log('FATAL ERROR: ' + error.message);
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
