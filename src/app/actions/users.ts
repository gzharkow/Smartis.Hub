"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Пароль генерируется на сервере тем же способом, что и в prisma/seed.ts,
// и показывается вызывающей стороне РОВНО ОДИН РАЗ — нигде не хранится,
// кроме необратимого bcrypt-хэша в базе.
function generatePassword(): string {
  return randomBytes(9).toString("base64url");
}

const EmailSchema = z
  .email({ error: "Введите корректную почту." })
  .refine((v) => v.toLowerCase().endsWith("@smartis.bi"), {
    error: "Почта должна быть на домене smartis.bi.",
  });

const RoleSchema = z.enum(["ADMIN", "MEMBER"], { error: "Выберите роль." });

/** Только суперадминистратор — единственный, кому доверено удалять аккаунты
 * и (в перспективе) другие необратимые операции над самой организацией. */
const SUPERADMIN_EMAIL = "admin@smartfollow.local";

function parseVisibleOwnerIds(formData: FormData): string[] {
  return formData.getAll("visibleOwnerIds").map(String).filter(Boolean);
}

export type CreateAccountState =
  | { error: string }
  | { success: true; email: string; password: string }
  | undefined;

export async function createAccount(
  _prevState: CreateAccountState,
  formData: FormData,
): Promise<CreateAccountState> {
  const admin = await requireAdmin();

  const emailParsed = EmailSchema.safeParse(formData.get("email"));
  if (!emailParsed.success) {
    return { error: emailParsed.error.issues[0]?.message ?? "Проверьте почту." };
  }
  const email = emailParsed.data.toLowerCase();

  const roleParsed = RoleSchema.safeParse(formData.get("role"));
  if (!roleParsed.success) {
    return { error: "Выберите роль." };
  }
  const role = roleParsed.data;

  const name = String(formData.get("name") ?? "").trim() || null;
  const canAddAssets = role === "MEMBER" && formData.get("canAddAssets") === "1";
  const visibleOwnerIds = role === "MEMBER" ? parseVisibleOwnerIds(formData) : [];

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { organizationId_email: { organizationId: admin.organizationId, email } },
      });
      if (existing) {
        throw new Error("DUPLICATE_EMAIL");
      }

      // Чужие аккаунты, которых открываем видимость, — только из той же
      // организации, иначе через подделанный id можно было бы подглядеть
      // за другой компанией.
      if (visibleOwnerIds.length > 0) {
        const count = await tx.user.count({
          where: { id: { in: visibleOwnerIds }, organizationId: admin.organizationId },
        });
        if (count !== visibleOwnerIds.length) throw new Error("OWNER_NOT_FOUND");
      }

      await tx.user.create({
        data: {
          organizationId: admin.organizationId,
          email,
          name,
          passwordHash,
          role,
          canAddAssets,
          visibleOwners: { connect: visibleOwnerIds.map((id) => ({ id })) },
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "DUPLICATE_EMAIL") {
      return { error: "Аккаунт с такой почтой уже есть." };
    }
    if (e instanceof Error && e.message === "OWNER_NOT_FOUND") {
      return { error: "Один из выбранных аккаунтов не найден." };
    }
    throw e;
  }

  revalidatePath("/settings/administration");
  return { success: true, email, password };
}

export type UpdateAccountState = { error: string } | { success: true; password?: string } | undefined;

export async function updateAccountAccess(
  _prevState: UpdateAccountState,
  formData: FormData,
): Promise<UpdateAccountState> {
  const admin = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Не указан аккаунт." };

  const roleParsed = RoleSchema.safeParse(formData.get("role"));
  if (!roleParsed.success) return { error: "Выберите роль." };
  const role = roleParsed.data;

  const canAddAssets = role === "MEMBER" && formData.get("canAddAssets") === "1";
  const visibleOwnerIds = role === "MEMBER" ? parseVisibleOwnerIds(formData) : [];

  const newPasswordRaw = String(formData.get("newPassword") ?? "");
  const resetPassword = newPasswordRaw === "1";
  const password = resetPassword ? generatePassword() : null;
  const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;

  try {
    await db.$transaction(async (tx) => {
      const target = await tx.user.findFirst({
        where: { id: userId, organizationId: admin.organizationId },
      });
      if (!target) throw new Error("NOT_FOUND");

      if (visibleOwnerIds.length > 0) {
        const count = await tx.user.count({
          where: { id: { in: visibleOwnerIds }, organizationId: admin.organizationId },
        });
        if (count !== visibleOwnerIds.length) throw new Error("OWNER_NOT_FOUND");
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          role,
          canAddAssets,
          // set вместо connect: список видимости — не добавка, а полная замена
          // тем, что отмечено в форме сейчас.
          visibleOwners: { set: visibleOwnerIds.map((id) => ({ id })) },
          ...(passwordHash ? { passwordHash } : {}),
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return { error: "Аккаунт не найден." };
    }
    if (e instanceof Error && e.message === "OWNER_NOT_FOUND") {
      return { error: "Один из выбранных аккаунтов не найден." };
    }
    throw e;
  }

  revalidatePath("/settings/administration");
  return password ? { success: true, password } : { success: true };
}

export type DeleteAccountState = { error: string } | { success: true } | undefined;

/** Удаление аккаунта — необратимо, поэтому доступно только суперадминистратору
 * (единственная в коде проверка по конкретной почте, а не по роли). */
export async function deleteAccount(
  _prevState: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const admin = await requireAdmin();
  if (admin.email !== SUPERADMIN_EMAIL) {
    return { error: "Удалять аккаунты может только суперадминистратор." };
  }

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Не указан аккаунт." };
  if (userId === admin.id) return { error: "Нельзя удалить свой аккаунт." };

  const target = await db.user.findFirst({
    where: { id: userId, organizationId: admin.organizationId },
    include: { _count: { select: { hubs: true, quotes: true } } },
  });
  if (!target) return { error: "Аккаунт не найден." };

  if (target._count.hubs > 0 || target._count.quotes > 0) {
    return {
      error: `У аккаунта есть хабы (${target._count.hubs}) и/или расчёты (${target._count.quotes}) — сначала передайте или удалите их.`,
    };
  }

  await db.user.delete({ where: { id: userId } });

  revalidatePath("/settings/administration");
  return { success: true };
}
