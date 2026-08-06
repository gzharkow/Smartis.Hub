import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
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

  const [hubs, folders, assets, quotes] = await Promise.all([
    db.hub.findMany({
      where: {
        organizationId: user.organizationId,
        // Продавец видит свои хабы, администратор — все, как и в разделе «Хабы».
        ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
        status: { not: "ARCHIVED" },
        title: { contains: q, mode: "insensitive" },
      },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: TAKE,
    }),
    db.hubFolder.findMany({
      where: {
        organizationId: user.organizationId,
        name: { contains: q, mode: "insensitive" },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: TAKE,
    }),
    db.asset.findMany({
      where: {
        organizationId: user.organizationId,
        archivedAt: null,
        // PDF калькулятора — не материал библиотеки; расчёт, из которого он
        // сделан, и так находится ниже через db.quote.findMany.
        quoteId: null,
        title: { contains: q, mode: "insensitive" },
      },
      select: { id: true, title: true, section: true },
      orderBy: { createdAt: "desc" },
      take: TAKE,
    }),
    db.quote.findMany({
      where: {
        organizationId: user.organizationId,
        // Та же логика видимости, что у хабов: продавец — только свои.
        ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
        archivedAt: null,
        clientName: { contains: q, mode: "insensitive" },
      },
      select: { id: true, clientName: true },
      orderBy: { updatedAt: "desc" },
      take: TAKE,
    }),
  ]);

  return NextResponse.json({
    hubs: hubs.map((h) => ({ id: h.id, title: h.title })),
    folders: folders.map((f) => ({ id: f.id, title: f.name })),
    assets: assets.map((a) => ({ id: a.id, title: a.title, section: a.section })),
    quotes: quotes.map((quote) => ({ id: quote.id, title: quote.clientName })),
  });
}
