import "dotenv/config";
import { rm } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/lib/db";

// Разовая уборка: удаляет материалы, созданные при проверке превью.
// Настоящие материалы владельца не трогает.
//
// Файлы удаляем напрямую, минуя src/lib/storage: тот помечен "server-only"
// и в обычном скрипте не запускается.

const TEST_TITLES = ["Превью работает", "Тест превью 2", "Тест превью"];
const STORAGE_ROOT = process.env.STORAGE_LOCAL_PATH ?? "./storage";

async function main() {
  const junk = await db.asset.findMany({
    where: { title: { in: TEST_TITLES } },
    select: { id: true, title: true, organizationId: true },
  });

  for (const a of junk) {
    // Сначала связи, потом сам материал — иначе база не даст удалить.
    await db.hubItem.deleteMany({ where: { assetId: a.id } });
    await db.event.updateMany({ where: { assetId: a.id }, data: { assetId: null } });
    await db.asset.delete({ where: { id: a.id } });

    // Папка материала целиком: и файл, и превью.
    await rm(path.resolve(STORAGE_ROOT, "assets", a.organizationId, a.id), {
      recursive: true,
      force: true,
    });

    console.log(`удалён тестовый материал: ${a.title}`);
  }

  const left = await db.asset.findMany({
    select: { title: true, thumbnailKey: true },
    orderBy: { createdAt: "asc" },
  });
  console.log("\nОсталось в библиотеке:");
  for (const a of left) {
    console.log(`  ${a.thumbnailKey ? "с превью " : "без превью"} — ${a.title}`);
  }
}

main()
  .catch((e) => {
    console.error("ОШИБКА:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
