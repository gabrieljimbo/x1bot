-- 1. lead_origins
CREATE TABLE IF NOT EXISTS "lead_origins" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "isFromAd" BOOLEAN NOT NULL DEFAULT false,
    "adSourceId" TEXT,
    "adCtwaClid" TEXT,
    "adTitle" TEXT,
    "adBody" TEXT,
    "adSourceUrl" TEXT,
    "adMediaUrl" TEXT,
    "contactState" TEXT,
    "contactDDD" TEXT,
    "contactName" TEXT,
    "workflowId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lead_origins_pkey" PRIMARY KEY ("id")
);

-- 2. tenant_pixel_configs
CREATE TABLE IF NOT EXISTS "tenant_pixel_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Pixel Padrão',
    "pixelId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "testEventCode" TEXT,
    "autoSendLead" BOOLEAN NOT NULL DEFAULT false,
    "includeState" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_pixel_configs_pkey" PRIMARY KEY ("id")
);

-- Ensure columns exist if table was already there (PostgreSQL 9.6+)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_pixel_configs' AND column_name='name') THEN
        ALTER TABLE "tenant_pixel_configs" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Pixel Padrão';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_pixel_configs' AND column_name='isDefault') THEN
        ALTER TABLE "tenant_pixel_configs" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- 3. group_trigger_executions
CREATE TABLE IF NOT EXISTS "group_trigger_executions" (
    "id" TEXT NOT NULL,
    "groupJid" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "executionDay" INTEGER,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "group_trigger_executions_pkey" PRIMARY KEY ("id")
);

-- 4. randomizer_stats
CREATE TABLE IF NOT EXISTS "randomizer_stats" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "executionId" TEXT,
    "contactId" TEXT,
    "saidaId" TEXT NOT NULL,
    "saidaNome" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "randomizer_stats_pkey" PRIMARY KEY ("id")
);

-- 5. external_webhooks
CREATE TABLE IF NOT EXISTS "external_webhooks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'POST',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_webhooks_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "lead_origins_tenantId_idx" ON "lead_origins"("tenantId");
CREATE INDEX IF NOT EXISTS "lead_origins_receivedAt_idx" ON "lead_origins"("receivedAt");
CREATE INDEX IF NOT EXISTS "tenant_pixel_configs_tenantId_idx" ON "tenant_pixel_configs"("tenantId");
CREATE INDEX IF NOT EXISTS "group_trigger_executions_groupJid_idx" ON "group_trigger_executions"("groupJid");
CREATE INDEX IF NOT EXISTS "randomizer_stats_tenantId_idx" ON "randomizer_stats"("tenantId");
CREATE INDEX IF NOT EXISTS "external_webhooks_tenantId_idx" ON "external_webhooks"("tenantId");

-- Unique constraints
ALTER TABLE "tenant_pixel_configs" DROP CONSTRAINT IF EXISTS "tenant_pixel_configs_tenantId_key";
-- Prisma unique constraint for (tenantId, pixelId)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_pixel_configs_tenantId_pixelId_key') THEN
        ALTER TABLE "tenant_pixel_configs" ADD CONSTRAINT "tenant_pixel_configs_tenantId_pixelId_key" UNIQUE ("tenantId", "pixelId");
    END IF;
END $$;
