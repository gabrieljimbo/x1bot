-- Fix: contactId was NOT NULL in original migration but is no longer used in schema
-- Every INSERT to conversations was failing with NOT NULL violation, causing Inbox to show empty
ALTER TABLE "conversations" ALTER COLUMN "contactId" DROP NOT NULL;

-- Ensure contactPhone and phoneNumber columns exist
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;

-- Backfill phoneNumber from contactPhone where missing
UPDATE "conversations"
SET "phoneNumber" = split_part("contactPhone", '@', 1)
WHERE "contactPhone" IS NOT NULL AND ("phoneNumber" IS NULL OR "phoneNumber" = '');
