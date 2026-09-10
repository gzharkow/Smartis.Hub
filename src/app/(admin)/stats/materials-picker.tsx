"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  STATS_MATERIALS_COOKIE,
  STATS_MATERIALS_COOKIE_MAX_AGE,
  serializeExcludedAssetIds,
} from "@/lib/stats-materials-filter";
import type { AssetSection } from "@/generated/prisma/enums";

export type MaterialOption = { id: string; title: string; section: AssetSection };

const GROUP_LABELS: Record<AssetSection, string> = {
  AUTO: "Автодилеры",
  REALTY: "Застройщики",
  COMMON: "Общие материалы",
  CASES: "Кейсы",
};

function remember(excludedIds: string[]) {
  document.cookie = `${STATS_MATERIALS_COOKIE}=${serializeExcludedAssetIds(excludedIds)}; path=/; max-age=${STATS_MATERIALS_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * Чекбокс-список материалов, которые участвуют в «Общей статистике» —
 * не форма (как AccountVisibilityPicker), а живой фильтр: выбор пишется
 * в cookie и страница перечитывается с сервера, тем же приёмом, что и
 * у ViewToggle (переключатель списка/плитки).
 */
export function MaterialsPicker({
  options,
  excludedIds,
}: {
  options: MaterialOption[];
  excludedIds: string[];
}) {
  const router = useRouter();
  const [excluded, setExcluded] = useState(new Set(excludedIds));
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  function toggle(id: string) {
    const next = new Set(excluded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExcluded(next);
    remember([...next]);
    router.refresh();
  }

  const filtered = query.trim()
    ? options.filter((o) => o.title.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  const groups = useMemo(() => {
    const order: AssetSection[] = ["AUTO", "REALTY", "COMMON"];
    return order
      .map((section) => ({
        section,
        label: GROUP_LABELS[section],
        items: filtered.filter((o) => o.section === section),
      }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  if (options.length === 0) return null;

  const includedCount = options.length - excluded.size;

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-sm"
      >
        <span>
          Материалы: <b>{includedCount}</b> из {options.length}
        </span>
        <span className="text-muted">{open ? "Свернуть" : "Настроить"}</span>
      </button>

      {open ? (
        <div className="mt-3 grid gap-2.5">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти материал…"
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm placeholder:text-muted"
          />

          <div className="grid max-h-64 gap-3 overflow-y-auto rounded-lg border border-border p-2.5">
            {groups.length === 0 ? (
              <p className="text-sm text-muted">Ничего не нашлось.</p>
            ) : (
              groups.map((g) => (
                <div key={g.section} className="grid gap-1">
                  <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                    {g.label}
                  </span>
                  {g.items.map((o) => (
                    <label key={o.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={!excluded.has(o.id)}
                        onChange={() => toggle(o.id)}
                      />
                      {o.title}
                    </label>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
