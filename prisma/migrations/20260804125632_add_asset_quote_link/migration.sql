-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "quoteId" TEXT;

-- CreateIndex
CREATE INDEX "Asset_organizationId_quoteId_idx" ON "Asset"("organizationId", "quoteId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
