-- CreateEnum
CREATE TYPE "QuoteClientType" AS ENUM ('BUILDER', 'AUTO_DEALER');

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "boxIntegrationSelected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "calculatorConfig" JSONB,
ADD COLUMN     "clientType" "QuoteClientType";
