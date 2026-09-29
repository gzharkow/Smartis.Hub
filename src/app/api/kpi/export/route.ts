import { getCurrentUser } from "@/lib/auth";
import { canAccessSection } from "@/lib/permissions";
import { buildKpiWorkbook } from "@/lib/kpi-export";
import type { Ym } from "@/lib/kpi";

// GET /api/kpi/export?months=2026-09,2026-10&quarters=2026-4
// Каждый месяц — отдельный лист, каждый квартал — тоже. Доступ — как у самого
// раздела KPI (вход + флаг canAccessKpi); право «менять настройки» не нужно.

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const QUARTER_RE = /^(\d{4})-([1-4])$/;
const MAX_SHEETS = 24;

const XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function list(raw: string | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Нужно войти", { status: 401 });
  if (!canAccessSection(user, "kpi")) {
    return new Response("Раздел не найден", { status: 404 });
  }

  const url = new URL(request.url);
  const monthRaw = [...new Set(list(url.searchParams.get("months")))];
  const quarterRaw = [...new Set(list(url.searchParams.get("quarters")))];

  const months: Ym[] = [];
  for (const m of monthRaw) {
    const hit = MONTH_RE.exec(m);
    if (!hit) return new Response(`Неверный месяц: ${m}`, { status: 400 });
    months.push({ year: Number(hit[1]), month: Number(hit[2]) });
  }
  const quarters: Ym[] = [];
  for (const q of quarterRaw) {
    const hit = QUARTER_RE.exec(q);
    if (!hit) return new Response(`Неверный квартал: ${q}`, { status: 400 });
    quarters.push({
      year: Number(hit[1]),
      month: (Number(hit[2]) - 1) * 3 + 1,
    });
  }
  const total = months.length + quarters.length;
  if (total === 0)
    return new Response("Выберите месяцы или кварталы", { status: 400 });
  if (total > MAX_SHEETS) {
    return new Response(`Не больше ${MAX_SHEETS} листов за раз`, {
      status: 400,
    });
  }

  const bytes = await buildKpiWorkbook(user.organizationId, {
    months,
    quarters,
  });

  // Имя файла: один месяц/квартал — по нему, иначе по году (или общее).
  const years = new Set([...months, ...quarters].map((p) => p.year));
  const pad = (n: number) => String(n).padStart(2, "0");
  let name = "KPI_export";
  if (total === 1 && months[0])
    name = `KPI_${months[0].year}-${pad(months[0].month)}`;
  else if (total === 1 && quarters[0]) {
    name = `KPI_${quarters[0].year}-Q${Math.floor((quarters[0].month - 1) / 3) + 1}`;
  } else if (years.size === 1) name = `KPI_${[...years][0]}`;

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": XLSX,
      "Content-Disposition": `attachment; filename="${name}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}.xlsx`,
      "Cache-Control": "private, no-store",
    },
  });
}
