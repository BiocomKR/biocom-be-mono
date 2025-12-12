-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_first_app_entry" BOOLEAN NOT NULL DEFAULT true;
