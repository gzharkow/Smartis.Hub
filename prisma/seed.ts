import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";

// Создаёт организацию и первого администратора.
// Запускать можно сколько угодно раз — существующее не трогает.

const ADMIN_EMAIL = "admin@smartfollow.local";

async function main() {
  const org = await db.organization.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "Моя компания",
      slug: "default",
      brandColor: "#2563eb",
    },
  });
  console.log(`Организация: ${org.name}`);

  const existing = await db.user.findUnique({
    where: { organizationId_email: { organizationId: org.id, email: ADMIN_EMAIL } },
  });

  if (existing) {
    console.log(`Администратор уже есть: ${existing.email} — пароль не меняю.`);
    return;
  }

  // Пароль генерируем случайно и показываем один раз. Хранить его негде:
  // в базе лежит только необратимый отпечаток, восстановить исходник нельзя.
  const password = randomBytes(9).toString("base64url");

  await db.user.create({
    data: {
      organizationId: org.id,
      email: ADMIN_EMAIL,
      name: "Администратор",
      passwordHash: await bcrypt.hash(password, 12),
      role: "ADMIN",
    },
  });

  console.log("");
  console.log("┌───────────────────────────────────────────────");
  console.log("│  ВХОД В АДМИНКУ — запиши, показываю один раз");
  console.log("│");
  console.log(`│  Почта:  ${ADMIN_EMAIL}`);
  console.log(`│  Пароль: ${password}`);
  console.log("│");
  console.log("└───────────────────────────────────────────────");
  console.log("");
}

main()
  .catch((e) => {
    console.error("Ошибка заполнения:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
