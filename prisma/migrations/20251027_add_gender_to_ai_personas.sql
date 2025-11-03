-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('M', 'F');

-- AlterTable
ALTER TABLE "ai_personas" ADD COLUMN "gender" "Gender";
