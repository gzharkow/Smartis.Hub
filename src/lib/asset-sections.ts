import type { AssetSection } from "@/generated/prisma/enums";

// Разделы библиотеки материалов. Файл нарочно без "server-only": одни и те же
// названия нужны и на сервере (списки, фильтры), и в браузере (выпадашки).
//
// В адресе строки латиницей — «auto», а не «AUTO» и не «Авторынок»: ссылку
// на раздел не стыдно отправить коллеге, и она не превращается в кашу
// из процентов при копировании.

export type SectionInfo = {
  value: AssetSection;
  slug: string;
  label: string;
  /** Пояснение под заголовком раздела. */
  hint: string;
};

export const SECTIONS: readonly SectionInfo[] = [
  {
    value: "AUTO",
    slug: "auto",
    label: "Авторынок",
    hint: "Материалы для автодилеров",
  },
  {
    value: "REALTY",
    slug: "realty",
    label: "Недвижимость",
    hint: "Материалы для застройщиков",
  },
  {
    value: "COMMON",
    slug: "common",
    label: "Общие",
    hint: "Нужны в обоих направлениях: о компании, договор, реквизиты",
  },
  {
    value: "CASES",
    slug: "cases",
    label: "Кейсы",
    hint: "Ссылки на кейсы — истории результатов клиентов",
  },
];

export const SECTION_LABELS: Record<AssetSection, string> = {
  AUTO: "Авторынок",
  REALTY: "Недвижимость",
  COMMON: "Общие",
  CASES: "Кейсы",
};

/** Раздел по строке из адреса. Мусор и отсутствие — одинаково «все разделы». */
export function sectionFromSlug(slug: string | undefined): AssetSection | null {
  return SECTIONS.find((s) => s.slug === slug)?.value ?? null;
}

export function slugOfSection(value: AssetSection): string {
  return SECTIONS.find((s) => s.value === value)!.slug;
}

/** Раздел из формы. Чужое значение молча не проглатываем. */
export function parseSection(value: unknown): AssetSection | null {
  return SECTIONS.find((s) => s.value === value)?.value ?? null;
}

/** Ключ раздела материалов для hasEdit() (src/lib/permissions.ts). */
export function permissionKeyForSection(value: AssetSection): string {
  return `assets.${slugOfSection(value)}`;
}
