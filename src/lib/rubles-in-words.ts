import Decimal from "decimal.js";
import { plural } from "./plural";

// Сумма прописью и денежное форматирование для Спецификации (.docx).
//
// Отдельно от quote-calc.ts: там формат экрана и PDF («183 750 ₽», без
// копеек), здесь — формат юридического документа («101 850 (сто одна тысяча
// восемьсот пятьдесят) рублей 00 копеек»). Форматы разные по существу, и
// сводить их в одну функцию значит потом ломать оба сразу.
//
// Свой модуль, а не npm-пакет: девяносто строк детерминированной арифметики
// в документе, который подписывают, надёжнее внешней зависимости.

/** Неразрывный пробел. Обычный Word рвёт на границе строки, и в узкой ячейке
 * таблицы «178 500» превращается в «178» / «500» на двух строках. */
const NBSP = " ";

const HUNDREDS = [
  "", "сто", "двести", "триста", "четыреста",
  "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот",
];

const TENS = [
  "", "", "двадцать", "тридцать", "сорок",
  "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто",
];

const TEENS = [
  "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать",
  "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать",
];

const UNITS_M = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const UNITS_F = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];

/** Названия разрядов, начиная с тысяч. Потолок — миллиарды: четыре порядка
 * запаса над любой реальной суммой договора. */
const SCALES: [string, string, string][] = [
  ["тысяча", "тысячи", "тысяч"],
  ["миллион", "миллиона", "миллионов"],
  ["миллиард", "миллиарда", "миллиардов"],
];

export type Gender = "m" | "f";

/** 1..999 словами. Род нужен только для последней цифры: «двадцать один» —
 * «двадцать одна». */
function tripletToWords(n: number, gender: Gender): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;

  if (h > 0) parts.push(HUNDREDS[h]);

  if (rest >= 10 && rest < 20) {
    parts.push(TEENS[rest - 10]);
  } else {
    const t = Math.floor(rest / 10);
    const u = rest % 10;
    if (t > 0) parts.push(TENS[t]);
    if (u > 0) parts.push(gender === "f" ? UNITS_F[u] : UNITS_M[u]);
  }

  return parts.join(" ");
}

/**
 * Число словами в нижнем регистре: 101850 → «сто одна тысяча восемьсот пятьдесят».
 *
 * @param gender род единиц последнего разряда — «один рубль» (m) против
 * «одна копейка» (f). Разряд тысяч всегда женский («одна тысяча»), миллионы
 * и миллиарды всегда мужские, независимо от этого параметра.
 */
export function numberToWordsRu(n: number, gender: Gender = "m"): string {
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`numberToWordsRu: ожидалось неотрицательное число, получено ${n}`);
  }
  const whole = Math.floor(n);
  if (whole === 0) return "ноль";

  // Разряды от младшего к старшему: [единицы, тысячи, миллионы, …]
  const groups: number[] = [];
  let rest = whole;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }

  if (groups.length > SCALES.length + 1) {
    throw new Error(`numberToWordsRu: сумма ${whole} больше поддерживаемого потолка в миллиарды`);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    // Пропускаем пустой разряд, но только если он не единственный: ноль уже
    // обработан выше, так что здесь groups точно содержит что-то ненулевое.
    if (group === 0) continue;

    // Тысячи — женский род («две тысячи», не «два тысячи»). Миллионы и выше —
    // мужской. Единицы — по роду валюты, который передал вызывающий.
    const groupGender: Gender = i === 0 ? gender : i === 1 ? "f" : "m";
    parts.push(tripletToWords(group, groupGender));

    if (i > 0) parts.push(plural(group, SCALES[i - 1]));
  }

  return parts.join(" ");
}

/** «178 500,00» — две цифры после запятой, неразрывный пробел между тысячами. */
export function formatAmount(value: Decimal | string | number): string {
  const d = value instanceof Decimal ? value : new Decimal(value);
  const [whole, fraction] = d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2).split(".");
  return `${groupThousands(whole)},${fraction}`;
}

/** «101 850» — целые рубли без копеек, неразрывный пробел между тысячами. */
export function formatWhole(value: Decimal | string | number): string {
  const d = value instanceof Decimal ? value : new Decimal(value);
  return groupThousands(d.toDecimalPlaces(0, Decimal.ROUND_DOWN).toFixed(0));
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

export type MoneyParts = {
  /** «101 850» — целые рубли для места перед скобкой. */
  sum: string;
  /** «сто одна тысяча восемьсот пятьдесят» — то, что идёт в скобках. */
  words: string;
  /** «рублей» / «рубль» / «рубля» — в шаблоне это метка, а не текст. */
  rub: string;
  /** «00» / «50» — только число: слово «копеек» остаётся текстом шаблона,
   * потому что обе возможные формы («00 копеек», «50 копеек») требуют
   * одного и того же слова. Иные значения копеек в Спецификацию не
   * допускаются — их ловит проверка в spec-values.ts. */
  kop: string;
  /** Копейки числом — чтобы вызывающий мог проверить допустимость. */
  kopValue: number;
};

/** Разбор суммы на части для подстановки в «___ (___) рублей ___ копеек». */
export function moneyParts(amount: Decimal | string | number): MoneyParts {
  const d = (amount instanceof Decimal ? amount : new Decimal(amount)).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );
  const rubles = d.floor().toNumber();
  const kopValue = d.minus(d.floor()).times(100).round().toNumber();

  return {
    sum: formatWhole(rubles),
    words: numberToWordsRu(rubles, "m"),
    rub: plural(rubles, ["рубль", "рубля", "рублей"]),
    kop: String(kopValue).padStart(2, "0"),
    kopValue,
  };
}
