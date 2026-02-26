const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

/**
 * Data-fix script: Restore correct roles and licenseStatus for existing users.
 * 
 * Run with: node prisma/fix-roles.js
 */
async function main() {
    console.log('🔧 Starting role and license fix...\n')

    // List all users
    const allUsers = await prisma.user.findMany({
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            licenseStatus: true,
            trialStartedAt: true,
            trialEndsAt: true,
        },
    })

    console.log('📋 Current users:')
    allUsers.forEach(u => {
        console.log(`  - ${u.email} | role: ${u.role} | license: ${u.licenseStatus}`)
    })
    console.log('')

    // Fix 1: Users that should be ADMIN but got reset to USER
    const usersToFixRole = allUsers.filter(u =>
        u.role === 'USER' &&
        !u.email.includes('superadmin')
    )

    if (usersToFixRole.length > 0) {
        console.log(`🔄 Fixing ${usersToFixRole.length} user(s) from USER → ADMIN:`)
        for (const user of usersToFixRole) {
            await prisma.user.update({
                where: { id: user.id },
                data: { role: 'ADMIN' },
            })
            console.log(`  ✅ ${user.email} → ADMIN`)
        }
    } else {
        console.log('✅ No users need role fixing.')
    }

    // Fix 2: Set licenseStatus = 'ACTIVE' for all ADMIN and SUPER_ADMIN users
    console.log('\n🔄 Setting licenseStatus=ACTIVE for ADMIN/SUPER_ADMIN users...')
    const result = await prisma.$executeRawUnsafe(`
    UPDATE "users" 
    SET "licenseStatus" = 'ACTIVE' 
    WHERE role IN ('ADMIN', 'SUPER_ADMIN')
  `)
    console.log(`  ✅ Updated ${result} admin/superadmin user(s) to licenseStatus=ACTIVE`)

    // Fix 3: Ensure USER/VIP users have trial dates set
    const usersNeedingTrial = allUsers.filter(u =>
        (u.role === 'USER' || u.role === 'VIP') && !u.trialStartedAt
    )
    if (usersNeedingTrial.length > 0) {
        console.log(`\n🔄 Setting trial dates for ${usersNeedingTrial.length} user(s):`)
        for (const user of usersNeedingTrial) {
            const trialStartedAt = new Date()
            const trialEndsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    trialStartedAt,
                    trialEndsAt,
                    licenseStatus: 'TRIAL',
                },
            })
            console.log(`  ✅ ${user.email} → trial until ${trialEndsAt.toISOString()}`)
        }
    }

    // Show final state
    const finalUsers = await prisma.user.findMany({
        select: { email: true, name: true, role: true, licenseStatus: true },
    })

    console.log('\n📋 Final user state:')
    finalUsers.forEach(u => {
        console.log(`  - ${u.email} | role: ${u.role} | license: ${u.licenseStatus}`)
    })

    console.log('\n✅ Fix complete!')
}

main()
    .catch((e) => {
        console.error('❌ Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
