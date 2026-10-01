-- CreateEnum
CREATE TYPE "Industry" AS ENUM ('AUTO', 'REALTY');

-- AlterTable
ALTER TABLE "Hub" ADD COLUMN     "industry" "Industry";

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "industry" "Industry";

-- CreateIndex
CREATE INDEX "Hub_organizationId_industry_idx" ON "Hub"("organizationId", "industry");

-- CreateIndex
CREATE INDEX "Quote_organizationId_industry_idx" ON "Quote"("organizationId", "industry");
