-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AssetKind" ADD VALUE 'DOCUMENT';
ALTER TYPE "AssetKind" ADD VALUE 'SPREADSHEET';

-- AlterTable
ALTER TABLE "Hub" ADD COLUMN     "contactMethods" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "contactMethodsTemplate" JSONB;

-- Backfill: контакты жили на организации одной строкой на всех — переносим
-- текущее значение в каждый её хаб, чтобы поведение существующих хабов
-- не изменилось после того, как код перестанет читать Organization.contactMethods.
UPDATE "Hub"
SET "contactMethods" = "Organization"."contactMethods"
FROM "Organization"
WHERE "Organization"."id" = "Hub"."organizationId";
