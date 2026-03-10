-- AlterTable
ALTER TABLE "CampaignRecipient" ADD COLUMN IF NOT EXISTS "isGroupAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CampaignRecipient" ADD COLUMN IF NOT EXISTS "sourceGroup" TEXT;
