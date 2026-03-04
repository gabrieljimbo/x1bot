CREATE TABLE IF NOT EXISTS "group_workflow_links" (
  "id" TEXT NOT NULL,
  "groupJid" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "group_workflow_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "group_offers" (
  "id" TEXT NOT NULL,
  "groupJid" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "group_offers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "group_mention_log" (
  "id" TEXT NOT NULL,
  "groupJid" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "mentionedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "group_mention_log_pkey" PRIMARY KEY ("id")
);
