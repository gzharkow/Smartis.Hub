-- CreateEnum
CREATE TYPE "AssetSection" AS ENUM ('AUTO', 'REALTY', 'COMMON');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "section" "AssetSection" NOT NULL DEFAULT 'COMMON';

-- CreateIndex
CREATE INDEX "Asset_organizationId_section_idx" ON "Asset"("organizationId", "section");
