-- AlterTable
ALTER TABLE "KpiDeal" ADD COLUMN     "confirmed" BOOLEAN NOT NULL DEFAULT false;

-- Уже внесённые сделки были фактической выручкой — считаем их подписанными.
UPDATE "KpiDeal" SET "confirmed" = true WHERE NOT "isReserve";
