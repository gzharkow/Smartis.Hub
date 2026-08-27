import Decimal from "decimal.js";
import { deriveQuoteDocument, type BuilderCalculatorConfig } from "../src/lib/quote-calculator";
import {
  computeSpecValues,
  deriveSpecValues,
  objectsLabel,
  unsupportedKopecks,
  usersLabel,
  type SpecEditableValues,
  type SpecQuoteInput,
} from "../src/lib/spec-values";
import { moneyParts, numberToWordsRu } from "../src/lib/rubles-in-words";

// Арифметика и язык Спецификации, без базы и без Word: npm run check:spec
//
// Эталон — присланный заказчиком заполненный вручную документ «Тест КП».
// В нём была ошибка: ячейка «178 000,00 / НДС 8 000,00» вместо
// «178 500,00 / 8 500,00» (170 000 × 1,05). Итог 203 700 при этом посчитан
// верно. Ради устранения ровно этого класса ошибок фича и делается, поэтому
// проверка держит правильные числа, а не числа из образца.

let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = String(actual);
  const e = String(expected);
  if (a === e) {
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}\n      ожидалось: ${e}\n      получено:  ${a}`);
  }
}

/** Неразрывные пробелы в ожидаемых значениях писать неудобно — сравниваем
 * по обычному. */
function plainSpaces(value: string): string {
  return value.replace(/ /g, " ");
}

function quoteFrom(config: BuilderCalculatorConfig, vatRatePct = 5): SpecQuoteInput {
  return {
    vatRatePct,
    calculatorConfig: config,
    sections: deriveQuoteDocument(config).sections,
  };
}

const REFERENCE: BuilderCalculatorConfig = {
  clientType: "BUILDER",
  enterpriseLicense: true,
  customCrmIntegration: true,
  objectsCount: 1,
  supportUsersCount: 1,
  mediaPlanUpload: true,
  postViewEventsTier: "NONE",
  cdpSegments: false,
  antifraud: false,
  box: false,
};

function money(label: string, actual: { net: Decimal; gross: Decimal; vat: Decimal }, net: string, gross: string, vat: string) {
  check(`${label} — без НДС`, actual.net.toFixed(2), net);
  check(`${label} — с НДС`, actual.gross.toFixed(2), gross);
  check(`${label} — НДС`, actual.vat.toFixed(2), vat);
}

// ─────────────────────────────  Эталонный расчёт  ─────────────────────────────

console.log("\nЭталон «Тест КП» — застройщик, enterprise + нестандартная CRM, 1 объект, 1 пользователь, медиапланы, НДС 5%:");
{
  const { editable, issues } = deriveSpecValues(quoteFrom(REFERENCE));
  const values = computeSpecValues(editable, 5);

  check("жалоб при сопоставлении нет", issues.map((i) => i.code).join(",") || "—", "—");

  money("табл. 2.2 платформа", values.t22.platform, "170000.00", "178500.00", "8500.00");
  money("табл. 2.2 объекты", values.t22.objects!, "15000.00", "15750.00", "750.00");
  money("табл. 2.2 пользователи", values.t22.users!, "4000.00", "4200.00", "200.00");
  money("табл. 2.2 медиапланы", values.t22.mediaPlan!, "5000.00", "5250.00", "250.00");

  money("табл. 2.3 объект", values.t23.object, "15000.00", "15750.00", "750.00");
  money("табл. 2.3 пользователь", values.t23.user, "4000.00", "4200.00", "200.00");
  money("табл. 2.3 медиаплан", values.t23.mediaPlan, "5000.00", "5250.00", "250.00");

  money("п.2.1 ежемесячно", values.monthly, "194000.00", "203700.00", "9700.00");
  money("п.1.2 этап", values.stage, "97000.00", "101850.00", "4850.00");

  const stage = moneyParts(values.stage.gross);
  check("п.1.2 сумма цифрами", plainSpaces(stage.sum), "101 850");
  check("п.1.2 прописью", stage.words, "сто одна тысяча восемьсот пятьдесят");
  check("п.1.2 слово рублей", stage.rub, "рублей");
  check("п.1.2 копейки", stage.kop, "00");

  const month = moneyParts(values.monthly.gross);
  check("п.2.1 сумма цифрами", plainSpaces(month.sum), "203 700");
  check("п.2.1 прописью", month.words, "двести три тысячи семьсот");

  check("подпись объектов", objectsLabel(values.objectsCount), "1 объект недвижимости");
  check("подпись пользователей", usersLabel(values.usersCount), "1 авторизованного пользователя Заказчика");
  check("копейки допустимы", unsupportedKopecks(values).join(",") || "—", "—");
}

// ─────────────────────────────  Итог против цены за единицу  ─────────────────────────────

console.log("\nТри объекта — таблица 2.2 держит итог, таблица 2.3 остаётся ценой за единицу:");
{
  const { editable } = deriveSpecValues(quoteFrom({ ...REFERENCE, objectsCount: 3 }));
  const values = computeSpecValues(editable, 5);

  check("табл. 2.2 объекты (3 × 15 000)", values.t22.objects!.net.toFixed(2), "45000.00");
  check("табл. 2.3 объект (за единицу)", values.t23.object.net.toFixed(2), "15000.00");
  // Медиапланы в калькуляторе считаются по числу объектов — 3 × 5 000.
  check("табл. 2.2 медиапланы (3 × 5 000)", values.t22.mediaPlan!.net.toFixed(2), "15000.00");
  check("подпись объектов", objectsLabel(values.objectsCount), "3 объекта недвижимости");
  check("подпись пользователей при 5", usersLabel(5), "5 авторизованных пользователей Заказчика");
}

// ─────────────────────────────  Позиция не куплена  ─────────────────────────────

console.log("\nБез загрузки медиапланов — строка таблицы 2.2 удаляется, таблица 2.3 печатается по тарифу:");
{
  const { editable, issues } = deriveSpecValues(quoteFrom({ ...REFERENCE, mediaPlanUpload: false }));
  const values = computeSpecValues(editable, 5);

  check("строка 2.2 удалена", values.t22.mediaPlan === null, true);
  check("цена 2.3 по тарифу enterprise", values.t23.mediaPlan.net.toFixed(2), "5000.00");
  check("есть жалоба LINE_MISSING", issues.some((i) => i.code === "LINE_MISSING"), true);
  money("п.2.1 без медиапланов", values.monthly, "189000.00", "198450.00", "9450.00");
}

console.log("\nБез enterprise — тариф таблицы 2.3 другой:");
{
  const { editable } = deriveSpecValues(
    quoteFrom({ ...REFERENCE, enterpriseLicense: false, mediaPlanUpload: false }),
  );
  const values = computeSpecValues(editable, 5);
  check("цена 2.3 медиаплан", values.t23.mediaPlan.net.toFixed(2), "4500.00");
  check("цена 2.3 объект", values.t23.object.net.toFixed(2), "12000.00");
  check("цена 2.3 пользователь", values.t23.user.net.toFixed(2), "3500.00");
}

// ─────────────────────────────  Копейки  ─────────────────────────────

console.log("\nПоловина нечётной суммы даёт 50 копеек:");
{
  const editable: SpecEditableValues = {
    platformNet: "100.00",
    includeObjects: false,
    objectsCount: 0,
    objectsNet: "0",
    includeUsers: false,
    usersCount: 0,
    usersNet: "0",
    includeMediaPlan: false,
    mediaPlanNet: "0",
    unitObjectNet: "0",
    unitUserNet: "0",
    unitMediaPlanNet: "0",
  };
  const values = computeSpecValues(editable, 5);
  const stage = moneyParts(values.stage.gross);

  check("месяц с НДС", values.monthly.gross.toFixed(2), "105.00");
  check("этап с НДС", values.stage.gross.toFixed(2), "52.50");
  check("копейки этапа", stage.kop, "50");
  check("рубли этапа прописью", stage.words, "пятьдесят два");
  check("слово рублей при 52", stage.rub, "рубля");
  check("копейки допустимы", unsupportedKopecks(values).join(",") || "—", "—");
}

console.log("\nНеподдерживаемые копейки ловятся, а не уезжают в документ:");
{
  const editable: SpecEditableValues = {
    platformNet: "100.10",
    includeObjects: false,
    objectsCount: 0,
    objectsNet: "0",
    includeUsers: false,
    usersCount: 0,
    usersNet: "0",
    includeMediaPlan: false,
    mediaPlanNet: "0",
    unitObjectNet: "0",
    unitUserNet: "0",
    unitMediaPlanNet: "0",
  };
  const values = computeSpecValues(editable, 5);
  check("месяц с НДС", values.monthly.gross.toFixed(2), "105.11");
  check("жалоба на копейки есть", unsupportedKopecks(values).length > 0, true);
}

// ─────────────────────────────  Прописью  ─────────────────────────────

console.log("\nЧисла прописью:");
{
  check("0", numberToWordsRu(0), "ноль");
  check("1 000 (женский род тысяч)", numberToWordsRu(1_000), "одна тысяча");
  check("2 000", numberToWordsRu(2_000), "две тысячи");
  check("5 000", numberToWordsRu(5_000), "пять тысяч");
  check("11 000 (исключение 11–14)", numberToWordsRu(11_000), "одиннадцать тысяч");
  check("21", numberToWordsRu(21), "двадцать один");
  check("21 (женский)", numberToWordsRu(21, "f"), "двадцать одна");
  check("101 850", numberToWordsRu(101_850), "сто одна тысяча восемьсот пятьдесят");
  check("203 700", numberToWordsRu(203_700), "двести три тысячи семьсот");
  check("1 000 000", numberToWordsRu(1_000_000), "один миллион");
  check("2 500 000", numberToWordsRu(2_500_000), "два миллиона пятьсот тысяч");
  check("слово рублей при 1", moneyParts(1).rub, "рубль");
  check("слово рублей при 2", moneyParts(2).rub, "рубля");
  check("слово рублей при 5", moneyParts(5).rub, "рублей");
  check("слово рублей при 101 851", moneyParts(101_851).rub, "рубль");
}

// ─────────────────────────────  Свободный КП  ─────────────────────────────

console.log("\nСвободный КП с незнакомыми строками — работает, но жалуется:");
{
  const quote: SpecQuoteInput = {
    vatRatePct: 5,
    calculatorConfig: null,
    sections: [
      {
        countsTowardImplementationPayment: true,
        lines: [
          { title: "Техническая поддержка ПО", quantity: 1, unitPrice: 90_000 },
          { title: "Особые условия для клиента", quantity: 1, unitPrice: 10_000 },
          { title: "Количество объектов", quantity: 2, unitPrice: 12_000 },
          { title: "Пользователи технической поддержки", quantity: 4, unitPrice: 3_500 },
          { title: "Информационная строка", quantity: 1, unitPrice: null },
        ],
      },
      {
        // Секция без флага игнорируется целиком — под допрешения отдельные
        // спецификации.
        countsTowardImplementationPayment: false,
        lines: [{ title: "CDP Конструктор сегментов", quantity: 1, unitPrice: 60_000 }],
      },
    ],
  };

  const { editable, issues } = deriveSpecValues(quote);
  const values = computeSpecValues(editable, 5);

  check("платформа = 90 000 + 10 000", values.t22.platform.net.toFixed(2), "100000.00");
  check("жалоба на свёрнутые строки", issues.some((i) => i.code === "FOLDED_INTO_PLATFORM"), true);
  check("объекты 2 × 12 000", values.t22.objects!.net.toFixed(2), "24000.00");
  check("цена 2.3 объект из строки расчёта", values.t23.object.net.toFixed(2), "12000.00");
  check("пользователи 4 × 3 500", values.t22.users!.net.toFixed(2), "14000.00");
  check("строка медиапланов удалена", values.t22.mediaPlan === null, true);
  check("нет тарифа для медиаплана", issues.some((i) => i.code === "NO_TARIFF_SOURCE"), true);
  check("допрешения не попали в итог", values.monthly.net.toFixed(2), "138000.00");
}

console.log(
  failed === 0
    ? "\nВсё сходится.\n"
    : `\nНе сошлось: ${failed}. Спецификацию выпускать нельзя.\n`,
);
process.exit(failed === 0 ? 0 : 1);
