"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { hasEdit } from "@/lib/permissions";
import { db } from "@/lib/db";

// Папки общие на организацию: сотрудник заводит свою и складывает туда хабы
// своих клиентов. Прав доступа папка не даёт — это полка, а не сейф.

const NameSchema = z
  .string()
  .trim()
  .min(1, { error: "Введите название папки." })
  .max(60, { error: "Название длиннее 60 символов." });

export type FolderState = { error: string } | undefined;

async function ownedFolder(folderId: string) {
  const user = await requireUser();
  if (!hasEdit(user, "hubs.folders")) {
    throw new Error("Недостаточно прав.");
  }

  const folder = await db.hubFolder.findUnique({ where: { id: folderId } });

  if (!folder || folder.organizationId !== user.organizationId) {
    throw new Error("Папка не найдена.");
  }
  return { user, folder };
}

function revalidate() {
  revalidatePath("/hubs");
  revalidatePath("/hubs/folders");
}

export async function createHubFolder(
  _prev: FolderState,
  formData: FormData,
): Promise<FolderState> {
  const user = await requireUser();
  if (!hasEdit(user, "hubs.folders")) {
    return { error: "Недостаточно прав." };
  }

  const parsed = NameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте название." };
  }

  // Тёзки запрещены на уровне базы. Ловим здесь, чтобы вместо страницы
  // с ошибкой продавец увидел понятную подсказку.
  const twin = await db.hubFolder.findFirst({
    where: { organizationId: user.organizationId, name: parsed.data },
  });
  if (twin) return { error: "Папка с таким названием уже есть." };

  await db.hubFolder.create({
    data: { organizationId: user.organizationId, name: parsed.data },
  });

  revalidate();
  return undefined;
}

export async function renameHubFolder(folderId: string, name: string) {
  const { user, folder } = await ownedFolder(folderId);

  const parsed = NameSchema.safeParse(name);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);

  const twin = await db.hubFolder.findFirst({
    where: {
      organizationId: user.organizationId,
      name: parsed.data,
      id: { not: folder.id },
    },
  });
  if (twin) throw new Error("Папка с таким названием уже есть.");

  await db.hubFolder.update({
    where: { id: folder.id },
    data: { name: parsed.data },
  });

  revalidate();
}

/**
 * Удалить папку. Хабы остаются — они лишь выпадают из неё и оказываются
 * «без папки». Папка не владеет хабами, поэтому и уносить их с собой
 * ей не за что.
 */
export async function deleteHubFolder(folderId: string) {
  const { folder } = await ownedFolder(folderId);

  await db.hubFolder.delete({ where: { id: folder.id } });

  revalidate();
}
