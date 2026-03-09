-- CreateTable
CREATE TABLE "sent_products" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "groupId" TEXT,
    "productId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sent_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sent_products_tenantId_groupId_productId_source_key" ON "sent_products"("tenantId", "groupId", "productId", "source");

-- CreateIndex
CREATE INDEX "sent_products_tenantId_source_idx" ON "sent_products"("tenantId", "source");

-- CreateIndex
CREATE INDEX "sent_products_expiresAt_idx" ON "sent_products"("expiresAt");

-- AddForeignKey
ALTER TABLE "sent_products" ADD CONSTRAINT "sent_products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
