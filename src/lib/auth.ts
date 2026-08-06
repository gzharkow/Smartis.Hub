import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { readSession } from "./session";

// cache() из React схлопывает повторные вызовы в пределах одного запроса:
// страница и её макет спросят пользователя каждый по разу, а в базу сходим один.
export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { organization: true, accessLevel: true },
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
