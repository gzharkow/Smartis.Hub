<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Дата и время на экране

Часовой пояс процесса Node (dev и прод) никем не задан и не гарантирован —
`TZ` не выставлен ни в `.env`, ни в `deploy/smartfollow.service`. Единственный
пояс, который точно нужен пользователю, — пояс его собственного устройства,
не сервера.

Поэтому: **любая дата/время, показываемые человеку, форматируются в браузере,
не в Server Component**. `Intl.DateTimeFormat` без явного `timeZone`,
вызванный в браузере, сам берёт локальный пояс устройства — это и есть
правильное поведение, специально ничего задавать не нужно.

Практически:
- Точка входа — `src/components/local-datetime.tsx` (`<LocalDateTime kind="..." date={date} />`).
  Server Component может рендерить его обычным ребёнком, не становясь
  клиентским целиком — `Date` в props пересекает границу сервер/клиент
  без проблем.
- Сами форматтеры (`formatHubCreated`, `formatWhen`, `formatShortDate`,
  `formatVisitWhen`, `formatEventTime`, `formatDuration`) живут в
  `src/lib/format-datetime.ts` — этот файл нарочно БЕЗ `"server-only"`,
  импортировать их напрямую можно и из клиентского компонента.
- `src/lib/stats.ts` помечен `"server-only"` (там прямые вызовы Prisma) —
  импортировать из него ничего, кроме типов (`import type {...}`), в
  клиентский компонент нельзя: потянет весь модуль и сломает сборку.
- Если формат даты собирается сервером ЗАРАНЕЕ в готовую строку
  (`xLabel: string`) и кладётся в презентационный компонент — это тот же
  баг, просто отложенный: передавайте сырую `Date`, форматируйте на месте
  показа.
