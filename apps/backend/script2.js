const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { _count: { select: { recipients: true } } }
  });
  console.log(campaigns.map(c => ({
    id: c.id,
    name: c.name,
    recipients: c._count.recipients,
    status: c.status
  })));
}
run().finally(() => prisma.$disconnect());
