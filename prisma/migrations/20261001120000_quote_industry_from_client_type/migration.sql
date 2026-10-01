-- Отрасль КП теперь определяется типом клиента (clientType), отдельное поле не нужно.
-- DropIndex
DROP INDEX "Quote_organizationId_industry_idx";

-- AlterTable
ALTER TABLE "Quote" DROP COLUMN "industry";
