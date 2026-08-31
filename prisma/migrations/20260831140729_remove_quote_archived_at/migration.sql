/*
  Warnings:

  - You are about to drop the column `archivedAt` on the `Quote` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Quote_organizationId_archivedAt_idx";

-- AlterTable
ALTER TABLE "Quote" DROP COLUMN "archivedAt";
