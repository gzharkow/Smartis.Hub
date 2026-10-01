"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { loginThrottle, trustedClientIp } from "@/lib/login-throttle";
import { createSession, deleteSession } from "@/lib/session";

const LoginSchema = z.object({
  email: z.email({ error: "Введите почту." }),
  password: z.string().min(1, { error: "Введите пароль." }),
  next: z.string().optional(),
});

export type LoginState = { error: string } | undefined;

// Хэш случайного пароля той же стоимости, что и настоящие: на нём «тратим время»,
// когда такого пользователя нет. Считаем один раз на процесс.
let dummyHash: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  dummyHash ??= bcrypt.hash(randomBytes(16).toString("hex"), 12);
  return dummyHash;
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return { error: "Проверьте почту и пароль." };
  }

  const ip = trustedClientIp(await headers());
  const { email, password } = parsed.data;

  const gate = loginThrottle.check(ip, email);
  if (gate.blocked) {
    console.warn(`[auth] вход временно заблокирован из-за частых неудач, ip=${ip}`);
    const minutes = Math.max(1, Math.ceil(gate.retryAfterMs / 60_000));
    return { error: `Слишком много попыток входа. Попробуйте через ${minutes} мин.` };
  }

  const user = await db.user.findFirst({
    where: { email },
  });

  // Пароль сверяем всегда, даже когда пользователя нет: иначе по времени ответа
  // видно, есть ли такая почта в системе (bcrypt занимает ~четверть секунды).
  const hash = user?.passwordHash ?? (await getDummyHash());
  const passwordMatches = await bcrypt.compare(password, hash);

  // Одинаковый текст и когда пользователя нет, и когда пароль неверный.
  // Разные ответы превратили бы форму входа в способ узнать,
  // кто в системе зарегистрирован.
  if (!user || !passwordMatches) {
    loginThrottle.fail(ip, email);
    return { error: "Неверная почта или пароль." };
  }

  loginThrottle.success(ip, email);

  await createSession({
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
  });

  // Пускаем только по внутренним адресам: без этой проверки чужой мог бы
  // подсунуть ссылку вида /login?next=https://сайт-мошенника — и человек
  // после успешного входа уехал бы туда, думая, что это наш сервис.
  const target =
    parsed.data.next?.startsWith("/") && !parsed.data.next.startsWith("//")
      ? parsed.data.next
      : "/hubs";

  // redirect() бросает специальное исключение — всё, что ниже, не выполнится.
  redirect(target);
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
