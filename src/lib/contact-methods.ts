import { z } from "zod";

// Organization.contactMethods лежит в базе как Json, а Postgres за его формой
// не следит — туда можно записать что угодно. Поэтому форму сторожим здесь:
// проверяем при каждой записи и при каждом чтении.

export const CONTACT_KINDS = [
  "PHONE",
  "EMAIL",
  "TELEGRAM",
  "WHATSAPP",
  "WEBSITE",
  "OTHER",
] as const;

export const CONTACT_KIND_LABELS: Record<(typeof CONTACT_KINDS)[number], string> =
  {
    PHONE: "Телефон",
    EMAIL: "Почта",
    TELEGRAM: "Телеграм",
    WHATSAPP: "WhatsApp",
    WEBSITE: "Сайт",
    OTHER: "Другое",
  };

export const ContactMethodSchema = z.object({
  kind: z.enum(CONTACT_KINDS),
  // Подпись для клиента: «Отдел продаж», «Ваш менеджер».
  label: z.string().trim().min(1).max(60),
  // Сам контакт: номер, адрес почты, @ник, ссылка.
  value: z.string().trim().min(1).max(200),
});

export const ContactMethodsSchema = z.array(ContactMethodSchema).max(8);

export type ContactMethod = z.infer<typeof ContactMethodSchema>;

// Читаем из базы. Если внутри мусор — отдаём пустой список, а не роняем витрину:
// сломанные контакты не повод не показать клиенту материалы.
export function parseContactMethods(value: unknown): ContactMethod[] {
  const result = ContactMethodsSchema.safeParse(value);
  return result.success ? result.data : [];
}

// Превращает контакт в ссылку, по которой можно кликнуть.
// Для OTHER ссылки нет — покажем просто текстом.
export function contactHref(method: ContactMethod): string | null {
  const v = method.value.trim();
  switch (method.kind) {
    case "PHONE":
      return `tel:${v.replace(/[^\d+]/g, "")}`;
    case "EMAIL":
      return `mailto:${v}`;
    case "TELEGRAM":
      return v.startsWith("http") ? v : `https://t.me/${v.replace(/^@/, "")}`;
    case "WHATSAPP":
      return v.startsWith("http")
        ? v
        : `https://wa.me/${v.replace(/[^\d]/g, "")}`;
    case "WEBSITE":
      return v.startsWith("http") ? v : `https://${v}`;
    case "OTHER":
      return null;
  }
}
