-- CreateEnum
CREATE TYPE "KpiRole" AS ENUM ('DEVELOPMENT', 'ASSISTANT');

-- AlterTable
ALTER TABLE "KpiPerson" ADD COLUMN     "role" "KpiRole" NOT NULL DEFAULT 'DEVELOPMENT';

-- Ксюша — ассистент (ведёт только встречи).
UPDATE "KpiPerson" SET "role" = 'ASSISTANT' WHERE "name" = 'Ксюша';
