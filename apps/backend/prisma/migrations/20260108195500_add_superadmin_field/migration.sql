-- This migration is now obsolete as the isSuperAdmin field was replaced by the role enum
-- Keeping it as a no-op to maintain migration history integrity

-- Check if isSuperAdmin column doesn't exist and role column exists (already migrated)
DO $$ 
BEGIN
    -- If we're in a state where role exists but isSuperAdmin doesn't, this migration is already applied
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' AND column_name = 'role') THEN
        -- Already migrated to role-based system, skip
        RAISE NOTICE 'Migration already applied via role enum migration';
    ELSE
        -- Old path: add isSuperAdmin if it doesn't exist (for databases that haven't migrated yet)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'users' AND column_name = 'isSuperAdmin') THEN
            ALTER TABLE "users" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;
            CREATE INDEX "users_isSuperAdmin_idx" ON "users"("isSuperAdmin");
        END IF;
    END IF;
END $$;

