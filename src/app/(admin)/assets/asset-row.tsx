"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveAsset,
  backfillLinkThumbnail,
  restoreAsset,
  setAssetSection,
} from "@/app/actions/assets";
import { backfillThumbnail } from "@/lib/backfill-thumbnail";
import { SECTIONS } from "@/lib/asset-sections";
import { withPlural, WORDS } from "@/lib/plural";
import type { ViewMode } from "@/lib/view-mode";
import type { AssetSection } from "@/generated/prisma/enums";

export type AssetRowData = {
  id: string;
  title: string;
  kindLabel: string;
  section: AssetSection;
  meta: string;
  /** Только у ссылок: адрес, на который они ведут. */
  externalUrl: string | null;
  /** Ссылка, которую сайт запрещает встраивать: откроется новой вкладкой. */
  opensInNewTab: boolean;
  /** В скольких хабах стоит. Нужно предупредить: удаление уберёт его с витрин. */
  hubCount: number;
  archived: boolean;
  hasThumbnail: boolean;
  /** Можно ли для этого типа сделать превью. Для LINK и прочих файлов — нет. */
  canThumbnail: boolean;
};

export function AssetRow({
  asset,
  view = "list",
}: {
  asset: AssetRowData;
  view?: ViewMode;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [thumbing, setThumbing] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const grid = view === "grid";

  // Управляющие элементы собираем один раз и раскладываем по-разному
  // в строке и в плитке — чтобы поведение не разъезжалось между видами.

  const kindBadge = (
    <span className="shrink-0 rounded-md bg-border/70 px-2 py-0.5 text-xs font-medium">
      {asset.kindLabel}
    </span>
  );

  const newTabBadge = asset.opensInNewTab ? (
    <span
      className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400"
      title="Сайт запрещает показывать себя внутри других страниц"
    >
      новой вкладкой
    </span>
  ) : null;

  const sectionSelect = !asset.archived ? (
    <select
      value={asset.section}
      disabled={pending}
      title="Раздел библиотеки"
      onChange={(e) => {
        const next = e.target.value;
        startTransition(() => setAssetSection(asset.id, next));
      }}
      className="shrink-0 rounded-md border border-border bg-background px-1.5 py-1 text-xs text-muted disabled:opacity-50"
    >
      {SECTIONS.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  ) : null;

  const thumbErrorEl = thumbError ? (
    <span className="shrink-0 text-xs text-red-600 dark:text-red-400">
      {thumbError}
    </span>
  ) : null;

  // Кнопка только там, где превью нет, но сделать его можно: у файлов
  // (PDF/видео/картинка) рисует браузер, у ссылок — берём og:image сайта.
  const makePreviewBtn =
    !asset.archived &&
    !asset.hasThumbnail &&
    (asset.canThumbnail || asset.externalUrl) ? (
      <button
        type="button"
        disabled={thumbing}
        onClick={async () => {
          setThumbing(true);
          setThumbError(null);
          let error: string | null = null;
          if (asset.externalUrl) {
            try {
              await backfillLinkThumbnail(asset.id);
            } catch (e) {
              error = e instanceof Error ? e.message : "Не удалось.";
            }
          } else {
            error = await backfillThumbnail(asset.id);
          }
          setThumbing(false);
          if (error) setThumbError(error);
          else router.refresh();
        }}
        className="shrink-0 rounded px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-500/10 disabled:opacity-50 dark:text-blue-400"
      >
        {thumbing ? "Готовим…" : "Сделать превью"}
      </button>
    ) : null;

  const actionCluster = asset.archived ? (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => restoreAsset(asset.id))}
      className="shrink-0 rounded px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-500/10 disabled:opacity-50 dark:text-blue-400"
    >
      {pending ? "…" : "Восстановить"}
    </button>
  ) : confirming ? (
    // Подтверждение прямо в строке, а не окном браузера: окна легко
    // закрываются вслепую, а здесь видно, что именно удаляешь.
    <span className="flex shrink-0 items-center gap-2">
      <span className="text-xs text-muted">
        {asset.hubCount > 0
          ? `Стоит в ${withPlural(asset.hubCount, WORDS.hubIn)} — пропадёт у клиентов`
          : "Удалить?"}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => archiveAsset(asset.id))}
        className="rounded px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
      >
        {pending ? "…" : "Удалить"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded px-2 py-1 text-xs text-muted transition hover:bg-border/60"
      >
        Отмена
      </button>
    </span>
  ) : (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="shrink-0 rounded px-2 py-1 text-xs text-muted transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
    >
      Удалить
    </button>
  );

  // ─── Плитка ───
  if (grid) {
    return (
      <li
        className={`flex h-full flex-col overflow-hidden rounded-xl border border-border ${
          asset.archived ? "opacity-60" : "bg-surface"
        }`}
      >
        {asset.hasThumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/assets/${asset.id}/thumbnail`}
            alt=""
            className="aspect-[16/10] w-full border-b border-border object-cover object-top"
          />
        ) : (
          <span className="grid aspect-[16/10] w-full place-items-center border-b border-dashed border-border text-xs text-muted">
            без превью
          </span>
        )}

        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {kindBadge}
            {newTabBadge}
          </div>

          <span className="line-clamp-2 font-medium">{asset.title}</span>

          {asset.externalUrl ? (
            <span className="truncate text-xs text-muted">
              {asset.externalUrl}
            </span>
          ) : null}

          {asset.meta ? (
            <span className="text-xs text-muted">{asset.meta}</span>
          ) : null}

          {thumbErrorEl}

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
            {sectionSelect}
            {makePreviewBtn}
            {actionCluster}
          </div>
        </div>
      </li>
    );
  }

  // ─── Строка ───
  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded-xl border border-border px-3 py-2.5 ${
        asset.archived ? "opacity-60" : "bg-surface"
      }`}
    >
      {/* Превью прямо в списке: продавец видит, что увидит клиент. */}
      {asset.hasThumbnail ? (
        // Обычный img: файл приватный, оптимизатор Next до него не достанет.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/assets/${asset.id}/thumbnail`}
          alt=""
          className="h-11 w-16 shrink-0 rounded border border-border object-cover object-top"
        />
      ) : (
        <span className="grid h-11 w-16 shrink-0 place-items-center rounded border border-dashed border-border text-[10px] text-muted">
          нет
        </span>
      )}

      {kindBadge}

      {/* min-w: иначе на узком окне название сжимается до «Сквоз…» и строка
          становится бесполезной. Лучше пусть остальное перенесётся вниз. */}
      <span className="min-w-40 flex-1 truncate font-medium">
        {asset.title}
        {asset.externalUrl ? (
          <span className="block truncate text-xs font-normal text-muted">
            {asset.externalUrl}
          </span>
        ) : null}
      </span>

      {newTabBadge}

      <span className="shrink-0 text-sm text-muted">{asset.meta}</span>

      {sectionSelect}
      {thumbErrorEl}
      {makePreviewBtn}
      {actionCluster}
    </li>
  );
}
