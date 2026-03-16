-- Migration: Add ContactReputation table for Layer 9 (Recipient Reputation System)
-- ⚠️  Run ONLY after Gabriel authorizes deploy
-- Created: 2026-03-15

CREATE TABLE IF NOT EXISTS "contact_reputations" (
    "id"                 TEXT NOT NULL,
    "tenantId"           TEXT NOT NULL,
    "phone"              TEXT NOT NULL,
    "score"              INTEGER NOT NULL DEFAULT 70,
    "consecutiveNoReply" INTEGER NOT NULL DEFAULT 0,
    "lastCampaignSentAt" TIMESTAMP(3),
    "campaign7DayCount"  INTEGER NOT NULL DEFAULT 0,
    "campaignTodayCount" INTEGER NOT NULL DEFAULT 0,
    "todayResetDate"     TEXT,
    "avgResponseTimeMs"  BIGINT,
    "lastRespondedAt"    TIMESTAMP(3),
    "engagementDrop"     BOOLEAN NOT NULL DEFAULT false,
    "quarantineUntil"    TIMESTAMP(3),
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_reputations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "contact_reputations_tenantId_phone_key"
    ON "contact_reputations"("tenantId", "phone");

CREATE INDEX IF NOT EXISTS "contact_reputations_tenantId_idx"
    ON "contact_reputations"("tenantId");

CREATE INDEX IF NOT EXISTS "contact_reputations_tenantId_score_idx"
    ON "contact_reputations"("tenantId", "score");

CREATE INDEX IF NOT EXISTS "contact_reputations_quarantineUntil_idx"
    ON "contact_reputations"("quarantineUntil");

ALTER TABLE "contact_reputations"
    ADD CONSTRAINT "contact_reputations_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
