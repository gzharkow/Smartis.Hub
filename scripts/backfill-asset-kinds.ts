import "dotenv/config";
import { db } from "../src/lib/db";
import { detectKind } from "../src/lib/asset-formats";

// Разовый бэкофилл: detectKind() научился распознавать docx/xlsx уже
// ПОСЛЕ того, как часть материалов была загружена — у них kind = FILE
// в базе, хотя mimeType на самом деле docx/xlsx. Поле kind выставляется
// один раз при загрузке и само не пересчитывается, поэтому старые
// материалы застряли на «только скачать». Запускать можно сколько
// угодно раз — трогает только kind = FILE с распознаваемым mimeType.

async function main() {
  const candidates = await db.asset.findMany({
    where: { kind: "FILE" },
    select: { id: true, title: true, mimeType: true },
  });

  let changed = 0;
  for (const a of candidates) {
    if (!a.mimeType) continue;
    const kind = detectKind(a.mimeType);
    if (kind === "FILE") continue;

    await db.asset.update({ where: { id: a.id }, data: { kind } });
    console.log(`${a.title}: FILE -> ${kind} (${a.mimeType})`);
    changed += 1;
  }

  console.log(`Готово: проверено ${candidates.length}, изменено ${changed}.`);
}

main()
  .catch((e) => {
    console.error("Ошибка:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
