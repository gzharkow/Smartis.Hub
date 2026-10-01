-- Отрасль хаба определяется составом материалов, ручное поле не нужно.
-- DropIndex
DROP INDEX "Hub_organizationId_industry_idx";

-- AlterTable
ALTER TABLE "Hub" DROP COLUMN "industry";

-- DropEnum
DROP TYPE "Industry";
