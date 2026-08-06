-- AlterTable
ALTER TABLE "Hub" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "folderId" TEXT;

-- CreateTable
CREATE TABLE "HubFolder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HubFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HubFolder_organizationId_idx" ON "HubFolder"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "HubFolder_organizationId_name_key" ON "HubFolder"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Hub_folderId_idx" ON "Hub"("folderId");

-- AddForeignKey
ALTER TABLE "HubFolder" ADD CONSTRAINT "HubFolder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hub" ADD CONSTRAINT "Hub_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "HubFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
