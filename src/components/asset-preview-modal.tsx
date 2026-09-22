"use client";

import { useEffect } from "react";
import type { AssetKind } from "@/generated/prisma/enums";
import { PdfViewer } from "@/app/v/[token]/pdf-viewer";
import { DocxViewer } from "@/app/v/[token]/docx-viewer";
import { XlsxViewer } from "@/app/v/[token]/xlsx-viewer";
import { useCloseOnBack } from "@/lib/use-close-on-back";

export type PreviewAsset = {
  id: string;
  title: string;
  kind: AssetKind;
  externalUrl: string | null;
  embeddable: boolean | null;
  pageCount: number | null;
};

/**
 * Предпросмотр материала для сотрудников — тот же принцип ветвления по типу,
 * что и во вьюере витрины (src/app/v/[token]/showcase-body.tsx), но без
 * трекинга просмотров и без токена: файл отдаётся приватным роутом
 * /api/assets/[id]/file, который сам проверяет вход в админку.
 */
export function AssetPreviewModal({
  asset,
  onClose,
}: {
  asset: PreviewAsset;
  onClose: () => void;
}) {
  // Кнопка «назад» на Android закрывает предпросмотр вместо выхода из приложения.
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

  const src = `/api/assets/${asset.id}/file`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-900">
      {/* pt складывает обычный отступ (0.625rem = py-2.5) с вырезом
          статус-бара — тот же приём, что и у pdf-preview-overlay.tsx: без
          него «← Закрыть» уезжала под статус-бар iPhone и переставала
          нажиматься (видна только размытая полоса под ним). */}
      <div className="flex shrink-0 items-center gap-3 px-4 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
        >
          ← Закрыть
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
          {asset.title}
        </span>
      </div>

      <div className="min-h-0 flex-1 bg-zinc-800">
        {asset.kind === "VIDEO" ? (
          <video src={src} controls autoPlay className="size-full" />
        ) : asset.kind === "IMAGE" ? (
          <div className="grid size-full place-items-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={asset.title}
              className="max-h-full max-w-full"
            />
          </div>
        ) : asset.kind === "LINK" && asset.externalUrl ? (
          asset.embeddable ? (
            <iframe
              src={asset.externalUrl}
              title={asset.title}
              className="size-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          ) : (
            <div className="grid size-full place-items-center p-6 text-center">
              <div className="max-w-sm">
                <p className="text-sm text-zinc-300">
                  Этот материал открывается на сайте отдельной вкладкой —
                  показать его прямо здесь сайт не разрешает.
                </p>
                <a
                  href={asset.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
                >
                  Открыть ↗
                </a>
                <p className="mt-3 truncate text-xs text-zinc-500">
                  {asset.externalUrl}
                </p>
              </div>
            </div>
          )
        ) : asset.kind === "FILE" ? (
          <div className="grid size-full place-items-center">
            <a
              href={src}
              download
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900"
            >
              Скачать файл
            </a>
          </div>
        ) : asset.kind === "DOCUMENT" ? (
          <DocxViewer src={src} />
        ) : asset.kind === "SPREADSHEET" ? (
          <XlsxViewer src={src} />
        ) : (
          <PdfViewer src={src} pageCount={asset.pageCount} onPageChange={() => {}} />
        )}
      </div>
    </div>
  );
}
