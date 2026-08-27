-- CreateEnum
CREATE TYPE "SpecTemplateKind" AS ENUM ('BUILDER_CLOUD', 'BUILDER_BOX', 'AUTO_DEALER_CLOUD', 'AUTO_DEALER_BOX');

-- CreateTable
CREATE TABLE "SpecTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "SpecTemplateKind" NOT NULL,
    "vatRatePct" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpecTemplate_organizationId_idx" ON "SpecTemplate"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SpecTemplate_organizationId_kind_vatRatePct_key" ON "SpecTemplate"("organizationId", "kind", "vatRatePct");

-- AddForeignKey
ALTER TABLE "SpecTemplate" ADD CONSTRAINT "SpecTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecTemplate" ADD CONSTRAINT "SpecTemplate_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
