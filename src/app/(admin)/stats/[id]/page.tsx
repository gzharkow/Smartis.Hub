import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { KIND_LABELS } from "@/lib/assets";
import { formatDuration, formatWhen, hubDetail, type ItemStats } from "@/lib/stats";
import { parseStatsRange } from "@/lib/stats-range";
import { StatsRangePicker } from "@/components/stats-range-picker";
import { withPlural, WORDS } from "@/lib/plural";
import type { AssetKind } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

function PageBar({ item }: { item: ItemStats }) {
  if (item.topPages.length === 0) return null;

  const max = Math.max(...item.topPages.map((p) => p.ms));

  return (
    <div className="mt-3 grid gap-1.5">
      <p className="text-xs text-muted">Где задержались дольше всего</p>
      {item.topPages.map((p) => (
        <div key={p.page} className="flex items-center gap-2 text-xs">
          <span className="w-16 shrink-0 text-muted">стр. {p.page}</span>
          <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-border">
            <span
              className="block h-full rounded-full bg-blue-600"
              style={{ width: `${Math.round((p.ms / max) * 100)}%` }}
            />
          </span>
          <span className="w-20 shrink-0 text-right tabular-nums">
            {formatDuration(p.ms)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function HubStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const user = await requireAdmin();
  const range = parseStatsRange(await searchParams);

  const hub = await db.hub.findUnique({
    where: { id },
    include: { items: { include: { asset: true } } },
  });

  if (!hub || hub.organizationId !== user.organizationId) notFound();

  const links = await hubDetail(hub.id, range);
  const opened = links.filter((l) => l.visits > 0);
  const untouched = links.filter((l) => l.visits === 0);

  return (
    <div className="grid grid-cols-1 gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/stats"
            className="text-sm text-muted transition hover:text-foreground"
          >
            ← Вся статистика
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">{hub.title}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {withPlural(links.length, WORDS.link)} ·{" "}
            {withPlural(hub.items.length, WORDS.material)}
          </p>
        </div>

        {/* Период применяется только к цифрам ниже — сам хаб и список ссылок
            от него не зависят. */}
        <StatsRangePicker range={range} />
      </div>

      {range && links.length > 0 && opened.length === 0 ? (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          За выбранный период ссылки не открывали.
        </p>
      ) : null}

      {links.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium">Ссылок ещё не выдавали</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            <Link href={`/hubs/${hub.id}`} className="text-blue-600 underline dark:text-blue-400">
              Выдайте ссылку клиенту
            </Link>{" "}
            — и здесь появится, что он смотрел.
          </p>
        </div>
      ) : null}

      {opened.map((link) => (
        <section key={link.linkId} className="grid grid-cols-1 gap-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border pb-3">
            <h2 className="text-lg font-semibold tracking-tight">
              {link.company ?? "Без названия"}
            </h2>
            {link.revoked ? (
              <span className="rounded bg-border/70 px-1.5 py-0.5 text-xs">
                ссылка отозвана
              </span>
            ) : null}
            {link.expired ? (
              <span className="rounded bg-border/70 px-1.5 py-0.5 text-xs">
                ссылка истекла
              </span>
            ) : null}
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Заходов", value: String(link.visits) },
              {
                label: "Человек",
                value: String(link.visitors),
                hint: "Разные устройства или люди по одной ссылке",
              },
              { label: "Всего времени", value: formatDuration(link.totalMs) },
              { label: "Последний заход", value: formatWhen(link.lastSeenAt) },
            ].map((cell) => (
              <div
                key={cell.label}
                className="rounded-lg border border-border px-3 py-2"
                title={cell.hint}
              >
                <dt className="text-xs text-muted">{cell.label}</dt>
                <dd className="mt-0.5 font-semibold">{cell.value}</dd>
              </div>
            ))}
          </dl>

          {/* Клики по кнопкам шапки — самые «горячие» сигналы: клиент
              не просто смотрел, а сделал шаг навстречу. Показываем, только
              если что-то из этого было. */}
          {link.demoClicks > 0 || link.contactClicks > 0 ? (
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {link.demoClicks > 0 ? (
                <span className="text-emerald-700 dark:text-emerald-400">
                  Демо-кабинет открывали{" "}
                  {withPlural(link.demoClicks, WORDS.time)}
                </span>
              ) : null}
              {link.contactClicks > 0 ? (
                <span className="text-emerald-700 dark:text-emerald-400">
                  «Задать вопрос» нажимали{" "}
                  {withPlural(link.contactClicks, WORDS.time)}
                </span>
              ) : null}
            </p>
          ) : null}

          {link.items.length === 0 ? (
            <p className="text-sm text-muted">
              Витрину открывали, но ни один материал не смотрели.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              {link.items.map((item) => (
                <li
                  key={item.assetId}
                  className="rounded-xl border border-border bg-surface px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="rounded bg-border/70 px-1.5 py-0.5 text-xs">
                      {KIND_LABELS[item.kind as AssetKind]}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {item.title}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {/* Пульс идёт раз в 10 секунд, поэтому «0 сек» означает
                          не «данных нет», а «закрыли быстрее, чем через 10».
                          Так и пишем, иначе цифра выглядит как ошибка. */}
                      {item.totalMs === 0 && item.opens > 0
                        ? "меньше 10 сек"
                        : formatDuration(item.totalMs)}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-muted">
                    открывали {withPlural(item.opens, WORDS.time)}
                    {item.downloads > 0
                      ? ` · скачивали ${withPlural(item.downloads, WORDS.time)}`
                      : ""}
                    {/* Для ссылки это главное: дальше клиент на чужом сайте,
                        и время там мы не видим. */}
                    {item.linkClicks > 0
                      ? ` · переходили на сайт ${withPlural(item.linkClicks, WORDS.time)}`
                      : ""}
                    {item.maxPage && item.pageCount
                      ? ` · долистали до ${item.maxPage}-й из ${item.pageCount}`
                      : ""}
                  </p>

                  {item.maxPage && item.pageCount ? (
                    <span
                      className="mt-2 block h-1.5 overflow-hidden rounded-full bg-border"
                      title={`Дочитано ${Math.round((item.maxPage / item.pageCount) * 100)}%`}
                    >
                      <span
                        className="block h-full rounded-full bg-green-600"
                        style={{
                          width: `${Math.round((item.maxPage / item.pageCount) * 100)}%`,
                        }}
                      />
                    </span>
                  ) : null}

                  <PageBar item={item} />
                </li>
              ))}
            </ul>
          )}

          {/* Что отправили, но клиент не открыл — часто важнее того, что открыл. */}
          {(() => {
            const seen = new Set(link.items.map((i) => i.assetId));
            const missed = hub.items.filter((i) => !seen.has(i.assetId));
            if (missed.length === 0) return null;

            return (
              <p className="text-sm text-muted">
                <span className="font-medium">Не открывали:</span>{" "}
                {missed
                  .map((i) => i.titleOverride ?? i.asset.title)
                  .join(", ")}
              </p>
            );
          })()}
        </section>
      ))}

      {untouched.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold tracking-tight text-muted uppercase">
            Ссылку не открывали
          </h2>
          <ul className="grid grid-cols-1 gap-2">
            {untouched.map((link) => (
              <li
                key={link.linkId}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                {link.company ?? "Без названия"}
                {link.revoked ? (
                  <span className="ml-2 text-xs text-muted">отозвана</span>
                ) : null}
                {link.expired ? (
                  <span className="ml-2 text-xs text-muted">истекла</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
