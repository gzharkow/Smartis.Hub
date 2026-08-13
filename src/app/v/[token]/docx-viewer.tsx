"use client";

import { useEffect, useState } from "react";
import { sanitizeDocumentHtml } from "@/lib/sanitize";

type Props = { src: string };

/**
 * .docx во внутреннем вьюере — конвертируем в HTML прямо в браузере через
 * mammoth. Сервера-конвертера (LibreOffice и т.п.) в проекте нет и не будет —
 * решили обойтись клиентской библиотекой. Вид приблизительный (mammoth не
 * копирует вёрстку Word 1:1), но содержимое читаемо. Для старого бинарного
 * .doc этот путь не работает — такие файлы остаются в detectKind() как FILE.
 */
export function DocxViewer({ src }: Props) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [html, setHtml] = useState("");

  // Сброс на "loading" при смене src — не через setState здесь (эффект
  // может сработать без ремонта), а через key={item.id} у вызывающей
  // стороны, которая полностью перемонтирует вьюер — как и у PdfViewer.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [mammoth, res] = await Promise.all([
          import("mammoth/mammoth.browser"),
          fetch(src),
        ]);
        if (!res.ok) throw new Error("Не удалось скачать файл");
        const arrayBuffer = await res.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (cancelled) return;
        // Не доверяем HTML вслепую, даже собственной конвертации —
        // тот же принцип, что и для descriptionHtml хаба (см. sanitize.ts).
        setHtml(sanitizeDocumentHtml(result.value));
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (status === "error") {
    return (
      <div className="grid size-full place-items-center p-6 text-center">
        <p className="text-sm text-zinc-300">
          Не удалось показать документ.
          <br />
          <a href={src} download className="underline">
            Скачать файл
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="size-full overflow-y-auto bg-white">
      {status === "loading" ? (
        <p className="py-10 text-center text-sm text-zinc-400">
          Загружаем документ…
        </p>
      ) : (
        <div
          className="mx-auto max-w-3xl px-8 py-8 text-sm leading-relaxed text-zinc-900 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_h1]:mb-3 [&_h2]:mb-2 [&_h3]:mb-2 [&_p]:mb-3 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-zinc-300 [&_td]:p-2 [&_th]:border [&_th]:border-zinc-300 [&_th]:bg-zinc-100 [&_th]:p-2 [&_img]:max-w-full [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}
