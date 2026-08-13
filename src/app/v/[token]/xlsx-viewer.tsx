"use client";

import { useEffect, useState } from "react";

type Props = { src: string };

type Sheet = { name: string; rows: string[][] };

// Больше — браузер начинает захлёбываться на холостом рендере огромной
// таблицы. Показываем начало и честно говорим, что дальше есть ещё.
const MAX_ROWS = 2000;
const MAX_COLS = 60;

/** Простой разбор CSV (RFC 4180): кавычки, экранирование "" внутри поля, запятая-разделитель. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

/**
 * .xlsx/.xls/.csv во внутреннем вьюере — разбираем в браузере через exceljs
 * (не SheetJS/`xlsx`: у той пакета в npm непропатченные Prototype Pollution
 * и ReDoS, см. обсуждение фичи) и рендерим обычной React-таблицей — без
 * dangerouslySetInnerHTML, значения ячеек уходят в JSX как текст, поэтому
 * лишняя санитизация тут не нужна.
 */
export function XlsxViewer({ src }: Props) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [active, setActive] = useState(0);

  // Сброс на "loading" при смене src — не через setState здесь (эффект
  // может сработать без ремонта), а через key={item.id} у вызывающей
  // стороны, которая полностью перемонтирует вьюер — как и у PdfViewer.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error("Не удалось скачать файл");
        const contentType = res.headers.get("content-type") ?? "";

        let parsed: Sheet[];
        if (contentType.includes("csv")) {
          const text = await res.text();
          parsed = [{ name: "CSV", rows: parseCsv(text) }];
        } else {
          // Импорт CJS-сборки exceljs через бандлер: в зависимости от
          // интеропа именованный Workbook может оказаться и на .default,
          // и прямо на модуле — подстраховываемся под оба варианта.
          const mod = await import("exceljs");
          const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
          const buffer = await res.arrayBuffer();
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(buffer);

          parsed = workbook.worksheets.map((sheet) => {
            const rows: string[][] = [];
            sheet.eachRow({ includeEmpty: false }, (row) => {
              const cells: string[] = [];
              row.eachCell({ includeEmpty: true }, (cell) => {
                cells.push(cell.text ?? "");
              });
              rows.push(cells);
            });
            return { name: sheet.name, rows };
          });
        }

        if (cancelled) return;
        if (parsed.every((s) => s.rows.length === 0)) throw new Error("Пустой файл");
        setSheets(parsed);
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
          Не удалось показать таблицу.
          <br />
          <a href={src} download className="underline">
            Скачать файл
          </a>
        </p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <p className="py-10 text-center text-sm text-zinc-400">Загружаем таблицу…</p>
    );
  }

  const sheet = sheets[active];
  const cols = Math.max(1, ...sheet.rows.map((r) => r.length));
  const truncatedRows = sheet.rows.length > MAX_ROWS;
  const truncatedCols = cols > MAX_COLS;
  const rows = sheet.rows.slice(0, MAX_ROWS);

  return (
    <div className="flex size-full flex-col bg-white">
      {sheets.length > 1 ? (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-zinc-200 bg-zinc-50 px-2 py-1.5">
          {sheets.map((s, i) => (
            <button
              key={s.name + i}
              type="button"
              onClick={() => setActive(i)}
              className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition ${
                i === active
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="border-collapse text-xs">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {Array.from({ length: Math.min(cols, MAX_COLS) }, (_, ci) => (
                  <td
                    key={ci}
                    className={`border border-zinc-200 px-2 py-1 whitespace-nowrap text-zinc-800 ${
                      ri === 0 ? "bg-zinc-100 font-medium" : ""
                    }`}
                  >
                    {row[ci] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {truncatedRows || truncatedCols ? (
        <p className="shrink-0 border-t border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-500">
          Показана только часть таблицы — файл слишком большой для полного просмотра.
        </p>
      ) : null}
    </div>
  );
}
