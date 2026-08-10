/*
  Warnings:

  - You are about to drop the column `accessLevelId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `AccessLevel` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AccessLevel" DROP CONSTRAINT "AccessLevel_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_accessLevelId_fkey";

-- DropIndex
DROP INDEX "User_accessLevelId_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "accessLevelId",
ADD COLUMN     "canAddAssets" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "AccessLevel";

-- CreateTable
CREATE TABLE "_AccountVisibility" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AccountVisibility_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AccountVisibility_B_index" ON "_AccountVisibility"("B");

-- AddForeignKey
ALTER TABLE "_AccountVisibility" ADD CONSTRAINT "_AccountVisibility_A_fkey" FOREIGN KEY ("A") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AccountVisibility" ADD CONSTRAINT "_AccountVisibility_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
