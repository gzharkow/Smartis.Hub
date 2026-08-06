/*
  Warnings:

  - You are about to drop the column `slug` on the `Hub` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Hub_organizationId_slug_key";

-- AlterTable
ALTER TABLE "Hub" DROP COLUMN "slug";
