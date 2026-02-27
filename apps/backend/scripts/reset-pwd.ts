import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

async function main() {
    const email = 'superadmin@n9n.com';
    const password = '@superadmin123';
    const saltRounds = 10;

    console.log(`Generating hash for ${email}...`);
    const hash = await bcrypt.hash(password, saltRounds);
    console.log(`New hash: ${hash}`);

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: process.env.DATABASE_URL
            }
        }
    });

    try {
        const user = await prisma.user.findFirst({
            where: { email }
        });

        if (!user) {
            console.error(`User ${email} not found!`);
            return;
        }

        console.log(`Current hash: ${user.password}`);

        const updated = await prisma.user.update({
            where: { id: user.id },
            data: { password: hash }
        });

        console.log(`Successfully updated password for ${updated.email}`);
    } catch (error) {
        console.error('Error updating password:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
