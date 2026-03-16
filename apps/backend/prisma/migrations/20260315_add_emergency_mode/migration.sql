-- Migration: Add emergency mode fields to tenants
-- ⚠️  Avisar Gabriel antes de rodar
ALTER TABLE "tenants"
    ADD COLUMN IF NOT EXISTS "emergencyMode"        BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "emergencyActivatedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "emergencyExpiresAt"   TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "emergencyReason"      TEXT,
    ADD COLUMN IF NOT EXISTS "emergencyCapacity"    FLOAT NOT NULL DEFAULT 1.0;
