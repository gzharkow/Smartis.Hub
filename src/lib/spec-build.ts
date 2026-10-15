import "server-only";
import Decimal from "decimal.js";
import { db } from "./db";
import { storage } from "./storage";
import { extractPlainText, fillDocxStrict } from "./docx-fill";
import { SPEC_TAGS, SPEC_TAG_NAMES, findTags } from "./spec-tags";
import {
  SPEC_TEMPLATE_TITLES,
  builtinSpecTemplate,
  hasBuiltinSpecTemplate,
  specTemplateKind,
  type SpecTemplateKind,
} from "./spec-template";
import {
  computeSpecValues,
  specValuesToTags,
  unsupportedKopecks,
  type SpecEditableValues,
} from "./spec-values";

// Сборка Спецификации: от записи КП до готовых байт .docx.
//
// Отдельно от spec-values.ts, потому что тот чистый и работает в браузере —
// здесь же база, хранилище и решение «можно ли вообще выпускать документ».

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Шаблон договора — это текст, а не медиа: десятки килобайт. Потолок стоит
 * не ради места, а чтобы в поле для .docx не улетел случайный видеофайл. */
export const MAX_SPEC_TEMPLATE_BYTES = 10 * 1024 * 1024;

export type SpecTemplateProblem =
  | { code: "NOT_DOCX"; message: string }
  | { code: "MISSING_TAGS"; message: string; tags: string[] }
  | { code: "UNKNOWN_TAGS"; message: string; tags: string[] };

/**
 * Проверяет загружаемый шаблон: это вообще .docx, и в нём есть ровно те
 * метки, которые мы умеем заполнять.
 *
 * Проверять надо именно здесь, при загрузке, а не при выпуске документа:
 * шаблон грузят раз в полгода, а Спецификацию по нему выпускают перед
 * отправкой клиенту, и «в документе не хватает метки» — плохая новость для
 * этого момента. Метки ищем в видимом тексте, а не в сыром XML: Word рвёт
 * набранную метку на несколько runs, и в XML её как целой строки нет.
 */
export async function validateSpecTemplate(bytes: Buffer): Promise<SpecTemplateProblem[]> {
  let text: string;
  try {
    text = await extractPlainText(bytes);
  } catch {
    return [
      {
        code: "NOT_DOCX",
        message: "Это не документ Word (.docx). Файлы .doc сначала пересохраните в .docx.",
      },
    ];
  }

  const found = findTags(text);
  const problems: SpecTemplateProblem[] = [];

  const missing = SPEC_TAGS.map((t) => t.tag).filter((tag) => !found.includes(tag));
  if (missing.length > 0) {
    problems.push({
      code: "MISSING_TAGS",
      tags: missing,
      message: `В шаблоне не хватает ${missing.length} меток: ${missing.join(", ")}. Без них документ вышел бы с пустыми местами.`,
    });
  }

  const unknown = found.filter((tag) => !SPEC_TAG_NAMES.has(tag));
  if (unknown.length > 0) {
    problems.push({
      code: "UNKNOWN_TAGS",
      tags: unknown,
      message: `Незнакомые метки: ${unknown.join(", ")}. Заполнить их нечем — проверьте, нет ли опечатки.`,
    });
  }

  return problems;
}

/** Кнопка либо работает, либо объясняет, почему нет. Причина показывается
 * прямо в интерфейсе, поэтому она на человеческом языке. */
export type SpecAvailability =
  | { ok: true; kind: SpecTemplateKind }
  | { ok: false; reason: string };

export type SpecQuoteRecord = {
  organizationId: string;
  clientType: "BUILDER" | "AUTO_DEALER" | null;
  boxIntegrationSelected: boolean;
  vatRatePct: Decimal | string | number;
};

/**
 * Байты шаблона под вид.
 *
 * Загруженный админом главнее встроенного: правку от юристов иначе пришлось
 * бы ждать до следующего релиза. Ставка НДС в шаблон приходит меткой
 * {{VAT_PCT}}, поэтому один файл подходит под любую ставку.
 */
export async function resolveSpecTemplate(
  organizationId: string,
  kind: SpecTemplateKind,
): Promise<Buffer | null> {
  const uploaded = await db.specTemplate.findFirst({
    where: { organizationId, kind },
    orderBy: { updatedAt: "desc" },
  });

  if (uploaded) {
    const chunks: Buffer[] = [];
    const stream = await storage.get(uploaded.storageKey);
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  }

  return builtinSpecTemplate(kind);
}

export async function specAvailability(quote: SpecQuoteRecord): Promise<SpecAvailability> {
  const kind = specTemplateKind(quote.clientType, quote.boxIntegrationSelected);

  const uploaded = await db.specTemplate.findFirst({
    where: { organizationId: quote.organizationId, kind },
    select: { id: true },
  });

  if (uploaded || hasBuiltinSpecTemplate(kind)) return { ok: true, kind };

  return {
    ok: false,
    reason: `Шаблон «${SPEC_TEMPLATE_TITLES[kind]}» не загружен. Загрузите его в «Настройки → Шаблоны документов».`,
  };
}

/** Собирает .docx. Падает, если выпускать документ нельзя, — вызывается и из
 * server action, и из route handler, и оба обязаны проверить это заново:
 * значения приходят из браузера. */
export async function renderSpecDocx(
  quote: SpecQuoteRecord,
  editable: SpecEditableValues,
): Promise<Buffer> {
  const availability = await specAvailability(quote);
  if (!availability.ok) throw new Error(availability.reason);

  const template = await resolveSpecTemplate(
    quote.organizationId,
    availability.kind,
  );
  if (!template) throw new Error("Шаблон Спецификации не найден.");

  // Шаблон, загруженный до появления метки ставки, держит «5%» текстом —
  // с другой ставкой в расчёте документ вышел бы с неверным НДС.
  if (!findTags(await extractPlainText(template)).includes("VAT_PCT")) {
    throw new Error(
      "Шаблон Спецификации устарел: в нём нет метки ставки НДС. " +
        "Загрузите его заново в «Настройки → Шаблоны документов» — метки расставятся сами.",
    );
  }

  // Пересчитываем производные суммы здесь, а не принимаем их из браузера:
  // из клиента приходят только базовые числа.
  const values = computeSpecValues(editable, quote.vatRatePct, quote.clientType);

  const badKopecks = unsupportedKopecks(values);
  if (badKopecks.length > 0) {
    throw new Error(
      `Суммы дают ${badKopecks.join(" и ")} копеек, а в шаблоне слово «копеек» стоит текстом — ` +
        "документ получился бы неграмотным. Округлите суммы до целых рублей.",
    );
  }

  const { bytes } = await fillDocxStrict(template, specValuesToTags(values));
  return bytes;
}
