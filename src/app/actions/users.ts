"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { PermissionsSchema, type Permissions } from "@/lib/access-levels";

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

type AccessLevelChoice =
  | { mode: "existing"; accessLevelId: string }
  | { mode: "new"; name: string; permissions: Permissions };

/** Разбирает и проверяет поля выбора уровня доступа из FormData — общие для создания и правки. */
function parseAccessLevelChoice(formData: FormData): AccessLevelChoice | { error: string } {
  const mode = formData.get("accessLevelMode");

  if (mode === "existing") {
    const accessLevelId = formData.get("accessLevelId");
    if (typeof accessLevelId !== "string" || !accessLevelId) {
      return { error: "Выберите уровень доступа." };
    }
    return { mode: "existing", accessLevelId };
  }

  if (mode === "new") {
    const name = String(formData.get("accessLevelName") ?? "").trim();
    if (!name) return { error: "Введите название уровня доступа." };

    let raw: unknown;
    try {
      raw = JSON.parse(String(formData.get("permissions") ?? "[]"));
    } catch {
      return { error: "Некорректная матрица доступа." };
    }
    const parsed = PermissionsSchema.safeParse(raw);
    if (!parsed.success) return { error: "Некорректная матрица доступа." };

    return { mode: "new", name, permissions: parsed.data };
  }

  return { error: "Выберите уровень доступа." };
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

  const choice = role === "MEMBER" ? parseAccessLevelChoice(formData) : null;
  if (choice && "error" in choice) return choice;

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

      let accessLevelId: string | null = null;

      if (choice) {
        if (choice.mode === "existing") {
          const level = await tx.accessLevel.findFirst({
            where: { id: choice.accessLevelId, organizationId: admin.organizationId },
          });
          if (!level) throw new Error("ACCESS_LEVEL_NOT_FOUND");
          accessLevelId = level.id;
        } else {
          const duplicate = await tx.accessLevel.findFirst({
            where: { organizationId: admin.organizationId, name: choice.name },
          });
          if (duplicate) throw new Error("DUPLICATE_ACCESS_LEVEL");
          const created = await tx.accessLevel.create({
            data: {
              organizationId: admin.organizationId,
              name: choice.name,
              permissions: choice.permissions,
            },
          });
          accessLevelId = created.id;
        }
      }

      await tx.user.create({
        data: {
          organizationId: admin.organizationId,
          email,
          name,
          passwordHash,
          role,
          accessLevelId,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "DUPLICATE_EMAIL") {
      return { error: "Аккаунт с такой почтой уже есть." };
    }
    if (e instanceof Error && e.message === "DUPLICATE_ACCESS_LEVEL") {
      return {
        error: `Уровень доступа «${choice && choice.mode === "new" ? choice.name : ""}» уже существует — выберите его из списка.`,
      };
    }
    if (e instanceof Error && e.message === "ACCESS_LEVEL_NOT_FOUND") {
      return { error: "Уровень доступа не найден." };
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

  const choice = role === "MEMBER" ? parseAccessLevelChoice(formData) : null;
  if (choice && "error" in choice) return choice;

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

      let accessLevelId: string | null = null;

      if (choice) {
        if (choice.mode === "existing") {
          const level = await tx.accessLevel.findFirst({
            where: { id: choice.accessLevelId, organizationId: admin.organizationId },
          });
          if (!level) throw new Error("ACCESS_LEVEL_NOT_FOUND");
          accessLevelId = level.id;
        } else {
          const duplicate = await tx.accessLevel.findFirst({
            where: {
              organizationId: admin.organizationId,
              name: choice.name,
              ...(target.accessLevelId ? { NOT: { id: target.accessLevelId } } : {}),
            },
          });
          if (duplicate) throw new Error("DUPLICATE_ACCESS_LEVEL");
          const created = await tx.accessLevel.create({
            data: {
              organizationId: admin.organizationId,
              name: choice.name,
              permissions: choice.permissions,
            },
          });
          accessLevelId = created.id;
        }
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          role,
          accessLevelId,
          ...(passwordHash ? { passwordHash } : {}),
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return { error: "Аккаунт не найден." };
    }
    if (e instanceof Error && e.message === "DUPLICATE_ACCESS_LEVEL") {
      return { error: "Уровень доступа с таким названием уже есть — выберите его из списка." };
    }
    if (e instanceof Error && e.message === "ACCESS_LEVEL_NOT_FOUND") {
      return { error: "Уровень доступа не найден." };
    }
    throw e;
  }

  revalidatePath("/settings/administration");
  return password ? { success: true, password } : { success: true };
}

export type EditAccessLevelState = { error: string } | { success: true } | undefined;

/** Правка именованного уровня доступа напрямую (не через привязку к конкретному аккаунту). */
export async function editAccessLevel(
  _prevState: EditAccessLevelState,
  formData: FormData,
): Promise<EditAccessLevelState> {
  const admin = await requireAdmin();

  const accessLevelId = String(formData.get("accessLevelId") ?? "");
  if (!accessLevelId) return { error: "Не указан уровень доступа." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Введите название уровня доступа." };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("permissions") ?? "[]"));
  } catch {
    return { error: "Некорректная матрица доступа." };
  }
  const parsed = PermissionsSchema.safeParse(raw);
  if (!parsed.success) return { error: "Некорректная матрица доступа." };

  const level = await db.accessLevel.findFirst({
    where: { id: accessLevelId, organizationId: admin.organizationId },
  });
  if (!level) return { error: "Уровень доступа не найден." };

  const duplicate = await db.accessLevel.findFirst({
    where: { organizationId: admin.organizationId, name, NOT: { id: accessLevelId } },
  });
  if (duplicate) return { error: "Уровень доступа с таким названием уже есть." };

  await db.accessLevel.update({
    where: { id: accessLevelId },
    data: { name, permissions: parsed.data },
  });

  revalidatePath("/settings/administration");
  return { success: true };
}
