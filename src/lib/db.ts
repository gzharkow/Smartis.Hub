import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 больше не подключается к базе сам — ему нужен драйвер-адаптер
// под конкретную СУБД. Отсюда PrismaPg: это и есть мост до PostgreSQL.

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Не задан DATABASE_URL. Проверь файл .env в корне проекта — там должен быть адрес базы.",
  );
}

// В режиме разработки Next.js перезагружает код на каждое изменение файла.
// Без этой обёртки каждая перезагрузка открывала бы новое соединение,
// и через десяток правок Postgres упёрся бы в лимит подключений.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
