import { formatMoney, type QuoteTotals } from "@/lib/quote-calc";

// Итоговый блок — общий для свободного редактора и калькулятора. Третий
// итог («Коробка») показывается сам по себе, когда он есть в totals —
// ничего специально включать не нужно.
export function QuoteTotalsSummary({
  totals,
  showImplementationNote = true,
}: {
  totals: QuoteTotals;
  /** Сноска про галочку «скидка на внедрение» — актуальна только там, где
   * эта галочка вообще есть в UI (свободный редактор). В калькуляторе
   * секция СА всегда одна и всегда даёт скидку на внедрение, галочки нет. */
  showImplementationNote?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {totals.boxIntegrationPayment ? (
          <div className="sm:col-span-2">
            <dt className="text-sm text-muted">
              Интеграционный платеж коробочного решения
            </dt>
            <dd className="text-lg font-semibold">
              {formatMoney(totals.boxIntegrationPayment)}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-sm text-muted">
            Итого платёж на период внедрения
          </dt>
          <dd className="text-lg font-semibold">
            {formatMoney(totals.implementationPayment)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">
            Итого абонентских ежемесячных платежей
          </dt>
          <dd className="text-lg font-semibold">
            {formatMoney(totals.monthlyTotal)}
          </dd>
        </div>
      </dl>
      {showImplementationNote ? (
        <p className="mt-2 text-xs text-muted">
          Секция со скидкой на внедрение отмечена галочкой ниже — 50% её
          суммы «с НДС» формирует платёж на период внедрения. Галочку можно
          снять совсем — тогда платёж на внедрение равен нулю, а сноска про
          него в документе не печатается.
        </p>
      ) : null}
    </div>
  );
}
