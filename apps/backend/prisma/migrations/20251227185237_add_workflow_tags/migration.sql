-- AddColumn
ALTER TABLE "workflows" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
