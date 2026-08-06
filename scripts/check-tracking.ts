import "dotenv/config";
import { db } from "../src/lib/db";

// Срез собранной статистики. Гонять после прогулки по витрине, чтобы видеть,
// что цифры сходятся: npm run check:tracking

async function main() {
  const visits = await db.visit.findMany({
    include: {
      shareLink: { select: { recipientCompany: true } },
      _count: { select: { events: true } },
    },
    orderBy: { startedAt: "desc" },
  });

  console.log(`Визитов: ${visits.length}`);
  for (const v of visits) {
    console.log(
      `  ${v.shareLink.recipientCompany} | метка ${v.visitorId.slice(0, 8)}… | ` +
        `событий ${v._count.events} | IP-отпечаток ${v.ipHash ? v.ipHash.slice(0, 8) + "…" : "нет"}`,
    );
  }

  const byType = await db.event.groupBy({
    by: ["type"],
    _count: { _all: true },
    _sum: { durationMs: true },
  });

  console.log("\nСобытия по типам:");
  for (const row of byType) {
    const time = row._sum.durationMs
      ? ` | суммарно ${Math.round(row._sum.durationMs / 1000)} сек`
      : "";
    console.log(`  ${row.type.padEnd(16)} ${row._count._all}${time}`);
  }

  // Главный вопрос продукта: сколько времени клиент провёл на каждом материале.
  const perItem = await db.event.groupBy({
    by: ["assetId"],
    where: { type: "HEARTBEAT", assetId: { not: null } },
    _sum: { durationMs: true },
  });

  console.log("\nВремя по материалам:");
  if (perItem.length === 0) {
    console.log("  пока ничего — пульс на материалах не успел сработать");
  }
  for (const row of perItem) {
    const asset = await db.asset.findUnique({ where: { id: row.assetId! } });
    console.log(
      `  ${(asset?.title ?? "").slice(0, 45).padEnd(45)} ${Math.round((row._sum.durationMs ?? 0) / 1000)} сек`,
    );
  }

  const hubTime = await db.event.aggregate({
    where: { type: "HEARTBEAT", assetId: null },
    _sum: { durationMs: true },
  });
  console.log(
    `\nВремя на самой витрине (ничего не открыто): ${Math.round((hubTime._sum.durationMs ?? 0) / 1000)} сек`,
  );

  // Ради этого всё и затевалось: докуда долистали и где залипли.
  const reached = await db.event.groupBy({
    by: ["assetId"],
    where: { type: "PAGE_VIEW" },
    _max: { pageNumber: true },
    _count: { _all: true },
  });

  console.log("\nПостранично по PDF:");
  if (reached.length === 0) console.log("  событий по страницам нет");

  for (const row of reached) {
    const asset = await db.asset.findUnique({ where: { id: row.assetId! } });
    console.log(
      `\n  ${asset?.title}\n` +
        `    долистали до страницы ${row._max.pageNumber} из ${asset?.pageCount}, ` +
        `всего смен страниц: ${row._count._all}`,
    );

    const perPage = await db.event.groupBy({
      by: ["pageNumber"],
      where: {
        type: "HEARTBEAT",
        assetId: row.assetId,
        pageNumber: { not: null },
      },
      _sum: { durationMs: true },
      orderBy: { _sum: { durationMs: "desc" } },
      take: 5,
    });

    if (perPage.length > 0) {
      console.log("    больше всего времени:");
      for (const p of perPage) {
        console.log(
          `      страница ${String(p.pageNumber).padStart(2)} — ${Math.round((p._sum.durationMs ?? 0) / 1000)} сек`,
        );
      }
    }
  }
}

main()
  .catch((e) => {
    console.error("ОШИБКА:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
