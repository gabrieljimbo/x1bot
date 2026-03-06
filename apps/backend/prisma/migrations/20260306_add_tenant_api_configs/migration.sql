-- CreateTable: tenant_api_configs
-- Stores per-tenant API credentials for external providers (Shopee, etc.)
CREATE TABLE IF NOT EXISTS "tenant_api_configs" (
    "id"        TEXT NOT NULL,
    "tenantId"  TEXT NOT NULL,
    "provider"  TEXT NOT NULL,
    "appId"     TEXT NOT NULL,
    "secret"    TEXT NOT NULL,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_api_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_api_configs_tenantId_provider_key"
    ON "tenant_api_configs"("tenantId", "provider");
