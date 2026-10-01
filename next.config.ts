import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Принудительная часть CSP — только директивы, которые не трогают скрипты и
// стили и повторяют то, что сайт и так делает: никаких <object>/<embed>,
// нельзя подменить базовый адрес ссылок, наш сайт не встраивают в чужие
// страницы, формы уходят только к нам.
const enforcedCsp = [
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  "form-action 'self'",
].join("; ");

// Полная политика пока только в режиме отчётов: браузер ничего не блокирует,
// а нарушения показывает в консоли как [Report Only]. Строгий script-src с
// nonce нарочно не включаем: он потребует переписать proxy.ts, а inline-скрипты
// Next и style="…" всё равно придётся разрешать.
//  - frame-src https: http: — сотрудники встраивают в витрину любые публичные
//    страницы (iframe с sandbox), список адресов заранее неизвестен;
//  - img-src data: blob: — миниатюры из canvas и картинки из .docx (mammoth);
//  - worker-src blob: — запасной путь pdf.js, основной — чанк с нашего домена;
//  - 'unsafe-eval' — только в dev: React использует eval для отладки.
const reportOnlyCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-src https: http:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: enforcedCsp },
  { key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp },
];

const nextConfig: NextConfig = {
  // Значок Next.js во время разработки по умолчанию висит слева внизу —
  // ровно поверх кнопки «Выйти» в боковом меню. Отодвигаем вправо.
  // На боевом сайте этого значка нет вовсе.
  devIndicators: {
    position: "bottom-right",
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
