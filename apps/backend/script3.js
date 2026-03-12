const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const states = await prisma.contactFlowState.findMany({ orderBy: { updatedAt: 'desc' }, take: 5 });
  console.log('States:', states);
  const executions = await prisma.workflowExecution.findMany({ orderBy: { updatedAt: 'desc' }, take: 5, select: { id: true, contactPhone: true, status: true, sessionId: true } });
  console.log('Executions:', executions);
}
run().finally(() => prisma.$disconnect());
