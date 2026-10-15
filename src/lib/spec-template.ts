import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SpecTemplateKind } from "@/generated/prisma/enums";

// Откуда берутся байты шаблона Спецификации.
//
// Два источника, в таком порядке: загруженный админом в «Настройки → Шаблоны
// документов» и встроенный в поставку. Загруженный главнее — иначе правку,
// сделанную юристами, пришлось бы ждать до следующего релиза.
//
// Встроенные лежат в templates/spec/, не в public/: иначе договор раздавался
// бы по HTTP кому угодно. Читаются из файловой системы тем же приёмом, что
// шрифты в quote-pdf.ts — деплой едет tar-архивом всего дерева, так что файл
// на сервере есть.
//
// Модуль без "server-only": scripts/check-spec-against-sample.ts сверяет
// заполненный шаблон с эталоном заказчика напрямую под tsx. Тип вида шаблона
// берём из сгенерированного Prisma-энума (import type стирается при сборке,
// клиент Prisma в скрипт не тянется) — чтобы список видов не разъехался
// между схемой и кодом.

export type { SpecTemplateKind };

export const SPEC_TEMPLATE_KINDS = [
  "BUILDER_CLOUD",
  "BUILDER_BOX",
  "AUTO_DEALER_CLOUD",
  "AUTO_DEALER_BOX",
] as const satisfies readonly SpecTemplateKind[];

export const SPEC_TEMPLATE_TITLES: Record<SpecTemplateKind, string> = {
  BUILDER_CLOUD: "Застройщик, облако",
  BUILDER_BOX: "Застройщик, коробка",
  AUTO_DEALER_CLOUD: "Автодилер, облако",
  AUTO_DEALER_BOX: "Автодилер, коробка",
};

export function isSpecTemplateKind(value: unknown): value is SpecTemplateKind {
  return typeof value === "string" && (SPEC_TEMPLATE_KINDS as readonly string[]).includes(value);
}

/** Какой шаблон нужен расчёту. Свободный КП (clientType === null) считаем
 * застройщиком: его формулировки — база, автодилерские отличаются. */
export function specTemplateKind(
  clientType: "BUILDER" | "AUTO_DEALER" | null,
  boxIntegrationSelected: boolean,
): SpecTemplateKind {
  const box = boxIntegrationSelected;
  if (clientType === "AUTO_DEALER") return box ? "AUTO_DEALER_BOX" : "AUTO_DEALER_CLOUD";
  return box ? "BUILDER_BOX" : "BUILDER_CLOUD";
}

/** Шаблоны, приехавшие вместе с кодом: застройщик и автодилер, облако.
 * Коробочные ждут согласованных документов и загружаются админом. Ставка НДС
 * в них — метка {{VAT_PCT}}, так что они подходят под любую ставку. */
const BUILTIN: Partial<Record<SpecTemplateKind, string>> = {
  BUILDER_CLOUD: "templates/spec/builder-cloud.docx",
  AUTO_DEALER_CLOUD: "templates/spec/auto-dealer-cloud.docx",
};

export function hasBuiltinSpecTemplate(kind: SpecTemplateKind): boolean {
  return BUILTIN[kind] !== undefined;
}

export async function builtinSpecTemplate(kind: SpecTemplateKind): Promise<Buffer | null> {
  const relative = BUILTIN[kind];
  if (!relative) return null;
  return readFile(path.join(process.cwd(), relative));
}
