import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessSection } from "@/lib/permissions";
import { db } from "@/lib/db";
import { formatFileSize, KIND_LABELS } from "@/lib/assets";
import { parseSection } from "@/lib/asset-sections";

// Поиск материалов библиотеки для «добавить в хаб» — не путать с общим
// поиском (src/app/api/search): здесь только материалы текущей организации,
// с учётом того же правила разделов, что и в hub-materials.tsx («Кейсы»
// и «Общие» — каждый только свой, «Авторынок»/«Недвижимость» ещё видят
// и «Общие»). Пустой запрос — не «ничего», а последние добавленные.

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужно войти." }, { status: 401 });
  if (!canAccessSection(user, "assets")) {
    return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const filter = parseSection(url.searchParams.get("section"));
  const excludeIds = url.searchParams.getAll("exclude");

  const sectionWhere = filter
    ? filter === "COMMON" || filter === "CASES"
      ? { section: filter }
      : { OR: [{ section: filter }, { section: "COMMON" as const }] }
    : {};

  const assets = await db.asset.findMany({
    where: {
      organizationId: user.organizationId,
      archivedAt: null,
      // PDF калькулятора добавляются отдельным виджетом (HubQuotePicker),
      // не через общую библиотеку.
      quoteId: null,
      id: { notIn: excludeIds },
      ...sectionWhere,
      ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: q ? 8 : 3,
  });

  return NextResponse.json({
    assets: assets.map((a) => ({
      id: a.id,
      title: a.title,
      kindLabel: KIND_LABELS[a.kind],
      kind: a.kind,
      section: a.section,
      meta: [
        a.pageCount ? `${a.pageCount} стр.` : null,
        a.sizeBytes ? formatFileSize(a.sizeBytes) : null,
      ]
        .filter(Boolean)
        .join(" · "),
      pageCount: a.pageCount,
      externalUrl: a.externalUrl,
      embeddable: a.embeddable,
      hasThumbnail: a.thumbnailKey !== null,
    })),
  });
}
