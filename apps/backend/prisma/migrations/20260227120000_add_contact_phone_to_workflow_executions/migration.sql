-- Manual migration to fix schema discrepancies

-- 1. Table workflow_executions
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE "workflow_executions" DROP COLUMN IF EXISTS "contactId";

-- 2. Table conversations
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE "conversations" DROP COLUMN IF EXISTS "contactId";

-- 3. Table contact_tags
ALTER TABLE "contact_tags" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE "contact_tags" DROP COLUMN IF EXISTS "contactId";

-- 4. Table whatsapp_sessions
ALTER TABLE "whatsapp_sessions" ADD COLUMN IF NOT EXISTS "isBusiness" BOOLEAN NOT NULL DEFAULT false;

-- 5. Create missing tables if they don't exist (ContactFlowState and Auth States)
CREATE TABLE IF NOT EXISTS "contact_flow_states" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "currentNodeId" TEXT NOT NULL,
    "executionId" TEXT,
    "variables" JSONB NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_flow_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "whatsapp_auth_states" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "creds" JSONB NOT NULL,
    "keys" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_auth_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "global_configs" (
    "id" TEXT NOT NULL,
    "minDelay" INTEGER NOT NULL DEFAULT 3000,
    "maxDelay" INTEGER NOT NULL DEFAULT 8000,
    "maxMsgsPerMinute" INTEGER NOT NULL DEFAULT 20,
    "proportionalDelayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_configs_pkey" PRIMARY KEY ("id")
);

-- Indices updates
CREATE INDEX IF NOT EXISTS "workflow_executions_tenantId_sessionId_contactPhone_status_idx" ON "workflow_executions"("tenantId", "sessionId", "contactPhone", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_sessionId_contactPhone_key" ON "conversations"("sessionId", "contactPhone");
CREATE UNIQUE INDEX IF NOT EXISTS "contact_flow_states_sessionId_contactPhone_key" ON "contact_flow_states"("sessionId", "contactPhone");
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_auth_states_sessionId_key" ON "whatsapp_auth_states"("sessionId");

-- Cleanup old indices if they exist (optional, won't fail if they don't)
DROP INDEX IF EXISTS "workflow_executions_tenantId_sessionId_contactId_status_idx";
DROP INDEX IF EXISTS "conversations_sessionId_contactId_idx";
DROP INDEX IF EXISTS "contact_tags_tenantId_sessionId_contactId_idx";
DROP INDEX IF EXISTS "contact_tags_tenantId_sessionId_contactId_key";
