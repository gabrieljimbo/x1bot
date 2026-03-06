-- CreateTable
CREATE TABLE "MlDailyOffer" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "originalPrice" DOUBLE PRECISION NOT NULL,
    "discount" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "reviewCount" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "productUrl" TEXT NOT NULL,
    "seller" TEXT NOT NULL,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MlDailyOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MlDailyOffer_title_idx" ON "MlDailyOffer"("title");

-- CreateIndex
CREATE INDEX "MlDailyOffer_expiresAt_idx" ON "MlDailyOffer"("expiresAt");
