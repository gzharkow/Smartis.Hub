import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessSection, visibleOwnerFilter } from "@/lib/permissions";
import { db } from "@/lib/db";

// Поиск расчётов калькулятора для «добавить в хаб» — не путать с общим
// поиском (src/app/api/search): здесь только КП, и пустой запрос — не
// «ничего», а последние созданные (быстрый выбор без набора текста).

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужно войти." }, { status: 401 });
  if (!canAccessSection(user, "calculator")) {
    return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  const quotes = await db.quote.findMany({
    where: {
      organizationId: user.organizationId,
      // Та же логика видимости, что в /calculator.
      ...visibleOwnerFilter(user),
      ...(q ? { clientName: { contains: q, mode: "insensitive" } } : {}),
    },
    select: { id: true, clientName: true },
    orderBy: { createdAt: "desc" },
    take: q ? 8 : 3,
  });

  return NextResponse.json({
    quotes: quotes.map((quote) => ({ id: quote.id, clientName: quote.clientName })),
  });
}
