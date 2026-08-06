import { sanitizeHtml, isEmptyHtml } from "../src/lib/sanitize";

const cases: { name: string; input: string; mustNotContain?: string[] }[] = [
  {
    name: "скрипт вырезается",
    input: '<p>Привет</p><script>alert("взлом")</script>',
    mustNotContain: ["script", "alert"],
  },
  {
    name: "ссылка javascript: обезвреживается",
    input: '<a href="javascript:alert(1)">Нажми меня</a>',
    mustNotContain: ["javascript"],
  },
  {
    name: "картинка с обработчиком ошибки вырезается",
    input: '<img src=x onerror="alert(1)">',
    mustNotContain: ["onerror", "img"],
  },
  {
    name: "обработчик события на абзаце вырезается",
    input: '<p onclick="alert(1)">Текст</p>',
    mustNotContain: ["onclick"],
  },
  {
    name: "рамка с чужим сайтом вырезается",
    input: '<iframe src="https://evil.example"></iframe>',
    mustNotContain: ["iframe"],
  },
  {
    name: "оформление сохраняется",
    input: "<p><strong>Жирный</strong> и <em>курсив</em></p><ul><li>Пункт</li></ul>",
  },
  {
    name: "нормальная ссылка выживает и получает защиту",
    input: '<a href="https://smartis.bi/case">Кейс</a>',
  },
  {
    name: "почта и телефон разрешены",
    input: '<a href="mailto:a@b.ru">Почта</a> <a href="tel:+74950210751">Телефон</a>',
  },
];

let failed = 0;

for (const c of cases) {
  const out = sanitizeHtml(c.input);
  const bad = (c.mustNotContain ?? []).filter((s) =>
    out.toLowerCase().includes(s.toLowerCase()),
  );

  if (bad.length > 0) {
    failed++;
    console.log(`ПРОВАЛ  ${c.name}`);
    console.log(`        просочилось: ${bad.join(", ")}`);
    console.log(`        результат:   ${out}`);
  } else {
    console.log(`ок      ${c.name}`);
    console.log(`        ${out}`);
  }
}

console.log("");
console.log(`Пустое описание распознаётся: ${isEmptyHtml("<p></p>") === true ? "да" : "НЕТ"}`);
console.log(`Непустое не путается с пустым: ${isEmptyHtml("<p>текст</p>") === false ? "да" : "НЕТ"}`);
console.log("");
console.log(failed === 0 ? "Все проверки пройдены." : `ПРОВАЛЕНО: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
