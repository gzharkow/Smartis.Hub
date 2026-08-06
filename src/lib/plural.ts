// Русские склонения после числа: 1 ссылка, 2 ссылки, 5 ссылок.
// Без этого интерфейс выдаёт «1 выданных ссылок», и продукт выглядит небрежно.

const ru = new Intl.PluralRules("ru-RU");

/**
 * @param forms [одна, две, пять] — «ссылка», «ссылки», «ссылок»
 */
export function plural(count: number, forms: [string, string, string]): string {
  // Intl знает правила языка сам: он же разберётся с 11-14, где вопреки
  // последней цифре нужна форма «пять» (11 ссылок, а не 11 ссылка).
  switch (ru.select(count)) {
    case "one":
      return forms[0];
    case "few":
      return forms[1];
    default:
      return forms[2];
  }
}

/** «3 материала» — число вместе со словом. */
export function withPlural(
  count: number,
  forms: [string, string, string],
): string {
  return `${count} ${plural(count, forms)}`;
}

export const WORDS = {
  material: ["материал", "материала", "материалов"] as [string, string, string],
  link: ["ссылка", "ссылки", "ссылок"] as [string, string, string],
  visit: ["заход", "захода", "заходов"] as [string, string, string],
  person: ["человек", "человека", "человек"] as [string, string, string],
  time: ["раз", "раза", "раз"] as [string, string, string],
  page: ["страница", "страницы", "страниц"] as [string, string, string],
  hub: ["хаб", "хаба", "хабов"] as [string, string, string],
  // Отдельная форма для «стоит в N хабах»: там предложный падеж, и общий
  // список не годится — вышло бы «стоит в 1 хаб».
  hubIn: ["хабе", "хабах", "хабах"] as [string, string, string],
};
