-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canAccessAssets" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canAccessCalculator" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canAccessHubs" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canAccessStats" BOOLEAN NOT NULL DEFAULT true;
