"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { canAccessSection, hasEdit } from "@/lib/permissions";
import { db } from "@/lib/db";
import { newShareToken } from "@/lib/tokens";
import { logSecurityEvent } from "@/lib/security-log";

async function ownedHub(hubId: string) {
  const user = await requireUser();
  if (!canAccessSection(user, "hubs") || !hasEdit(user, "hubs")) {
    throw new Error("Недостаточно прав.");
  }

  const hub = await db.hub.findUnique({ where: { id: hubId } });

  if (!hub || hub.organizationId !== user.organizationId) {
    throw new Error("Хаб не найден.");
  }
  if (user.role !== "ADMIN" && hub.ownerId !== user.id) {
    throw new Error("Хаб не найден.");
  }
  return { user, hub };
}

const CreateSchema = z.object({
  hubId: z.string().min(1),
  recipientCompany: z.string().trim().min(1, { error: "Укажите компанию." }).max(120),
  greeting: z.string().trim().max(200),
  // Пусто = бессрочно. Иначе число дней.
  expiresInDays: z.union([z.literal(""), z.coerce.number().int().min(1).max(3650)]),
});

export type CreateLinkState = { error: string } | undefined;

export async function createShareLink(
  _prev: CreateLinkState,
  formData: FormData,
): Promise<CreateLinkState> {
  const parsed = CreateSchema.safeParse({
    hubId: formData.get("hubId"),
    recipientCompany: formData.get("recipientCompany"),
    greeting: formData.get("greeting") ?? "",
    expiresInDays: formData.get("expiresInDays") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля." };
  }

  const { user, hub } = await ownedHub(parsed.data.hubId);

  const expiresAt =
    parsed.data.expiresInDays === ""
      ? null
      : new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000);

  const link = await db.shareLink.create({
    data: {
      hubId: hub.id,
      createdById: user.id,
      token: newShareToken(),
      recipientCompany: parsed.data.recipientCompany,
      greeting: parsed.data.greeting || null,
      expiresAt,
    },
  });

  // Токен ссылки в журнал не пишем — только id, компания и срок.
  await logSecurityEvent({
    type: "SHARE_LINK_CREATED",
    actor: { id: user.id, email: user.email, organizationId: user.organizationId },
    target: { id: link.id, label: parsed.data.recipientCompany },
    details: { hubId: hub.id, expiresAt: expiresAt ? expiresAt.toISOString() : "бессрочно" },
  });

  revalidatePath(`/hubs/${hub.id}`);
  return undefined;
}

export async function revokeShareLink(hubId: string, linkId: string) {
  const { user, hub } = await ownedHub(hubId);

  // Ссылку не удаляем, а помечаем отозванной: удаление утащило бы за собой
  // всю статистику по ней, а она может быть нужна и после отзыва.
  const { count } = await db.shareLink.updateMany({
    where: { id: linkId, hubId: hub.id },
    data: { revokedAt: new Date() },
  });

  if (count > 0) {
    await logSecurityEvent({
      type: "SHARE_LINK_REVOKED",
      actor: { id: user.id, email: user.email, organizationId: user.organizationId },
      target: { id: linkId },
      details: { hubId: hub.id },
    });
  }

  revalidatePath(`/hubs/${hub.id}`);
}

export async function restoreShareLink(hubId: string, linkId: string) {
  const { user, hub } = await ownedHub(hubId);

  const { count } = await db.shareLink.updateMany({
    where: { id: linkId, hubId: hub.id },
    data: { revokedAt: null },
  });

  if (count > 0) {
    await logSecurityEvent({
      type: "SHARE_LINK_RESTORED",
      actor: { id: user.id, email: user.email, organizationId: user.organizationId },
      target: { id: linkId },
      details: { hubId: hub.id },
    });
  }

  revalidatePath(`/hubs/${hub.id}`);
}
