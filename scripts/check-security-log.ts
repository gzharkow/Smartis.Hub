import { SecurityEventType } from "../src/generated/prisma/enums";
import {
  EVENT_LABELS,
  PURGE_EVERY_MS,
  RETENTION_MS,
  clip,
  createOncePerWindow,
  formatDetails,
  purgeDue,
  retentionCutoff,
  sanitizeDetails,
} from "../src/lib/security-log-core";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed++;
  console.log(`${ok ? "ок     " : "ПРОВАЛ "} ${name}${ok || !extra ? "" : `  → ${extra}`}`);
}

// Подпись на русском есть для КАЖДОГО вида события из схемы.
const types = Object.values(SecurityEventType) as string[];
const missing = types.filter((t) => !(t in EVENT_LABELS) || !EVENT_LABELS[t as keyof typeof EVENT_LABELS]);
check(`подписи есть для всех ${types.length} видов событий`, missing.length === 0, missing.join(", "));
const extraLabels = Object.keys(EVENT_LABELS).filter((k) => !types.includes(k));
check("в подписях нет лишних видов", extraLabels.length === 0, extraLabels.join(", "));

// Фильтр деталей.
{
  const d = sanitizeDetails({
    reason: "bad_password",
    password: "123456",
    newPassword: "x",
    passwordHash: "$2a$12$abc",
    shareToken: "abc",
    apiSecret: "s",
    cookieValue: "c",
    Authorization: "Bearer x",
    count: 3,
    ok: true,
    nothing: null,
    nested: { a: 1 },
    list: [1, 2],
    undef: undefined,
    nan: Number.NaN,
  });
  check("пароли, хэши, токены, секреты и куки отбрасываются", !!d && !("password" in d) && !("newPassword" in d) && !("passwordHash" in d) && !("shareToken" in d) && !("apiSecret" in d) && !("cookieValue" in d) && !("Authorization" in d));
  check("обычные значения сохраняются", !!d && d.reason === "bad_password" && d.count === 3 && d.ok === true && d.nothing === null);
  check("вложенные объекты, массивы, undefined и NaN отбрасываются", !!d && !("nested" in d) && !("list" in d) && !("undef" in d) && !("nan" in d));
}
{
  const d = sanitizeDetails({ title: "я".repeat(500) });
  check("длинные строки режутся до 200", !!d && typeof d.title === "string" && d.title.length === 200);
}
{
  const many: Record<string, unknown> = {};
  for (let i = 0; i < 50; i++) many[`k${i}`] = i;
  const d = sanitizeDetails(many);
  check("ключей не больше 20", !!d && Object.keys(d).length === 20);
}
check("пустые детали → null", sanitizeDetails({}) === null && sanitizeDetails(undefined) === null && sanitizeDetails({ password: "x" }) === null);
check("clip режет и пропускает пустое", clip("a".repeat(300), 200)?.length === 200 && clip("") === null && clip(null) === null);

// Срок хранения.
{
  const now = Date.UTC(2026, 9, 1);
  const cutoff = retentionCutoff(now).getTime();
  check("граница хранения — 365 суток назад", now - cutoff === RETENTION_MS && RETENTION_MS === 365 * 86_400_000);
  check("чистка: сразу после запуска не нужна", !purgeDue(now, now + 1000));
  check("чистка: через сутки нужна", purgeDue(now, now + PURGE_EVERY_MS));
  check("чистка: при первом запуске (0) нужна", purgeDue(0, now));
}

// Подавитель «залпа».
{
  const lim = createOncePerWindow(60_000, 100);
  const t = 1_000_000;
  check("первое событие проходит", lim.allow("a", t));
  check("повтор в течение минуты подавляется", !lim.allow("a", t + 59_000));
  check("другой ключ не подавляется", lim.allow("b", t + 1000));
  check("через минуту снова проходит", lim.allow("a", t + 60_001));
  for (let i = 0; i < 500; i++) lim.allow(`k${i}`, t + 2000);
  check("память ограничена", lim.allow("fresh", t + 3000));
}

// Отображение деталей.
check("детали превращаются в читаемую строку", formatDetails({ roleFrom: "MEMBER", roleTo: "ADMIN" }) === "Роль была: MEMBER · Роль стала: ADMIN");
check("пустые детали → пустая строка", formatDetails(null) === "" && formatDetails(undefined) === "");

console.log("");
console.log(failed === 0 ? "Все проверки пройдены." : `ПРОВАЛЕНО: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
