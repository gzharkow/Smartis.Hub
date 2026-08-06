"use client";

import {
  calculateQuote,
  formatMoney,
  formatThousands,
  storageEventsLimitLabel,
} from "@/lib/quote-calc";
import type { QuoteSectionData } from "./quote-editor";

// Живой предпросмотр итогового PDF — HTML-копия его разметки (см.
// src/lib/quote-pdf.ts: тот же зелёный, те же колонки, те же итоги и сноски),
// а не точный рендер самого файла. pdf-lib там собирает PDF из шрифтов и
// логотипа, читаемых с диска ("server-only") — это не запустить в браузере
// на каждое нажатие клавиши. HTML-копия дешева и обновляется мгновенно;
// то, что действительно уйдёт клиенту, остаётся кнопкой «Скачать PDF».
const GREEN = "#7CA82D"; // цвет «жучка» в логотипе — тот же, что в quote-pdf.ts

const COLS = "minmax(0,1fr) 52px 64px 60px 60px";

/** "2026-08-03" → "03.08.2026" — без Date(), чтобы не словить сдвиг часового пояса. */
function formatDateRu(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return y && m && d ? `${d}.${m}.${y}` : isoDate;
}

export function QuotePreview({
  clientName,
  vatRatePct,
  documentDate,
  sections,
  boxIntegrationSelected = false,
}: {
  clientName: string;
  vatRatePct: number;
  documentDate: string;
  sections: QuoteSectionData[];
  /** «Коробка» в калькуляторе — включает третий итог в футере. У свободных
   * КП калькулятора нет, поэтому по умолчанию выключен. */
  boxIntegrationSelected?: boolean;
}) {
  const totals = calculateQuote(sections, vatRatePct, { boxIntegrationSelected });
  const flagged = sections.find((s) => s.countsTowardImplementationPayment);

  return (
    <div className="rounded-xl border border-border bg-white p-5 text-[13px] leading-snug text-black shadow-sm">
      <div className="flex justify-center border-b border-black/10 pb-4">
        {/* Логотип КП — не тот же /logo.png, что в сайдбаре (просто знак без
            текста): готовый вордмарк «SMARTIS», выданный владельцем для
            расчётов, текст рядом не дорисовываем — см. quote-pdf.ts. Ширина —
            2/3 документа (см. logoW в quote-pdf.ts), высота считается сама
            по соотношению сторон картинки. */}
        <img src="/quote-logo.png" alt="" className="w-2/3 h-auto" />
      </div>

      <p className="mt-4 text-[14px] font-bold">
        Расчет стоимости для: {clientName || "…"}
      </p>

      {/* Колонки таблицы — фиксированной ширины (см. COLS), на узких экранах
          они не сжимаются до нуля и текст полез бы внахлёст. Горизонтальная
          прокрутка внутри карточки — тот же приём, что и в самом редакторе
          (quote-section.tsx: overflow-x-auto + min-width). */}
      <div className="mt-4 overflow-x-auto">
        <div className="grid min-w-[480px] grid-cols-1 gap-5">
          {sections.map((section) => {
            const sectionTotals = totals.sections.find((s) => s.id === section.id);

            return (
              <div key={section.id}>
                <div
                  className="grid items-center gap-1.5 rounded-t px-2 py-1.5 text-white"
                  style={{ backgroundColor: GREEN, gridTemplateColumns: COLS }}
                >
                  <span className="truncate text-[11px] font-bold">
                    {section.title || "—"}
                  </span>
                  <span className="text-right text-[8.5px] font-bold">Единиц</span>
                  <span className="text-right text-[8.5px] font-bold">Цена за ед.</span>
                  <span className="text-right text-[8.5px] font-bold">Без НДС</span>
                  <span className="text-right text-[8.5px] font-bold">
                    С НДС {formatThousands(vatRatePct)}%
                  </span>
                </div>

                {section.lines.length === 0 ? (
                  <p className="px-2 py-2 text-[10.5px] text-black/45">
                    Пока пусто
                  </p>
                ) : (
                  section.lines.map((line) => {
                    const lineTotals = sectionTotals?.lines.find((l) => l.id === line.id);
                    const limitLabel = line.autoStorageLimit
                      ? storageEventsLimitLabel(line.unitPrice)
                      : null;

                    return (
                      <div
                        key={line.id}
                        className="grid items-start gap-1.5 px-2 py-1.5"
                        style={{ gridTemplateColumns: COLS }}
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold">{line.title || "—"}</p>
                          {line.description ? (
                            <p className="mt-0.5 text-[9.5px] text-black/55">
                              {line.description}
                            </p>
                          ) : null}
                          {limitLabel ? (
                            <p className="mt-0.5 text-[9.5px] text-black/55">
                              Лимит хранимых событий: {limitLabel}
                              {limitLabel === "Безлимит" ? "" : " шт."}
                            </p>
                          ) : null}
                        </div>

                        <span className="text-right text-[10.5px]">
                          {formatThousands(line.quantity)}
                        </span>

                        {line.unitPrice !== null ? (
                          <>
                            <span className="text-right text-[10.5px]">
                              {formatMoney(line.unitPrice)}
                            </span>
                            <span className="text-right text-[10.5px]">
                              {lineTotals?.withoutVat
                                ? formatMoney(lineTotals.withoutVat)
                                : "—"}
                            </span>
                            <span className="text-right text-[10.5px]">
                              {lineTotals?.withVat ? formatMoney(lineTotals.withVat) : "—"}
                            </span>
                          </>
                        ) : (
                          <span className="col-span-3" />
                        )}
                      </div>
                    );
                  })
                )}

                <div
                  className="grid items-center gap-1.5 px-2 pb-1.5 pt-2 text-[10.5px] font-bold"
                  style={{ gridTemplateColumns: COLS, borderTop: `1.5px solid ${GREEN}` }}
                >
                  <span>Сумма ежемесячных абонентских платежей:</span>
                  <span />
                  <span />
                  <span className="text-right">
                    {sectionTotals ? formatMoney(sectionTotals.subtotalWithoutVat) : "—"}
                  </span>
                  <span className="text-right">
                    {sectionTotals ? formatMoney(sectionTotals.subtotalWithVat) : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="mt-5 grid grid-cols-1 gap-2 pt-4"
        style={{ borderTop: `1.5px solid ${GREEN}` }}
      >
        {totals.boxIntegrationPayment ? (
          <div className="flex items-center justify-between gap-3 text-[11.5px] font-bold">
            <span>Интеграционный платеж коробочного решения</span>
            <span>{formatMoney(totals.boxIntegrationPayment)}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 text-[11.5px] font-bold">
          <span>
            Итого платёж на период внедрения{flagged ? ":*" : ""}
          </span>
          <span>{formatMoney(totals.implementationPayment)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-[11.5px] font-bold">
          <span>Итого абонентских ежемесячных платежей:**</span>
          <span>{formatMoney(totals.monthlyTotal)}</span>
        </div>
      </div>

      {/* Сноска про внедрение печатается, только если хоть одна секция
          отмечена галочкой «скидка на внедрение» — сняли галочку, значит и
          звёздочка, и текст под ней пропадают, а не подменяются заглушкой. */}
      {flagged ? (
        <p className="mt-3 text-[9px] text-black/55">
          {`* Платёж на период внедрения — 50% от суммы «с НДС» секции «${flagged.title}»; остальные секции в него не входят.`}
        </p>
      ) : null}
      <p className={`text-[9px] text-black/55 ${flagged ? "" : "mt-3"}`}>
        ** Полная сумма выставляется после полного внедрения продукта и подключения всех сопутствующих интеграций
      </p>

      <p className="mt-4 text-[10px] text-black/55">
        Данное предложение действительно 30 дней, начиная с {formatDateRu(documentDate)}
      </p>
    </div>
  );
}
