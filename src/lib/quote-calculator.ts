import { z } from "zod";

// Конфиг калькулятора КП (Застройщик / Автодилер) → секции/строки документа.
// Чистый модуль без DB/"use server" — как quote-calc.ts, работает и в
// браузере (мгновенный предпросмотр на каждый чекбокс), и на сервере
// (server action пересобирает реальные QuoteSection/QuoteLine из того же
// вывода). Единственное место, где живёт ценовая логика калькулятора —
// сумма считается отдельно, в quote-calc.ts, из уже выведенных строк.

export type PostViewTierChoice = "NONE" | "UNDER_1M" | "OVER_1M";

export type BuilderCalculatorConfig = {
  clientType: "BUILDER";
  enterpriseLicense: boolean;
  customCrmIntegration: boolean;
  objectsCount: number;
  supportUsersCount: number;
  mediaPlanUpload: boolean;
  /** 0 — строка Post-View не добавляется. */
  postViewEventsCount: number;
  cdpSegments: boolean;
  antifraud: boolean;
  box: boolean;
};

export type AutoDealerCalculatorConfig = {
  clientType: "AUTO_DEALER";
  customCrmIntegration: boolean;
  objectsCount: number;
  supportUsersCount: number;
  mediaPlanUpload: boolean;
  postViewAvitoTier: PostViewTierChoice;
  postViewAutoRuTier: PostViewTierChoice;
  /** 0 — строка Post-View не добавляется. */
  postViewOtherEventsCount: number;
  mindbox: boolean;
  cdpSegments: boolean;
  box: boolean;
};

export type QuoteCalculatorConfig = BuilderCalculatorConfig | AutoDealerCalculatorConfig;

// ─────────────────────────────  Валидация  ─────────────────────────────

const countSchema = z.number().int().min(0).max(999_999_999);
const tierChoiceSchema = z.enum(["NONE", "UNDER_1M", "OVER_1M"]);

export const BuilderConfigSchema = z.object({
  clientType: z.literal("BUILDER"),
  enterpriseLicense: z.boolean(),
  customCrmIntegration: z.boolean(),
  objectsCount: countSchema,
  supportUsersCount: countSchema,
  mediaPlanUpload: z.boolean(),
  postViewEventsCount: countSchema,
  cdpSegments: z.boolean(),
  antifraud: z.boolean(),
  box: z.boolean(),
});

export const AutoDealerConfigSchema = z.object({
  clientType: z.literal("AUTO_DEALER"),
  customCrmIntegration: z.boolean(),
  objectsCount: countSchema,
  supportUsersCount: countSchema,
  mediaPlanUpload: z.boolean(),
  postViewAvitoTier: tierChoiceSchema,
  postViewAutoRuTier: tierChoiceSchema,
  postViewOtherEventsCount: countSchema,
  mindbox: z.boolean(),
  cdpSegments: z.boolean(),
  box: z.boolean(),
});

export const QuoteCalculatorConfigSchema = z.discriminatedUnion("clientType", [
  BuilderConfigSchema,
  AutoDealerConfigSchema,
]);

/** Postgres Json не проверяет форму — перед использованием значения из
 * Quote.calculatorConfig всегда гоняем через эту функцию. null и на входе
 * (clientType ещё не выбран), и на неожиданной форме (битые старые данные). */
export function parseCalculatorConfig(value: unknown): QuoteCalculatorConfig | null {
  const result = QuoteCalculatorConfigSchema.safeParse(value);
  return result.success ? result.data : null;
}

export const DEFAULT_BUILDER_CONFIG: BuilderCalculatorConfig = {
  clientType: "BUILDER",
  enterpriseLicense: false,
  customCrmIntegration: false,
  objectsCount: 0,
  supportUsersCount: 0,
  mediaPlanUpload: false,
  postViewEventsCount: 0,
  cdpSegments: false,
  antifraud: false,
  box: false,
};

export const DEFAULT_AUTO_DEALER_CONFIG: AutoDealerCalculatorConfig = {
  clientType: "AUTO_DEALER",
  customCrmIntegration: false,
  objectsCount: 0,
  supportUsersCount: 0,
  mediaPlanUpload: false,
  postViewAvitoTier: "NONE",
  postViewAutoRuTier: "NONE",
  postViewOtherEventsCount: 0,
  mindbox: false,
  cdpSegments: false,
  box: false,
};

// ─────────────────────────────  Post-View: цена по кол-ву событий  ─────────────────────────────
//
// Таблица диапазонов для полей, где продавец вводит именно количество
// событий (а не выбирает готовую цену, как у freeform-строк с
// autoStorageLimit — см. STORAGE_LIMIT_TIERS в quote-calc.ts, её не трогаем).
// Ценовые точки — подмножество той же тарифной сетки, поэтому
// storageEventsLimitLabel продолжает находить подпись лимита по цене как
// раньше; тариф в 150 000 этим полем просто никогда не выбирается.

/** 0 или меньше → строки нет. Иначе — плоская цена по диапазону. */
export function postViewTierPrice(events: number): number | null {
  if (events <= 0) return null;
  if (events <= 1_000_000) return 25_000;
  if (events <= 10_000_000) return 50_000;
  if (events <= 50_000_000) return 100_000;
  if (events <= 100_000_000) return 200_000;
  return 300_000;
}

// ─────────────────────────────  Вывод секций/строк документа  ─────────────────────────────

export type DerivedLine = {
  title: string;
  description: string | null;
  quantity: number;
  unitPrice: number | null;
  autoStorageLimit: boolean;
};

export type DerivedSection = {
  title: string;
  countsTowardImplementationPayment: boolean;
  lines: DerivedLine[];
};

export type DerivedQuoteDocument = {
  sections: DerivedSection[];
  boxIntegrationSelected: boolean;
};

const SA_SECTION_TITLE = "Сквозная аналитика Smartis";
const ADDONS_SECTION_TITLE = "Дополнительные решения";

const TECH_SUPPORT_DESCRIPTION =
  "Доступ к лицензии, персональный менеджер + Настройка, поддержка, интеграция";
const CRM_LINE_DESCRIPTION =
  "Выделение доп ресурса с нашей стороны на настройку и поддержание кастомного сервиса по передаче данных из вашей CRM к нам. Относится ко всем CRM кроме B24 и AMO";
const SUPPORT_USERS_DESCRIPTION =
  "Количество доступов, необходимых для ваших сотрудников. Например: доступ для маркетолога, руководителя, собственника";
const MEDIA_PLAN_UPLOAD_DESCRIPTION =
  "Оплачивается, если вы планируете загружать файлы план/факт в систему нашими силами, а не самостоятельно";
const POST_VIEW_EVENTS_DESCRIPTION =
  "Стоимость зависит от объёма показов медийной рекламы, которые будут поступать в виде событий в Smartis";

function line(
  title: string,
  unitPrice: number,
  opts: { description?: string | null; quantity?: number; autoStorageLimit?: boolean } = {},
): DerivedLine {
  return {
    title,
    description: opts.description ?? null,
    quantity: opts.quantity ?? 1,
    unitPrice,
    autoStorageLimit: opts.autoStorageLimit ?? false,
  };
}

function deriveBuilderDocument(config: BuilderCalculatorConfig): DerivedQuoteDocument {
  const saLines: DerivedLine[] = [
    line("Техническая поддержка ПО", config.enterpriseLicense ? 120_000 : 90_000, {
      description: TECH_SUPPORT_DESCRIPTION,
    }),
  ];

  if (config.customCrmIntegration) {
    saLines.push(
      line("Поток CRM данных нестандартного источника", 50_000, {
        description: CRM_LINE_DESCRIPTION,
      }),
    );
  }

  saLines.push(
    line("Количество объектов", config.enterpriseLicense ? 15_000 : 12_000, {
      description: "Количество объектов, подключаемых к нам",
      quantity: config.objectsCount,
    }),
  );

  saLines.push(
    line("Пользователи технической поддержки", config.enterpriseLicense ? 4_000 : 3_500, {
      description: SUPPORT_USERS_DESCRIPTION,
      quantity: config.supportUsersCount,
    }),
  );

  if (config.mediaPlanUpload) {
    saLines.push(
      line("Загрузка медиапланов", config.enterpriseLicense ? 5_000 : 4_500, {
        description: MEDIA_PLAN_UPLOAD_DESCRIPTION,
        quantity: config.objectsCount,
      }),
    );
  }

  if (config.box) {
    saLines.push(line("Поддержка продукта в контуре клиента", 50_000));
  }

  const addonLines: DerivedLine[] = [];

  const postViewPrice = postViewTierPrice(config.postViewEventsCount);
  if (postViewPrice !== null) {
    addonLines.push(
      line("Post-View аналитика медийной рекламы", postViewPrice, {
        description: POST_VIEW_EVENTS_DESCRIPTION,
        autoStorageLimit: true,
      }),
    );
  }

  if (config.cdpSegments) {
    addonLines.push(line("CDP Конструктор сегментов", 60_000));
  }

  if (config.antifraud) {
    addonLines.push(line("Антифрод", 36_000));
  }

  const sections: DerivedSection[] = [
    { title: SA_SECTION_TITLE, countsTowardImplementationPayment: true, lines: saLines },
  ];
  if (addonLines.length > 0) {
    sections.push({
      title: ADDONS_SECTION_TITLE,
      countsTowardImplementationPayment: false,
      lines: addonLines,
    });
  }

  return { sections, boxIntegrationSelected: config.box };
}

function deriveAutoDealerDocument(config: AutoDealerCalculatorConfig): DerivedQuoteDocument {
  const saLines: DerivedLine[] = [
    line("Техническая поддержка ПО", 90_000, { description: TECH_SUPPORT_DESCRIPTION }),
  ];

  if (config.customCrmIntegration) {
    saLines.push(
      line("Поток CRM данных нестандартного источника", 50_000, {
        description: CRM_LINE_DESCRIPTION,
      }),
    );
  }

  saLines.push(
    line("Количество объектов (ДЦ)", 6_000, {
      description: "Количество единиц медиапланирования, подключаемых к нам",
      quantity: config.objectsCount,
    }),
  );

  saLines.push(
    line("Пользователи технической поддержки", 4_000, {
      description: SUPPORT_USERS_DESCRIPTION,
      quantity: config.supportUsersCount,
    }),
  );

  if (config.mediaPlanUpload) {
    saLines.push(
      line("Загрузка медиапланов", 3_500, {
        description: MEDIA_PLAN_UPLOAD_DESCRIPTION,
        quantity: config.objectsCount,
      }),
    );
  }

  if (config.box) {
    saLines.push(line("Поддержка продукта в контуре клиента", 50_000));
  }

  const addonLines: DerivedLine[] = [];

  if (config.postViewAvitoTier !== "NONE") {
    addonLines.push(
      line("Post-View Авито классифайд", config.postViewAvitoTier === "OVER_1M" ? 50_000 : 25_000),
    );
  }

  if (config.postViewAutoRuTier !== "NONE") {
    addonLines.push(
      line(
        "Post-View Авто.ру классифайд",
        config.postViewAutoRuTier === "OVER_1M" ? 50_000 : 25_000,
      ),
    );
  }

  const postViewOtherPrice = postViewTierPrice(config.postViewOtherEventsCount);
  if (postViewOtherPrice !== null) {
    addonLines.push(
      line("Post-View аналитика другой медийной рекламы", postViewOtherPrice, {
        description: POST_VIEW_EVENTS_DESCRIPTION,
        autoStorageLimit: true,
      }),
    );
  }

  if (config.mindbox) {
    addonLines.push(line("Mindbox интеграция", 50_000));
  }

  if (config.cdpSegments) {
    addonLines.push(line("CDP Конструктор сегментов", 60_000));
  }

  const sections: DerivedSection[] = [
    { title: SA_SECTION_TITLE, countsTowardImplementationPayment: true, lines: saLines },
  ];
  if (addonLines.length > 0) {
    sections.push({
      title: ADDONS_SECTION_TITLE,
      countsTowardImplementationPayment: false,
      lines: addonLines,
    });
  }

  return { sections, boxIntegrationSelected: config.box };
}

export function deriveQuoteDocument(config: QuoteCalculatorConfig): DerivedQuoteDocument {
  return config.clientType === "BUILDER"
    ? deriveBuilderDocument(config)
    : deriveAutoDealerDocument(config);
}
