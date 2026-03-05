-- AlterTable logic for multi-pixel support
-- 1. Add new columns
ALTER TABLE "tenant_pixel_configs" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Pixel Padrão';
ALTER TABLE "tenant_pixel_configs" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT true;

-- 2. Handle constraints
-- Drop the existing unique constraint on tenantId
ALTER TABLE "tenant_pixel_configs" DROP CONSTRAINT IF EXISTS "tenant_pixel_configs_tenantId_key";

-- 3. Cleanup existing NULLs if any (though schema previously had String?)
-- In previous schema they were optional, now they are required in Prisma model but let's ensure we have values
UPDATE "tenant_pixel_configs" SET "pixelId" = '0' WHERE "pixelId" IS NULL;
UPDATE "tenant_pixel_configs" SET "accessToken" = '0' WHERE "accessToken" IS NULL;

-- 4. Create new unique index
CREATE UNIQUE INDEX "tenant_pixel_configs_tenantId_pixelId_key" ON "tenant_pixel_configs"("tenantId", "pixelId");
