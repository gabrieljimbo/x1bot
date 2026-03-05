-- CreateTable
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

-- CreateTable
CREATE TABLE IF NOT EXISTS "tenant_pixel_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pixelId" TEXT,
    "accessToken" TEXT,
    "testEventCode" TEXT,
    "autoSendLead" BOOLEAN NOT NULL DEFAULT false,
    "includeState" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_pixel_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_pixel_configs_tenantId_key" ON "tenant_pixel_configs"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "lead_origins_tenantId_idx" ON "lead_origins"("tenantId");
CREATE INDEX IF NOT EXISTS "lead_origins_tenantId_isFromAd_idx" ON "lead_origins"("tenantId", "isFromAd");
CREATE INDEX IF NOT EXISTS "lead_origins_tenantId_contactState_idx" ON "lead_origins"("tenantId", "contactState");
CREATE INDEX IF NOT EXISTS "lead_origins_receivedAt_idx" ON "lead_origins"("receivedAt");
