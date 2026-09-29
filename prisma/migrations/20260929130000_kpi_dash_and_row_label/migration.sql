-- DropForeignKey
ALTER TABLE "KpiMetricLabel" DROP CONSTRAINT "KpiMetricLabel_organizationId_fkey";

-- DropTable
DROP TABLE "KpiMetricLabel";

-- AlterTable
ALTER TABLE "KpiEntry" ADD COLUMN     "label" TEXT,
ALTER COLUMN "plan" DROP NOT NULL,
ALTER COLUMN "fact" DROP NOT NULL;
