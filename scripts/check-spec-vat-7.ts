import { readFileSync } from "node:fs";
import { extractPlainText, fillDocxStrict } from "../src/lib/docx-fill";
import { prepareSpecTemplate } from "../src/lib/spec-prepare";
import { SPEC_TAG_NAMES, findTags } from "../src/lib/spec-tags";
import {
  computeSpecValues,
  specValuesToTags,
  unsupportedKopecks,
  type SpecEditableValues,
} from "../src/lib/spec-values";

// Проверка перехода на НДС 7%: расчёт итогов, метка ставки и тариф часа
// доп. услуг в встроенных шаблонах, автоподготовка не зависит от ставки.
//
//   npx tsx scripts/check-spec-vat-7.ts

let failed = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = String(actual) === String(expected);
  if (!ok) failed++;
  console.log(`${ok ? "  ok " : "FAIL "} ${name}${ok ? "" : `\n      ждали: ${expected}\n      есть:  ${actual}`}`);
}

const editable: SpecEditableValues = {
  platformNet: "170000",
  includeObjects: true,
  objectsCount: 1,
  includeUsers: true,
  usersCount: 1,
  includeMediaPlan: true,
  mediaPlanNet: "5000",
  unitObjectNet: "15000",
  unitUserNet: "4000",
  unitMediaPlanNet: "5000",
};

(async () => {
  console.log("\nРасчёт при НДС 7%:");
  const values = computeSpecValues(editable, 7, "BUILDER");
  check("платформа с НДС", values.t22.platform.gross.toFixed(2), "181900.00");
  check("НДС платформы", values.t22.platform.vat.toFixed(2), "11900.00");
  check("объекты с НДС", values.t22.objects!.gross.toFixed(2), "16050.00");
  check("пользователи с НДС", values.t22.users!.gross.toFixed(2), "4280.00");
  check("медиаплан с НДС", values.t22.mediaPlan!.gross.toFixed(2), "5350.00");
  check("в месяц (с НДС)", values.monthly.gross.toFixed(2), "207580.00");
  check("за этап (с НДС)", values.stage.gross.toFixed(2), "103790.00");
  check("час доп. услуг с НДС", values.extraHour.gross.toFixed(2), "3745.00");
  check("копейки допустимы", unsupportedKopecks(values).join(",") || "—", "—");

  const tags = specValuesToTags(values);
  check("метка VAT_PCT", tags.VAT_PCT, "7");
  check("метка EXTRA_HOUR_SUM", tags.EXTRA_HOUR_SUM, "3 745");
  check("метка EXTRA_HOUR_WORDS", tags.EXTRA_HOUR_WORDS, "три тысячи семьсот сорок пять");

  console.log("\nВстроенные шаблоны:");
  for (const name of ["builder-cloud", "auto-dealer-cloud"]) {
    const bytes = readFileSync(`templates/spec/${name}.docx`);
    const found = findTags(await extractPlainText(bytes));
    const missing = [...SPEC_TAG_NAMES].filter((t) => !found.includes(t));
    check(`${name}: все метки на месте`, missing.join(",") || "—", "—");

    const filled = await fillDocxStrict(bytes, specValuesToTags(values));
    const text = await extractPlainText(filled.bytes);
    check(`${name}: нет «(5%)»`, /НДС\s*\(\s*5\s*%/.test(text), false);
    check(`${name}: есть «(7%)»`, /НДС \(7%\)/.test(text), true);
    check(`${name}: нет 3 675`, /3[\s ]675/.test(text), false);
    check(`${name}: есть 3 745`, /3[\s ]745 \(три тысячи семьсот сорок пять\) рублей/.test(text), true);
  }

  console.log("\nАвтоподготовка не зависит от ставки:");
  const once = await prepareSpecTemplate(readFileSync("templates/spec/builder-cloud.docx"));
  const twice = await prepareSpecTemplate(once.bytes);
  check("повторный прогон ничего не меняет", twice.report.steps.every((s) => s.count === 0), true);

  console.log(failed === 0 ? "\nВсё сходится.\n" : `\nПровалено проверок: ${failed}\n`);
  process.exit(failed === 0 ? 0 : 1);
})();
