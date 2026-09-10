import { cookies } from "next/headers";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { materialEventStats, formatDuration } from "@/lib/stats";
import { parseStatsRange } from "@/lib/stats-range";
import { parseExcludedAssetIds, STATS_MATERIALS_COOKIE } from "@/lib/stats-materials-filter";
import { withPlural, WORDS } from "@/lib/plural";
import { StatsRangePicker } from "@/components/stats-range-picker";
import { PageHeader } from "@/components/ui/page-header";
import { cardClasses } from "@/components/ui/card";
import { StatsTabs } from "./stats-tabs";
import { MaterialsPicker, type MaterialOption } from "./materials-picker";
import { RankedBarChart } from "./clients/[id]/components/ranked-bar-chart";
import { KpiTile } from "./clients/[id]/components/kpi-tile";
import type { AssetSection } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

// Группы вкладки «Общая статистика» — свои подписи, обращены к продавцу,
// не совпадают дословно с названиями разделов библиотеки (asset-sections.ts).
// CASES сюда никогда не попадает: по кейсам отслеживается только клик/
// переход, агрегировать «время»/«открытия» для них нечего (решение
// владельца продукта).
const GROUPS: { section: AssetSection; label: string }[] = [
  { section: "AUTO", label: "Автодилеры" },
  { section: "REALTY", label: "Застройщики" },
  { section: "COMMON", label: "Общие материалы" },
];

export default async function StatsGeneralPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await requireSection("stats");
  const range = parseStatsRange(await searchParams);
  const jar = await cookies();
  const excludedIds = new Set(
    parseExcludedAssetIds(jar.get(STATS_MATERIALS_COOKIE)?.value),
  );

  const [publishedHubs, eligibleAssets] = await Promise.all([
    db.hub.findMany({
      where: { organizationId: user.organizationId, status: "PUBLISHED" },
      select: { id: true },
    }),
    db.asset.findMany({
      where: {
        organizationId: user.organizationId,
        archivedAt: null,
        section: { not: "CASES" },
        quoteId: null,
      },
      select: { id: true, title: true, section: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const pickerOptions: MaterialOption[] = eligibleAssets.map((a) => ({
    id: a.id,
    title: a.title,
    section: a.section,
  }));

  const selected = eligibleAssets.filter((a) => !excludedIds.has(a.id));
  const statsByAsset = await materialEventStats(
    publishedHubs.map((h) => h.id),
    selected.map((a) => a.id),
    range,
  );

  const rows = selected
    .map((a) => ({
      assetId: a.id,
      title: a.title,
      section: a.section,
      ...statsByAsset.get(a.id)!,
    }))
    .sort((a, b) => b.totalMs - a.totalMs);

  const groups = GROUPS.map((g) => ({
    ...g,
    materials: rows.filter((r) => r.section === g.section),
  })).filter((g) => g.materials.length > 0);

  return (
    <div>
      <StatsTabs current="general" right={<StatsRangePicker range={range} />} />
      <PageHeader
        className="mb-6"
        title="Общая статистика"
        subtitle="Материалы во всех опубликованных хабах, по отраслям"
      />

      <div className="mb-6">
        <MaterialsPicker options={pickerOptions} excludedIds={[...excludedIds]} />
      </div>

      {publishedHubs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium">Опубликованных хабов пока нет</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Как только хаб опубликуют и клиенты начнут смотреть материалы,
            здесь появится сводная статистика.
          </p>
        </div>
      ) : groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted">
          Материалов для показа нет — проверьте, не сняты ли все галочки
          в пикере выше.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {groups.map((group) => {
            const withActivity = group.materials.filter((m) => m.totalMs > 0 || m.opens > 0);
            const totalMs = group.materials.reduce((sum, m) => sum + m.totalMs, 0);
            const totalOpens = group.materials.reduce((sum, m) => sum + m.opens, 0);
            const totalDownloads = group.materials.reduce((sum, m) => sum + m.downloads, 0);

            return (
              <section key={group.section} className="grid gap-4">
                <h2 className="text-lg font-semibold tracking-tight">{group.label}</h2>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <KpiTile
                    label="Материалов"
                    value={String(group.materials.length)}
                    sub={`${withActivity.length} с активностью`}
                  />
                  <KpiTile label="Суммарное время" value={formatDuration(totalMs)} />
                  <KpiTile label="Открытий" value={String(totalOpens)} />
                  <KpiTile label="Скачиваний" value={String(totalDownloads)} />
                </div>

                {withActivity.length > 0 ? (
                  <div className={cardClasses("card")}>
                    <p className="mb-3 font-mono text-[11px] tracking-wide text-muted uppercase">
                      Рейтинг материалов по времени
                    </p>
                    <RankedBarChart items={group.materials} />
                  </div>
                ) : null}

                <ul className="grid grid-cols-1 gap-2">
                  {group.materials.map((m) => (
                    <li key={m.assetId} className={cardClasses("row")}>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="min-w-0 flex-1 truncate font-medium">{m.title}</span>
                        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                          {formatDuration(m.totalMs)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {withPlural(m.opens, WORDS.time)} открывали
                        {m.downloads > 0 ? ` · скачивали ${withPlural(m.downloads, WORDS.time)}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
