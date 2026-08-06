-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accessLevelId" TEXT;

-- CreateTable
CREATE TABLE "AccessLevel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessLevel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessLevel_organizationId_idx" ON "AccessLevel"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessLevel_organizationId_name_key" ON "AccessLevel"("organizationId", "name");

-- CreateIndex
CREATE INDEX "User_accessLevelId_idx" ON "User"("accessLevelId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accessLevelId_fkey" FOREIGN KEY ("accessLevelId") REFERENCES "AccessLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLevel" ADD CONSTRAINT "AccessLevel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
