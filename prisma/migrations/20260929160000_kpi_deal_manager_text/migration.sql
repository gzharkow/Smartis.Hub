-- Менеджер сделки становится свободным текстом.
ALTER TABLE "KpiDeal" ADD COLUMN     "managerName" TEXT;

UPDATE "KpiDeal" d SET "managerName" = p."name"
FROM "KpiPerson" p WHERE d."managerId" = p."id";

-- DropForeignKey
ALTER TABLE "KpiDeal" DROP CONSTRAINT "KpiDeal_managerId_fkey";

-- AlterTable
ALTER TABLE "KpiDeal" DROP COLUMN "managerId";
