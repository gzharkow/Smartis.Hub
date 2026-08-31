"use client";

import { useEffect, useRef } from "react";
import { useGlobalSearch } from "@/components/use-global-search";
import { SearchResultsList } from "@/components/search-results-list";
import { useCloseOnBack } from "@/lib/use-close-on-back";
import { SearchIcon } from "./nav-icons";

/**
 * Поиск нижнего PWA-бара — своя кнопка, не под шестерёнкой (решение
 * владельца). В шапке поиск раскрывается инлайн в строке, тут строки нет —
 * полноэкранная панель поверх бара с крупным полем сверху и результатами
 * под ним. Логика запроса/дебаунса общая с GlobalSearch (useGlobalSearch).
 *
 * BottomNav монтирует этот компонент, только когда панель открыта, и
 * размонтирует при закрытии — так каждое открытие начинается с чистого
 * запроса без ручного сброса стейта в эффекте.
 */
export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { query, result, loading, total, onChange } = useGlobalSearch();
  const inputRef = useRef<HTMLInputElement>(null);

  // Кнопка «назад» на Android закрывает панель вместо выхода из приложения.
  useCloseOnBack(onClose);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 pt-[env(safe-area-inset-top)] pb-3">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={onChange}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
            placeholder="Поиск по хабам, папкам, материалам"
            className="w-full rounded-full border border-border bg-surface py-2.5 pr-3 pl-9 text-sm transition focus:border-accent"
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-border/60 hover:text-foreground"
        >
          Отмена
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {query.trim().length > 0 ? (
          <SearchResultsList
            result={result}
            loading={loading}
            query={query}
            total={total}
            onSelect={onClose}
          />
        ) : (
          <p className="px-4 py-6 text-center text-sm text-muted">
            Начните вводить запрос
          </p>
        )}
      </div>
    </div>
  );
}
