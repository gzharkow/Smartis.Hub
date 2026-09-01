"use client";

import { useEffect, useRef, useState } from "react";
import { PdfPreviewOverlay } from "@/components/pdf-preview-overlay";

// Предпросмотр уже выпущенной Спецификации — статичный файл, поэтому в
// отличие от Preview в calculator/[id]/spec/spec-review.tsx (там живая форма,
// debounce на каждое изменение и повторная сборка .docx) здесь один запрос
// при открытии: /api/assets/[id]/spec-preview просто конвертирует уже
// лежащий в хранилище файл в PDF. Сам полноэкранный оверлей и рендер PDF —
// общий PdfPreviewOverlay, этому компоненту остаётся только загрузка файла.

export function SpecPreviewModal({
  assetId,
  title,
  onClose,
}: {
  assetId: string;
  title: string;
  onClose: () => void;
}) {
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
    <PdfPreviewOverlay
      title={title}
      url={url}
      error={
        error
          ? {
              message: error.message,
              missing: error.missing,
              downloadHref: `/api/assets/${assetId}/file?download=1`,
            }
          : null
      }
      onClose={onClose}
    />
  );
}
