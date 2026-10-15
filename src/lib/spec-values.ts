import Decimal from "decimal.js";
import { z } from "zod";
import { plural, WORDS } from "./plural";
import { formatAmount, moneyParts } from "./rubles-in-words";
import {
  AUTO_DEALER_UNIT_TARIFFS,
  LINE_TITLES,
  builderUnitTariffs,
  type QuoteCalculatorConfig,
  type UnitTariffs,
} from "./quote-calculator";

// Расчёт КП → значения, которые подставляются в Спецификацию.
//
// Модуль чистый (без "server-only"), как quote-calc.ts: одни и те же формулы
// нужны и серверу при выпуске документа, и браузеру — экран проверки
// пересчитывает производные суммы на каждое изменение поля.
//
// Три шага разведены нарочно:
//   deriveSpecValues  — расчёт → стартовые значения формы (может жаловаться)
//   computeSpecValues — значения формы → полный набор с НДС и итогами
//   specValuesToTags  — полный набор → строки для подстановки в шаблон
// Сервер при выпуске вызывает второй и третий заново: из браузера приходят
// только базовые числа, ни одной итоговой суммы мы не принимаем на веру.

export type DecimalLike = Decimal | string | number;

export type SpecMoney = { net: Decimal; gross: Decimal; vat: Decimal };

// ─────────────────────────────  Вход  ─────────────────────────────

export type SpecQuoteLine = {
  title: string;
  quantity: DecimalLike;
  /** null — информационная строка без цены, в Спецификацию не попадает. */
  unitPrice: DecimalLike | null;
};

export type SpecQuoteSection = {
  countsTowardImplementationPayment: boolean;
  lines: SpecQuoteLine[];
};

export type SpecQuoteInput = {
  vatRatePct: DecimalLike;
  calculatorConfig: QuoteCalculatorConfig | null;
  sections: SpecQuoteSection[];
};

// ─────────────────────────────  Что правит человек  ─────────────────────────────

/** Только базовые числа. Всё остальное — суммы с НДС, итоги, прописи,
 * склонения — выводится из них и на экране проверки доступно лишь для
 * чтения. В этом весь смысл фичи: ячейку «178 000 вместо 178 500» физически
 * некуда ввести. */
export type SpecEditableValues = {
  /** Таблица 2.2, строка «за предоставление доступа к платформе». */
  platformNet: string;

  /** Итог за объекты — не отдельное поле: count × unitObjectNet (см.
   * computeSpecValues). Раньше это было ещё одно свободно вводимое число,
   * и правка одного количества не меняла сумму — ту же цену теперь держит
   * только унитарная цена ниже, единственный источник истины. */
  includeObjects: boolean;
  objectsCount: number;

  includeUsers: boolean;
  usersCount: number;

  includeMediaPlan: boolean;
  mediaPlanNet: string;

  /** Таблица 2.3 — цена за одну дополнительную единицу; она же цена, по
   * которой считается итог за объекты/пользователей в таблице 2.2. */
  unitObjectNet: string;
  unitUserNet: string;
  unitMediaPlanNet: string;
};

/** Значения приходят из браузера прямым POST — и в маршруты предпросмотра, и
 * в server action выпуска. Каждый вход валидирует их заново этой схемой, а
 * все производные суммы считает сам. */
const moneySchema = z
  .string()
  .trim()
  .regex(/^\d{1,12}([.,]\d{1,2})?$/, "Сумма — число с не более чем двумя знаками после запятой")
  .transform((value) => value.replace(",", "."));

const countSchema = z.number().int().min(0).max(999_999);

export const SpecEditableValuesSchema = z.object({
  platformNet: moneySchema,
  includeObjects: z.boolean(),
  objectsCount: countSchema,
  includeUsers: z.boolean(),
  usersCount: countSchema,
  includeMediaPlan: z.boolean(),
  mediaPlanNet: moneySchema,
  unitObjectNet: moneySchema,
  unitUserNet: moneySchema,
  unitMediaPlanNet: moneySchema,
});

// ─────────────────────────────  Что получается  ─────────────────────────────

export type SpecValues = {
  vatRatePct: Decimal;
  /** Чем застройщик отличается от автодилера в тексте документа — счётная
   * строка таблицы 2.2 называется «объект недвижимости» у одного и
   * «дилерский центр» у другого (см. objectsLabel). Свободный КП (null)
   * считаем застройщиком: это база, автодилерские формулировки — отличие. */
  clientType: "BUILDER" | "AUTO_DEALER" | null;
  t22: {
    platform: SpecMoney;
    /** null — строка удаляется из таблицы целиком. */
    objects: SpecMoney | null;
    users: SpecMoney | null;
    mediaPlan: SpecMoney | null;
  };
  objectsCount: number;
  usersCount: number;
  t23: { object: SpecMoney; user: SpecMoney; mediaPlan: SpecMoney };
  /** Сумма таблицы 2.2 — то, что печатается в п.2.1. */
  monthly: SpecMoney;
  /** Половина месячной суммы — п.1.2.1 и п.1.2.2. */
  stage: SpecMoney;
  /** Час дополнительных услуг (раздел об иных услугах): тариф без НДС
   * фиксирован, с НДС зависит от ставки — раньше «3 675» было зашито в текст
   * шаблона и не пересчитывалось при смене ставки. */
  extraHour: SpecMoney;
};

/** Стоимость часа дополнительных услуг без НДС, рублей. */
export const EXTRA_HOUR_NET = 3500;

export type SpecIssueCode =
  | "NO_IMPLEMENTATION_SECTION"
  | "LINE_MISSING"
  | "LINE_DUPLICATED"
  | "FOLDED_INTO_PLATFORM"
  | "FRACTIONAL_QUANTITY"
  | "NO_TARIFF_SOURCE";

export type SpecIssueField = keyof SpecEditableValues;

export type SpecIssue = {
  code: SpecIssueCode;
  /** Поле формы, которое надо подсветить; null — проблема со всем документом. */
  field: SpecIssueField | null;
  message: string;
};

// ─────────────────────────────  Сопоставление строк  ─────────────────────────────

/** Сравниваем названия строго, но терпимо к вводу: лишние пробелы, регистр и
 * «ё» не должны решать, попадёт ли позиция в документ. Нечёткого поиска нет
 * намеренно — в юридическом документе предсказуемость важнее догадливости. */
function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase().replace(/ё/g, "е");
}

const OBJECT_TITLES = new Set(
  [LINE_TITLES.objectsBuilder, LINE_TITLES.objectsAutoDealer].map(normalizeTitle),
);
const USER_TITLES = new Set([LINE_TITLES.supportUsers].map(normalizeTitle));
const MEDIA_PLAN_TITLES = new Set([LINE_TITLES.mediaPlan].map(normalizeTitle));

/** Строки, которые заведомо относятся к плате за платформу. Всё, чего нет ни
 * в одном из четырёх списков, тоже попадёт в платформу — но уже с жалобой. */
const PLATFORM_TITLES = new Set(
  [LINE_TITLES.techSupport, LINE_TITLES.customCrm, LINE_TITLES.boxSupport].map(normalizeTitle),
);

function tariffsFor(config: QuoteCalculatorConfig | null): UnitTariffs | null {
  if (!config) return null;
  return config.clientType === "BUILDER"
    ? builderUnitTariffs(config.enterpriseLicense)
    : AUTO_DEALER_UNIT_TARIFFS;
}

// ─────────────────────────────  Шаг 1: расчёт → форма  ─────────────────────────────

const ZERO = "0";

function emptyEditable(): SpecEditableValues {
  return {
    platformNet: ZERO,
    includeObjects: false,
    objectsCount: 0,
    includeUsers: false,
    usersCount: 0,
    includeMediaPlan: false,
    mediaPlanNet: ZERO,
    unitObjectNet: ZERO,
    unitUserNet: ZERO,
    unitMediaPlanNet: ZERO,
  };
}

export function deriveSpecValues(quote: SpecQuoteInput): {
  editable: SpecEditableValues;
  issues: SpecIssue[];
} {
  const issues: SpecIssue[] = [];

  // Источник — секция с флагом «идёт в платёж за внедрение». Именно флаг, а не
  // название: он переживает переименование секции и он же отсекает
  // «Дополнительные решения», под которые предусмотрены отдельные
  // спецификации.
  const section = quote.sections.find((s) => s.countsTowardImplementationPayment);
  if (!section) {
    return {
      editable: emptyEditable(),
      issues: [
        {
          code: "NO_IMPLEMENTATION_SECTION",
          field: null,
          message:
            "В расчёте нет секции, отмеченной как платёж за внедрение — брать суммы для Спецификации неоткуда.",
        },
      ],
    };
  }

  const tariffs = tariffsFor(quote.calculatorConfig);

  let platform = new Decimal(0);
  const folded: string[] = [];

  type Bucket = { total: Decimal; count: Decimal; unit: Decimal | null; seen: number };
  const objects: Bucket = { total: new Decimal(0), count: new Decimal(0), unit: null, seen: 0 };
  const users: Bucket = { total: new Decimal(0), count: new Decimal(0), unit: null, seen: 0 };
  const mediaPlan: Bucket = { total: new Decimal(0), count: new Decimal(0), unit: null, seen: 0 };

  for (const line of section.lines) {
    if (line.unitPrice === null) continue; // информационная строка

    const price = new Decimal(line.unitPrice);
    const quantity = new Decimal(line.quantity);
    const amount = quantity.times(price);
    const key = normalizeTitle(line.title);

    const bucket = OBJECT_TITLES.has(key)
      ? objects
      : USER_TITLES.has(key)
        ? users
        : MEDIA_PLAN_TITLES.has(key)
          ? mediaPlan
          : null;

    if (bucket) {
      bucket.total = bucket.total.plus(amount);
      bucket.count = bucket.count.plus(quantity);
      bucket.unit = price;
      bucket.seen += 1;
      continue;
    }

    platform = platform.plus(amount);
    if (!PLATFORM_TITLES.has(key)) folded.push(line.title);
  }

  if (folded.length > 0) {
    issues.push({
      code: "FOLDED_INTO_PLATFORM",
      field: "platformNet",
      message: `В плату за платформу свёрнуты строки, которых нет в стандартном расчёте: ${folded.join(", ")}. Проверьте сумму.`,
    });
  }

  for (const [bucket, field, name] of [
    [objects, "objectsCount", "объектов"],
    [users, "usersCount", "пользователей"],
    [mediaPlan, "mediaPlanNet", "медиапланов"],
  ] as const) {
    if (bucket.seen > 1) {
      issues.push({
        code: "LINE_DUPLICATED",
        field,
        message: `В расчёте несколько строк ${name} — они сложены в одну строку Спецификации. Проверьте сумму.`,
      });
    }
    if (!bucket.count.isInteger()) {
      issues.push({
        code: "FRACTIONAL_QUANTITY",
        field,
        message: `Дробное количество ${name} (${bucket.count.toString()}) округлено до целого — в Спецификации количество целое.`,
      });
    }
  }

  // Таблица 2.3 печатается всегда, даже когда позиции нет в расчёте: это
  // прайс за добавление единиц, а не факт покупки. Цену берём из строки
  // расчёта, а если строки нет — из тарифа выбранной лицензии (у застройщика
  // цены отличаются при включённом enterprise).
  const unitObject = bucket2Unit(objects, tariffs?.object);
  const unitUser = bucket2Unit(users, tariffs?.supportUser);
  const unitMediaPlan = bucket2Unit(mediaPlan, tariffs?.mediaPlan);

  for (const [unit, bucket, field, name] of [
    [unitObject, objects, "unitObjectNet", "дополнительный объект"],
    [unitUser, users, "unitUserNet", "дополнительного пользователя"],
    [unitMediaPlan, mediaPlan, "unitMediaPlanNet", "дополнительный медиаплан"],
  ] as const) {
    if (unit === null) {
      issues.push({
        code: "NO_TARIFF_SOURCE",
        field,
        message: `Цену за ${name} взять неоткуда: в расчёте нет такой строки, а тариф подставить не из чего — КП собран вручную либо его настройки калькулятора не читаются. Впишите цену сами.`,
      });
    } else if (bucket.seen === 0) {
      issues.push({
        code: "LINE_MISSING",
        field,
        message: `Позиции нет в расчёте — цена подставлена по тарифу. Строка таблицы 2.2 будет удалена, таблица 2.3 остаётся.`,
      });
    }
  }

  return {
    editable: {
      platformNet: platform.toFixed(2),

      includeObjects: objects.count.greaterThan(0),
      objectsCount: objects.count.round().toNumber(),

      includeUsers: users.count.greaterThan(0),
      usersCount: users.count.round().toNumber(),

      includeMediaPlan: mediaPlan.count.greaterThan(0),
      mediaPlanNet: mediaPlan.total.toFixed(2),

      unitObjectNet: (unitObject ?? new Decimal(0)).toFixed(2),
      unitUserNet: (unitUser ?? new Decimal(0)).toFixed(2),
      unitMediaPlanNet: (unitMediaPlan ?? new Decimal(0)).toFixed(2),
    },
    issues,
  };
}

function bucket2Unit(
  bucket: { unit: Decimal | null },
  tariff: number | undefined,
): Decimal | null {
  if (bucket.unit !== null) return bucket.unit;
  return tariff === undefined ? null : new Decimal(tariff);
}

// ─────────────────────────────  Шаг 2: форма → полный набор  ─────────────────────────────

function money(net: DecimalLike, vatRatePct: Decimal): SpecMoney {
  const netD = new Decimal(net).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const gross = netD
    .times(vatRatePct.dividedBy(100).plus(1))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  // Сумма НДС — разностью, а не отдельным умножением: так она всегда точно
  // равна разнице колонок «с НДС» и «без НДС», а её как раз и проверяют.
  return { net: netD, gross, vat: gross.minus(netD) };
}

export function computeSpecValues(
  editable: SpecEditableValues,
  vatRatePct: DecimalLike,
  clientType: "BUILDER" | "AUTO_DEALER" | null = null,
): SpecValues {
  const rate = new Decimal(vatRatePct);

  const platform = money(editable.platformNet, rate);
  // Итог всегда count × цена за единицу — та самая цена, что напечатана в
  // таблице 2.3 (unitObjectNet/unitUserNet). Раньше итог хранился отдельным
  // свободно вводимым полем, и правка количества не меняла сумму — теперь
  // разъехаться им физически нечем, потому что независимого поля-суммы нет.
  const objects = editable.includeObjects
    ? money(new Decimal(editable.objectsCount).times(editable.unitObjectNet), rate)
    : null;
  const users = editable.includeUsers
    ? money(new Decimal(editable.usersCount).times(editable.unitUserNet), rate)
    : null;
  const mediaPlan = editable.includeMediaPlan ? money(editable.mediaPlanNet, rate) : null;

  const rows = [platform, objects, users, mediaPlan].filter((r): r is SpecMoney => r !== null);

  // Итог складываем из уже округлённых строк, а не пересчитываем от общего
  // «без НДС»: над таблицей написано «складывается из сумм платы», значит
  // напечатанные строки обязаны дать напечатанный итог до копейки.
  const monthlyNet = rows.reduce((sum, r) => sum.plus(r.net), new Decimal(0));
  const monthlyGross = rows.reduce((sum, r) => sum.plus(r.gross), new Decimal(0));
  const monthly: SpecMoney = {
    net: monthlyNet,
    gross: monthlyGross,
    vat: monthlyGross.minus(monthlyNet),
  };

  const stageNet = monthly.net.dividedBy(2).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const stageGross = monthly.gross.dividedBy(2).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const stage: SpecMoney = { net: stageNet, gross: stageGross, vat: stageGross.minus(stageNet) };

  return {
    vatRatePct: rate,
    clientType,
    t22: { platform, objects, users, mediaPlan },
    objectsCount: editable.objectsCount,
    usersCount: editable.usersCount,
    t23: {
      object: money(editable.unitObjectNet, rate),
      user: money(editable.unitUserNet, rate),
      mediaPlan: money(editable.unitMediaPlanNet, rate),
    },
    monthly,
    stage,
    extraHour: money(EXTRA_HOUR_NET, rate),
  };
}

/**
 * Копейки, для которых слово «копеек» в шаблоне окажется неверным.
 *
 * Слово оставлено текстом шаблона по решению заказчика: копейки бывают только
 * «00» или «50», и обе формы требуют «копеек». Проверка сторожит это
 * допущение — при «2 копейки» или «21 копейке» документ стал бы неграмотным,
 * а заметить это в PDF почти невозможно. Пустой массив — всё в порядке.
 */
export function unsupportedKopecks(values: SpecValues): number[] {
  const bad: number[] = [];
  for (const amount of [values.monthly.gross, values.stage.gross]) {
    const kop = moneyParts(amount).kopValue;
    if (kop !== 0 && kop !== 50) bad.push(kop);
  }
  // Час доп. услуг печатается целыми рублями без копеек: ставка, при которой
  // 3500 × (1+НДС) даёт копейки, в этот текст не ложится.
  const hourKop = moneyParts(values.extraHour.gross).kopValue;
  if (hourKop !== 0) bad.push(hourKop);
  return bad;
}

// ─────────────────────────────  Шаг 3: набор → метки  ─────────────────────────────

/** «1 объект недвижимости» / «3 объекта недвижимости» у застройщика,
 * «1 дилерский центр» / «3 дилерских центра» у автодилера — та же строка
 * таблицы 2.2 в двух версиях документа названа по-разному, и подстановка
 * должна попасть в ту фразу, что реально напечатана в шаблоне клиента. */
export function objectsLabel(
  count: number,
  clientType: "BUILDER" | "AUTO_DEALER" | null,
): string {
  const words = clientType === "AUTO_DEALER" ? WORDS.dealerCenterAcc : WORDS.realtyObjectAcc;
  return `${count} ${plural(count, words)}`;
}

/** «1 авторизованного пользователя Заказчика». */
export function usersLabel(count: number): string {
  return `${count} ${plural(count, WORDS.authUserAcc)} Заказчика`;
}

function moneyTags(prefix: string, value: SpecMoney | null): Record<string, string | null> {
  if (value === null) {
    // null во всех метках строки — сигнал docx-fill.ts удалить весь <w:tr>.
    return {
      [`${prefix}_NET`]: null,
      [`${prefix}_GROSS`]: null,
      [`${prefix}_VAT`]: null,
    };
  }
  return {
    [`${prefix}_NET`]: formatAmount(value.net),
    [`${prefix}_GROSS`]: formatAmount(value.gross),
    [`${prefix}_VAT`]: formatAmount(value.vat),
  };
}

export function specValuesToTags(values: SpecValues): Record<string, string | null> {
  const stage = moneyParts(values.stage.gross);
  const month = moneyParts(values.monthly.gross);

  const hour = moneyParts(values.extraHour.gross);

  return {
    VAT_PCT: values.vatRatePct.toString().replace(".", ","),
    EXTRA_HOUR_SUM: hour.sum,
    EXTRA_HOUR_WORDS: hour.words,
    EXTRA_HOUR_RUB: hour.rub,

    STAGE_SUM: stage.sum,
    STAGE_WORDS: stage.words,
    STAGE_RUB: stage.rub,
    STAGE_KOP: stage.kop,
    STAGE_VAT: formatAmount(values.stage.vat),

    MONTH_SUM: month.sum,
    MONTH_WORDS: month.words,
    MONTH_RUB: month.rub,
    MONTH_KOP: month.kop,
    MONTH_VAT: formatAmount(values.monthly.vat),

    ...moneyTags("T22_PLATFORM", values.t22.platform),

    T22_OBJECTS_LABEL:
      values.t22.objects === null ? null : objectsLabel(values.objectsCount, values.clientType),
    ...moneyTags("T22_OBJECTS", values.t22.objects),

    T22_USERS_LABEL: values.t22.users === null ? null : usersLabel(values.usersCount),
    ...moneyTags("T22_USERS", values.t22.users),

    ...moneyTags("T22_MEDIAPLAN", values.t22.mediaPlan),

    ...moneyTags("T23_OBJECT", values.t23.object),
    ...moneyTags("T23_USER", values.t23.user),
    ...moneyTags("T23_MEDIAPLAN", values.t23.mediaPlan),
  };
}
