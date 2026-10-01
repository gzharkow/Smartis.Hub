"use client";

import { useTransition } from "react";
import { INDUSTRIES, INDUSTRY_LABELS, type IndustryValue } from "@/lib/industry";

/**
 * Выбор отрасли у существующего хаба/КП. Сохраняется сразу, без кнопки,
 * как HubFolderPicker.
 */
export function IndustryPicker({
  value,
  onSave,
}: {
  value: IndustryValue | null;
  onSave: (industry: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Отрасль
      <select
        value={value ?? ""}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(() => onSave(next));
        }}
        className="rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground disabled:opacity-50"
      >
        <option value="">Не указана</option>
        {INDUSTRIES.map((i) => (
          <option key={i} value={i}>
            {INDUSTRY_LABELS[i]}
          </option>
        ))}
      </select>
    </label>
  );
}
