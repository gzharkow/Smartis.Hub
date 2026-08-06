"use client";

import { useRef, useState } from "react";
import { SearchIcon } from "@/app/(admin)/nav-icons";
import { useGlobalSearch } from "./use-global-search";
import { SearchResultsList } from "./search-results-list";

/**
 * Сквозной поиск в шапке кабинета: один запрос — результаты сразу по хабам,
 * папкам и материалам. Материалы дополнительно подписаны разделом библиотеки
 * (Авторынок/Недвижимость/Общие) — единственное место, где один и тот же
 * запрос может найти совпадения в разных разделах, и это надо различать
 * прямо в выпадающем списке, не переходя никуда.
 */
export function GlobalSearch() {
  const { query, result, loading, open, total, onChange, reset, setOpen } =
    useGlobalSearch();
  // На телефоне строка целиком не помещается рядом с почтой и «Выйти» —
  // по умолчанию показываем только значок, поле раскрывается по нажатию.
  // С sm и шире поле видно всегда (см. классы ниже), это состояние не влияет.
  const [mobileOpen, setMobileOpen] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const outsideHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);

  function closeAndCleanup() {
    // Схлопываем обратно в значок и стираем запрос: на телефоне это
    // экономит место, а на sm+ поле всё равно всегда видно классами.
    setMobileOpen(false);
    reset();
    if (outsideHandlerRef.current) {
      document.removeEventListener("mousedown", outsideHandlerRef.current);
      outsideHandlerRef.current = null;
    }
  }

  function openMobile() {
    setMobileOpen(true);
    // Поле появляется только сейчас — фокус ставим на следующий тик,
    // когда оно уже в DOM.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function ensureOutsideHandler() {
    if (outsideHandlerRef.current) return;
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        closeAndCleanup();
      }
    };
    outsideHandlerRef.current = handler;
    document.addEventListener("mousedown", handler);
  }

  const showDropdown = open && query.trim().length > 0;

  return (
    <div
      ref={boxRef}
      // flex-1 — только пока поле открыто на телефоне, чтобы оно забрало
      // свободное место в строке шапки. С sm и шире всегда flex-none:
      // ширина там фиксированная (sm:w-72 у самого поля).
      className={`relative min-w-0 sm:flex-none ${mobileOpen ? "flex-1" : ""}`}
    >
      {/* Телефон: одна кнопка-значок вместо целой строки поиска — ей рядом
          с почтой и «Выйти» всё равно негде поместиться читаемо. */}
      <button
        type="button"
        onClick={openMobile}
        aria-label="Поиск по хабам, папкам, материалам"
        className={`grid size-8 place-items-center rounded-full text-muted transition hover:bg-border/60 hover:text-foreground sm:hidden ${
          mobileOpen ? "hidden" : "grid"
        }`}
      >
        <SearchIcon className="size-4" />
      </button>

      <div
        className={`relative ${mobileOpen ? "block" : "hidden"} sm:block`}
      >
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            onChange(e);
            ensureOutsideHandler();
          }}
          onFocus={() => query.trim() && setOpen(true)}
          onKeyDown={(e) => {
            // Esc сворачивает поле обратно в значок на телефоне и закрывает
            // список результатов везде.
            if (e.key === "Escape") closeAndCleanup();
          }}
          placeholder="Поиск по хабам, папкам, материалам"
          className="w-full rounded-full border border-border bg-background py-1.5 pr-3 pl-8 text-sm outline-none transition focus:border-blue-500 sm:w-72"
        />
      </div>

      {showDropdown ? (
        // Фиксированные 384px (w-96) на телефоне вылезали за край экрана —
        // растягивали всю страницу вбок. На телефоне поле само уже занимает
        // ровно столько места, сколько есть в строке (flex-1), поэтому
        // w-full под список результатов гарантированно не вылезет. С sm
        // и шире поле снова фиксированной ширины — там список пошире, w-96.
        <div className="absolute top-full left-0 z-20 mt-1.5 max-h-96 w-full overflow-y-auto rounded-xl border border-border bg-surface shadow-lg sm:w-96">
          <SearchResultsList
            result={result}
            loading={loading}
            query={query}
            total={total}
            onSelect={closeAndCleanup}
          />
        </div>
      ) : null}
    </div>
  );
}
