const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

/**
 * Data-fix script: Restore ADMIN role for users that were
 * incorrectly migrated to USER during the role standardization.
 * 
 * This script:
 * 1. Finds all users with role USER that are NOT the superadmin
 * 2. Sets them to ADMIN (their original role)
 * 3. Ensures licenseStatus is set for all users
 * 
 * Run with: npx ts-node prisma/fix-roles.js
 * Or:       node prisma/fix-roles.js
 */
async function main() {
    console.log('🔧 Starting role fix migration...\n')

    // List all users and their current roles
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

    // Fix users that should be ADMIN but got reset to USER
    // (Exclude the superadmin user)
    const usersToFix = allUsers.filter(u =>
        u.role === 'USER' &&
        !u.email.includes('superadmin')
    )

    if (usersToFix.length === 0) {
        console.log('✅ No users need role fixing.')
    } else {
        console.log(`🔄 Fixing ${usersToFix.length} user(s) from USER → ADMIN:`)
        for (const user of usersToFix) {
            await prisma.user.update({
                where: { id: user.id },
                data: { role: 'ADMIN' },
            })
            console.log(`  ✅ ${user.email} (${user.name || 'no name'}) → ADMIN`)
        }
    }

    // Ensure all users have licenseStatus set
    const usersWithoutLicense = allUsers.filter(u => !u.licenseStatus)
    if (usersWithoutLicense.length > 0) {
        console.log(`\n🔄 Setting licenseStatus for ${usersWithoutLicense.length} user(s):`)
        for (const user of usersWithoutLicense) {
            const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    licenseStatus: isAdmin ? 'ACTIVE' : 'TRIAL',
                    trialStartedAt: user.trialStartedAt || new Date(),
                    trialEndsAt: user.trialEndsAt || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                },
            })
            console.log(`  ✅ ${user.email} → licenseStatus: ${isAdmin ? 'ACTIVE' : 'TRIAL'}`)
        }
    }

    // Show final state
    const finalUsers = await prisma.user.findMany({
        select: {
            email: true,
            name: true,
            role: true,
            licenseStatus: true,
        },
    })

    console.log('\n📋 Final user state:')
    finalUsers.forEach(u => {
        console.log(`  - ${u.email} | role: ${u.role} | license: ${u.licenseStatus}`)
    })

    console.log('\n✅ Role fix migration complete!')
}

main()
    .catch((e) => {
        console.error('❌ Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
