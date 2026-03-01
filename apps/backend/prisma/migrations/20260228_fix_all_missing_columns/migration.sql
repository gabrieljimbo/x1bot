-- ENUMS
DO $$ BEGIN
    CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED', 'BOT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER', 'VIP');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "LicenseStatus" AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- TABLES (CREATE IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "conversations" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactName" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "contactAvatar" TEXT,
    "lastMessage" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "activeFlowId" TEXT,
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "fromMe" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

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

CREATE TABLE IF NOT EXISTS "workflows" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "workflow_executions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "currentNodeId" TEXT,
    "status" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "interactionCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "whatsapp_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "qrCode" TEXT,
    "phoneNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isBusiness" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "whatsapp_labels" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_labels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "whatsapp_group_configs" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "workflowIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_group_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "whatsapp_chat_labels" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_chat_labels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "whatsapp_auth_states" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "creds" JSONB NOT NULL,
    "keys" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_auth_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "licenseExpiresAt" TIMESTAMP(3),
    "licenseStatus" "LicenseStatus" NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "trialStartedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "role" "Role" NOT NULL DEFAULT 'USER',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tags" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT DEFAULT '#8b5cf6',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "shareable_workflows" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "importCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shareable_workflows_pkey" PRIMARY KEY ("id")
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

CREATE TABLE IF NOT EXISTS "execution_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "nodeId" TEXT,
    "eventType" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "execution_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "contact_tags" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_tags_pkey" PRIMARY KEY ("id")
);


-- COLUMNS (ADD IF NOT EXISTS TO EXISTING TABLES)
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "sessionId" TEXT NOT NULL;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT NOT NULL;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "contactName" TEXT;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT NOT NULL;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "contactAvatar" TEXT;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "lastMessage" TEXT;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "lastMessageAt" TIMESTAMP(3);
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "unreadCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "isGroup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN';
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "activeFlowId" TEXT;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "labels" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "conversationId" TEXT NOT NULL;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "content" TEXT NOT NULL;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "mediaType" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "fromMe" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMP(3) NOT NULL;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "status" "MessageStatus" NOT NULL DEFAULT 'SENT';
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "contact_flow_states" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "contact_flow_states" ADD COLUMN IF NOT EXISTS "sessionId" TEXT NOT NULL;
ALTER TABLE "contact_flow_states" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT NOT NULL;
ALTER TABLE "contact_flow_states" ADD COLUMN IF NOT EXISTS "workflowId" TEXT NOT NULL;
ALTER TABLE "contact_flow_states" ADD COLUMN IF NOT EXISTS "currentNodeId" TEXT NOT NULL;
ALTER TABLE "contact_flow_states" ADD COLUMN IF NOT EXISTS "executionId" TEXT;
ALTER TABLE "contact_flow_states" ADD COLUMN IF NOT EXISTS "variables" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "contact_flow_states" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "contact_flow_states" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "contact_flow_states" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "nodes" JSONB NOT NULL;
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "edges" JSONB NOT NULL;
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "workflowId" TEXT NOT NULL;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "sessionId" TEXT NOT NULL;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT NOT NULL;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "currentNodeId" TEXT;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "context" JSONB NOT NULL;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "interactionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "error" TEXT;
ALTER TABLE "whatsapp_sessions" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "whatsapp_sessions" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "whatsapp_sessions" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "whatsapp_sessions" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL;
ALTER TABLE "whatsapp_sessions" ADD COLUMN IF NOT EXISTS "qrCode" TEXT;
ALTER TABLE "whatsapp_sessions" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE "whatsapp_sessions" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "whatsapp_sessions" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "whatsapp_sessions" ADD COLUMN IF NOT EXISTS "isBusiness" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "whatsapp_labels" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "whatsapp_labels" ADD COLUMN IF NOT EXISTS "sessionId" TEXT NOT NULL;
ALTER TABLE "whatsapp_labels" ADD COLUMN IF NOT EXISTS "labelId" TEXT NOT NULL;
ALTER TABLE "whatsapp_labels" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "whatsapp_labels" ADD COLUMN IF NOT EXISTS "color" INTEGER;
ALTER TABLE "whatsapp_labels" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "whatsapp_labels" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "whatsapp_group_configs" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "whatsapp_group_configs" ADD COLUMN IF NOT EXISTS "sessionId" TEXT NOT NULL;
ALTER TABLE "whatsapp_group_configs" ADD COLUMN IF NOT EXISTS "groupId" TEXT NOT NULL;
ALTER TABLE "whatsapp_group_configs" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "whatsapp_group_configs" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "whatsapp_group_configs" ADD COLUMN IF NOT EXISTS "workflowIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "whatsapp_group_configs" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "whatsapp_group_configs" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "whatsapp_chat_labels" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "whatsapp_chat_labels" ADD COLUMN IF NOT EXISTS "sessionId" TEXT NOT NULL;
ALTER TABLE "whatsapp_chat_labels" ADD COLUMN IF NOT EXISTS "chatId" TEXT NOT NULL;
ALTER TABLE "whatsapp_chat_labels" ADD COLUMN IF NOT EXISTS "labelId" TEXT NOT NULL;
ALTER TABLE "whatsapp_chat_labels" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "whatsapp_chat_labels" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "whatsapp_auth_states" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "whatsapp_auth_states" ADD COLUMN IF NOT EXISTS "sessionId" TEXT NOT NULL;
ALTER TABLE "whatsapp_auth_states" ADD COLUMN IF NOT EXISTS "creds" JSONB NOT NULL;
ALTER TABLE "whatsapp_auth_states" ADD COLUMN IF NOT EXISTS "keys" JSONB NOT NULL;
ALTER TABLE "whatsapp_auth_states" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" TEXT NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password" TEXT NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "licenseExpiresAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "licenseStatus" "LicenseStatus" NOT NULL DEFAULT 'TRIAL';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trialStartedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "Role" NOT NULL DEFAULT 'USER';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "email" TEXT NOT NULL;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "color" TEXT DEFAULT '#8b5cf6';
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "shareable_workflows" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "shareable_workflows" ADD COLUMN IF NOT EXISTS "workflowId" TEXT NOT NULL;
ALTER TABLE "shareable_workflows" ADD COLUMN IF NOT EXISTS "createdBy" TEXT NOT NULL;
ALTER TABLE "shareable_workflows" ADD COLUMN IF NOT EXISTS "importCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "shareable_workflows" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "shareable_workflows" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "global_configs" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "global_configs" ADD COLUMN IF NOT EXISTS "minDelay" INTEGER NOT NULL DEFAULT 3000;
ALTER TABLE "global_configs" ADD COLUMN IF NOT EXISTS "maxDelay" INTEGER NOT NULL DEFAULT 8000;
ALTER TABLE "global_configs" ADD COLUMN IF NOT EXISTS "maxMsgsPerMinute" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "global_configs" ADD COLUMN IF NOT EXISTS "proportionalDelayEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "global_configs" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "execution_logs" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "execution_logs" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "execution_logs" ADD COLUMN IF NOT EXISTS "executionId" TEXT NOT NULL;
ALTER TABLE "execution_logs" ADD COLUMN IF NOT EXISTS "nodeId" TEXT;
ALTER TABLE "execution_logs" ADD COLUMN IF NOT EXISTS "eventType" TEXT NOT NULL;
ALTER TABLE "execution_logs" ADD COLUMN IF NOT EXISTS "data" JSONB NOT NULL;
ALTER TABLE "execution_logs" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "execution_logs" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "contact_tags" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "contact_tags" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;
ALTER TABLE "contact_tags" ADD COLUMN IF NOT EXISTS "sessionId" TEXT NOT NULL;
ALTER TABLE "contact_tags" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT NOT NULL;
ALTER TABLE "contact_tags" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "contact_tags" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "contact_tags" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL;

-- INDEXES
CREATE INDEX IF NOT EXISTS "conversations_tenantId_idx" ON "conversations"("tenantId");
CREATE INDEX IF NOT EXISTS "conversations_sessionId_contactPhone_idx" ON "conversations"("sessionId", "contactPhone");
CREATE INDEX IF NOT EXISTS "conversations_sessionId_idx" ON "conversations"("sessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_sessionId_contactPhone_key" ON "conversations"("sessionId", "contactPhone");
CREATE INDEX IF NOT EXISTS "messages_conversationId_idx" ON "messages"("conversationId");
CREATE UNIQUE INDEX IF NOT EXISTS "contact_flow_states_sessionId_contactPhone_key" ON "contact_flow_states"("sessionId", "contactPhone");
CREATE INDEX IF NOT EXISTS "workflows_tenantId_idx" ON "workflows"("tenantId");
CREATE INDEX IF NOT EXISTS "workflows_tenantId_isActive_idx" ON "workflows"("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS "workflow_executions_status_expiresAt_idx" ON "workflow_executions"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "workflow_executions_tenantId_idx" ON "workflow_executions"("tenantId");
CREATE INDEX IF NOT EXISTS "workflow_executions_tenantId_sessionId_contactPhone_status_idx" ON "workflow_executions"("tenantId", "sessionId", "contactPhone", "status");
CREATE INDEX IF NOT EXISTS "workflow_executions_tenantId_workflowId_idx" ON "workflow_executions"("tenantId", "workflowId");
CREATE INDEX IF NOT EXISTS "whatsapp_sessions_tenantId_idx" ON "whatsapp_sessions"("tenantId");
CREATE INDEX IF NOT EXISTS "whatsapp_sessions_tenantId_status_idx" ON "whatsapp_sessions"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "whatsapp_labels_sessionId_idx" ON "whatsapp_labels"("sessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_labels_sessionId_labelId_key" ON "whatsapp_labels"("sessionId", "labelId");
CREATE INDEX IF NOT EXISTS "whatsapp_group_configs_sessionId_idx" ON "whatsapp_group_configs"("sessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_group_configs_sessionId_groupId_key" ON "whatsapp_group_configs"("sessionId", "groupId");
CREATE INDEX IF NOT EXISTS "whatsapp_chat_labels_sessionId_chatId_idx" ON "whatsapp_chat_labels"("sessionId", "chatId");
CREATE INDEX IF NOT EXISTS "whatsapp_chat_labels_sessionId_idx" ON "whatsapp_chat_labels"("sessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_chat_labels_sessionId_chatId_labelId_key" ON "whatsapp_chat_labels"("sessionId", "chatId", "labelId");
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_auth_states_sessionId_key" ON "whatsapp_auth_states"("sessionId");
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
CREATE INDEX IF NOT EXISTS "users_tenantId_idx" ON "users"("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenantId_email_key" ON "users"("tenantId", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_email_key" ON "tenants"("email");
CREATE INDEX IF NOT EXISTS "tags_tenantId_idx" ON "tags"("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "tags_tenantId_name_key" ON "tags"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "execution_logs_createdAt_idx" ON "execution_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "execution_logs_executionId_idx" ON "execution_logs"("executionId");
CREATE INDEX IF NOT EXISTS "execution_logs_tenantId_idx" ON "execution_logs"("tenantId");
CREATE INDEX IF NOT EXISTS "contact_tags_tenantId_idx" ON "contact_tags"("tenantId");
CREATE INDEX IF NOT EXISTS "contact_tags_tenantId_sessionId_contactPhone_idx" ON "contact_tags"("tenantId", "sessionId", "contactPhone");
CREATE INDEX IF NOT EXISTS "contact_tags_tenantId_sessionId_idx" ON "contact_tags"("tenantId", "sessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "contact_tags_tenantId_sessionId_contactPhone_key" ON "contact_tags"("tenantId", "sessionId", "contactPhone");