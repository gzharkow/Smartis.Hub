"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

// Удаление шаблона Спецификации. Загрузка идёт маршрутом (там FormData и
// файл), а удаление — обычный server action: передаётся только id.

export async function deleteSpecTemplate(id: string) {
  const user = await requireAdmin();

  const template = await db.specTemplate.findUnique({ where: { id } });
  // Чужой организации шаблона «не существует».
  if (!template || template.organizationId !== user.organizationId) {
    throw new Error("Шаблон не найден.");
  }

  // Сначала запись, потом файл: висящая запись без файла ломает выпуск
  // документа, а осиротевший файл в хранилище — нет.
  await db.specTemplate.delete({ where: { id } });
  if (template.storageKey) {
    await storage.delete(template.storageKey).catch(() => {});
  }

  revalidatePath("/settings/spec-templates");
}
