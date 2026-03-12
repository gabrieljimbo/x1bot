const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const c = await prisma.conversation.findFirst({ where: { contactPhone: { contains: '5511947145008' } } });
  console.log(c);
}
run().finally(() => prisma.$disconnect());
