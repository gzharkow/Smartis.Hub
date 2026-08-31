"use client";

import { useEffect, useRef, useState } from "react";
import { useCloseOnBack } from "@/lib/use-close-on-back";

// Предпросмотр уже выпущенной Спецификации — статичный файл, поэтому в
// отличие от Preview в calculator/[id]/spec/spec-review.tsx (там живая форма,
// debounce на каждое изменение и повторная сборка .docx) здесь один запрос
// при открытии: /api/assets/[id]/spec-preview просто конвертирует уже
// лежащий в хранилище файл в PDF.
//
// Оболочка — тот же полноэкранный паттерн, что у AssetPreviewModal
// (src/components/asset-preview-modal.tsx): фикс-оверлей, закрытие по
// Escape/кнопке «назад» на Android, блокировка скролла страницы под собой.

export function SpecPreviewModal({
  assetId,
  title,
  onClose,
}: {
  assetId: string;
  title: string;
  onClose: () => void;
}) {
  useCloseOnBack(onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; missing: boolean } | null>(null);
  const objectUrl = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/assets/${assetId}/spec-preview`);
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          if (!cancelled) {
            setError({
              message: body?.error ?? "Не удалось собрать предпросмотр",
              missing: body?.code === "LIBREOFFICE_MISSING",
            });
          }
          return;
        }
        const blob = await response.blob();
        if (cancelled) return;
        const next = URL.createObjectURL(blob);
        objectUrl.current = next;
        setUrl(next);
      } catch {
        if (!cancelled) {
          setError({ message: "Не удалось собрать предпросмотр", missing: false });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    };
  }, [assetId]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-900">
      <div className="flex shrink-0 items-center gap-3 px-4 py-2.5">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
        >
          ← Закрыть
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
          {title}
        </span>
      </div>

      <div className="min-h-0 flex-1 bg-zinc-800">
        {error ? (
          <div className="grid size-full place-items-center p-6 text-center">
            <div className="max-w-sm">
              <p className="text-sm text-zinc-300">
                {error.missing
                  ? "На сервере не установлен LibreOffice — точный предпросмотр недоступен."
                  : error.message}
              </p>
              <a
                href={`/api/assets/${assetId}/file?download=1`}
                className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
              >
                Скачать .docx
              </a>
            </div>
          </div>
        ) : url ? (
          <iframe src={url} title={title} className="size-full bg-white" />
        ) : (
          <div className="grid size-full place-items-center text-sm text-zinc-400">
            Собираем предпросмотр…
          </div>
        )}
      </div>
    </div>
  );
}
