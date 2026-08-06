import Link from "next/link";
import { SECTION_LABELS, slugOfSection } from "@/lib/asset-sections";
import type { SearchResult } from "./use-global-search";

function ResultGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1">
      <p className="px-3 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-muted uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

const itemClass =
  "flex items-center justify-between gap-3 px-3 py-1.5 text-sm transition hover:bg-border/60";

/**
 * Группы результатов сквозного поиска — вынесены из GlobalSearch, чтобы
 * их же рисовал и полноэкранный поиск нижнего PWA-бара, не дублируя разметку.
 */
export function SearchResultsList({
  result,
  loading,
  query,
  total,
  onSelect,
}: {
  result: SearchResult;
  loading: boolean;
  query: string;
  total: number;
  /** Вызывается при клике по любому результату — закрыть/сбросить поиск. */
  onSelect: () => void;
}) {
  if (loading) {
    return <p className="px-3 py-3 text-sm text-muted">Ищем…</p>;
  }

  if (total === 0) {
    return (
      <p className="px-3 py-3 text-sm text-muted">
        Ничего не найдено по «{query.trim()}»
      </p>
    );
  }

  return (
    <>
      {result.hubs.length > 0 ? (
        <ResultGroup label="Хабы">
          {result.hubs.map((hub) => (
            <Link
              key={hub.id}
              href={`/hubs/${hub.id}`}
              onClick={onSelect}
              className={itemClass}
            >
              <span className="truncate">{hub.title}</span>
            </Link>
          ))}
        </ResultGroup>
      ) : null}

      {result.folders.length > 0 ? (
        <ResultGroup label="Папки">
          {result.folders.map((folder) => (
            <Link
              key={folder.id}
              href={`/hubs/folders/${folder.id}`}
              onClick={onSelect}
              className={itemClass}
            >
              <span className="truncate">{folder.title}</span>
            </Link>
          ))}
        </ResultGroup>
      ) : null}

      {result.assets.length > 0 ? (
        <ResultGroup label="Материалы">
          {result.assets.map((asset) => (
            <Link
              key={asset.id}
              href={`/assets/${slugOfSection(asset.section)}`}
              onClick={onSelect}
              className={itemClass}
            >
              <span className="truncate">{asset.title}</span>
              {/* Единственное место, где поиск смешивает разделы — подпись
                  показывает, в какой раздел библиотеки вести. */}
              <span className="shrink-0 rounded-md bg-border/70 px-2 py-0.5 text-xs font-medium">
                {SECTION_LABELS[asset.section]}
              </span>
            </Link>
          ))}
        </ResultGroup>
      ) : null}

      {result.quotes.length > 0 ? (
        <ResultGroup label="Генератор КП">
          {result.quotes.map((quote) => (
            <Link
              key={quote.id}
              href={`/calculator/${quote.id}`}
              onClick={onSelect}
              className={itemClass}
            >
              <span className="truncate">{quote.title}</span>
            </Link>
          ))}
        </ResultGroup>
      ) : null}
    </>
  );
}
