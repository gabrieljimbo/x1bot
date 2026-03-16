-- Migration: Add CampaignSettings table for per-tenant anti-spam protection toggles
CREATE TABLE IF NOT EXISTS "campaign_settings" (
    "id"                          TEXT NOT NULL,
    "tenantId"                    TEXT NOT NULL,
    "autoBlacklistOptOut"         BOOLEAN NOT NULL DEFAULT true,
    "autoBlacklistBadNumbers"     BOOLEAN NOT NULL DEFAULT true,
    "exposureLimitsEnabled"       BOOLEAN NOT NULL DEFAULT true,
    "reputationQuarantineEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sessionHealthFilterEnabled"  BOOLEAN NOT NULL DEFAULT true,
    "timingOptimizationEnabled"   BOOLEAN NOT NULL DEFAULT false,
    "createdAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_settings_tenantId_key"
    ON "campaign_settings"("tenantId");

ALTER TABLE "campaign_settings"
    ADD CONSTRAINT "campaign_settings_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
