"use client";

import { makeThumbnail } from "@/lib/make-thumbnail";

/**
 * Досоздание превью для материала, у которого файл уже лежит в хранилище,
 * но картинки превью ещё нет (материал загружен до появления превью, либо
 * создан сервером напрямую — как PDF расчёта из калькулятора, см.
 * addQuotePdfToHub). Перезакачивать файл нельзя — это создаст НОВЫЙ материал
 * и оторвёт всю накопленную по нему статистику. Поэтому качаем исходник в
 * браузер, рисуем картинку (см. make-thumbnail.ts — PDF/видео/картинку
 * рендерит браузер, не сервер, чтобы не тащить нативные графические
 * библиотеки в деплой) и присылаем только её.
 */
export async function backfillThumbnail(assetId: string): Promise<string | null> {
  const res = await fetch(`/api/assets/${assetId}/file`);
  if (!res.ok) return "Не удалось скачать файл.";

  const blob = await res.blob();
  const file = new File([blob], "asset", { type: blob.type });

  const thumb = await makeThumbnail(file);
  if (!thumb) return "Не удалось сделать превью из этого файла.";

  const body = new FormData();
  body.append("thumbnail", thumb, "thumb.jpg");

  const put = await fetch(`/api/assets/${assetId}/thumbnail`, {
    method: "POST",
    body,
  });

  return put.ok ? null : "Не удалось сохранить превью.";
}
