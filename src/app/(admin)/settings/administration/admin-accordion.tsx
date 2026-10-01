import type { ReactNode } from "react";

// Свёрнутый по умолчанию раздел. <details>/<summary>, а не самодельный
// аккордеон — тот же приём, что в kpi/weeks.tsx и spec-templates/tag-reference.tsx:
// клавиатура и фокус работают из коробки, JS не нужен. Содержимое остаётся в DOM
// и в свёрнутом виде, поэтому форма не теряет введённое при сворачивании.
export function AdminAccordion({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <details className="group grid gap-3">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-lg py-1 pr-2 pointer-coarse:py-2 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="text-muted transition-transform duration-150 group-open:rotate-90"
        >
          ▸
        </span>
        <h2 className="text-sm font-semibold tracking-tight text-muted uppercase">{title}</h2>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </summary>
      <div className="grid gap-3">{children}</div>
    </details>
  );
}
