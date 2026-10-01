import "server-only";

import ExcelJS from "exceljs";
import {
  DEFAULT_METRIC_LABELS,
  effectivePlan,
  MONTH_NAMES,
  ROLE_LABEL,
  metricsFor,
  pct,
  quarterOf,
  toneOf,
  weeksOfMonth,
  type KpiTone,
  type Ym,
} from "./kpi";
import { loadKpi, type KpiData } from "./kpi-data";
import {
  activityPeopleOf,
  summarizePeriod,
  type PeriodSummary,
  type Segment,
} from "./kpi-summary";

// Экспорт KPI в .xlsx: каждый выбранный месяц — отдельный лист (сводка по
// сотрудникам, недели, выручка, сделки, менеджеры), каждый выбранный квартал —
// тоже отдельный лист (сводка квартала). Числа пишутся настоящими числами, а
// не строками; прочерк («-» в ячейке плана/факта) выводится как «—».

const RUB = '#,##0 "₽"';
const PCT = "0%";
const DASH = "—";

const TONE_COLOR: Record<KpiTone, string | null> = {
  ok: "FF15803D",
  warn: "FFB45309",
  danger: "FFDC2626",
  none: null,
};

const HEAD_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE9ECEF" },
};
const WEEK_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF4F6F8" },
};

const DIRECTION_LABEL = { AUTO: "Авто", REALTY: "Недвижимость" } as const;

export type KpiExportRequest = {
  months: Ym[];
  /** Кварталы: любой месяц квартала достаточно, лист строится на весь квартал. */
  quarters: Ym[];
};

const monthTitle = (m: Ym) => `${MONTH_NAMES[m.month - 1]} ${m.year}`;

/** Лист под записью: курсор строки и короткие помощники оформления. */
class SheetWriter {
  row = 1;
  constructor(readonly ws: ExcelJS.Worksheet) {}

  skip(n = 1) {
    this.row += n;
  }

  title(text: string) {
    const r = this.ws.getRow(this.row++);
    r.getCell(1).value = text;
    r.getCell(1).font = { bold: true, size: 14 };
    this.skip();
  }

  block(text: string) {
    const r = this.ws.getRow(this.row++);
    r.getCell(1).value = text;
    r.getCell(1).font = { bold: true, size: 12 };
  }

  header(cells: string[]) {
    const r = this.ws.getRow(this.row++);
    cells.forEach((text, i) => {
      const c = r.getCell(i + 1);
      c.value = text;
      c.font = { bold: true };
      c.fill = HEAD_FILL;
      c.alignment = {
        vertical: "middle",
        horizontal: i === 0 ? "left" : "center",
        wrapText: true,
      };
      c.border = { bottom: { style: "thin" } };
    });
  }

  /** Строка значений; `fmts[i]` — числовой формат ячейки, `tones[i]` — цвет
   * шрифта (для процентов). */
  data(
    values: (string | number | null)[],
    opts: {
      fmts?: (string | undefined)[];
      tones?: (KpiTone | undefined)[];
      bold?: boolean;
      topBorder?: boolean;
    } = {},
  ) {
    const r = this.ws.getRow(this.row++);
    values.forEach((v, i) => {
      const c = r.getCell(i + 1);
      c.value = v;
      const fmt = opts.fmts?.[i];
      if (fmt && typeof v === "number") c.numFmt = fmt;
      const tone = opts.tones?.[i];
      const color = tone ? TONE_COLOR[tone] : null;
      c.font = {
        bold: opts.bold ?? false,
        ...(color ? { color: { argb: color } } : {}),
      };
      if (i > 0 && typeof v === "number") c.alignment = { horizontal: "right" };
      else if (i > 0) c.alignment = { horizontal: "center" };
      if (opts.topBorder)
        c.border = { top: { style: "medium", color: { argb: "FF9AA4B2" } } };
    });
  }

  band(text: string, cols: number) {
    const r = this.ws.getRow(this.row);
    this.ws.mergeCells(this.row, 1, this.row, cols);
    const c = r.getCell(1);
    c.value = text;
    c.font = { bold: true };
    c.fill = WEEK_FILL;
    this.row++;
  }
}

/** % как доля (для формата 0%) и цвет по порогам; null — прочерк. */
function pctCell(
  fact: number,
  plan: number,
): { v: number | string; tone: KpiTone } {
  const p = pct(fact, plan);
  return p === null
    ? { v: DASH, tone: "none" }
    : { v: p / 100, tone: toneOf(p) };
}

function writePeopleSummary(w: SheetWriter, s: PeriodSummary) {
  w.block("Сводка по сотрудникам");
  w.header([
    "Сотрудник",
    "Должность",
    `${DEFAULT_METRIC_LABELS.MEETINGS}: план`,
    "факт",
    "%",
    `${DEFAULT_METRIC_LABELS.QUALIFIED}: план`,
    "факт",
    "%",
    "Сделки: план",
    "Сделки: факт",
  ]);
  const firstAssistant = s.people.findIndex((p) => p.isAssistant);
  s.people.forEach((p, i) => {
    const m = pctCell(p.meetings.fact, p.meetings.plan);
    const q = pctCell(p.qualified.fact, p.qualified.plan);
    const topBorder = i === firstAssistant && firstAssistant > 0;
    if (p.salesOnly) {
      // Менеджер без «Активности»: прочерки; факт сделок — число его сделок.
      w.data([
        p.person.name,
        "Менеджер",
        DASH,
        DASH,
        DASH,
        DASH,
        DASH,
        DASH,
        DASH,
        p.deals.fact,
      ]);
    } else if (p.isAssistant) {
      w.data(
        [
          p.person.name,
          ROLE_LABEL.ASSISTANT,
          p.meetings.plan,
          p.meetings.fact,
          m.v,
          DASH,
          DASH,
          DASH,
          DASH,
          DASH,
        ],
        { fmts: [, , , , PCT], tones: [, , , , m.tone], topBorder },
      );
    } else {
      w.data(
        [
          p.person.name,
          ROLE_LABEL.DEVELOPMENT,
          p.meetings.plan,
          p.meetings.fact,
          m.v,
          p.qualified.plan,
          p.qualified.fact,
          q.v,
          p.deals.plan,
          p.deals.fact,
        ],
        {
          fmts: [, , , , PCT, , , PCT],
          tones: [, , , , m.tone, , , q.tone],
          topBorder,
        },
      );
    }
  });
  if (s.people.length === 0) w.data(["В таблице нет сотрудников"]);
}

function writeWeeks(w: SheetWriter, data: KpiData, month: Ym) {
  w.block("Активность по неделям");
  const people = activityPeopleOf(data.people, data.entries);
  const byKey = new Map(
    data.entries.map((e) => [
      `${e.personId}|${e.metric}|${e.scope}|${e.periodStart}`,
      e,
    ]),
  );
  const firstAssistant = people.findIndex((p) => p.role === "ASSISTANT");
  for (const week of weeksOfMonth(month)) {
    w.skip();
    w.band(`Неделя ${week.label}`, 7);
    w.header([
      "Сотрудник",
      "Показатель",
      "План",
      "Факт",
      "%",
      "Примечание к плану",
      "Примечание к факту",
    ]);
    people.forEach((person, pi) => {
      metricsFor(person.role).forEach((metric, mi) => {
        const e = byKey.get(`${person.id}|${metric}|WEEK|${week.start}`);
        const plan = effectivePlan(e, person.role, metric, "WEEK");
        const fact = e ? e.fact : 0;
        const p = pctCell(fact ?? 0, plan ?? 0);
        w.data(
          [
            mi === 0 ? person.name : "",
            e?.label || DEFAULT_METRIC_LABELS[metric],
            plan === null ? DASH : plan,
            fact === null ? DASH : fact,
            p.v,
            e?.planNote ?? "",
            e?.factNote ?? "",
          ],
          {
            fmts: [, , , , PCT],
            tones: [, , , , p.tone],
            topBorder: mi === 0 && pi === firstAssistant && firstAssistant > 0,
          },
        );
      });
    });
  }
}

function writeRevenue(w: SheetWriter, general: Segment, auto: Segment) {
  w.block("Выручка");
  w.header([
    "Сегмент",
    "План: оптимум",
    "План: максимум",
    "Факт",
    "Отклонение от оптимума",
    "% к оптимуму",
    "Отклонение от максимума",
    "% к максимуму",
  ]);
  for (const [name, seg] of [
    ["Общий план (без Авто)", general],
    ["Авто", auto],
  ] as const) {
    const o = pctCell(seg.total, seg.planOptimal);
    const m = pctCell(seg.total, seg.planMax);
    w.data(
      [
        name,
        seg.planOptimal,
        seg.planMax,
        seg.total,
        seg.planOptimal > 0 ? seg.total - seg.planOptimal : DASH,
        o.v,
        seg.planMax > 0 ? seg.total - seg.planMax : DASH,
        m.v,
      ],
      {
        fmts: [, RUB, RUB, RUB, RUB, PCT, RUB, PCT],
        tones: [, , , , , o.tone, , m.tone],
      },
    );
  }
}

function writeDeals(w: SheetWriter, s: PeriodSummary, withMonth: boolean) {
  w.block(withMonth ? "Сделки квартала" : "Сделки месяца");
  w.header([
    ...(withMonth ? ["Месяц"] : []),
    "Клиент",
    "Сумма",
    "Направление",
    "Менеджер",
    "Заметка",
    "Договор подписан",
  ]);
  const deals = withMonth
    ? [...s.deals].sort((a, b) => a.year - b.year || a.month - b.month)
    : s.deals;
  for (const d of deals) {
    w.data(
      [
        ...(withMonth ? [monthTitle(d)] : []),
        d.client,
        d.amount,
        d.direction ? DIRECTION_LABEL[d.direction] : "",
        d.managerName,
        d.note,
        d.confirmed ? "Да" : "Нет",
      ],
      { fmts: withMonth ? [, , RUB] : [, RUB] },
    );
  }
  if (deals.length === 0) w.data(["Сделок за период нет"]);
}

function writeManagers(w: SheetWriter, s: PeriodSummary) {
  w.block("Менеджеры");
  w.header([
    "Менеджер",
    "Чек",
    "Сделок",
    "Средний чек",
    "В т. ч. Авто: сумма",
    "В т. ч. Авто: сделок",
  ]);
  for (const m of s.managers) {
    w.data(
      [
        m.name,
        m.sum,
        m.count,
        m.count ? m.sum / m.count : 0,
        m.autoSum,
        m.autoCount,
      ],
      {
        fmts: [, RUB, , RUB, RUB],
      },
    );
  }
  if (s.managers.length === 0) {
    w.data(["Сделок за период нет"]);
    return;
  }
  const sum = s.managers.reduce((a, m) => a + m.sum, 0);
  const count = s.managers.reduce((a, m) => a + m.count, 0);
  w.data(
    [
      "Всего",
      sum,
      count,
      count ? sum / count : 0,
      s.managers.reduce((a, m) => a + m.autoSum, 0),
      s.managers.reduce((a, m) => a + m.autoCount, 0),
    ],
    { fmts: [, RUB, , RUB, RUB], bold: true },
  );
}

function setup(ws: ExcelJS.Worksheet) {
  const widths = [26, 24, 14, 14, 14, 14, 14, 14, 14, 14, 14];
  widths.forEach((width, i) => (ws.getColumn(i + 1).width = width));
  ws.views = [{ showGridLines: true }];
}

async function loadFor(orgId: string, months: Ym[]) {
  return loadKpi(orgId, months, {
    dealMonths: months,
    reserveUpTo: months[months.length - 1],
    prevQuarter: [],
  });
}

/** Собирает книгу: листы месяцев и кварталов в хронологическом порядке
 * (квартал — после своих месяцев). */
export async function buildKpiWorkbook(
  organizationId: string,
  req: KpiExportRequest,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Smartis.Flite";

  type Job =
    | { kind: "month"; ym: Ym; order: number }
    | { kind: "quarter"; ym: Ym; order: number };
  const jobs: Job[] = [
    ...req.months.map<Job>((ym) => ({
      kind: "month",
      ym,
      order: ym.year * 100 + ym.month * 2,
    })),
    ...req.quarters.map<Job>((ym) => {
      const last = quarterOf(ym).months[2];
      return {
        kind: "quarter",
        ym,
        order: last.year * 100 + last.month * 2 + 1,
      };
    }),
  ].sort((a, b) => a.order - b.order);

  for (const job of jobs) {
    if (job.kind === "month") {
      const data = await loadFor(organizationId, [job.ym]);
      const s = summarizePeriod(data, [job.ym]);
      const ws = wb.addWorksheet(monthTitle(job.ym));
      setup(ws);
      const w = new SheetWriter(ws);
      w.title(monthTitle(job.ym));
      writePeopleSummary(w, s);
      w.skip();
      writeWeeks(w, data, job.ym);
      w.skip();
      writeRevenue(w, s.general, s.auto);
      w.skip();
      writeDeals(w, s, false);
      w.skip();
      writeManagers(w, s);
    } else {
      const q = quarterOf(job.ym);
      const data = await loadFor(organizationId, q.months);
      const s = summarizePeriod(data, q.months);
      const name = `${q.q} квартал ${q.months[0].year}`;
      const ws = wb.addWorksheet(name);
      setup(ws);
      const w = new SheetWriter(ws);
      w.title(name);
      writePeopleSummary(w, s);
      w.skip();

      // Выручка по месяцам квартала + итог.
      w.block("Выручка по месяцам");
      w.header([
        "Месяц",
        "Общий: факт",
        "Общий: оптимум",
        "Общий: максимум",
        "Авто: факт",
        "Авто: оптимум",
        "Авто: максимум",
      ]);
      for (const m of q.months) {
        const ms = summarizePeriod(data, [m]);
        w.data(
          [
            monthTitle(m),
            ms.general.total,
            ms.general.planOptimal,
            ms.general.planMax,
            ms.auto.total,
            ms.auto.planOptimal,
            ms.auto.planMax,
          ],
          { fmts: [, RUB, RUB, RUB, RUB, RUB, RUB] },
        );
      }
      w.data(
        [
          "Итого за квартал",
          s.general.total,
          s.general.planOptimal,
          s.general.planMax,
          s.auto.total,
          s.auto.planOptimal,
          s.auto.planMax,
        ],
        { fmts: [, RUB, RUB, RUB, RUB, RUB, RUB], bold: true, topBorder: true },
      );
      w.skip();
      writeRevenue(w, s.general, s.auto);
      w.skip();
      writeDeals(w, s, true);
      w.skip();
      writeManagers(w, s);
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
