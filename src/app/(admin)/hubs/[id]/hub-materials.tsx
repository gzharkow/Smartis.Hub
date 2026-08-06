"use client";

import { useState, useTransition } from "react";
import { addItemToHub, removeItemFromHub } from "@/app/actions/hubs";
import { SECTION_LABELS, SECTIONS } from "@/lib/asset-sections";
import type { AssetSection } from "@/generated/prisma/enums";

type Item = {
  id: string;
  assetId: string;
  title: string;
  kindLabel: string;
  meta: string;
  /** Материал удалён из библиотеки — клиенты его уже не видят. */
  archived: boolean;
};

type Available = {
  id: string;
  title: string;
  kindLabel: string;
  meta: string;
  section: AssetSection;
};

export function HubMaterials({
  hubId,
  items,
  available,
}: {
  hubId: string;
  items: Item[];
  available: Available[];
}) {
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<AssetSection | null>(null);

  // «Авторынок» показывает и общие материалы: договор с презентацией о
  // компании нужны в любом хабе, и заставлять переключаться между разделами
  // ради них — лишняя возня. «Общие» — наоборот, только общие.
  const shown = available.filter((a) => {
    if (!filter) return true;
    if (filter === "COMMON") return a.section === "COMMON";
    return a.section === filter || a.section === "COMMON";
  });

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h2 className="mb-2 text-sm font-medium">В хабе — {items.length}</h2>

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
            Пусто. Добавьте материалы из библиотеки ниже.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className={`flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2 ${
                  item.archived ? "opacity-60" : "bg-surface"
                }`}
              >
                {/* Формат — не главное на телефоне: там и так тесно,
                    название важнее. Возвращаем с sm и шире. */}
                <span className="hidden shrink-0 rounded bg-border/70 px-1.5 py-0.5 text-xs sm:inline-block">
                  {item.kindLabel}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {item.title}
                </span>

                {/* Материал удалён из библиотеки: он всё ещё числится в хабе,
                    но витрина его уже не показывает. Без этой пометки продавец
                    считал бы, что клиент его видит. Предупреждение оставляем
                    и на телефоне — это не декоративные метаданные. */}
                {item.archived ? (
                  <span
                    className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400"
                    title="Материал удалён из библиотеки — клиенты его не видят"
                  >
                    удалён
                  </span>
                ) : null}

                {/* Размер/страницы — та же логика: убираем на телефоне,
                    оставляем с sm и шире. */}
                <span className="hidden shrink-0 text-xs text-muted sm:inline">
                  {item.meta}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(() => removeItemFromHub(hubId, item.id))
                  }
                  className="rounded px-2 py-1 text-xs text-muted transition hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
                >
                  Убрать
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="mr-1 text-sm font-medium">Библиотека</h2>

          {/* Фильтр по разделам: в хабе для автодилера незачем листать
              материалы застройщика. */}
          {[{ value: null, label: "Все" }, ...SECTIONS].map((chip) => {
            const active = filter === chip.value;
            return (
              <button
                key={chip.label}
                type="button"
                onClick={() => setFilter(chip.value as AssetSection | null)}
                className={`rounded-full px-2.5 py-1 text-xs transition ${
                  active
                    ? "bg-border font-medium"
                    : "text-muted hover:bg-border/50 hover:text-foreground"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {shown.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
            {available.length > 0
              ? "В этом разделе не осталось материалов для добавления."
              : items.length > 0
                ? "Все материалы библиотеки уже в хабе."
                : "Библиотека пуста — сначала загрузите материалы."}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {shown.map((asset) => (
              <li
                key={asset.id}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
              >
                <span className="hidden shrink-0 rounded bg-border/70 px-1.5 py-0.5 text-xs sm:inline-block">
                  {asset.kindLabel}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {asset.title}
                </span>
                {/* Раздел видно всегда: иначе непонятно, почему при фильтре
                    «Авторынок» в списке лежит договор. */}
                <span className="shrink-0 text-xs text-muted">
                  {SECTION_LABELS[asset.section]}
                </span>
                {/* Формат и размер — как в списке «В хабе»: на телефоне
                    убираем, оставляем только с sm и шире. */}
                <span className="hidden shrink-0 text-xs text-muted sm:inline">
                  {asset.meta}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(() => addItemToHub(hubId, asset.id))
                  }
                  className="rounded px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-500/10 disabled:opacity-50 dark:text-blue-400"
                >
                  Добавить
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
