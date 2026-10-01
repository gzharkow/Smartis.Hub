import {
  createThrottle,
  trustedClientIp,
  UNKNOWN_IP,
  type ThrottleConfig,
} from "../src/lib/login-throttle";

const MIN = 60_000;
const config: ThrottleConfig = {
  windowMs: 15 * MIN,
  maxPerPair: 5,
  maxPerIp: 20,
  maxEntries: 50,
};

let failed = 0;
function check(name: string, ok: boolean) {
  if (!ok) failed++;
  console.log(`${ok ? "ок     " : "ПРОВАЛ "} ${name}`);
}

function fresh() {
  let t = 1_000_000;
  const throttle = createThrottle(config, () => t);
  return { throttle, advance: (ms: number) => (t += ms) };
}

{
  const { throttle } = fresh();
  for (let i = 0; i < 4; i++) throttle.fail("1.1.1.1", "a@b.ru");
  check("4 неудачи подряд — ещё не блокировка", !throttle.check("1.1.1.1", "a@b.ru").blocked);
  throttle.fail("1.1.1.1", "a@b.ru");
  const v = throttle.check("1.1.1.1", "a@b.ru");
  check("5-я неудача — блокировка пары", v.blocked);
  check(
    "в ответе есть время ожидания не больше окна",
    v.blocked && v.retryAfterMs > 0 && v.retryAfterMs <= config.windowMs,
  );
}

{
  const { throttle } = fresh();
  for (let i = 0; i < 5; i++) throttle.fail("1.1.1.1", "a@b.ru");
  check(
    "другая почта с того же адреса не заблокирована",
    !throttle.check("1.1.1.1", "other@b.ru").blocked,
  );
  check(
    "та же почта с другого адреса не заблокирована",
    !throttle.check("2.2.2.2", "a@b.ru").blocked,
  );
}

{
  const { throttle } = fresh();
  for (let i = 0; i < 5; i++) throttle.fail("1.1.1.1", "A@B.ru ");
  check("регистр и пробелы в почте не обходят счётчик", throttle.check("1.1.1.1", "a@b.ru").blocked);
}

{
  const { throttle } = fresh();
  for (let i = 0; i < 20; i++) throttle.fail("3.3.3.3", `user${i}@b.ru`);
  check(
    "20 неудач с разными почтами — блокируется весь адрес",
    throttle.check("3.3.3.3", "new@b.ru").blocked,
  );
  check("другой адрес при этом свободен", !throttle.check("4.4.4.4", "new@b.ru").blocked);
}

{
  const { throttle, advance } = fresh();
  for (let i = 0; i < 5; i++) throttle.fail("1.1.1.1", "a@b.ru");
  advance(15 * MIN + 1);
  check("после окна блокировка снимается", !throttle.check("1.1.1.1", "a@b.ru").blocked);
  throttle.fail("1.1.1.1", "a@b.ru");
  check("и счёт начинается заново", !throttle.check("1.1.1.1", "a@b.ru").blocked);
}

{
  const { throttle } = fresh();
  for (let i = 0; i < 4; i++) throttle.fail("1.1.1.1", "a@b.ru");
  throttle.success("1.1.1.1", "a@b.ru");
  for (let i = 0; i < 4; i++) throttle.fail("1.1.1.1", "a@b.ru");
  check("успешный вход обнуляет счётчик пары", !throttle.check("1.1.1.1", "a@b.ru").blocked);
}

{
  const { throttle } = fresh();
  for (let i = 0; i < 100; i++) throttle.fail(UNKNOWN_IP, `user${i}@b.ru`);
  check(
    "неопределённый адрес не создаёт общую блокировку на всех",
    !throttle.check(UNKNOWN_IP, "someone@b.ru").blocked,
  );
  for (let i = 0; i < 5; i++) throttle.fail(UNKNOWN_IP, "a@b.ru");
  check("но лимит пары для него работает", throttle.check(UNKNOWN_IP, "a@b.ru").blocked);
}

{
  const { throttle } = fresh();
  for (let i = 0; i < 500; i++) throttle.fail(`10.0.${Math.floor(i / 250)}.${i % 250}`, `u${i}@b.ru`);
  const { pairs, ips } = throttle.size();
  check(`память ограничена (пар: ${pairs}, адресов: ${ips}, предел ${config.maxEntries})`,
    pairs <= config.maxEntries && ips <= config.maxEntries);
}

{
  const h = (init: Record<string, string>) => new Headers(init);
  check(
    "X-Real-IP имеет приоритет",
    trustedClientIp(h({ "x-real-ip": "5.5.5.5", "x-forwarded-for": "9.9.9.9, 6.6.6.6" })) === "5.5.5.5",
  );
  check(
    "без X-Real-IP берётся ПРАВЫЙ адрес из X-Forwarded-For, а не левый (его подделывает клиент)",
    trustedClientIp(h({ "x-forwarded-for": "9.9.9.9, 6.6.6.6" })) === "6.6.6.6",
  );
  check("нет заголовков — unknown", trustedClientIp(h({})) === UNKNOWN_IP);
  check(
    "слишком длинное значение не принимается",
    trustedClientIp(h({ "x-real-ip": "x".repeat(200) })) === UNKNOWN_IP,
  );
}

console.log("");
console.log(failed === 0 ? "Все проверки пройдены." : `ПРОВАЛЕНО: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
