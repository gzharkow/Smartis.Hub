-- Шаблон Спецификации больше не привязан к ставке НДС: ставка стала меткой
-- {{VAT_PCT}} внутри файла. Если на вид приходилось несколько шаблонов
-- (по ставкам), оставляем последний обновлённый.
DELETE FROM "SpecTemplate" a
USING "SpecTemplate" b
WHERE a."organizationId" = b."organizationId"
  AND a."kind" = b."kind"
  AND (a."updatedAt" < b."updatedAt" OR (a."updatedAt" = b."updatedAt" AND a."id" < b."id"));

-- DropIndex
DROP INDEX "SpecTemplate_organizationId_kind_vatRatePct_key";

-- CreateIndex
CREATE UNIQUE INDEX "SpecTemplate_organizationId_kind_key" ON "SpecTemplate"("organizationId", "kind");

-- Новые КП и записи по умолчанию — ставка 7%
ALTER TABLE "Quote" ALTER COLUMN "vatRatePct" SET DEFAULT 7;
ALTER TABLE "SpecTemplate" ALTER COLUMN "vatRatePct" SET DEFAULT 7;
