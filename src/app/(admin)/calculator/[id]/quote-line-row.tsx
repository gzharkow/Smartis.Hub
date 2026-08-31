"use client";

import { useState, useTransition } from "react";
import { removeQuoteLine, updateQuoteLine } from "@/app/actions/quotes";
import {
  calculateQuote,
  formatMoney,
  storageEventsLimitLabel,
  STORAGE_LIMIT_PRICES,
} from "@/lib/quote-calc";
import type { QuoteLineData } from "./quote-editor";

const inputCls =
  "w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-border focus:border-accent";
const numCls = `${inputCls} text-right`;

export function QuoteLineRow({
  line,
  vatRatePct,
  gridCols,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  reordering,
  onLiveChange,
}: {
  line: QuoteLineData;
  vatRatePct: number;
  gridCols: string;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  reordering: boolean;
  /** Зеркало для предпросмотра документа — не про сохранение, см. quote-editor.tsx. */
  onLiveChange: (patch: Partial<QuoteLineData>) => void;
}) {
  const [title, setTitle] = useState(line.title);
  const [description, setDescription] = useState(line.description ?? "");
  const [quantity, setQuantity] = useState(line.quantity);
  const [unitPrice, setUnitPrice] = useState<number | null>(line.unitPrice);
  const [, startSave] = useTransition();
  const [removing, startRemove] = useTransition();

  const infoOnly = unitPrice === null;
  const storageLimitLabel = line.autoStorageLimit
    ? storageEventsLimitLabel(unitPrice)
    : null;

  const lineTotals = calculateQuote(
    [
      {
        id: line.id,
        countsTowardImplementationPayment: false,
        lines: [{ id: line.id, quantity, unitPrice }],
      },
    ],
    vatRatePct,
  ).sections[0].lines[0];

  function save(patch: {
    title?: string;
    description?: string | null;
    quantity?: number;
    unitPrice?: number | null;
  }) {
    startSave(() => updateQuoteLine(line.id, patch));
  }

  function toggleInfoOnly() {
    const next = infoOnly ? 0 : null;
    setUnitPrice(next);
    save({ unitPrice: next });
    onLiveChange({ unitPrice: next });
  }

  return (
    <div
      className="grid items-start gap-2 border-b border-border px-4 py-1.5"
      style={{ gridTemplateColumns: gridCols }}
    >
      <div>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            onLiveChange({ title: e.target.value });
          }}
          onBlur={() => title !== line.title && save({ title })}
          maxLength={200}
          placeholder="Название строки"
          className={`${inputCls} font-medium`}
        />
        <input
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            onLiveChange({ description: e.target.value || null });
          }}
          onBlur={() =>
            description !== (line.description ?? "") &&
            save({ description: description || null })
          }
          maxLength={1000}
          placeholder="Описание (необязательно)"
          className={`${inputCls} text-xs text-muted`}
        />
      </div>

      <input
        type="number"
        min={0}
        step="any"
        value={quantity}
        onChange={(e) => {
          const next = Number(e.target.value) || 0;
          setQuantity(next);
          onLiveChange({ quantity: next });
        }}
        onBlur={() => quantity !== line.quantity && save({ quantity })}
        className={numCls}
      />

      {line.autoStorageLimit ? (
        <select
          value={unitPrice ?? ""}
          onChange={(e) => {
            const next = Number(e.target.value);
            setUnitPrice(next);
            save({ unitPrice: next });
            onLiveChange({ unitPrice: next });
          }}
          className={numCls}
        >
          {/* Текущая цена могла быть выставлена до появления тарифа —
              добавляем её отдельным пунктом, чтобы select не переключал
              значение молча на первый вариант из списка. */}
          {unitPrice !== null && !STORAGE_LIMIT_PRICES.includes(unitPrice) ? (
            <option value={unitPrice}>{formatMoney(unitPrice)}</option>
          ) : null}
          {STORAGE_LIMIT_PRICES.map((price) => (
            <option key={price} value={price}>
              {formatMoney(price)}
            </option>
          ))}
        </select>
      ) : infoOnly ? (
        <span className="justify-self-end pt-1 text-right text-xs text-muted">
          без цены
        </span>
      ) : (
        <input
          type="number"
          min={0}
          step="any"
          value={unitPrice}
          onChange={(e) => {
            const next = Number(e.target.value) || 0;
            setUnitPrice(next);
            onLiveChange({ unitPrice: next });
          }}
          onBlur={() => unitPrice !== line.unitPrice && save({ unitPrice })}
          className={numCls}
        />
      )}

      <span className="pt-1 text-right text-sm">
        {lineTotals.withoutVat ? formatMoney(lineTotals.withoutVat) : "—"}
      </span>
      <span className="pt-1 text-right text-sm">
        {lineTotals.withVat ? formatMoney(lineTotals.withVat) : "—"}
      </span>

      <div className="flex items-center justify-end gap-0.5 pt-0.5">
        <button
          type="button"
          disabled={isFirst || reordering}
          onClick={onMoveUp}
          title="Переместить вверх"
          className="rounded px-1 py-0.5 text-xs text-muted transition hover:bg-border/60 disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          disabled={isLast || reordering}
          onClick={onMoveDown}
          title="Переместить вниз"
          className="rounded px-1 py-0.5 text-xs text-muted transition hover:bg-border/60 disabled:opacity-30"
        >
          ↓
        </button>
        <button
          type="button"
          disabled={removing}
          onClick={() => startRemove(() => removeQuoteLine(line.id))}
          title="Удалить строку"
          className="rounded px-1 py-0.5 text-xs text-muted transition hover:bg-danger/10 hover:text-danger"
        >
          ✕
        </button>
      </div>

      {line.autoStorageLimit ? (
        <p className="col-span-full -mt-1 text-xs text-muted">
          Лимит хранимых событий:{" "}
          <span className="font-medium text-foreground">
            {storageLimitLabel ?? "—"}
          </span>
          {storageLimitLabel && storageLimitLabel !== "Безлимит" ? " шт." : ""}
        </p>
      ) : (
        <label className="col-span-full -mt-1 flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={infoOnly}
            onChange={toggleInfoOnly}
            className="size-3.5"
          />
          строка без цены (только количество)
        </label>
      )}
    </div>
  );
}
