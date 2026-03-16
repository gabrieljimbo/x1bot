-- Migration: Add warmup override fields to whatsapp_sessions
-- ⚠️  Avisar Gabriel antes de rodar
ALTER TABLE "whatsapp_sessions"
    ADD COLUMN IF NOT EXISTS "warmupOverride"     BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "warmupOverriddenAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "warmupOverriddenBy" TEXT;
