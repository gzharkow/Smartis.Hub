import "dotenv/config";
import { db } from "../src/lib/db";

// Разовый перенос листа «Октябрь2026» из «KPI Мес.xlsx» в раздел «KPI план/факт».
// Данные вписаны вручную по таблице (лист слишком неоднороден для
// автоматического разбора). Повторный запуск ничего не дублирует: если в
// организации уже есть участники KPI — скрипт останавливается.
//
// Что НЕ переносится и почему:
//  - факты по неделям: в файле они равны 0 (названия компаний лежали
//    только в комментариях) — переносим компании тегами, число не выдумываем;
//  - план Ксюши: в файле у неё вместо чисел подписи «План встречи»;
//  - менеджеры сделок: формулы в блоке «Менеджеры» битые (#REF!) —
//    проставьте менеджера в таблице сделок вручную.

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const list = (s: string) =>
  s
    .split(/,| и /)
    .map((x) => x.trim())
    .filter(Boolean);

// понедельник недели → [встречи, квалифицированные] по каждому человеку
const WEEKS = ["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"];
const COMPANIES: Record<string, Record<string, { m?: string; q?: string }>> = {
  "2026-10-05": {
    Саша: { m: "Философия, Гк Депо, ПМК 5, Русские сезоны", q: "Аструм, МиК" },
    Глеб: { m: "СИМ", q: "СИМ" },
    Ксюша: {
      m: "Философия идеалистов, русские сезоны, пмк5, гк депо, дк харизмы",
      q: "философия идеалистов, русские сезоны, пмк 5, гк демо, дк харизмы",
    },
  },
  "2026-10-12": {
    Саша: { m: "Девелопмент юг, Аструм", q: "Девелопмент Юг" },
    Глеб: { m: "Chery-86, KSI", q: "Орехово АЦ" },
    Ксюша: {
      m: "Символ Девелопмент, ГК Сальвия, ГК Новоселье, Ас Авто, Бел Девелопмент",
      q: "Символ Девелопмент и Бел Девелопмент",
    },
  },
  "2026-10-19": {
    Саша: { m: "Новые Ватутинки, Сз структура, Творчество", q: "Творчеств, Абсолют девелопмент" },
    Ксюша: { m: "Веспер, Артекс, Асавто, Нижний Новгород", q: "Веспер, Артекс, Нижний Новгород" },
  },
};

const DEALS: [year: number, month: number, client: string, amount: number][] = [
  [2026, 10, "Глобалстрой", 130000],
  [2026, 10, "Академия Девелопмент", 195000],
  [2026, 10, "Дело", 110000],
  [2026, 10, "Структура", 180000],
  [2026, 11, "Донстрой", 350000],
  [2026, 11, "Фонд Реновации Мск", 248000],
  [2026, 12, "Абсолют", 315000],
  [2026, 12, "Форум Групп", 240000],
];

// «Резерв Q1 27» и блок «Авто» под ним — ожидаемые сделки. Пометки «И»/«С»
// из названий (Stenoy - С, Расцветай - И) сохранены заметкой.
const RESERVE: [client: string, amount: number, note: string | null, auto: boolean][] = [
  ["Stenoy", 120000, "С", false],
  ["Ривер хаус", 115000, null, false],
  ["Расцветай", 520000, "И", false],
  ["Девелопмент Юг", 230000, "И", false],
  ["Форсайт девелопмент", 220000, "С", false],
  ["КанАвто (допрод)", 60000, "блок «Авто» в Excel", true],
  ["Орехово АЦ", 230000, "блок «Авто» в Excel", true],
  ["Море Авто", 293000, "блок «Авто» в Excel", true],
  ["СИМ Авто", 270000, "блок «Авто» в Excel", true],
];

async function main() {
  const org = await db.organization.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  if ((await db.kpiPerson.count({ where: { organizationId: org.id } })) > 0) {
    console.log("В организации уже есть участники KPI — ничего не делаю.");
    return;
  }

  const names: [string, boolean, boolean][] = [
    ["Саша", true, false],
    ["Глеб", true, false],
    ["Ваня", true, false],
    ["Ксюша", true, false], // ассистент — см. role ниже
    ["Курочкин", false, true],
    ["Жарков", false, true],
    ["Калинин", false, true],
  ];
  const ids = new Map<string, string>();
  for (const [i, [name, inActivity, inSales]] of names.entries()) {
    const p = await db.kpiPerson.create({
      data: {
        organizationId: org.id,
        name,
        inActivity,
        inSales,
        role: name === "Ксюша" ? "ASSISTANT" : "DEVELOPMENT",
        position: i,
      },
    });
    ids.set(name, p.id);
  }

  // План недель: 2 встречи и 1 квалификация у Саши/Глеба/Вани; сделка — 1 на месяц.
  for (const who of ["Саша", "Глеб", "Ваня"]) {
    for (const week of WEEKS) {
      for (const [metric, plan] of [["MEETINGS", 2], ["QUALIFIED", 1]] as const) {
        await db.kpiEntry.create({
          data: {
            organizationId: org.id,
            personId: ids.get(who)!,
            metric,
            scope: "WEEK",
            periodStart: d(week),
            plan,
          },
        });
      }
    }
    await db.kpiEntry.create({
      data: {
        organizationId: org.id,
        personId: ids.get(who)!,
        metric: "DEALS",
        scope: "MONTH",
        periodStart: d("2026-10-01"),
        plan: 1,
      },
    });
  }

  // Компании из комментариев — тегами к факту.
  for (const [week, byPerson] of Object.entries(COMPANIES)) {
    for (const [who, c] of Object.entries(byPerson)) {
      for (const [metric, raw] of [["MEETINGS", c.m], ["QUALIFIED", c.q]] as const) {
        if (!raw) continue;
        await db.kpiEntry.upsert({
          where: {
            organizationId_personId_metric_scope_periodStart: {
              organizationId: org.id,
              personId: ids.get(who)!,
              metric,
              scope: "WEEK",
              periodStart: d(week),
            },
          },
          create: {
            organizationId: org.id,
            personId: ids.get(who)!,
            metric,
            scope: "WEEK",
            periodStart: d(week),
            companies: list(raw),
          },
          update: { companies: list(raw) },
        });
      }
    }
  }

  for (const month of [10, 11, 12]) {
    await db.kpiMonth.create({
      data: { organizationId: org.id, year: 2026, month, planOptimal: 500000, planMax: 600000 },
    });
  }
  for (const [i, [year, month, client, amount]] of DEALS.entries()) {
    await db.kpiDeal.create({
      data: { organizationId: org.id, year, month, client, amount, position: i },
    });
  }
  for (const [i, [client, amount, note, auto]] of RESERVE.entries()) {
    await db.kpiDeal.create({
      data: {
        organizationId: org.id,
        year: 2027,
        month: 1,
        client,
        amount,
        note,
        direction: auto ? "AUTO" : null,
        isReserve: true,
        position: i,
      },
    });
  }
  console.log("Готово: октябрь 2026 перенесён.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
