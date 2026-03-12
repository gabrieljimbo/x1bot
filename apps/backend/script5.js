const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const c = await prisma.conversation.findMany({ where: { contactPhone: { contains: 'lid' } }, take: 1, select: { id: true, contactPhone: true, contactName: true } });
  console.log(c);
}
run().finally(() => prisma.$disconnect());
