import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { ownerLabel } from "@/lib/owner-color";
import { INDUSTRY_TO_CLIENT_TYPE, type IndustryValue } from "@/lib/industry";
import {
  listFilterCookie,
  parseListFilter,
  type ListFilterScope,
} from "@/lib/list-filter";

type FilterUser = { organizationId: string; role: string };

/** Фильтр из cookie + список создателей для выпадашки (только ADMIN). */
export async function loadListFilter(scope: ListFilterScope, user: FilterUser) {
  const isAdmin = user.role === "ADMIN";
  const jar = await cookies();
  const filter = parseListFilter(jar.get(listFilterCookie(scope))?.value, isAdmin);
  const creators = isAdmin
    ? (
        await db.user.findMany({
          where: { organizationId: user.organizationId },
          select: { id: true, name: true, email: true },
          orderBy: [{ name: "asc" }, { email: "asc" }],
        })
      ).map((u) => ({ id: u.id, label: ownerLabel(u) }))
    : undefined;
  return { filter, creators, active: filter.industry !== null || filter.creator !== null };
}

/**
 * Хабы организации, относящиеся к отрасли: той, материалов которой в хабе
 * больше; при равенстве — к обеим. Считаются живые материалы из раздела
 * библиотеки «Авторынок»/«Недвижимость» и расчёты КП по типу клиента
 * (файл КП лежит в «Общих», его отрасль — от КП); «Общие» и «Кейсы» не в счёт.
 */
export async function hubIdsForIndustry(
  organizationId: string,
  industry: IndustryValue,
): Promise<string[]> {
  const items = await db.hubItem.findMany({
    where: { hub: { organizationId }, asset: { archivedAt: null } },
    select: {
      hubId: true,
      asset: { select: { section: true, quote: { select: { clientType: true } } } },
    },
  });

  const counts = new Map<string, { AUTO: number; REALTY: number }>();
  for (const { hubId, asset } of items) {
    const kind: IndustryValue | null = asset.quote
      ? asset.quote.clientType === INDUSTRY_TO_CLIENT_TYPE.AUTO
        ? "AUTO"
        : asset.quote.clientType === INDUSTRY_TO_CLIENT_TYPE.REALTY
          ? "REALTY"
          : null
      : asset.section === "AUTO" || asset.section === "REALTY"
        ? asset.section
        : null;
    if (!kind) continue;
    const c = counts.get(hubId) ?? { AUTO: 0, REALTY: 0 };
    c[kind] += 1;
    counts.set(hubId, c);
  }

  const other: IndustryValue = industry === "AUTO" ? "REALTY" : "AUTO";
  return [...counts]
    .filter(([, c]) => c[industry] > 0 && c[industry] >= c[other])
    .map(([hubId]) => hubId);
}
