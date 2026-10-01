// Защита входа от подбора пароля. Считаются только НЕУДАЧНЫЕ попытки.
//
// Два счётчика в окне 15 минут:
//  - пара «адрес + почта»: 5 неудач — пробуют угадать пароль одного человека;
//  - адрес целиком: 20 неудач — перебирают разные логины с одного места.
// Блокировки «по одной почте со всех адресов» нет нарочно: иначе посторонний
// мог бы запереть любого сотрудника, просто набрав его почту несколько раз.
//
// Состояние живёт в памяти процесса. Сайт работает одним процессом (systemd +
// next start), поэтому этого достаточно; перезапуск сбрасывает счётчики.
// Файл без "server-only" — его проверяет обычный tsx-скрипт.

export type ThrottleConfig = {
  windowMs: number;
  maxPerPair: number;
  maxPerIp: number;
  maxEntries: number;
};

export const DEFAULT_THROTTLE: ThrottleConfig = {
  windowMs: 15 * 60 * 1000,
  maxPerPair: 5,
  maxPerIp: 20,
  maxEntries: 10_000,
};

export type ThrottleVerdict =
  | { blocked: false }
  | { blocked: true; retryAfterMs: number };

type Entry = { count: number; resetAt: number };

// Адрес не определился (прямое обращение мимо nginx) — общую корзину на всех
// не заводим, иначе один неудачник заблокировал бы вход остальным.
export const UNKNOWN_IP = "unknown";

export function createThrottle(
  config: ThrottleConfig = DEFAULT_THROTTLE,
  now: () => number = Date.now,
) {
  const pairs = new Map<string, Entry>();
  const ips = new Map<string, Entry>();

  function trim(map: Map<string, Entry>) {
    if (map.size <= config.maxEntries) return;
    const t = now();
    for (const [key, entry] of map) {
      if (entry.resetAt <= t) map.delete(key);
    }
    // Всё ещё слишком много — выбрасываем самые старые записи.
    for (const key of map.keys()) {
      if (map.size <= config.maxEntries) break;
      map.delete(key);
    }
  }

  function active(map: Map<string, Entry>, key: string): Entry | undefined {
    const entry = map.get(key);
    if (!entry) return undefined;
    if (entry.resetAt <= now()) {
      map.delete(key);
      return undefined;
    }
    return entry;
  }

  function bump(map: Map<string, Entry>, key: string) {
    const entry = active(map, key);
    if (entry) {
      entry.count += 1;
      return;
    }
    map.set(key, { count: 1, resetAt: now() + config.windowMs });
    trim(map);
  }

  const pairKey = (ip: string, email: string) =>
    `${ip}|${email.trim().toLowerCase()}`;

  return {
    check(ip: string, email: string): ThrottleVerdict {
      const t = now();
      const pair = active(pairs, pairKey(ip, email));
      const byIp = ip === UNKNOWN_IP ? undefined : active(ips, ip);

      let retryAfterMs = 0;
      if (pair && pair.count >= config.maxPerPair) {
        retryAfterMs = Math.max(retryAfterMs, pair.resetAt - t);
      }
      if (byIp && byIp.count >= config.maxPerIp) {
        retryAfterMs = Math.max(retryAfterMs, byIp.resetAt - t);
      }
      return retryAfterMs > 0 ? { blocked: true, retryAfterMs } : { blocked: false };
    },

    fail(ip: string, email: string) {
      bump(pairs, pairKey(ip, email));
      if (ip !== UNKNOWN_IP) bump(ips, ip);
    },

    success(ip: string, email: string) {
      pairs.delete(pairKey(ip, email));
    },

    size() {
      return { pairs: pairs.size, ips: ips.size };
    },
  };
}

// Общий экземпляр на процесс; через globalThis, чтобы пережить HMR в dev.
const globalForThrottle = globalThis as unknown as {
  loginThrottle: ReturnType<typeof createThrottle> | undefined;
};

export const loginThrottle = (globalForThrottle.loginThrottle ??=
  createThrottle());

// Какому адресу верить. nginx ПЕРЕЗАПИСЫВАЕТ X-Real-IP значением $remote_addr,
// подделать его нельзя. X-Forwarded-For nginx лишь дописывает к тому, что прислал
// клиент: левый элемент выдумывается кем угодно, настоящий — самый правый.
export function trustedClientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real && real.length <= 64) return real;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const last = forwarded.split(",").at(-1)?.trim();
    if (last && last.length <= 64) return last;
  }
  return UNKNOWN_IP;
}
