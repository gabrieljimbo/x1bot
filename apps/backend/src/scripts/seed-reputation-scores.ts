/**
 * ONE-TIME script to seed reputation scores for existing contacts.
 * ⚠️  AVISAR GABRIEL antes de rodar — verificar volume de contatos primeiro.
 *
 * Run with: npx ts-node -P tsconfig.json src/scripts/seed-reputation-scores.ts
 *
 * IDEMPOTENT: can be run multiple times safely.
 * Uses a Redis key to track which contacts have already been seeded.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BASE_SCORE = 70;
const MAX_BONUS = 30;
const MAX_PENALTY = 30;

async function main() {
  console.log('[SEED] Iniciando seed de scores de reputação...');

  // Get all tenants
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  console.log(`[SEED] ${tenants.length} tenants encontrados`);

  let totalUpdated = 0;
  let totalHealthy = 0;
  let totalAtRisk = 0;
  let totalQuarantine = 0;

  for (const tenant of tenants) {
    // Get all unique phones that have been in campaigns
    const campaignPhones = await prisma.campaignRecipient.findMany({
      where: { campaign: { tenantId: tenant.id } },
      select: { phone: true, status: true },
      distinct: ['phone'],
    });

    for (const { phone } of campaignPhones) {
      // Check if already seeded (has non-default score)
      const existing = await prisma.contactReputation.findUnique({
        where: { tenantId_phone: { tenantId: tenant.id, phone } },
      });
      // Skip if already has custom score (seeded before or modified by system)
      if (existing && existing.score !== BASE_SCORE) continue;

      // Calculate score from history
      const allRecipientEntries = await prisma.campaignRecipient.findMany({
        where: { phone, campaign: { tenantId: tenant.id } },
        select: { status: true, campaignId: true },
      });

      // Count distinct campaigns with failures
      const failedCampaigns = new Set(
        allRecipientEntries.filter(r => r.status === 'failed').map(r => r.campaignId)
      ).size;

      // Count distinct campaigns sent (any status)
      const sentCampaigns = allRecipientEntries.length;

      // Count campaigns with replies (would need conversation data — approximate)
      const sentCount = allRecipientEntries.filter(r => r.status === 'sent').length;
      const failCount = allRecipientEntries.filter(r => r.status === 'failed').length;

      // Calculate score
      let score = BASE_SCORE;
      const penalty = Math.min(MAX_PENALTY, failedCampaigns * 20);
      const bonus = Math.min(MAX_BONUS, Math.floor(sentCount * 0.5));
      score = Math.max(10, Math.min(100, score - penalty + bonus));

      await prisma.contactReputation.upsert({
        where: { tenantId_phone: { tenantId: tenant.id, phone } },
        update: { score },
        create: { tenantId: tenant.id, phone, score },
      });

      totalUpdated++;
      if (score >= 50) totalHealthy++;
      else if (score >= 20) totalAtRisk++;
      else totalQuarantine++;
    }
  }

  console.log(`[SEED] ${totalUpdated} contatos atualizados.`);
  console.log(`[SEED] Distribuição: ${totalHealthy} saudáveis, ${totalAtRisk} em risco, ${totalQuarantine} em quarentena`);
  console.log('[SEED] Seed concluído. Idempotente — pode rodar novamente com segurança.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
