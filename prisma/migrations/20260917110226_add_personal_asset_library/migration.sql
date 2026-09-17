-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "validatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Asset_ownerId_idx" ON "Asset"("ownerId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
