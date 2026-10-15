import { extractPlainText, replaceTextInDocx, type TextRule } from "./docx-fill";
import { findTags } from "./spec-tags";

// Автоподготовка шаблона Спецификации при загрузке: из согласованного
// юристами документа (прочерки «_____,00 рублей», «включая НДС (5%)», «3 675
// (…) рублей») получается шаблон с метками, и админу не нужно расставлять
// их руками в Word.
//
// Модуль чистый, без "server-only": то же правило используют route загрузки
// (src/app/api/settings/spec-templates/route.ts) и скрипт
// scripts/prepare-spec-template.ts для встроенных шаблонов.
//
// Правила не зависят от ставки НДС: «(5%)» и «(7%)» одинаково превращаются в
// «({{VAT_PCT}}%)», и один и тот же файл подходит под любую ставку.
// Файл, в котором метки уже стоят, не ломается: правила просто ничего не
// находят, а недостающее покажет validateSpecTemplate.

/** Денежные ячейки таблиц 2.2 и 2.3 текстом неразличимы — во всех стоит
 * «_____,00 рублей, без НДС», отличает их только порядок в документе. */
const MONEY_ROWS = [
  "T22_PLATFORM",
  "T22_OBJECTS",
  "T22_USERS",
  "T22_MEDIAPLAN",
  "T23_OBJECT",
  "T23_USER",
  "T23_MEDIAPLAN",
] as const;

/** Любая запись ставки в скобках после «НДС»: (5%), (7 %), (7,5%). */
const VAT_PAREN = String.raw`\(\s*\d+(?:[.,]\d+)?\s*%\s*\)`;

/** Не больше строк, чем MONEY_ROWS: лишние ячейки оставляем нетронутыми, а
 * validate/отчёт сообщит о расхождении, а не упадёт по индексу. */
function moneyRow(occurrence: number): string {
  return MONEY_ROWS[occurrence] ?? `UNEXPECTED_ROW_${occurrence}`;
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type PrepareStep = { title: string; count: number };

export type SpecPrepareReport = {
  /** Файл уже содержал метки денежных ячеек — расстановку пропустили. */
  alreadyTagged: boolean;
  /** Ставки НДС, найденные в исходном тексте (для информации админу). */
  vatRatesFound: string[];
  steps: PrepareStep[];
  warnings: string[];
};

function moneyRules(dash: string): { title: string; rule: TextRule }[] {
  const d = escapeForRegex(dash);
  // Пять «_» в норме; в одном из документов шесть, а сумма НДС набрана как
  // «____0,00» — опечатка составителя, которую подстановка должна пережить.
  const money = String.raw`[_0]+,00`;

  return [
    {
      title: "Платёж за этап (п.1.2.1 и п.1.2.2)",
      rule: {
        find: new RegExp(
          `_+ \\(_+\\) рублей _+ копеек, включая НДС ${VAT_PAREN} ${d} ${money} рублей\\.?`,
          "g",
        ),
        replace:
          `{{STAGE_SUM}} ({{STAGE_WORDS}}) {{STAGE_RUB}} {{STAGE_KOP}} копеек, ` +
          `включая НДС ({{VAT_PCT}}%) ${dash} {{STAGE_VAT}} рублей`,
      },
    },
    {
      title: "Ежемесячная стоимость (п.2.1)",
      rule: {
        find: new RegExp(
          `_+ \\(_+\\) рублей (?:00|_+) копеек, включая НДС ${VAT_PAREN} ${d} ${money} рублей`,
          "g",
        ),
        replace:
          `{{MONTH_SUM}} ({{MONTH_WORDS}}) {{MONTH_RUB}} {{MONTH_KOP}} копеек, ` +
          `включая НДС ({{VAT_PCT}}%) ${dash} {{MONTH_VAT}} рублей`,
      },
    },
    {
      title: "Подпись строки объектов",
      rule: {
        find: /за\s+\d*\s*_+\s*(?:объектов недвижимости|дилерских центров)/g,
        replace: "за {{T22_OBJECTS_LABEL}}",
      },
    },
    {
      title: "Подпись строки пользователей",
      rule: {
        find: /за\s+_+\s+авторизованн\S+\s+пользовател\S+\s+Заказчика/g,
        replace: "за {{T22_USERS_LABEL}}",
      },
    },
    {
      title: "Ячейки «без НДС» таблиц 2.2 и 2.3",
      rule: {
        find: new RegExp(`${money} рублей, без НДС`, "g"),
        replace: (i) => `{{${moneyRow(i)}_NET}} рублей, без НДС`,
      },
    },
    {
      title: "Ячейки «с НДС» и сумма НДС таблиц 2.2 и 2.3",
      rule: {
        find: new RegExp(
          `${money} рублей, включая НДС ${VAT_PAREN} ${d} ${money} рублей`,
          "g",
        ),
        replace: (i) =>
          `{{${moneyRow(i)}_GROSS}} рублей, включая НДС ({{VAT_PCT}}%) ${dash} {{${moneyRow(i)}_VAT}} рублей`,
      },
    },
  ];
}

/** Тире перед суммой НДС — дефис, короткое или длинное: документ правили в
 * разных редакторах. Берём то, что реально стоит в файле. */
function detectDash(text: string): string {
  const m = text.match(new RegExp(`включая НДС\\s*${VAT_PAREN}\\s*([-–—])\\s*[_0]+,00`));
  return m?.[1] ?? "-";
}

export type SpecPrepareResult = { bytes: Buffer; report: SpecPrepareReport };

export async function prepareSpecTemplate(
  source: Buffer | Uint8Array,
): Promise<SpecPrepareResult> {
  const sourceText = await extractPlainText(source); // бросает, если не .docx
  const tags = findTags(sourceText);

  const vatRatesFound = [
    ...new Set(
      [...sourceText.matchAll(/НДС\s*\(\s*(\d+(?:[.,]\d+)?)\s*%\s*\)/g)].map((m) =>
        m[1].replace(",", "."),
      ),
    ),
  ];

  const alreadyTagged = tags.includes("T22_PLATFORM_NET");
  const rules: { title: string; rule: TextRule }[] = [];

  if (!alreadyTagged) rules.push(...moneyRules(detectDash(sourceText)));

  // Тариф дополнительных услуг: сумма с НДС набрана числом и прописью прямо в
  // тексте («3 675 (три тысячи …) рублей, включая НДС (5%)»). Смена ставки
  // сама её не пересчитает — превращаем в метки.
  if (!tags.includes("EXTRA_HOUR_SUM")) {
    rules.push({
      title: "Стоимость дополнительной услуги за час",
      rule: {
        find: /\d[\d  ]*\([а-яёА-ЯЁ\s-]+\)\s+рублей(?=,?\s*включая НДС)/g,
        replace: "{{EXTRA_HOUR_SUM}} ({{EXTRA_HOUR_WORDS}}) {{EXTRA_HOUR_RUB}}",
      },
    });
  }

  // Всё, что осталось от «НДС (N%)», — в метку ставки. Идёт последним, чтобы
  // не мешать правилам выше, которым «(5%)» нужен в исходном виде.
  rules.push({
    title: "Ставка НДС в тексте",
    rule: {
      find: new RegExp(`НДС\\s*${VAT_PAREN}`, "g"),
      replace: "НДС ({{VAT_PCT}}%)",
    },
  });

  const { bytes, applied } = await replaceTextInDocx(
    source,
    rules.map((r) => r.rule),
  );

  const steps = rules.map((r, i) => ({ title: r.title, count: applied[i] }));
  const warnings: string[] = [];

  if (vatRatesFound.length > 1) {
    warnings.push(
      `В документе встречаются разные ставки НДС: ${vatRatesFound.join("%, ")}%. Все они заменены одной меткой — проверьте текст.`,
    );
  }

  const moneyCells = steps.find((s) => s.title.startsWith("Ячейки «без НДС»"));
  if (moneyCells && moneyCells.count > MONEY_ROWS.length) {
    warnings.push(
      `Денежных ячеек в таблицах ${moneyCells.count}, а ожидается ${MONEY_ROWS.length}. Структура таблиц отличается от стандартной — проверьте шаблон.`,
    );
  }

  return {
    bytes,
    report: { alreadyTagged, vatRatesFound, steps, warnings },
  };
}
