-- CreateTable
CREATE TABLE "workflow_node_stats" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeName" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "totalExecutions" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_node_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflow_node_stats_workflowId_date_idx" ON "workflow_node_stats"("workflowId", "date");

-- AddForeignKey
ALTER TABLE "workflow_node_stats" ADD CONSTRAINT "workflow_node_stats_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
