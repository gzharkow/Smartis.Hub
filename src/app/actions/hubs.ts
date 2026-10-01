"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PDFDocument } from "pdf-lib";
import { requireUser } from "@/lib/auth";
import { canAccessSection, hasEdit } from "@/lib/permissions";
import { db } from "@/lib/db";
import { isEmptyHtml, sanitizeHtml } from "@/lib/sanitize";
import { storage, storageKeys } from "@/lib/storage";
import { renderQuotePdf } from "@/lib/quote-pdf";
import { newShareToken } from "@/lib/tokens";
import {
  CONTACT_KIND_LABELS,
  ContactMethodsSchema,
  type ContactMethod,
} from "@/lib/contact-methods";

// Каждое действие проверяет вход и владение само. Server Actions доступны
// прямым POST-запросом, а не только из нашей формы, — на proxy и на то,
// что кнопка не показана, полагаться нельзя.

async function ownedHub(hubId: string) {
  const user = await requireUser();

  // Единая точка входа для всех мутирующих действий над хабом — проверка
  // прав на раздел «Хабы» достаточно поставить здесь один раз.
  if (!canAccessSection(user, "hubs")) {
    throw new Error("Недостаточно прав.");
  }
  if (!hasEdit(user, "hubs")) {
    throw new Error("Недостаточно прав.");
  }

  const hub = await db.hub.findUnique({ where: { id: hubId } });

  // Не «нет доступа», а «не найдено»: разные ответы позволили бы перебором
  // выяснять, какие хабы существуют в чужих организациях.
  if (!hub || hub.organizationId !== user.organizationId) {
    throw new Error("Хаб не найден.");
  }
  if (user.role !== "ADMIN" && hub.ownerId !== user.id) {
    throw new Error("Хаб не найден.");
  }
  return { user, hub };
}

const CreateSchema = z.object({
  title: z.string().trim().min(1, { error: "Введите название." }).max(120),
});

export type CreateHubState = { error: string } | undefined;

export async function createHub(
  _prev: CreateHubState,
  formData: FormData,
): Promise<CreateHubState> {
  const user = await requireUser();
  if (!canAccessSection(user, "hubs") || !hasEdit(user, "hubs")) {
    return { error: "Недостаточно прав." };
  }

  const parsed = CreateSchema.safeParse({ title: formData.get("title") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте название." };
  }

  // Приветствие сюда НЕ кладём: оно живёт на ссылке, потому что адресовано
  // конкретной компании, а хаб может уйти нескольким. Описание — только
  // про содержимое подборки, иначе приветствие напечатается дважды.
  const hub = await db.hub.create({
    data: {
      organizationId: user.organizationId,
      ownerId: user.id,
      title: parsed.data.title,
      headline: `Материалы для «${parsed.data.title}»`,
    },
  });

  // Постоянная ссылка для внутреннего пользования — вставить в CRM (АМО),
  // не выдать клиенту. trackingEnabled: false — заходы по ней не должны
  // выглядеть как интерес клиента, см. v/[token]/track/route.ts.
  await db.shareLink.create({
    data: {
      hubId: hub.id,
      createdById: user.id,
      token: newShareToken(),
      recipientCompany: "Для АМО",
      trackingEnabled: false,
    },
  });

  revalidatePath("/hubs");
  redirect(`/hubs/${hub.id}`);
}

const UpdateSchema = z.object({
  title: z.string().trim().min(1, { error: "Введите название." }).max(120),
  headline: z.string().trim().max(160),
  descriptionHtml: z.string().max(50_000),
  ctaLabel: z.string().trim().max(40),
  ctaEnabled: z.boolean(),
  // Пустая строка = кнопки демо нет. Иначе адрес обязан быть настоящим:
  // кнопка уводит клиента наружу, и «сайт.ру» без схемы браузер не откроет.
  demoUrl: z.union([z.literal(""), z.url({ error: "Адрес демо должен начинаться с https://" })]),
  demoLabel: z.string().trim().max(40),
  demoNote: z.string().trim().max(600),
});

export type UpdateHubState = { error?: string; saved?: boolean } | undefined;

// Черновые строки (добавили контакт, но ещё не заполнили) не должны валить
// сохранение остальной формы — молча отбрасываем те, где пусто значение,
// и подставляем подпись по умолчанию, если её не ввели.
function cleanContactMethods(raw: string): ContactMethod[] | null {
  let draft: unknown;
  try {
    draft = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(draft)) return null;

  const filled = draft
    .filter(
      (c): c is { kind: string; label: string; value: string } =>
        typeof c === "object" && c !== null && String(c.value ?? "").trim().length > 0,
    )
    .map((c) => ({
      kind: c.kind,
      label: c.label.trim() || CONTACT_KIND_LABELS[c.kind as keyof typeof CONTACT_KIND_LABELS] || c.kind,
      value: c.value.trim(),
    }));

  const result = ContactMethodsSchema.safeParse(filled);
  return result.success ? result.data : null;
}

export async function updateHub(
  _prev: UpdateHubState,
  formData: FormData,
): Promise<UpdateHubState> {
  const hubId = String(formData.get("hubId") ?? "");
  const { user, hub } = await ownedHub(hubId);

  const parsed = UpdateSchema.safeParse({
    title: formData.get("title"),
    headline: formData.get("headline"),
    descriptionHtml: formData.get("descriptionHtml") ?? "",
    ctaLabel: formData.get("ctaLabel"),
    ctaEnabled: formData.get("ctaEnabled") === "on",
    demoUrl: formData.get("demoUrl") ?? "",
    demoLabel: formData.get("demoLabel") ?? "",
    demoNote: formData.get("demoNote") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля." };
  }

  const contactMethods = cleanContactMethods(
    String(formData.get("contactMethods") ?? "[]"),
  );
  if (contactMethods === null) {
    return { error: "Проверьте контакты — что-то в них не так." };
  }
  const saveAsTemplate = formData.get("saveAsTemplate") === "on";

  // Чистим ЗДЕСЬ, а не только в редакторе: до этой строки данные шли
  // из браузера, а ему верить нельзя — запрос можно послать и мимо формы.
  const clean = sanitizeHtml(parsed.data.descriptionHtml);

  // Контакты — собственность ЭТОГО хаба (раньше жили на организации и были
  // общими на все хабы, включая чужие аккаунты — см. миграцию
  // add_hub_contact_methods_and_asset_kinds). Шаблон — отдельно, на аккаунте,
  // и пишется только если явно попросили галочкой «Сохранить как шаблон».
  await Promise.all([
    db.hub.update({
      where: { id: hub.id },
      data: {
        title: parsed.data.title,
        headline: parsed.data.headline || null,
        descriptionHtml: isEmptyHtml(clean) ? null : clean,
        ctaLabel: parsed.data.ctaLabel || "Задать вопрос",
        ctaEnabled: parsed.data.ctaEnabled,
        demoUrl: parsed.data.demoUrl || null,
        demoLabel: parsed.data.demoLabel || "Демо-кабинет",
        demoNote: parsed.data.demoNote || null,
        contactMethods,
      },
    }),
    saveAsTemplate
      ? db.user.update({
          where: { id: user.id },
          data: { contactMethodsTemplate: contactMethods },
        })
      : Promise.resolve(),
  ]);

  // /v/[token] сам всегда динамический (force-dynamic) — свежие контакты
  // подхватит без дополнительной ревалидации.
  revalidatePath(`/hubs/${hub.id}`);
  revalidatePath("/hubs");
  return { saved: true };
}

/** «ГК ИНСИТИ» → «ГК ИНСИТИ — копия», а если такая уже есть → «— копия 2». */
async function freeCopyTitle(
  organizationId: string,
  sourceTitle: string,
): Promise<string> {
  const base = `${sourceTitle} — копия`;

  const taken = new Set(
    (
      await db.hub.findMany({
        where: { organizationId, title: { startsWith: base } },
        select: { title: true },
      })
    ).map((h) => h.title),
  );

  if (!taken.has(base)) return base;

  let n = 2;
  while (taken.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

/**
 * Копия хаба. Заменяет собой шаблоны: любой удачный хаб можно объявить
 * образцом и копировать под нового клиента.
 *
 * Что копируется: оформление, описание, кнопки, состав материалов вместе
 * с их порядком и переименованиями.
 *
 * Что НЕ копируется:
 *   - Ссылки для клиентов. Ссылка выдана конкретной компании; размножать её
 *     нельзя ни в коем случае — чужой клиент попал бы в новый хаб.
 *   - Статистика. Она про то, что происходило в исходном хабе.
 *   - Состояние «опубликован»: копия всегда черновик. В заголовке остаётся
 *     имя прежнего клиента, и публиковать её можно только осознанно.
 *
 * Материалы копируются ССЫЛКАМИ на те же Asset — файлы не дублируются,
 * и правка материала в библиотеке видна во всех хабах сразу.
 */
export async function duplicateHub(hubId: string) {
  const { user, hub } = await ownedHub(hubId);

  const [sections, items] = await Promise.all([
    db.hubSection.findMany({
      where: { hubId: hub.id },
      orderBy: { position: "asc" },
    }),
    db.hubItem.findMany({
      where: { hubId: hub.id },
      orderBy: { position: "asc" },
    }),
  ]);

  const title = await freeCopyTitle(user.organizationId, hub.title);

  // Транзакция: хаб без своих материалов — это не «почти скопировалось»,
  // а пустышка, которую пришлось бы собирать заново. Либо всё, либо ничего.
  const copy = await db.$transaction(async (tx) => {
    const created = await tx.hub.create({
      data: {
        organizationId: user.organizationId,
        // Владелец — тот, кто копирует, а не автор исходного хаба.
        ownerId: user.id,
        title,
        headline: hub.headline,
        descriptionHtml: hub.descriptionHtml,
        status: "DRAFT",
        logoUrl: hub.logoUrl,
        brandColor: hub.brandColor,
        coverImageKey: hub.coverImageKey,
        ctaLabel: hub.ctaLabel,
        ctaEnabled: hub.ctaEnabled,
        demoUrl: hub.demoUrl,
        demoLabel: hub.demoLabel,
        demoNote: hub.demoNote,
        // Контакты кнопки «Задать вопрос» — тоже собственность хаба,
        // копируем вместе с остальным оформлением.
        contactMethods: hub.contactMethods ?? [],
      },
    });

    // Копия — тоже «создаваемый хаб»: своя ссылка «Для АМО», не унаследованная
    // от оригинала (ссылки клиентов и так не копируются, см. выше — эта
    // не клиентская, но по той же причине должна быть у копии своя).
    await tx.shareLink.create({
      data: {
        hubId: created.id,
        createdById: user.id,
        token: newShareToken(),
        recipientCompany: "Для АМО",
        trackingEnabled: false,
      },
    });

    // Разделы витрины получают новые id, поэтому материалам нужно раздать
    // именно их. Иначе материал копии ссылался бы на раздел ЧУЖОГО хаба.
    const sectionIds = new Map<string, string>();
    for (const section of sections) {
      const made = await tx.hubSection.create({
        data: {
          hubId: created.id,
          title: section.title,
          subtitle: section.subtitle,
          position: section.position,
        },
      });
      sectionIds.set(section.id, made.id);
    }

    if (items.length > 0) {
      await tx.hubItem.createMany({
        data: items.map((item) => ({
          hubId: created.id,
          sectionId: item.sectionId ? (sectionIds.get(item.sectionId) ?? null) : null,
          assetId: item.assetId,
          position: item.position,
          titleOverride: item.titleOverride,
          descriptionOverride: item.descriptionOverride,
          featured: item.featured,
        })),
      });
    }

    return created;
  });

  revalidatePath("/hubs");
  // redirect бросает исключение — поэтому только после транзакции.
  redirect(`/hubs/${copy.id}`);
}

export async function addItemToHub(hubId: string, assetId: string) {
  const { user, hub } = await ownedHub(hubId);

  // Материал должен быть из той же организации — иначе через подставленный
  // id можно было бы утащить чужой файл в свой хаб.
  const asset = await db.asset.findUnique({ where: { id: assetId } });
  if (!asset || asset.organizationId !== user.organizationId) {
    throw new Error("Материал не найден.");
  }
  // КП PDF и Спецификации (quoteId заполнен) добавляются в хаб только
  // через addQuotePdfToHub — этот action для них недостижим и через
  // текущий UI (поиск/frequentlyUsed их не отдают), но проверка здесь же
  // дешева и не даёт этому свойству стать случайной дырой при будущей
  // правке UI.
  if (asset.quoteId !== null) {
    throw new Error("Этот материал нельзя добавить в хаб напрямую.");
  }
  // Личный материал («Мои материалы») — критично проверить здесь, а не
  // только скрыть в UI: без серверной проверки чужой/неподтверждённый
  // личный материал можно было бы добавить в хаб прямым вызовом этого
  // действия с угаданным assetId. ADMIN — исключение (см.
  // canManagePersonalAsset в permissions.ts), у него доступ ко всем
  // личным библиотекам, но и его материал должен быть подтверждён.
  if (asset.ownerId !== null) {
    if (asset.ownerId !== user.id && user.role !== "ADMIN") {
      throw new Error("Этот материал недоступен для добавления в хаб.");
    }
    if (asset.validatedAt === null) {
      throw new Error("Материал ещё не подтверждён как проверенный.");
    }
  }

  const last = await db.hubItem.findFirst({
    where: { hubId: hub.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await db.hubItem.create({
    data: {
      hubId: hub.id,
      assetId: asset.id,
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidatePath(`/hubs/${hub.id}`);
}

/**
 * Добавляет в хаб PDF расчёта из калькулятора — не как отдельный тип
 * материала, а как обычный Asset(kind=PDF), тем же путём, что и загруженный
 * файл. Снимок на момент нажатия, а не живая ссылка на КП: PDF в хабе
 * должен остаться тем же, что реально видел клиент, даже если расчёт потом
 * поправят — в отличие от материалов библиотеки, которые в хабе живые.
 */
export async function addQuotePdfToHub(hubId: string, quoteId: string) {
  const { user, hub } = await ownedHub(hubId);

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: {
      sections: {
        orderBy: { position: "asc" },
        include: { lines: { orderBy: { position: "asc" } } },
      },
    },
  });
  if (!quote || quote.organizationId !== user.organizationId) {
    throw new Error("Расчёт не найден.");
  }
  if (user.role !== "ADMIN" && quote.ownerId !== user.id) {
    throw new Error("Расчёт не найден.");
  }

  const pdfBytes = await renderQuotePdf({
    clientName: quote.clientName,
    vatRatePct: quote.vatRatePct.toString(),
    documentDate: quote.documentDate.toISOString().slice(0, 10),
    sections: quote.sections.map((section) => ({
      id: section.id,
      title: section.title,
      countsTowardImplementationPayment: section.countsTowardImplementationPayment,
      lines: section.lines.map((line) => ({
        id: line.id,
        title: line.title,
        description: line.description,
        quantity: line.quantity.toString(),
        unitPrice: line.unitPrice?.toString() ?? null,
        autoStorageLimit: line.autoStorageLimit,
      })),
    })),
    boxIntegrationSelected: quote.boxIntegrationSelected,
  });
  const buffer = Buffer.from(pdfBytes);
  const pageCount = (await PDFDocument.load(pdfBytes)).getPageCount();

  // quoteId — признак того, что материал сгенерирован калькулятором, а не
  // загружен вручную: по нему такой Asset прячется из «Материалы» и
  // показывается в «Генератор КП → Файлы» (см. asset-sections.ts не
  // затронут — раздел там про направление продаж, а не про источник файла).
  // «КП —» в заголовке оставляем для узнаваемости там, где виден title
  // (например, «В хабе» на странице конкретного хаба).
  const asset = await db.asset.create({
    data: {
      organizationId: user.organizationId,
      kind: "PDF",
      section: "COMMON",
      title: `КП — ${quote.clientName}`,
      mimeType: "application/pdf",
      sizeBytes: buffer.length,
      pageCount,
      quoteId: quote.id,
    },
  });

  const key = storageKeys.original(user.organizationId, asset.id, ".pdf");
  try {
    await storage.put(key, buffer, "application/pdf");
  } catch (e) {
    // Файл не лёг — не оставляем в библиотеке запись без файла.
    await db.asset.delete({ where: { id: asset.id } });
    throw e;
  }
  await db.asset.update({ where: { id: asset.id }, data: { storageKey: key } });

  const last = await db.hubItem.findFirst({
    where: { hubId: hub.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await db.hubItem.create({
    data: {
      hubId: hub.id,
      assetId: asset.id,
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidatePath(`/hubs/${hub.id}`);

  // Превью PDF рисует браузер (см. src/lib/backfill-thumbnail.ts) — этот
  // action только создаёт материал и возвращает его id, чтобы вызывающая
  // сторона (HubQuotePicker) могла сразу же сделать и сохранить превью
  // отдельным запросом.
  return { assetId: asset.id };
}

export async function removeItemFromHub(hubId: string, itemId: string) {
  const { hub } = await ownedHub(hubId);

  // hubId в условии не лишний: без него чужой item удалился бы
  // по одному лишь его id.
  await db.hubItem.deleteMany({ where: { id: itemId, hubId: hub.id } });

  revalidatePath(`/hubs/${hub.id}`);
}

export async function setHubStatus(hubId: string, publish: boolean) {
  const { hub } = await ownedHub(hubId);

  await db.hub.update({
    where: { id: hub.id },
    data: { status: publish ? "PUBLISHED" : "DRAFT" },
  });

  revalidatePath(`/hubs/${hub.id}`);
  revalidatePath("/hubs");
}

/**
 * Удаление хаба — мягкое, как и у материалов: статус `ARCHIVED`.
 *
 * Отдельного поля вроде `archivedAt` заводить не стали: `HubStatus.ARCHIVED`
 * уже означает ровно это, а два способа сказать «хаба нет» витрине пришлось
 * бы проверять по очереди — и однажды кто-то проверил бы только один.
 *
 * Ссылки клиентов гаснут сами: `resolveShowcase` пускает только `PUBLISHED`.
 * Ничего не стирается — материалы, ссылки и вся статистика на месте.
 */
export async function archiveHub(hubId: string) {
  const { hub } = await ownedHub(hubId);

  await db.hub.update({
    where: { id: hub.id },
    // Дата нужна «Недавно удалённым», чтобы считать срок хранения.
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });

  revalidatePath(`/hubs/${hub.id}`);
  revalidatePath("/hubs");
  revalidatePath("/hubs/trash");
}

/**
 * Возврат хаба — всегда в черновики, даже если удаляли опубликованный.
 *
 * Иначе восстановление молча открыло бы клиентам старые ссылки: удаляли-то,
 * как правило, именно чтобы их закрыть. Публикация — отдельное решение.
 */
export async function restoreHub(hubId: string) {
  const { hub } = await ownedHub(hubId);

  await db.hub.update({
    where: { id: hub.id },
    data: { status: "DRAFT", archivedAt: null },
  });

  revalidatePath(`/hubs/${hub.id}`);
  revalidatePath("/hubs");
  revalidatePath("/hubs/trash");
}

/**
 * Удалить хаб НАВСЕГДА. Отсюда возврата нет.
 *
 * Вместе с хабом уходят его материалы-связки, выданные ссылки и вся
 * статистика по ним: заходы, время, дочитанность. Сами файлы в библиотеке
 * не трогаются — хаб хранил лишь ссылки на них.
 *
 * Разрешено только для уже удалённых хабов: чтобы стереть насовсем, надо
 * сперва удалить обычным способом. Одного неверного нажатия мало.
 */
export async function purgeHub(hubId: string) {
  const { hub } = await ownedHub(hubId);

  if (hub.status !== "ARCHIVED") {
    throw new Error("Насовсем можно удалить только то, что уже в корзине.");
  }

  await db.hub.delete({ where: { id: hub.id } });

  revalidatePath("/hubs");
  revalidatePath("/hubs/trash");
  revalidatePath("/stats");
}

/** Переложить хаб в папку. Пустая строка — вынуть из папки. */
export async function setHubFolder(hubId: string, folderId: string) {
  const { user, hub } = await ownedHub(hubId);

  if (folderId) {
    // Папка обязана быть своей: иначе подставленным id можно было бы
    // засунуть хаб в чужую организацию.
    const folder = await db.hubFolder.findUnique({ where: { id: folderId } });
    if (!folder || folder.organizationId !== user.organizationId) {
      throw new Error("Папка не найдена.");
    }
  }

  await db.hub.update({
    where: { id: hub.id },
    data: { folderId: folderId || null },
  });

  revalidatePath(`/hubs/${hub.id}`);
  revalidatePath("/hubs");
  revalidatePath("/hubs/folders");
}
