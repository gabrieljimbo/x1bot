-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPERADMIN', 'ADMIN');

-- AlterTable (only add column if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'role') THEN
        ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'ADMIN';
    END IF;
END $$;

-- Migrate existing data: isSuperAdmin = true -> SUPERADMIN, false -> ADMIN (only if isSuperAdmin exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' AND column_name = 'isSuperAdmin') THEN
        UPDATE "users" SET "role" = 'SUPERADMIN' WHERE "isSuperAdmin" = true;
        UPDATE "users" SET "role" = 'ADMIN' WHERE "isSuperAdmin" = false;
    END IF;
END $$;

-- DropIndex (only if exists)
DROP INDEX IF EXISTS "users_isSuperAdmin_idx";

-- AlterTable (only drop column if it exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' AND column_name = 'isSuperAdmin') THEN
        ALTER TABLE "users" DROP COLUMN "isSuperAdmin";
    END IF;
END $$;

-- CreateIndex (only if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE tablename = 'users' AND indexname = 'users_role_idx') THEN
        CREATE INDEX "users_role_idx" ON "users"("role");
    END IF;
END $$;
