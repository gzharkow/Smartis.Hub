import Decimal from "decimal.js";

// Единственное место, где считаются деньги в калькуляторе — и клиентский
// редактор (живые итоги по мере ввода), и генератор PDF берут суммы отсюда,
// чтобы формула не разъехалась в двух местах. Модуль чистый: без обращения
// к базе и без "use server", поэтому работает и в браузере, и на сервере.
//
// Decimal, а не number: qty × price × (1 + ставка) считается многократно
// подряд, и плавающая точка на такой цепочке даёт видимые ошибки округления
// в копейках. Округляем только на выводе — см. formatMoney().

export type DecimalLike = Decimal | string | number;

export type QuoteLineInput = {
  id: string;
  quantity: DecimalLike;
  // null — информационная строка без цены (например «Post-View лимит
  // хранимых событий, шт»): участвует в интерфейсе, но не в сумме.
  unitPrice: DecimalLike | null;
};

export type QuoteSectionInput = {
  id: string;
  countsTowardImplementationPayment: boolean;
  lines: QuoteLineInput[];
};

export type QuoteLineTotals = {
  id: string;
  withoutVat: Decimal | null;
  withVat: Decimal | null;
};

export type QuoteSectionTotals = {
  id: string;
  lines: QuoteLineTotals[];
  subtotalWithoutVat: Decimal;
  subtotalWithVat: Decimal;
};

export type QuoteTotals = {
  sections: QuoteSectionTotals[];
  /** 50% суммы «с НДС» секций с countsTowardImplementationPayment. */
  implementationPayment: Decimal;
  /** Сумма «с НДС» всех секций без исключений. */
  monthlyTotal: Decimal;
  /** «Интеграционный платёж коробочного решения» — фиксированные 2 500 000 ₽,
   * если в калькуляторе выбрана «Коробка», иначе null (строка в футере не
   * печатается). В отличие от двух итогов выше — не функция секций/строк:
   * сумма фиксирована и приходит флагом уровня документа (opts, ниже), а не
   * из содержимого какой-либо секции. */
  boxIntegrationPayment: Decimal | null;
};

/** Фиксированная сумма третьего итога — см. QuoteTotals.boxIntegrationPayment. */
export const BOX_INTEGRATION_PAYMENT_AMOUNT = 2_500_000;

function toDecimal(value: DecimalLike): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

function lineTotals(line: QuoteLineInput, vatMultiplier: Decimal): QuoteLineTotals {
  if (line.unitPrice === null) {
    return { id: line.id, withoutVat: null, withVat: null };
  }
  const withoutVat = toDecimal(line.quantity).times(toDecimal(line.unitPrice));
  return { id: line.id, withoutVat, withVat: withoutVat.times(vatMultiplier) };
}

export function calculateQuote(
  sections: QuoteSectionInput[],
  vatRatePct: DecimalLike,
  opts?: { boxIntegrationSelected?: boolean },
): QuoteTotals {
  const vatMultiplier = toDecimal(vatRatePct).dividedBy(100).plus(1);

  const sectionTotals = sections.map((section) => {
    const lines = section.lines.map((line) => lineTotals(line, vatMultiplier));
    const subtotalWithoutVat = lines.reduce(
      (sum, l) => (l.withoutVat ? sum.plus(l.withoutVat) : sum),
      new Decimal(0),
    );
    const subtotalWithVat = lines.reduce(
      (sum, l) => (l.withVat ? sum.plus(l.withVat) : sum),
      new Decimal(0),
    );
    return { id: section.id, lines, subtotalWithoutVat, subtotalWithVat };
  });

  const implementationBase = sections.reduce((sum, section, i) => {
    if (!section.countsTowardImplementationPayment) return sum;
    return sum.plus(sectionTotals[i].subtotalWithVat);
  }, new Decimal(0));

  const monthlyTotal = sectionTotals.reduce(
    (sum, s) => sum.plus(s.subtotalWithVat),
    new Decimal(0),
  );

  return {
    sections: sectionTotals,
    implementationPayment: implementationBase.times(0.5),
    monthlyTotal,
    boxIntegrationPayment: opts?.boxIntegrationSelected
      ? new Decimal(BOX_INTEGRATION_PAYMENT_AMOUNT)
      : null,
  };
}

/** «183 750» — пробел как разделитель тысяч, без копеек. */
export function formatThousands(value: DecimalLike): string {
  const rounded = toDecimal(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  return rounded.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** «183 750 ₽» — формат образца. */
export function formatMoney(value: DecimalLike): string {
  return `${formatThousands(value)} ₽`;
}

// ─────────────────────────────  Post-View: лимит хранимых событий  ─────────────────────────────
//
// Раньше это была отдельная информационная строка рядом со строкой цены
// («Post-View другой медийной рекламы» + «Post-View лимит хранимых событий,
// шт»). Объединены в одну строку (QuoteLine.autoStorageLimit) — лимит больше
// не вводится руками, а выводится из выбранной цены по фиксированному тарифу.
const STORAGE_LIMIT_TIERS: { price: number; label: string }[] = [
  { price: 25_000, label: "20 000 000" },
  { price: 50_000, label: "200 000 000" },
  { price: 100_000, label: "1 000 000 000" },
  { price: 150_000, label: "1 200 000 000" },
  { price: 200_000, label: "2 000 000 000" },
  { price: 300_000, label: "Безлимит" },
];

/** Цены тарифа — источник для выпадающего списка в редакторе строки. */
export const STORAGE_LIMIT_PRICES = STORAGE_LIMIT_TIERS.map((t) => t.price);

/** «20 000 000» / «Безлимит» по цене строки; null — цены нет или она не из тарифа. */
export function storageEventsLimitLabel(unitPrice: DecimalLike | null): string | null {
  if (unitPrice === null) return null;
  const price = toDecimal(unitPrice).toNumber();
  return STORAGE_LIMIT_TIERS.find((t) => t.price === price)?.label ?? null;
}
