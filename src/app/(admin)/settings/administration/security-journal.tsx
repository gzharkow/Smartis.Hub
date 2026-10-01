import { db } from "@/lib/db";
import { SecurityEventType } from "@/generated/prisma/enums";
import { EVENT_LABELS, formatDetails } from "@/lib/security-log-core";
import { LocalDateTime } from "@/components/local-datetime";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";

const PAGE_STEP = 50;
const MAX_ROWS = 500;

const ALL_TYPES = Object.values(SecurityEventType) as SecurityEventType[];

export function parseJournalParams(params: { journal?: string; n?: string }) {
  const type = ALL_TYPES.find((t) => t === params.journal) ?? null;
  const asked = Number(params.n);
  const limit =
    Number.isFinite(asked) && asked >= PAGE_STEP
      ? Math.min(MAX_ROWS, Math.floor(asked / PAGE_STEP) * PAGE_STEP)
      : PAGE_STEP;
  return { type, limit };
}

// Тревожные события выделяем цветом — глазами проще найти среди обычных входов.
const WARNING_TYPES = new Set<SecurityEventType>([
  "LOGIN_FAILED",
  "LOGIN_BLOCKED",
  "PASSWORD_CHANGE_FAILED",
  "ITEM_PURGED",
  "ACCOUNT_DELETED",
]);

export async function SecurityJournal({
  organizationId,
  type,
  limit,
}: {
  organizationId: string;
  type: SecurityEventType | null;
  limit: number;
}) {
  // Вход под чужой или несуществующей почтой организации не имеет — такие
  // записи показываем тоже, иначе самые интересные попытки пропадут из виду.
  const rows = await db.securityEvent.findMany({
    where: {
      OR: [{ organizationId }, { organizationId: null }],
      ...(type ? { type } : {}),
    },
    orderBy: { occurredAt: "desc" },
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const shown = rows.slice(0, limit);

  const moreHref = `/settings/administration?${new URLSearchParams({
    ...(type ? { journal: type } : {}),
    n: String(Math.min(MAX_ROWS, limit + PAGE_STEP)),
  }).toString()}#journal`;

  return (
    <section id="journal" className="grid gap-3 scroll-mt-6">
      <div className="grid gap-1">
        <h2 className="text-sm font-semibold tracking-tight text-muted uppercase">
          Журнал безопасности
        </h2>
        <p className="text-xs text-muted">
          Входы, неудачные попытки, изменения прав и паролей, выдача ссылок клиентам, безвозвратные
          удаления и выгрузки. Записи хранятся 12 месяцев и не редактируются.
        </p>
      </div>

      <form
        method="get"
        action="/settings/administration#journal"
        className="flex flex-wrap items-center gap-2"
      >
        <Select name="journal" defaultValue={type ?? ""} aria-label="Вид события">
          <option value="">Все события</option>
          {ALL_TYPES.map((t) => (
            <option key={t} value={t}>
              {EVENT_LABELS[t]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary" size="md">
          Показать
        </Button>
      </form>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">
          Записей пока нет.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {shown.map((e) => {
            const details = formatDetails(e.details);
            const warn = WARNING_TYPES.has(e.type);
            return (
              <li key={e.id} className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className={`text-sm font-medium ${warn ? "text-danger" : ""}`}>
                    {EVENT_LABELS[e.type]}
                  </span>
                  <span className="text-xs text-muted tabular-nums">
                    <LocalDateTime kind="securityEvent" date={e.occurredAt} />
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                  <span>Кто: {e.actorEmail ?? "неизвестно"}</span>
                  {e.targetLabel ? <span>Над чем: {e.targetLabel}</span> : null}
                  {e.ip ? <span>IP: {e.ip}</span> : null}
                </div>
                {details ? <p className="mt-1 text-xs text-muted break-words">{details}</p> : null}
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && limit < MAX_ROWS ? (
        <a
          href={moreHref}
          className="w-fit rounded-lg px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
        >
          Показать ещё
        </a>
      ) : null}
      {hasMore && limit >= MAX_ROWS ? (
        <p className="text-xs text-muted">
          Показаны последние {MAX_ROWS} записей. Для более ранних сузьте список по виду события.
        </p>
      ) : null}
    </section>
  );
}
