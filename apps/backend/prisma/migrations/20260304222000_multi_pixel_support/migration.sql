-- Criar tabela tenant_pixel_configs se não existir
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

-- Adicionar colunas se não existirem
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_pixel_configs' AND column_name='name') THEN
        ALTER TABLE "tenant_pixel_configs" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Pixel Padrão';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_pixel_configs' AND column_name='isDefault') THEN
        ALTER TABLE "tenant_pixel_configs" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Remover constraint única antiga se existir
ALTER TABLE "tenant_pixel_configs" DROP CONSTRAINT IF EXISTS "tenant_pixel_configs_tenantId_key";

-- Adicionar índice único composto se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'tenant_pixel_configs_tenantId_pixelId_key' AND n.nspname = 'public') THEN
        CREATE UNIQUE INDEX "tenant_pixel_configs_tenantId_pixelId_key" ON "tenant_pixel_configs"("tenantId", "pixelId");
    END IF;
END $$;

-- Criar tabela lead_origins se não existir
CREATE TABLE IF NOT EXISTS "lead_origins" (
  "id" TEXT NOT NULL,
  "contactPhone" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
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

-- Garantir coluna contactName em lead_origins
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lead_origins' AND column_name='contactName') THEN
        ALTER TABLE "lead_origins" ADD COLUMN "contactName" TEXT;
    END IF;
END $$;

-- Criar tabela randomizer_stats se não existir
CREATE TABLE IF NOT EXISTS "randomizer_stats" (
  "id" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "executionId" TEXT,
  "contactId" TEXT,
  "saidaId" TEXT,
  "saidaNome" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "randomizer_stats_pkey" PRIMARY KEY ("id")
);

-- Garantir colunas extras em randomizer_stats
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='randomizer_stats' AND column_name='executionId') THEN
        ALTER TABLE "randomizer_stats" ADD COLUMN "executionId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='randomizer_stats' AND column_name='contactId') THEN
        ALTER TABLE "randomizer_stats" ADD COLUMN "contactId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='randomizer_stats' AND column_name='saidaId') THEN
        ALTER TABLE "randomizer_stats" ADD COLUMN "saidaId" TEXT;
    END IF;
END $$;

-- Criar tabela external_webhooks se não existir
CREATE TABLE IF NOT EXISTS "external_webhooks" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "events" TEXT[] NOT NULL,
  "secret" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_webhooks_pkey" PRIMARY KEY ("id")
);

-- Criar tabela group_trigger_executions se não existir
CREATE TABLE IF NOT EXISTS "group_trigger_executions" (
  "id" TEXT NOT NULL,
  "groupJid" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "executionDay" INTEGER,
  "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  CONSTRAINT "group_trigger_executions_pkey" PRIMARY KEY ("id")
);

-- Index fixes
CREATE INDEX IF NOT EXISTS "lead_origins_tenantId_idx" ON "lead_origins"("tenantId");
CREATE INDEX IF NOT EXISTS "randomizer_stats_tenantId_idx" ON "randomizer_stats"("tenantId");
CREATE INDEX IF NOT EXISTS "external_webhooks_tenantId_idx" ON "external_webhooks"("tenantId");
