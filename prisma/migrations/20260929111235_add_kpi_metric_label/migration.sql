-- CreateTable
CREATE TABLE "KpiMetricLabel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "metric" "KpiMetric" NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "KpiMetricLabel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KpiMetricLabel_organizationId_metric_key" ON "KpiMetricLabel"("organizationId", "metric");

-- AddForeignKey
ALTER TABLE "KpiMetricLabel" ADD CONSTRAINT "KpiMetricLabel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
