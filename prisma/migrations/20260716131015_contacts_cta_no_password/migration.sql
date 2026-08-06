/*
  Warnings:

  - You are about to drop the column `passwordHash` on the `ShareLink` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Hub" ADD COLUMN     "ctaEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ctaLabel" TEXT NOT NULL DEFAULT 'Задать вопрос';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "contactMethods" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "ShareLink" DROP COLUMN "passwordHash";
