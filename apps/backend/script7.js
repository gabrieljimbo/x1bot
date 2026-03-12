const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const c = await prisma.contactFlowState.findMany({ select: { id: true, contactPhone: true, createdAt: true } });
  console.log(c);
}
run().finally(() => prisma.$disconnect());
