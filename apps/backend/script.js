const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const latestCampaign = await prisma.campaign.findFirst({ orderBy: { createdAt: 'desc' } });
  if (latestCampaign) {
    console.log('Latest Campaign:', latestCampaign);
    const recipients = await prisma.campaignRecipient.findMany({ where: { campaignId: latestCampaign.id } });
    console.log('Recipients for this campaign:', recipients.length);
    if (recipients.length > 0) {
      console.log(recipients.slice(0, 3));
    }
  } else {
    console.log('No campaigns found.');
  }
}
run().finally(() => prisma.$disconnect());
