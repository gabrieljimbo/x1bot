const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const conv = await prisma.conversation.findMany({ where: { contactPhone: { contains: 'lid' } }, take: 1, select: { contactPhone: true } });
  console.log('LID Conversations:', conv);
}
run().finally(() => prisma.$disconnect());
