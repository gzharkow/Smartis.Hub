import { z } from "zod";
import { ALL_SECTION_KEYS } from "./permission-sections";

// Форма матрицы прав уровня доступа (AccessLevel.permissions). Без
// "server-only": схема нужна и серверным actions, и клиентской форме для
// проверки перед отправкой.

export const PermissionEntrySchema = z.object({
  section: z.string(),
  view: z.boolean(),
  edit: z.boolean(),
});

export const PermissionsSchema = z.array(PermissionEntrySchema);

export type PermissionEntry = z.infer<typeof PermissionEntrySchema>;
export type Permissions = z.infer<typeof PermissionsSchema>;

/** Разобрать значение поля Json — чужеродное/битое значение молча превращаем в «доступа нет». */
export function parsePermissions(value: unknown): Permissions {
  const parsed = PermissionsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

/** Каждый ключ реестра — своя независимая запись, без наследования родитель→потомок. */
export function canView(permissions: Permissions, sectionKey: string): boolean {
  return permissions.some((p) => p.section === sectionKey && p.view);
}

export function canEdit(permissions: Permissions, sectionKey: string): boolean {
  return permissions.some((p) => p.section === sectionKey && p.edit);
}

/** Матрица по умолчанию для формы «новый уровень доступа» — всё выключено. */
export function emptyPermissions(): Permissions {
  return ALL_SECTION_KEYS.map((section) => ({ section, view: false, edit: false }));
}
