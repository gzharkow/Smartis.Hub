"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";

const LoginSchema = z.object({
  email: z.email({ error: "Введите почту." }),
  password: z.string().min(1, { error: "Введите пароль." }),
  next: z.string().optional(),
});

export type LoginState = { error: string } | undefined;

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

  const user = await db.user.findFirst({
    where: { email: parsed.data.email },
  });

  // Одинаковый текст и когда пользователя нет, и когда пароль неверный.
  // Разные ответы превратили бы форму входа в способ узнать,
  // кто в системе зарегистрирован.
  const passwordOk =
    user && (await bcrypt.compare(parsed.data.password, user.passwordHash));

  if (!user || !passwordOk) {
    return { error: "Неверная почта или пароль." };
  }

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
