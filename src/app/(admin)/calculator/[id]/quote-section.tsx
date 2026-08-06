"use client";

import { useState, useTransition } from "react";
import {
  addQuoteLine,
  clearImplementationSection,
  removeQuoteSection,
  renameQuoteSection,
  reorderQuoteLines,
  setImplementationSection,
} from "@/app/actions/quotes";
import { calculateQuote, formatMoney } from "@/lib/quote-calc";
import { QuoteLineRow } from "./quote-line-row";
import type { QuoteLineData, QuoteSectionData } from "./quote-editor";

const GRID_COLS = "minmax(0,1fr) 90px 110px 100px 100px 68px";

export function QuoteSectionBlock({
  quoteId,
  section,
  vatRatePct,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  reordering,
  onLiveTitleChange,
  onLiveLineChange,
}: {
  quoteId: string;
  section: QuoteSectionData;
  vatRatePct: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  reordering: boolean;
  /** Зеркало для предпросмотра документа — не про сохранение, см. quote-editor.tsx. */
  onLiveTitleChange: (title: string) => void;
  onLiveLineChange: (lineId: string, patch: Partial<QuoteLineData>) => void;
}) {
  const [, startRename] = useTransition();
  const [flagging, startFlag] = useTransition();
  const [addingLine, startAddLine] = useTransition();
  const [movingLine, startMoveLine] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, startDelete] = useTransition();

  const subtotal = calculateQuote([section], vatRatePct).sections[0];
  const lineIds = section.lines.map((l) => l.id);

  function moveLine(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= lineIds.length) return;
    const next = [...lineIds];
    [next[index], next[target]] = [next[target], next[index]];
    startMoveLine(() => reorderQuoteLines(section.id, next));
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <input
          key={section.title}
          defaultValue={section.title}
          onChange={(e) => onLiveTitleChange(e.target.value)}
          onBlur={(e) => {
            const value = e.target.value.trim();
            if (value && value !== section.title) {
              startRename(() => renameQuoteSection(section.id, value));
            }
          }}
          maxLength={120}
          // basis-full на мобильном — иначе flex-wrap не переносит остальные
          // элементы строки на новую строку, а сжимает поле названия секции
          // до пары букв. С sm и шире снова обычное гибкое поле в общей строке.
          className="min-w-0 flex-1 basis-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold tracking-tight outline-none hover:border-border focus:border-blue-500 sm:basis-auto"
        />

        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={section.countsTowardImplementationPayment}
            disabled={flagging}
            onChange={() =>
              startFlag(() =>
                section.countsTowardImplementationPayment
                  ? clearImplementationSection(quoteId)
                  : setImplementationSection(quoteId, section.id),
              )
            }
            className="accent-blue-600"
          />
          скидка на внедрение
        </label>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={isFirst || reordering}
            onClick={onMoveUp}
            title="Переместить вверх"
            className="rounded px-1.5 py-1 text-xs text-muted transition hover:bg-border/60 disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={isLast || reordering}
            onClick={onMoveDown}
            title="Переместить вниз"
            className="rounded px-1.5 py-1 text-xs text-muted transition hover:bg-border/60 disabled:opacity-30"
          >
            ↓
          </button>
        </div>

        {confirmingDelete ? (
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted">Удалить секцию?</span>
            <button
              type="button"
              disabled={deleting}
              onClick={() => startDelete(() => removeQuoteSection(section.id))}
              className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
            >
              {deleting ? "…" : "Удалить"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-border/60"
            >
              Отмена
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
          >
            Удалить секцию
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div
            className="grid items-center gap-2 border-b border-border px-4 py-1.5 text-xs text-muted"
            style={{ gridTemplateColumns: GRID_COLS }}
          >
            <span>Строка</span>
            <span className="text-right">Единиц</span>
            <span className="text-right">Цена за ед.</span>
            <span className="text-right">Без НДС</span>
            <span className="text-right">С НДС {vatRatePct}%</span>
            <span />
          </div>

          {section.lines.map((line, index) => (
            <QuoteLineRow
              key={line.id}
              line={line}
              vatRatePct={vatRatePct}
              gridCols={GRID_COLS}
              isFirst={index === 0}
              isLast={index === section.lines.length - 1}
              onMoveUp={() => moveLine(index, -1)}
              onMoveDown={() => moveLine(index, 1)}
              reordering={movingLine}
              onLiveChange={(patch) => onLiveLineChange(line.id, patch)}
            />
          ))}

          <div
            className="grid items-center gap-2 border-t border-border px-4 py-2 text-sm font-semibold"
            style={{ gridTemplateColumns: GRID_COLS }}
          >
            <span>Сумма ежемесячных абонентских платежей</span>
            <span />
            <span />
            <span className="text-right">
              {formatMoney(subtotal.subtotalWithoutVat)}
            </span>
            <span className="text-right">
              {formatMoney(subtotal.subtotalWithVat)}
            </span>
            <span />
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <button
          type="button"
          disabled={addingLine}
          onClick={() => startAddLine(() => addQuoteLine(section.id))}
          className="rounded-lg border border-border px-3 py-1.5 text-xs transition hover:bg-border/60 disabled:opacity-50"
        >
          {addingLine ? "Добавляем…" : "+ Строка"}
        </button>
      </div>
    </div>
  );
}
