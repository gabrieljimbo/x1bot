-- Fix: contactId was NOT NULL in original migration but is no longer used in schema
-- Wrapped in DO block to be safe if column does not exist
DO $$
BEGIN
  -- Drop NOT NULL from contactId only if the column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'contactId'
  ) THEN
    ALTER TABLE "conversations" ALTER COLUMN "contactId" DROP NOT NULL;
  END IF;

  -- Ensure contactPhone exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'contactPhone'
  ) THEN
    ALTER TABLE "conversations" ADD COLUMN "contactPhone" TEXT;
  END IF;

  -- Ensure phoneNumber exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'phoneNumber'
  ) THEN
    ALTER TABLE "conversations" ADD COLUMN "phoneNumber" TEXT;
  END IF;
END $$;

-- Backfill phoneNumber from contactPhone where missing
UPDATE "conversations"
SET "phoneNumber" = split_part("contactPhone", '@', 1)
WHERE "contactPhone" IS NOT NULL AND ("phoneNumber" IS NULL OR "phoneNumber" = '');
