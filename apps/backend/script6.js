const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const c = await prisma.message.findFirst({ where: { conversation: { contactPhone: { contains: 'lid' } } }, include: { conversation: true }, orderBy: { createdAt: 'desc' } });
  console.log(JSON.stringify(c, null, 2));
}
run().finally(() => prisma.$disconnect());
