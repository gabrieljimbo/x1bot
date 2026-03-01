-- CreateTable
CREATE TABLE IF NOT EXISTS "media_files" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "objectName" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "nodeId" TEXT,
    "workflowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "media_files_tenantId_idx" ON "media_files"("tenantId");
CREATE INDEX IF NOT EXISTS "media_files_nodeId_idx" ON "media_files"("nodeId");
CREATE INDEX IF NOT EXISTS "media_files_workflowId_idx" ON "media_files"("workflowId");
