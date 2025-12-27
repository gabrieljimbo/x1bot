const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Limpando execuções travadas...');
  
  const result = await prisma.workflowExecution.updateMany({
    where: {
      status: {
        in: ['RUNNING', 'WAITING']
      }
    },
    data: {
      status: 'FAILED',
      error: 'Execução cancelada manualmente'
    }
  });
  
  console.log(`✅ ${result.count} execuções foram canceladas`);
  
  const allExecutions = await prisma.workflowExecution.findMany({
    select: {
      id: true,
      status: true,
      workflowId: true,
      contactId: true
    }
  });
  
  console.log('\n📊 Execuções no banco:');
  console.table(allExecutions);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
