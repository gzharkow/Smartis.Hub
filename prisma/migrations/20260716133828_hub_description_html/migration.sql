/*
  Warnings:

  - You are about to drop the column `description` on the `Hub` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Hub" DROP COLUMN "description",
ADD COLUMN     "descriptionHtml" TEXT;
