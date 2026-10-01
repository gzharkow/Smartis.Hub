// Заголовки, с которыми можно отдавать загруженный пользователем файл с нашего
// домена. Тип хранится в базе в том виде, как его прислал браузер при загрузке,
// поэтому перед отдачей смотрим на него ещё раз.
//
// Привычные типы (PDF, картинки, видео, Office, csv) отдаются как раньше.
// Без "server-only": файл проверяет обычный tsx-скрипт.

const OFFICE_AND_TEXT = new Set([
  "application/pdf",
  "application/octet-stream",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
]);

export function safeServeHeaders(
  mimeType: string | null | undefined,
): Record<string, string> {
  const raw = (mimeType ?? "").trim();
  const base = raw.toLowerCase().split(";")[0]!.trim();

  if (!base) return { "Content-Type": "application/octet-stream" };

  // SVG в <img> безопасен, но при прямом открытии ссылки выполняет вшитые
  // скрипты от имени нашего сайта. sandbox запрещает скрипты и в этом случае,
  // а на показ в <img> не влияет.
  if (base === "image/svg+xml") {
    return {
      "Content-Type": raw,
      "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'",
    };
  }

  if (base.startsWith("image/") || base.startsWith("video/") || OFFICE_AND_TEXT.has(base)) {
    return { "Content-Type": raw };
  }

  // text/html, xml и всё незнакомое: браузер не должен ни показать это как
  // страницу, ни выполнить — только скачать.
  return {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": "attachment",
  };
}
