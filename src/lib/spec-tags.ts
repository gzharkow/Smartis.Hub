// Словарь меток шаблона Спецификации. Единственное место, где живут их имена:
// отсюда берут и подстановка (spec-values.ts), и валидация загружаемого
// админом шаблона, и таблица для копипаста в настройках.
//
// Имена латиницей, не кириллицей. Метка — идентификатор, а не текст
// документа, а кириллическая метка ловит гомоглифы: {{ОБЪЕКТЫ}} со случайной
// латинской «О» глазом не отличить от правильной, и баг невоспроизводим.

export type SpecTagGroup =
  | "stage"
  | "month"
  | "t22"
  | "t23";

export const SPEC_TAG_GROUPS: { key: SpecTagGroup; title: string; hint: string }[] = [
  {
    key: "stage",
    title: "Платёж за этапы — п.1.2.1 и п.1.2.2",
    hint: "Одни и те же метки в обоих пунктах: суммы там равны. Слова «рублей»/«копеек» после прочерков надо заменить метками — при сумме 101 851 нужен «рубль», а не «рублей».",
  },
  {
    key: "month",
    title: "Ежемесячная стоимость — п.2.1",
    hint: "Сумма таблицы 2.2 с НДС.",
  },
  {
    key: "t22",
    title: "Таблица 2.2 — из чего складывается ежемесячная плата",
    hint: "Строки объектов, пользователей и медиапланов удаляются целиком, если позиции нет в расчёте.",
  },
  {
    key: "t23",
    title: "Таблица 2.3 — стоимость дополнительных единиц",
    hint: "Цена за одну единицу по тарифу. Печатается всегда, даже если позиция в расчёт не вошла.",
  },
];

export type SpecTag = {
  tag: string;
  group: SpecTagGroup;
  label: string;
  example: string;
  /** Метка допускает пустое значение, и тогда строка таблицы удаляется. */
  removable?: boolean;
};

export const SPEC_TAGS: SpecTag[] = [
  { tag: "STAGE_SUM",   group: "stage", label: "Сумма этапа, рубли цифрами", example: "101 850" },
  { tag: "STAGE_WORDS", group: "stage", label: "Сумма этапа прописью (в скобках)", example: "сто одна тысяча восемьсот пятьдесят" },
  { tag: "STAGE_RUB",   group: "stage", label: "Слово «рублей» в нужной форме", example: "рублей" },
  { tag: "STAGE_KOP",   group: "stage", label: "Копейки числом (слово «копеек» остаётся в шаблоне)", example: "00" },
  { tag: "STAGE_VAT",   group: "stage", label: "НДС с суммы этапа", example: "4 850,00" },

  { tag: "MONTH_SUM",   group: "month", label: "Ежемесячная сумма, рубли цифрами", example: "203 700" },
  { tag: "MONTH_WORDS", group: "month", label: "Ежемесячная сумма прописью (в скобках)", example: "двести три тысячи семьсот" },
  { tag: "MONTH_RUB",   group: "month", label: "Слово «рублей» в нужной форме", example: "рублей" },
  { tag: "MONTH_KOP",   group: "month", label: "Копейки числом", example: "00" },
  { tag: "MONTH_VAT",   group: "month", label: "НДС с ежемесячной суммы", example: "9 700,00" },

  { tag: "T22_PLATFORM_NET",   group: "t22", label: "Платформа — без НДС", example: "170 000,00" },
  { tag: "T22_PLATFORM_GROSS", group: "t22", label: "Платформа — с НДС", example: "178 500,00" },
  { tag: "T22_PLATFORM_VAT",   group: "t22", label: "Платформа — сумма НДС", example: "8 500,00" },

  { tag: "T22_OBJECTS_LABEL", group: "t22", label: "Подпись строки объектов", example: "1 объект недвижимости", removable: true },
  { tag: "T22_OBJECTS_NET",   group: "t22", label: "Объекты — без НДС", example: "15 000,00", removable: true },
  { tag: "T22_OBJECTS_GROSS", group: "t22", label: "Объекты — с НДС", example: "15 750,00", removable: true },
  { tag: "T22_OBJECTS_VAT",   group: "t22", label: "Объекты — сумма НДС", example: "750,00", removable: true },

  { tag: "T22_USERS_LABEL", group: "t22", label: "Подпись строки пользователей", example: "1 авторизованного пользователя Заказчика", removable: true },
  { tag: "T22_USERS_NET",   group: "t22", label: "Пользователи — без НДС", example: "4 000,00", removable: true },
  { tag: "T22_USERS_GROSS", group: "t22", label: "Пользователи — с НДС", example: "4 200,00", removable: true },
  { tag: "T22_USERS_VAT",   group: "t22", label: "Пользователи — сумма НДС", example: "200,00", removable: true },

  { tag: "T22_MEDIAPLAN_NET",   group: "t22", label: "Медиапланы — без НДС", example: "5 000,00", removable: true },
  { tag: "T22_MEDIAPLAN_GROSS", group: "t22", label: "Медиапланы — с НДС", example: "5 250,00", removable: true },
  { tag: "T22_MEDIAPLAN_VAT",   group: "t22", label: "Медиапланы — сумма НДС", example: "250,00", removable: true },

  { tag: "T23_OBJECT_NET",   group: "t23", label: "Доп. объект — без НДС", example: "15 000,00" },
  { tag: "T23_OBJECT_GROSS", group: "t23", label: "Доп. объект — с НДС", example: "15 750,00" },
  { tag: "T23_OBJECT_VAT",   group: "t23", label: "Доп. объект — сумма НДС", example: "750,00" },

  { tag: "T23_USER_NET",   group: "t23", label: "Доп. пользователь — без НДС", example: "4 000,00" },
  { tag: "T23_USER_GROSS", group: "t23", label: "Доп. пользователь — с НДС", example: "4 200,00" },
  { tag: "T23_USER_VAT",   group: "t23", label: "Доп. пользователь — сумма НДС", example: "200,00" },

  { tag: "T23_MEDIAPLAN_NET",   group: "t23", label: "Доп. медиаплан — без НДС", example: "5 000,00" },
  { tag: "T23_MEDIAPLAN_GROSS", group: "t23", label: "Доп. медиаплан — с НДС", example: "5 250,00" },
  { tag: "T23_MEDIAPLAN_VAT",   group: "t23", label: "Доп. медиаплан — сумма НДС", example: "250,00" },
];

export const SPEC_TAG_NAMES: ReadonlySet<string> = new Set(SPEC_TAGS.map((t) => t.tag));

/** Как метка выглядит в документе: {{MONTH_SUM}}. */
export function tagPlaceholder(tag: string): string {
  return `{{${tag}}}`;
}

/** Все метки, найденные в тексте — для валидации загружаемого шаблона. */
export function findTags(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)) found.add(m[1]);
  return [...found];
}
