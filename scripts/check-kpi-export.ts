import "dotenv/config";
import { writeFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { db } from "../src/lib/db";
import { buildKpiWorkbook } from "../src/lib/kpi-export";

// Проверка экспорта KPI в .xlsx на локальной базе: npm run check:kpi-export
// (`server-only` в src/lib/kpi-export.ts снимается условием react-server).
//
// Эталон — цифры из Excel отдела (октябрь 2026): выручка октября 615 000,
// ноября 598 000, декабря 555 000, итого за 4 квартал 1 768 000.

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failed++;
}

/** Значения листа плоским списком строк (для поиска по тексту). */
function rows(ws: ExcelJS.Worksheet): (string | number)[][] {
  const out: (string | number)[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals: (string | number)[] = [];
    row.eachCell({ includeEmpty: true }, (c) => {
      const v = c.value;
      vals.push(typeof v === "number" ? v : v == null ? "" : String(v));
    });
    out.push(vals);
  });
  return out;
}

async function main() {
  const org = await db.organization.findFirstOrThrow({
    orderBy: { createdAt: "asc" },
  });
  const buf = await buildKpiWorkbook(org.id, {
    months: [
      { year: 2026, month: 11 },
      { year: 2026, month: 10 },
    ],
    quarters: [{ year: 2026, month: 12 }],
  });
  writeFileSync(process.argv[2] ?? "kpi-export-check.xlsx", buf);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const names = wb.worksheets.map((w) => w.name);
  check(
    "листы: месяцы по порядку, квартал после своих месяцев",
    JSON.stringify(names) ===
      JSON.stringify(["Октябрь 2026", "Ноябрь 2026", "4 квартал 2026"]),
    names.join(" | "),
  );

  const oct = rows(wb.getWorksheet("Октябрь 2026")!);
  const octGeneral = oct.find((r) => r[0] === "Общий план (без Авто)");
  check(
    "октябрь: выручка общего плана = 615 000",
    octGeneral?.[3] === 615000,
    String(octGeneral?.[3]),
  );

  const dev = oct.find((r) => r[1] === "Менеджер по развитию");
  check(
    "октябрь: план менеджера по развитию 8 встреч и 3 квалификации",
    dev?.[2] === 8 && dev?.[5] === 3,
    JSON.stringify(dev),
  );

  const assistantIdx = oct.findIndex((r) => r[1] === "Менеджер-ассистент");
  const lastDevIdx = oct.map((r) => r[1]).lastIndexOf("Менеджер по развитию");
  check(
    "октябрь: ассистенты ниже менеджеров по развитию",
    assistantIdx > lastDevIdx && lastDevIdx >= 0,
  );

  const weekBands = oct.filter((r) => String(r[0]).startsWith("Неделя "));
  check(
    "октябрь: 4 недели (по правилу среды)",
    weekBands.length === 4,
    weekBands.map((r) => r[0]).join(" ; "),
  );

  const nov = rows(wb.getWorksheet("Ноябрь 2026")!);
  check(
    "ноябрь: выручка = 598 000",
    nov.find((r) => r[0] === "Общий план (без Авто)")?.[3] === 598000,
  );

  const q = rows(wb.getWorksheet("4 квартал 2026")!);
  const qTotal = q.find((r) => r[0] === "Итого за квартал");
  check(
    "квартал: итог выручки = 1 768 000",
    qTotal?.[1] === 1768000,
    String(qTotal?.[1]),
  );
  const qDev = q.find((r) => r[1] === "Менеджер по развитию");
  check(
    "квартал: план менеджера по развитию 24 встречи и 9 квалификаций",
    qDev?.[2] === 24 && qDev?.[5] === 9,
    JSON.stringify(qDev),
  );
  check(
    "квартал: есть колонка «Месяц» в сделках",
    q.some((r) => r[0] === "Месяц" && r[1] === "Клиент"),
  );

  const novDev = nov.find((r) => r[1] === "Менеджер по развитию");
  check(
    "ноябрь (пустой месяц): план сделок по умолчанию = 1",
    novDev?.[8] === 1,
    JSON.stringify(novDev),
  );
  check(
    "квартал: план сделок по умолчанию = 1 на каждый месяц (3)",
    qDev?.[8] === 3,
    String(qDev?.[8]),
  );

  const novMeet = nov.find(
    (r) => r[1] === "Встречи / демо" && r[2] !== undefined && r[0] !== "",
  );
  const novQual = nov.find((r) => r[1] === "Квалифицировано");
  check(
    "ноябрь (пустой месяц): недельный план по умолчанию 2 встречи и 1 квалификация",
    novMeet?.[2] === 2 && novQual?.[2] === 1,
    JSON.stringify([novMeet, novQual]),
  );

  const managerHeader = oct.find((r) => r[0] === "Менеджер" && r[1] === "Чек");
  check("октябрь: блок «Менеджеры» присутствует", !!managerHeader);

  console.log(
    failed ? `\nПровалено проверок: ${failed}` : "\nВсе проверки пройдены.",
  );
  process.exitCode = failed ? 1 : 0;
}

main().finally(() => db.$disconnect());
