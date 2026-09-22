"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addItemToHub, removeItemFromHub } from "@/app/actions/hubs";
import { SECTION_LABELS, SECTIONS } from "@/lib/asset-sections";
import { AssetPreviewModal, type PreviewAsset } from "@/components/asset-preview-modal";
import type { AssetKind, AssetSection } from "@/generated/prisma/enums";
import { fieldClasses } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";

type Item = {
  id: string;
  assetId: string;
  title: string;
  kindLabel: string;
  meta: string;
  /** Материал удалён из библиотеки — клиенты его уже не видят. */
  archived: boolean;
};

type PickableAsset = {
  id: string;
  title: string;
  kindLabel: string;
  kind: AssetKind;
  meta: string;
  section: AssetSection;
  /** Не null — личный материал («Мои материалы») из библиотеки владельца. */
  ownerId: string | null;
  pageCount: number | null;
  externalUrl: string | null;
  embeddable: boolean | null;
  hasThumbnail: boolean;
};

const DEBOUNCE_MS = 250;

function toPreviewAsset(a: PickableAsset): PreviewAsset {
  return {
    id: a.id,
    title: a.title,
    kind: a.kind,
    externalUrl: a.externalUrl,
    embeddable: a.embeddable,
    pageCount: a.pageCount,
  };
}

function PickRow({
  asset,
  disabled,
  onAdd,
  onPreview,
}: {
  asset: PickableAsset;
  disabled: boolean;
  onAdd: () => void;
  onPreview: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
      <button
        type="button"
        onClick={onPreview}
        title="Открыть предпросмотр"
        className="grid h-9 w-13 shrink-0 place-items-center overflow-hidden rounded border border-border bg-border/30 text-[9px] text-muted"
      >
        {asset.hasThumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/assets/${asset.id}/thumbnail`}
            alt=""
            className="h-full w-full object-cover object-top"
          />
        ) : (
          "нет"
        )}
      </button>

      <span className="hidden shrink-0 rounded bg-border/70 px-1.5 py-0.5 text-xs sm:inline-block">
        {asset.kindLabel}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{asset.title}</span>
      {/* Раздел видно всегда: иначе непонятно, почему при фильтре
          «Авторынок» в списке лежит договор. У личных материалов раздела
          нет — показываем вместо него, что это личный материал. */}
      <span className="shrink-0 text-xs text-muted">
        {asset.ownerId ? "Личный материал" : SECTION_LABELS[asset.section]}
      </span>
      <span className="hidden shrink-0 text-xs text-muted sm:inline">
        {asset.meta}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        className={buttonClasses("link", "sm", "shrink-0")}
      >
        Добавить
      </button>
    </li>
  );
}

export function HubMaterials({
  hubId,
  items,
  frequentlyUsed,
  excludeAssetIds,
  canEdit = true,
}: {
  hubId: string;
  items: Item[];
  frequentlyUsed: PickableAsset[];
  excludeAssetIds: string[];
  /** Право «Изменение» на «Хабы» — см. hubs/[id]/page.tsx. */
  canEdit?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<AssetSection | "mine" | null>(null);
  const [previewAsset, setPreviewAsset] = useState<PreviewAsset | null>(null);
  // Добавленное в хаб убираем из виду сразу, не дожидаясь revalidatePath —
  // иначе до перерисовки с сервера тот же материал можно нажать «Добавить»
  // ещё раз и получить дубль в хабе.
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickableAsset[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function fetchResults(q: string, section: AssetSection | "mine" | null) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (section) params.set("section", section);
    // «Часто используемые» и результаты поиска никогда не показываются
    // одновременно (см. showFrequent ниже) — их не нужно исключать друг
    // из друга. Раньше id из «Часто используемые» исключались всегда,
    // из-за чего эти материалы было невозможно найти поиском вообще.
    const exclude = new Set([...excludeAssetIds, ...addedIds]);
    for (const id of exclude) params.append("exclude", id);

    // "searching" не выставляем здесь синхронно (правило
    // react-hooks/set-state-in-effect запрещает setState напрямую в теле
    // эффекта) — только из колбэков промиса, как и в HubQuotePicker; вызывающая
    // сторона решает, когда включать индикатор синхронно (событие) и когда нет.
    return fetch(`/api/assets/search?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data: { assets: PickableAsset[] }) => setResults(data.assets))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      })
      .finally(() => setSearching(false));
  }

  // Пустая строка поиска при активном чипе раздела: без своего запроса
  // «часто используемые» (снятые с фильтра) не покажут материалы этого
  // раздела вовсе, а искать их всё равно можно только через поле.
  useEffect(() => {
    if (filter) {
      fetchResults(query.trim(), filter);
    } else {
      // setState не напрямую в теле эффекта (react-hooks/set-state-in-effect) —
      // откладываем на микротаск, как и любой другой setState в этом файле,
      // который приходит из колбэка, а не синхронно из тела эффекта.
      Promise.resolve().then(() => setResults([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  function onQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setQuery(next);
    if (timer.current) clearTimeout(timer.current);

    const trimmed = next.trim();
    if (!trimmed && !filter) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    timer.current = setTimeout(() => fetchResults(trimmed, filter), DEBOUNCE_MS);
  }

  function add(assetId: string) {
    setAddedIds((prev) => new Set(prev).add(assetId));
    startTransition(() => addItemToHub(hubId, assetId));
  }

  // «Часто используемые» — фиксированный снимок по всем разделам; при
  // включённом чипе фильтра он не размечен по разделу, так что прячем его
  // и показываем только результаты поиска/фильтра.
  const showFrequent = !filter && query.trim().length === 0;
  const visibleFrequent = frequentlyUsed.filter((a) => !addedIds.has(a.id));
  const visibleResults = results.filter((a) => !addedIds.has(a.id));

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
                    className="shrink-0 rounded bg-warn/15 px-1.5 py-0.5 text-xs text-warn"
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
                {canEdit ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(() => removeItemFromHub(hubId, item.id))
                    }
                    className={buttonClasses("ghostDanger", "sm")}
                  >
                    Убрать
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEdit ? (
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="mr-1 text-sm font-medium">Библиотека</h2>

          {/* Фильтр по разделам: в хабе для автодилера незачем листать
              материалы застройщика. «Мои материалы» — своя личная
              библиотека, отдельно от разделов организации (см. /assets/mine). */}
          {[
            { value: null, label: "Все" },
            ...SECTIONS,
            { value: "mine" as const, label: "Мои материалы" },
          ].map((chip) => {
            const active = filter === chip.value;
            return (
              <button
                key={chip.label}
                type="button"
                onClick={() => setFilter(chip.value as AssetSection | "mine" | null)}
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

        {/* Строка поиска всегда сразу под чипами разделов — независимо от
            того, что показывается ниже («Часто используемые» или результаты
            поиска). Раньше «Часто используемые» рендерились перед полем
            поиска, и на вкладке «Все» с пустым запросом список оказывался
            НАД строкой поиска, а на остальных чипах (где этот блок не
            показывается) — под ней. */}
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted">
            Поиск по названию
          </span>
          <input
            value={query}
            onChange={onQueryChange}
            placeholder="Название материала…"
            className={fieldClasses()}
          />
        </label>

        {showFrequent ? (
          <div className="mt-3">
            <h3 className="mb-1.5 text-xs font-medium text-muted">
              Часто используемые
            </h3>
            {visibleFrequent.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
                {items.length > 0
                  ? "Все материалы библиотеки уже в хабе."
                  : "Библиотека пуста — сначала загрузите материалы."}
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-2">
                {visibleFrequent.map((asset) => (
                  <PickRow
                    key={asset.id}
                    asset={asset}
                    disabled={pending}
                    onAdd={() => add(asset.id)}
                    onPreview={() => setPreviewAsset(toPreviewAsset(asset))}
                  />
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <ul className="mt-3 grid grid-cols-1 gap-2">
          {searching ? (
            <li className="px-1 py-2 text-sm text-muted">Ищем…</li>
          ) : query.trim() || filter ? (
            visibleResults.length === 0 ? (
              <li className="px-1 py-2 text-sm text-muted">
                {query.trim()
                  ? `Ничего не найдено по «${query.trim()}»`
                  : "В этом разделе не осталось материалов для добавления."}
              </li>
            ) : (
              visibleResults.map((asset) => (
                <PickRow
                  key={asset.id}
                  asset={asset}
                  disabled={pending}
                  onAdd={() => add(asset.id)}
                  onPreview={() => setPreviewAsset(toPreviewAsset(asset))}
                />
              ))
            )
          ) : null}
        </ul>
      </div>
      ) : null}

      {previewAsset ? (
        <AssetPreviewModal
          asset={previewAsset}
          onClose={() => setPreviewAsset(null)}
        />
      ) : null}
    </div>
  );
}
