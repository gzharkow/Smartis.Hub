"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { storageKeys } from "@/lib/storage/types";
import { DOCX_MIME, renderSpecDocx } from "@/lib/spec-build";
import { loadQuoteForSpec, specRecordFrom } from "@/lib/spec-quote";
import { SpecEditableValuesSchema } from "@/lib/spec-values";

// Выпуск Спецификации: собранный .docx становится Asset, привязанным к
// расчёту, и появляется в «Генератор КП → Файлы».
//
// Значения приходят из браузера, поэтому валидируются заново, а все
// производные суммы (НДС, итоги, прописи) считает renderSpecDocx на сервере —
// из клиента принимаются только базовые числа.

export async function finalizeQuoteSpec(quoteId: string, values: unknown) {
  const loaded = await loadQuoteForSpec(quoteId);
  if (!loaded) throw new Error("КП не найден.");

  const parsed = SpecEditableValuesSchema.safeParse(values);
  if (!parsed.success) throw new Error("Значения не прошли проверку.");

  const { user, quote } = loaded;
  const bytes = await renderSpecDocx(specRecordFrom(quote), parsed.data);

  // Порядок как в addQuotePdfToHub: сначала строка (ключ хранилища содержит
  // её id), потом файл, и откат строки, если файл не записался — Asset без
  // файла хуже, чем отсутствие Asset.
  const asset = await db.asset.create({
    data: {
      organizationId: user.organizationId,
      kind: "DOCUMENT",
      section: "COMMON",
      title: `Спецификация — ${quote.clientName}`,
      mimeType: DOCX_MIME,
      sizeBytes: bytes.length,
      quoteId: quote.id,
    },
  });

  const key = storageKeys.original(user.organizationId, asset.id, ".docx");
  try {
    await storage.put(key, bytes, DOCX_MIME);
  } catch (e) {
    await db.asset.delete({ where: { id: asset.id } });
    throw e;
  }
  await db.asset.update({ where: { id: asset.id }, data: { storageKey: key } });

  revalidatePath("/calculator/files");
  revalidatePath(`/calculator/${quote.id}/spec`);

  return { assetId: asset.id };
}
