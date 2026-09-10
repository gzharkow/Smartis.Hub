import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { readSession } from "./session";
import { canAccessSection, type SectionKey } from "./permissions";

// cache() из React схлопывает повторные вызовы в пределах одного запроса:
// страница и её макет спросят пользователя каждый по разу, а в базу сходим один.
export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { organization: true, visibleOwners: { select: { id: true } } },
  });

  // Кука валидна, а пользователя нет — значит, его удалили после входа.
  return user ?? null;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/hubs");
  return user;
}

const SECTION_ROUTE: Record<SectionKey, string> = {
  hubs: "/hubs",
  assets: "/assets",
  calculator: "/calculator",
  stats: "/stats",
};

// Порядок — тот же, что и в сайдбаре: если запрошенный раздел закрыт,
// уводим на первый, который открыт, а не молча гадаем.
const SECTION_FALLBACK_ORDER: SectionKey[] = ["hubs", "assets", "calculator", "stats"];

/** Блокирует страницу раздела для тех, у кого он закрыт индивидуальным
 * флагом (см. canAccessSection в permissions.ts). «Настройки» в эту
 * проверку не входят — они открыты любому вошедшему без исключений,
 * поэтому служат гарантированным дном для fallback без риска зацикливания. */
export async function requireSection(section: SectionKey) {
  const user = await requireUser();
  if (canAccessSection(user, section)) return user;

  const firstAvailable = SECTION_FALLBACK_ORDER.find((s) => canAccessSection(user, s));
  redirect(firstAvailable ? SECTION_ROUTE[firstAvailable] : "/settings");
}
