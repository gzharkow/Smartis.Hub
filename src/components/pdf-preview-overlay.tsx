"use client";

import { useEffect } from "react";
import { useCloseOnBack } from "@/lib/use-close-on-back";
import { PdfViewer } from "@/app/v/[token]/pdf-viewer";

// Общий полноэкранный каркас предпросмотра PDF — вынесен из
// SpecPreviewModal, теперь используется и там (предпросмотр уже выпущенной
// Спецификации), и в spec-review.tsx (предпросмотр черновика на тач-экране,
// куда встроенный <iframe> не листался — системный PDF-плагин браузера
// плохо уживается с жестовым скроллом внутри PWA). Тело — PdfViewer
// (src/app/v/[token]/pdf-viewer.tsx): свой canvas-рендер поверх pdf.js с
// честным прокручиваемым контейнером, а не системный плагин.
//
// Загрузку файла (fetch/blob/object URL) каждый вызывающий делает сам —
// у SpecPreviewModal это один запрос при открытии, у Preview в
// spec-review.tsx — уже идущий в фоне debounce поверх живой формы.
export function PdfPreviewOverlay({
  title,
  url,
  error,
  onClose,
}: {
  title: string;
  url: string | null;
  error: { message: string; missing?: boolean; downloadHref?: string } | null;
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
              {error.downloadHref ? (
                <a
                  href={error.downloadHref}
                  className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
                >
                  Скачать .docx
                </a>
              ) : null}
            </div>
          </div>
        ) : url ? (
          <PdfViewer src={url} pageCount={null} onPageChange={() => {}} />
        ) : (
          <div className="grid size-full place-items-center text-sm text-zinc-400">
            Собираем предпросмотр…
          </div>
        )}
      </div>
    </div>
  );
}
