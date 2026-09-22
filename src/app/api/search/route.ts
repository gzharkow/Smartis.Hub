import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessSection, visibleOwnerFilter } from "@/lib/permissions";
import { db } from "@/lib/db";

// Сквозной поиск для строки в шапке: один запрос — хабы, папки, материалы
// и расчёты калькулятора сразу, каждое по своему полю названия. GET, а не
// серверное действие: удобно дёргать fetch'ем на каждое нажатие клавиши
// с отменой предыдущего запроса.

const TAKE = 6;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужно войти." }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ hubs: [], folders: [], assets: [] });

  // Раздел закрыт индивидуальным флагом — просто не ищем в нём, а не
  // блокируем весь маршрут: остальные категории поиска всё равно нужны.
  const canHubs = canAccessSection(user, "hubs");
  const canAssets = canAccessSection(user, "assets");
  const canCalculator = canAccessSection(user, "calculator");

  const [hubs, folders, assets, quotes] = await Promise.all([
    canHubs
      ? db.hub.findMany({
          where: {
            organizationId: user.organizationId,
            // Та же видимость, что и в разделе «Хабы».
            ...visibleOwnerFilter(user),
            status: { not: "ARCHIVED" },
            title: { contains: q, mode: "insensitive" },
          },
          select: { id: true, title: true },
          orderBy: { updatedAt: "desc" },
          take: TAKE,
        })
      : Promise.resolve([]),
    canHubs
      ? db.hubFolder.findMany({
          where: {
            organizationId: user.organizationId,
            name: { contains: q, mode: "insensitive" },
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: TAKE,
        })
      : Promise.resolve([]),
    canAssets
      ? db.asset.findMany({
          where: {
            organizationId: user.organizationId,
            archivedAt: null,
            // PDF калькулятора — не материал библиотеки; расчёт, из которого он
            // сделан, и так находится ниже через db.quote.findMany.
            quoteId: null,
            // Личная библиотека сюда не попадает — ни своя, ни чужая, у неё
            // своя вкладка «Мои материалы» (см. тот же фильтр в assets/search).
            ownerId: null,
            title: { contains: q, mode: "insensitive" },
          },
          select: { id: true, title: true, section: true },
          orderBy: { createdAt: "desc" },
          take: TAKE,
        })
      : Promise.resolve([]),
    canCalculator
      ? db.quote.findMany({
          where: {
            organizationId: user.organizationId,
            // Та же логика видимости, что у хабов.
            ...visibleOwnerFilter(user),
            clientName: { contains: q, mode: "insensitive" },
          },
          select: { id: true, clientName: true },
          orderBy: { updatedAt: "desc" },
          take: TAKE,
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    hubs: hubs.map((h) => ({ id: h.id, title: h.title })),
    folders: folders.map((f) => ({ id: f.id, title: f.name })),
    assets: assets.map((a) => ({ id: a.id, title: a.title, section: a.section })),
    quotes: quotes.map((quote) => ({ id: quote.id, title: quote.clientName })),
  });
}
