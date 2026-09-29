"use client";

import { useTransition } from "react";
import { carryOverUnconfirmed } from "@/app/actions/kpi";
import { Button } from "@/components/ui";

/** Новый квартал: форма пуста; по кнопке все неподписанные сделки прошлого
 * квартала переставляются на +3 месяца (не копируются — подписанные остаются
 * в своём квартале). Кнопка видна всегда, при нуле — неактивна. */
export function CarryOverButton({
  year,
  month,
  count,
  fromLabel,
}: {
  year: number;
  month: number;
  /** Неподписанных сделок в прошлом квартале. */
  count: number;
  /** «3 квартал 2026». */
  fromLabel: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={pending || count === 0}
      title={
        count === 0
          ? `В прошлом квартале (${fromLabel}) нет неподписанных сделок`
          : `Все сделки без галочки «Подписан» из прошлого квартала (${fromLabel}) переедут на те же месяцы этого квартала`
      }
      onClick={() => {
        if (
          !window.confirm(
            `Перенести неподписанные сделки (${count}) из «${fromLabel}» в этот квартал? Подписанные останутся на месте.`,
          )
        )
          return;
        start(() => carryOverUnconfirmed(year, month));
      }}
    >
      {pending ? "Переношу…" : `Перенести с прошлого квартала (${count})`}
    </Button>
  );
}
