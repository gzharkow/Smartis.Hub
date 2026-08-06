"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "Введите текущий пароль." }),
    newPassword: z.string().min(8, { error: "Новый пароль — минимум 8 символов." }),
    confirmPassword: z.string().min(1, { error: "Повторите новый пароль." }),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    error: "Новые пароли не совпадают.",
    path: ["confirmPassword"],
  });

export type ChangePasswordState = { error: string } | { success: true } | undefined;

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await requireUser();

  const parsed = ChangePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля формы." };
  }

  const currentOk = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!currentOk) {
    return { error: "Текущий пароль неверный." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });

  return { success: true };
}
