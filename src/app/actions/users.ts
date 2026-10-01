"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { logSecurityEvent } from "@/lib/security-log";

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

/** Доступ по разделам и разрешение добавлять материалы — только для
 * role = MEMBER (для ADMIN эти поля не проверяются и форсируются в false,
 * так же как и canAddAssets/visibleOwnerIds ниже). Не доверяем скрытой на
 * клиенте галочке canAddAssets — форсируем зависимость от canAccessAssets
 * ещё раз здесь. */
function parseSectionAccess(formData: FormData, role: "ADMIN" | "MEMBER") {
  if (role !== "MEMBER") {
    return {
      canAccessHubs: false,
      canAccessAssets: false,
      canAccessStats: false,
      canAccessCalculator: false,
      canAccessKpi: false,
      canManageKpi: false,
      canAddAssets: false,
    };
  }
  const canAccessAssets = formData.get("canAccessAssets") === "1";
  const canAccessKpi = formData.get("canAccessKpi") === "1";
  return {
    canAccessHubs: formData.get("canAccessHubs") === "1",
    canAccessAssets,
    canAccessStats: formData.get("canAccessStats") === "1",
    canAccessCalculator: formData.get("canAccessCalculator") === "1",
    canAccessKpi,
    canManageKpi: canAccessKpi && formData.get("canManageKpi") === "1",
    canAddAssets: canAccessAssets && formData.get("canAddAssets") === "1",
  };
}

type SectionFlags = ReturnType<typeof parseSectionAccess>;

/** Какие из флагов доступа включены — одной строкой для журнала. */
function enabledFlags(flags: SectionFlags): string {
  return Object.entries(flags)
    .filter(([, on]) => on)
    .map(([name]) => name)
    .join(", ");
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
  const sectionAccess = parseSectionAccess(formData, role);
  const visibleOwnerIds = role === "MEMBER" ? parseVisibleOwnerIds(formData) : [];

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);

  let createdId: string | null = null;

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

      const created = await tx.user.create({
        data: {
          organizationId: admin.organizationId,
          email,
          name,
          passwordHash,
          role,
          ...sectionAccess,
          visibleOwners: { connect: visibleOwnerIds.map((id) => ({ id })) },
        },
      });
      createdId = created.id;
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

  await logSecurityEvent({
    type: "ACCOUNT_CREATED",
    actor: { id: admin.id, email: admin.email, organizationId: admin.organizationId },
    target: { id: createdId, label: email },
    details: {
      role,
      access: enabledFlags(sectionAccess),
      visibleOwners: visibleOwnerIds.length,
    },
  });

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

  const sectionAccess = parseSectionAccess(formData, role);
  const visibleOwnerIds = role === "MEMBER" ? parseVisibleOwnerIds(formData) : [];

  const newPasswordRaw = String(formData.get("newPassword") ?? "");
  const resetPassword = newPasswordRaw === "1";
  const password = resetPassword ? generatePassword() : null;
  const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;

  const changes: Record<string, string | number | boolean> = {};
  let targetEmail = "";

  try {
    await db.$transaction(async (tx) => {
      const target = await tx.user.findFirst({
        where: { id: userId, organizationId: admin.organizationId },
        include: { visibleOwners: { select: { id: true } } },
      });
      if (!target) throw new Error("NOT_FOUND");
      targetEmail = target.email;

      // Что именно меняется — для журнала: до и после.
      if (target.role !== role) {
        changes.roleFrom = target.role;
        changes.roleTo = role;
      }
      const flagChanges = (Object.keys(sectionAccess) as (keyof SectionFlags)[]).filter(
        (k) => target[k] !== sectionAccess[k],
      );
      if (flagChanges.length > 0) changes.changed = flagChanges.join(", ");
      const before = new Set(target.visibleOwners.map((o) => o.id));
      const sameOwners =
        before.size === visibleOwnerIds.length && visibleOwnerIds.every((id) => before.has(id));
      if (!sameOwners) changes.visibleOwners = visibleOwnerIds.length;

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
          ...sectionAccess,
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

  const actor = { id: admin.id, email: admin.email, organizationId: admin.organizationId };
  const target = { id: userId, label: targetEmail };
  if (Object.keys(changes).length > 0) {
    await logSecurityEvent({ type: "ACCOUNT_UPDATED", actor, target, details: changes });
  }
  if (password) {
    await logSecurityEvent({ type: "PASSWORD_RESET", actor, target });
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

  await logSecurityEvent({
    type: "ACCOUNT_DELETED",
    actor: { id: admin.id, email: admin.email, organizationId: admin.organizationId },
    target: { id: userId, label: target.email },
  });

  revalidatePath("/settings/administration");
  return { success: true };
}
