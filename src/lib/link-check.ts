import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Проверка ссылки, которую продавец добавляет как материал.
 *
 * Делает три вещи: узнаёт название страницы (чтобы не вводить вручную),
 * выясняет, пускает ли сайт себя в рамку, и находит картинку-превью
 * (og:image) — ту самую, что показывают мессенджеры.
 */

export type LinkCheck = {
  url: string;
  title: string | null;
  /** null — сайт не ответил; тогда считаем, что встраивать нельзя. */
  embeddable: boolean | null;
  /** Абсолютный адрес картинки-превью сайта или null. */
  imageUrl: string | null;
};

export type LinkImage = { bytes: Buffer; mime: string };

const TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 3;
/** og:image и <title> живут в <head> — первых сотен килобайт хватает. */
const MAX_HTML_BYTES = 128 * 1024;
/** Потолок на картинку-превью: og:image крупнее — почти наверняка ошибка. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const UA = "SmartisFlite/1.0 (+link-check)";

/**
 * Запрет на внутренние адреса.
 *
 * Без него добавление ссылки превращается в способ заглянуть внутрь нашего
 * же сервера: продавец пишет http://localhost:5432 или адрес служебных
 * данных облака, а наш сервер послушно туда ходит — снаружи это недоступно,
 * изнутри открыто. Поэтому имя сначала превращаем в адрес и смотрим, куда
 * он ведёт на самом деле.
 */
async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Ссылка должна начинаться с http:// или https://");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true })).map((a) => a.address);

  for (const address of addresses) {
    if (isPrivate(address)) {
      throw new Error("Такой адрес недоступен снаружи — клиент его не откроет.");
    }
  }
}

function isPrivate(address: string): boolean {
  if (isIP(address) === 6) {
    const v6 = address.toLowerCase();
    // ::1 — сам сервер, fc00::/7 — внутренние сети, fe80::/10 — локальный канал.
    if (v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd")) return true;
    if (v6.startsWith("fe8") || v6.startsWith("fe9")) return true;
    if (v6.startsWith("fea") || v6.startsWith("feb")) return true;
    // ::ffff:10.0.0.1 — адрес IPv4, записанный по-новому.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
    return mapped ? isPrivate(mapped[1]) : false;
  }

  const [a, b] = address.split(".").map(Number);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // служебные данные облаков живут здесь
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/**
 * Fetch с защитой от внутренних адресов и ручным разбором переходов.
 *
 * Переходы отслеживаем сами: сайт может увести редиректом на внутренний
 * адрес, и каждый шаг надо проверять заново — `redirect: "follow"` этого
 * не даст. Возвращаем и ответ, и итоговый адрес (он мог смениться).
 */
async function guardedFetch(
  rawUrl: string,
): Promise<{ response: Response; url: URL }> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Не похоже на адрес. Пример: https://example.com/case");
  }

  await assertPublic(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let hops = 0;
    for (;;) {
      const response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        // Только латиница: в заголовках HTTP кириллица недопустима,
        // и fetch падает с «Cannot convert argument to a ByteString».
        headers: { "User-Agent": UA },
      });

      const next = response.headers.get("location");
      if (!next || response.status < 300 || response.status >= 400) {
        return { response, url };
      }

      if (++hops > MAX_REDIRECTS) throw new Error("Слишком много перенаправлений.");
      url = new URL(next, url);
      await assertPublic(url);
    }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Сайт не ответил за 6 секунд.");
    }
    // Наши проверки уже написаны по-человечески — их пропускаем. А от fetch
    // прилетает голое «fetch failed», по которому непонятно ничего.
    if (e instanceof TypeError) {
      throw new Error("Не удалось связаться с сайтом. Проверьте адрес.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Разрешает ли ответ показывать себя в рамке. */
function allowsFraming(headers: Headers): boolean {
  const xfo = headers.get("x-frame-options")?.toLowerCase() ?? "";
  if (xfo.includes("deny") || xfo.includes("sameorigin")) return false;

  const csp = headers.get("content-security-policy")?.toLowerCase() ?? "";
  const rule = /frame-ancestors([^;]*)/.exec(csp);
  if (!rule) return true;

  const value = rule[1].trim();
  // Нам разрешено, только если сайт пускает всех: перечисленные домены —
  // это чужие домены, нас в списке заведомо нет.
  return value === "*" || value.startsWith("* ");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function readTitle(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match) return null;
  const text = decodeEntities(match[1].replace(/\s+/g, " ")).trim();
  return text ? text.slice(0, 120) : null;
}

/** Адрес картинки-превью из мета-тегов (og:image, на крайний случай twitter). */
function readImageUrl(html: string, base: URL): string | null {
  const keys = [
    "og:image",
    "og:image:url",
    "og:image:secure_url",
    "twitter:image",
    "twitter:image:src",
  ];
  const tagRe = /<meta\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html))) {
    const tag = m[0];
    const prop = /(?:property|name)\s*=\s*["']([^"']+)["']/i
      .exec(tag)?.[1]
      ?.toLowerCase();
    if (!prop || !keys.includes(prop)) continue;

    const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (!content) continue;

    try {
      // Адрес может быть относительным — разрешаем относительно страницы.
      return new URL(decodeEntities(content.trim()), base).toString();
    } catch {
      // Битый адрес пропускаем — вдруг дальше найдётся годный.
    }
  }
  return null;
}

export async function checkLink(rawUrl: string): Promise<LinkCheck> {
  const { response, url } = await guardedFetch(rawUrl);

  if (!response.ok) {
    throw new Error(`Сайт ответил ошибкой ${response.status}.`);
  }

  const type = response.headers.get("content-type") ?? "";
  let title: string | null = null;
  let imageUrl: string | null = null;

  if (type.includes("text/html")) {
    const buffer = await response.arrayBuffer();
    const head = Buffer.from(buffer.slice(0, MAX_HTML_BYTES)).toString("utf8");
    title = readTitle(head);
    imageUrl = readImageUrl(head, url);
  }

  return {
    url: url.toString(),
    title,
    embeddable: allowsFraming(response.headers),
    imageUrl,
  };
}

/**
 * Скачать картинку-превью сайта. Лучшее усилие: любой сбой — это просто
 * «превью не будет», добавление ссылки из-за него срываться не должно,
 * поэтому вызывающий код ловит исключения и трактует их как «нет картинки».
 *
 * SVG не берём: внутри него бывают скрипты, а как превью он не нужен.
 */
export async function downloadLinkImage(rawUrl: string): Promise<LinkImage> {
  const { response } = await guardedFetch(rawUrl);
  if (!response.ok) throw new Error(`Картинка ответила ошибкой ${response.status}.`);

  const mime = (response.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (!mime.startsWith("image/") || mime === "image/svg+xml") {
    throw new Error("По этому адресу не картинка.");
  }

  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_IMAGE_BYTES) throw new Error("Картинка слишком большая.");

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error("Пустая картинка.");
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("Картинка слишком большая.");

  return { bytes, mime };
}
