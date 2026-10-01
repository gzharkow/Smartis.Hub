"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { canAccessSection, hasEdit } from "@/lib/permissions";
import { db } from "@/lib/db";
import { logSecurityEvent } from "@/lib/security-log";

// Каждое действие проверяет вход и владение само — как в actions/hubs.ts:
// Server Actions вызываются прямым POST-запросом, а не только из нашей формы.

// Экспортируется — переиспользуется в actions/quote-calculator.ts, тот же
// auth-инвариант (org + owner/admin, "не найден" вместо "нет доступа").
export async function ownedQuote(quoteId: string) {
  const user = await requireUser();
  if (!canAccessSection(user, "calculator") || !hasEdit(user, "calculator")) {
    throw new Error("Недостаточно прав.");
  }

  const quote = await db.quote.findUnique({ where: { id: quoteId } });

  // «Не найден», а не «нет доступа» — иначе перебором id можно было бы
  // выяснять, какие КП существуют в чужих организациях.
  if (!quote || quote.organizationId !== user.organizationId) {
    throw new Error("КП не найден.");
  }
  if (user.role !== "ADMIN" && quote.ownerId !== user.id) {
    throw new Error("КП не найден.");
  }
  return { user, quote };
}

async function ownedSection(sectionId: string) {
  const section = await db.quoteSection.findUnique({ where: { id: sectionId } });
  if (!section) throw new Error("Секция не найдена.");
  const { user, quote } = await ownedQuote(section.quoteId);
  return { user, quote, section };
}

async function ownedLine(lineId: string) {
  const line = await db.quoteLine.findUnique({ where: { id: lineId } });
  if (!line) throw new Error("Строка не найдена.");
  const { user, quote, section } = await ownedSection(line.sectionId);
  return { user, quote, section, line };
}

function revalidateQuote(quoteId: string) {
  revalidatePath("/calculator");
  revalidatePath(`/calculator/${quoteId}`);
}

// ─────────────────────────────  Создание, шапка  ─────────────────────────────

const CreateSchema = z.object({
  clientName: z
    .string()
    .trim()
    .min(1, { error: "Введите название клиента." })
    .max(160),
});

export type CreateQuoteState = { error: string } | undefined;

// Новый КП сразу заполняется секциями и строками из образца — привычная
// отправная точка «как в таблице», дальше продавец правит всё свободно.
// Цены — из образца PDF (Smaris КП от 30.07.2026).
const DEFAULT_TEMPLATE = [
  {
    title: "Сквозная аналитика Smartis",
    countsTowardImplementationPayment: true,
    lines: [
      {
        title: "Техническая поддержка ПО",
        description: "Доступ к лицензии, персональный менеджер + Настройка, поддержка, интеграция",
        quantity: 1,
        unitPrice: 90000,
        autoStorageLimit: false,
      },
      {
        title: "Поток CRM данных нестандартного источника",
        description:
          "Выделение доп ресурса с нашей стороны на настройку и поддержание кастомного сервиса по передаче данных из вашей CRM к нам. Относится ко всем CRM кроме B24 и AMO",
        quantity: 1,
        unitPrice: 50000,
        autoStorageLimit: false,
      },
      {
        title: "Количество объектов",
        description: "Количество единиц медиапланирования, подключаемых к нам",
        quantity: 1,
        unitPrice: 6000,
        autoStorageLimit: false,
      },
      {
        title: "Пользователи технической поддержки",
        description:
          "Количество доступов, необходимых для ваших сотрудников. Например: доступ для маркетолога, руководителя, собственника",
        quantity: 1,
        unitPrice: 4000,
        autoStorageLimit: false,
      },
      {
        title: "Загрузка медиапланов",
        description:
          "Оплачивается, если вы планируете загружать файлы план/факт в систему нашими силами, а не самостоятельно",
        quantity: 0,
        unitPrice: 3500,
        autoStorageLimit: false,
      },
    ],
  },
  {
    title: "Post-view аналитика",
    countsTowardImplementationPayment: false,
    lines: [
      {
        title: "Лицензия за интеграцию с Auto.ru",
        description: "Стоимость указана за интеграцию всего холдинга",
        quantity: 0,
        unitPrice: 50000,
        autoStorageLimit: false,
      },
      {
        title: "Лицензия за интеграцию с Avito-Auto",
        description: "Стоимость указана за интеграцию всего холдинга",
        quantity: 0,
        unitPrice: 50000,
        autoStorageLimit: false,
      },
      {
        title: "Лицензия за интеграцию с Mindbox",
        description: null,
        quantity: 0,
        unitPrice: 50000,
        autoStorageLimit: false,
      },
      {
        // Раньше это были две строки: цена + отдельная информационная
        // «Post-View лимит хранимых событий, шт» рядом. Объединены —
        // лимит теперь выводится из unitPrice по тарифу, см.
        // storageEventsLimitLabel в src/lib/quote-calc.ts.
        title: "Post-View другой медийной рекламы",
        description:
          "Стоимость зависит от объёма показов медийной рекламы, которые будут поступать в виде событий в Smartis",
        quantity: 0,
        unitPrice: 25000,
        autoStorageLimit: true,
      },
    ],
  },
] as const;

export async function createQuote(
  _prev: CreateQuoteState,
  formData: FormData,
): Promise<CreateQuoteState> {
  const user = await requireUser();
  if (!canAccessSection(user, "calculator") || !hasEdit(user, "calculator")) {
    return { error: "Недостаточно прав." };
  }

  const parsed = CreateSchema.safeParse({ clientName: formData.get("clientName") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте название." };
  }

  const quote = await db.$transaction(async (tx) => {
    const created = await tx.quote.create({
      data: {
        organizationId: user.organizationId,
        ownerId: user.id,
        clientName: parsed.data.clientName,
      },
    });

    for (const [sectionIndex, section] of DEFAULT_TEMPLATE.entries()) {
      await tx.quoteSection.create({
        data: {
          quoteId: created.id,
          title: section.title,
          position: sectionIndex,
          countsTowardImplementationPayment: section.countsTowardImplementationPayment,
          lines: {
            create: section.lines.map((line, lineIndex) => ({
              title: line.title,
              description: line.description,
              position: lineIndex,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              autoStorageLimit: line.autoStorageLimit,
            })),
          },
        },
      });
    }

    return created;
  });

  revalidatePath("/calculator");
  redirect(`/calculator/${quote.id}`);
}

const UpdateMetaSchema = z.object({
  clientName: z
    .string()
    .trim()
    .min(1, { error: "Введите название клиента." })
    .max(160),
  vatRatePct: z.coerce
    .number()
    .min(0, { error: "Ставка не может быть отрицательной." })
    .max(100, { error: "Ставка не может быть больше 100%." }),
  // input type="date" отдаёт "YYYY-MM-DD" — коэрсим в Date; невалидную
  // строку (пустое поле, битый формат) ловим явно, а не отдаём в БД как есть.
  documentDate: z.coerce.date({ error: "Проверьте дату." }),
});

export type UpdateQuoteMetaState = { error?: string; saved?: boolean } | undefined;

export async function updateQuoteMeta(
  _prev: UpdateQuoteMetaState,
  formData: FormData,
): Promise<UpdateQuoteMetaState> {
  const quoteId = String(formData.get("quoteId") ?? "");
  const { quote } = await ownedQuote(quoteId);

  const parsed = UpdateMetaSchema.safeParse({
    clientName: formData.get("clientName"),
    vatRatePct: formData.get("vatRatePct"),
    documentDate: formData.get("documentDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля." };
  }

  await db.quote.update({
    where: { id: quote.id },
    data: {
      clientName: parsed.data.clientName,
      vatRatePct: parsed.data.vatRatePct,
      documentDate: parsed.data.documentDate,
    },
  });

  revalidateQuote(quote.id);
  return { saved: true };
}

// ─────────────────────────────  Секции  ─────────────────────────────

export async function addQuoteSection(quoteId: string) {
  const { quote } = await ownedQuote(quoteId);

  const last = await db.quoteSection.findFirst({
    where: { quoteId: quote.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await db.quoteSection.create({
    data: {
      quoteId: quote.id,
      title: "Новая секция",
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidateQuote(quote.id);
}

const SectionTitleSchema = z.string().trim().max(120);

export async function renameQuoteSection(sectionId: string, title: string) {
  const { quote, section } = await ownedSection(sectionId);

  const parsed = SectionTitleSchema.safeParse(title);
  if (!parsed.success) throw new Error("Проверьте название секции.");

  await db.quoteSection.update({
    where: { id: section.id },
    data: { title: parsed.data },
  });

  revalidateQuote(quote.id);
}

/**
 * Не больше одной секции в рамках КП даёт скидку на период внедрения —
 * ноль тоже допустимое состояние (платёж на внедрение тогда просто 0).
 * Включает флаг здесь, гасит у остальных секций этого же КП, одной
 * транзакцией.
 */
export async function setImplementationSection(quoteId: string, sectionId: string) {
  const { quote } = await ownedQuote(quoteId);

  const section = await db.quoteSection.findUnique({ where: { id: sectionId } });
  if (!section || section.quoteId !== quote.id) {
    throw new Error("Секция не найдена.");
  }

  await db.$transaction([
    db.quoteSection.updateMany({
      where: { quoteId: quote.id, id: { not: sectionId } },
      data: { countsTowardImplementationPayment: false },
    }),
    db.quoteSection.update({
      where: { id: sectionId },
      data: { countsTowardImplementationPayment: true },
    }),
  ]);

  revalidateQuote(quote.id);
}

/** Снять флаг совсем — платёж на период внедрения станет нулевым у всех секций. */
export async function clearImplementationSection(quoteId: string) {
  const { quote } = await ownedQuote(quoteId);

  await db.quoteSection.updateMany({
    where: { quoteId: quote.id },
    data: { countsTowardImplementationPayment: false },
  });

  revalidateQuote(quote.id);
}

export async function removeQuoteSection(sectionId: string) {
  const { quote, section } = await ownedSection(sectionId);

  await db.$transaction(async (tx) => {
    await tx.quoteSection.delete({ where: { id: section.id } });

    // Удалили секцию, дававшую скидку на внедрение, — переносим флаг на
    // первую оставшуюся секцию, иначе платёж на период внедрения молча
    // обнулится без объяснений.
    if (section.countsTowardImplementationPayment) {
      const next = await tx.quoteSection.findFirst({
        where: { quoteId: quote.id },
        orderBy: { position: "asc" },
      });
      if (next) {
        await tx.quoteSection.update({
          where: { id: next.id },
          data: { countsTowardImplementationPayment: true },
        });
      }
    }
  });

  revalidateQuote(quote.id);
}

export async function reorderQuoteSections(quoteId: string, orderedSectionIds: string[]) {
  const { quote } = await ownedQuote(quoteId);

  const sections = await db.quoteSection.findMany({ where: { quoteId: quote.id } });
  const ids = new Set(sections.map((s) => s.id));
  if (orderedSectionIds.length !== sections.length || !orderedSectionIds.every((id) => ids.has(id))) {
    throw new Error("Список секций рассинхронизирован — обновите страницу.");
  }

  await db.$transaction(
    orderedSectionIds.map((id, position) =>
      db.quoteSection.update({ where: { id }, data: { position } }),
    ),
  );

  revalidateQuote(quote.id);
}

// ─────────────────────────────  Строки  ─────────────────────────────

export async function addQuoteLine(sectionId: string) {
  const { quote, section } = await ownedSection(sectionId);

  const last = await db.quoteLine.findFirst({
    where: { sectionId: section.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await db.quoteLine.create({
    data: {
      sectionId: section.id,
      title: "Новая строка",
      quantity: 1,
      unitPrice: 0,
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidateQuote(quote.id);
}

const LinePatchSchema = z.object({
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  quantity: z.number().finite().min(0).max(999_999_999).optional(),
  // null — строка становится информационной (без цены и без вклада в сумму).
  unitPrice: z.number().finite().min(0).max(999_999_999).nullable().optional(),
});

export type LinePatch = z.infer<typeof LinePatchSchema>;

export async function updateQuoteLine(lineId: string, patch: LinePatch) {
  const { quote, line } = await ownedLine(lineId);

  const parsed = LinePatchSchema.safeParse(patch);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Проверьте значения строки.");
  }

  await db.quoteLine.update({ where: { id: line.id }, data: parsed.data });

  revalidateQuote(quote.id);
}

export async function removeQuoteLine(lineId: string) {
  const { quote, line } = await ownedLine(lineId);

  await db.quoteLine.delete({ where: { id: line.id } });

  revalidateQuote(quote.id);
}

export async function reorderQuoteLines(sectionId: string, orderedLineIds: string[]) {
  const { quote, section } = await ownedSection(sectionId);

  const lines = await db.quoteLine.findMany({ where: { sectionId: section.id } });
  const ids = new Set(lines.map((l) => l.id));
  if (orderedLineIds.length !== lines.length || !orderedLineIds.every((id) => ids.has(id))) {
    throw new Error("Список строк рассинхронизирован — обновите страницу.");
  }

  await db.$transaction(
    orderedLineIds.map((id, position) =>
      db.quoteLine.update({ where: { id }, data: { position } }),
    ),
  );

  revalidateQuote(quote.id);
}

// ─────────────────────────────  Список, копия, удаление  ─────────────────────────────

/** «ГК ИНСИТИ» → «ГК ИНСИТИ — копия», а если такая уже есть → «— копия 2». */
async function freeCopyName(organizationId: string, sourceName: string): Promise<string> {
  const base = `${sourceName} — копия`;

  const taken = new Set(
    (
      await db.quote.findMany({
        where: { organizationId, clientName: { startsWith: base } },
        select: { clientName: true },
      })
    ).map((q) => q.clientName),
  );

  if (!taken.has(base)) return base;

  let n = 2;
  while (taken.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

/**
 * Копия КП целиком — секции, строки, флаг скидки на внедрение. Удобно
 * начать следующий расчёт с уже готового, а не с чистого шаблона.
 */
export async function duplicateQuote(quoteId: string) {
  const { user, quote } = await ownedQuote(quoteId);

  const sections = await db.quoteSection.findMany({
    where: { quoteId: quote.id },
    orderBy: { position: "asc" },
    include: { lines: { orderBy: { position: "asc" } } },
  });

  const clientName = await freeCopyName(user.organizationId, quote.clientName);

  const copy = await db.$transaction(async (tx) => {
    const created = await tx.quote.create({
      data: {
        organizationId: user.organizationId,
        ownerId: user.id,
        clientName,
        vatRatePct: quote.vatRatePct,
      },
    });

    for (const section of sections) {
      await tx.quoteSection.create({
        data: {
          quoteId: created.id,
          title: section.title,
          position: section.position,
          countsTowardImplementationPayment: section.countsTowardImplementationPayment,
          lines: {
            create: section.lines.map((line) => ({
              title: line.title,
              description: line.description,
              position: line.position,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              autoStorageLimit: line.autoStorageLimit,
            })),
          },
        },
      });
    }

    return created;
  });

  revalidatePath("/calculator");
  redirect(`/calculator/${copy.id}`);
}

/**
 * Удаление КП — настоящее, без корзины. Секции и строки уходят вместе с ним
 * (Cascade), а уже выпущенные PDF/Спецификации (Asset.quoteId) переживают
 * удаление — SetNull, потому что снимок расчёта не должен исчезать вместе с
 * оригиналом. Такой файл при этом пропадает из «Файлы»/«Спецификации» (обе
 * страницы фильтруют quoteId: { not: null }), но остаётся видимым в хабе,
 * если уже был туда добавлен — HubItem это не трогает.
 */
export async function purgeQuote(quoteId: string) {
  const { user, quote } = await ownedQuote(quoteId);

  await db.quote.delete({ where: { id: quote.id } });

  await logSecurityEvent({
    type: "ITEM_PURGED",
    actor: { id: user.id, email: user.email, organizationId: user.organizationId },
    target: { id: quote.id, label: quote.clientName },
    details: { kind: "КП" },
  });

  revalidatePath("/calculator");
  revalidatePath("/calculator/files");
  revalidatePath("/calculator/spec");
}
