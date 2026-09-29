-- CreateEnum
CREATE TYPE "KpiMetric" AS ENUM ('MEETINGS', 'QUALIFIED', 'DEALS');

-- CreateEnum
CREATE TYPE "KpiScope" AS ENUM ('WEEK', 'MONTH');

-- CreateEnum
CREATE TYPE "KpiDirection" AS ENUM ('AUTO', 'REALTY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canAccessKpi" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "KpiPerson" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inActivity" BOOLEAN NOT NULL DEFAULT true,
    "inSales" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "metric" "KpiMetric" NOT NULL,
    "scope" "KpiScope" NOT NULL,
    "periodStart" DATE NOT NULL,
    "plan" INTEGER NOT NULL DEFAULT 0,
    "fact" INTEGER NOT NULL DEFAULT 0,
    "companies" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiMonth" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "planOptimal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "planMax" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "KpiMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiDeal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "client" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "direction" "KpiDirection",
    "managerId" TEXT,
    "note" TEXT,
    "isReserve" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiDeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KpiPerson_organizationId_idx" ON "KpiPerson"("organizationId");

-- CreateIndex
CREATE INDEX "KpiEntry_organizationId_periodStart_idx" ON "KpiEntry"("organizationId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "KpiEntry_organizationId_personId_metric_scope_periodStart_key" ON "KpiEntry"("organizationId", "personId", "metric", "scope", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "KpiMonth_organizationId_year_month_key" ON "KpiMonth"("organizationId", "year", "month");

-- CreateIndex
CREATE INDEX "KpiDeal_organizationId_year_month_idx" ON "KpiDeal"("organizationId", "year", "month");

-- AddForeignKey
ALTER TABLE "KpiPerson" ADD CONSTRAINT "KpiPerson_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiEntry" ADD CONSTRAINT "KpiEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiEntry" ADD CONSTRAINT "KpiEntry_personId_fkey" FOREIGN KEY ("personId") REFERENCES "KpiPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiMonth" ADD CONSTRAINT "KpiMonth_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiDeal" ADD CONSTRAINT "KpiDeal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiDeal" ADD CONSTRAINT "KpiDeal_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "KpiPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
