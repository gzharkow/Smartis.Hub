"use client";

import { useRef, useState } from "react";
import type { SECTION_LABELS } from "@/lib/asset-sections";

const DEBOUNCE_MS = 250;

export type SearchResult = {
  hubs: { id: string; title: string }[];
  folders: { id: string; title: string }[];
  assets: { id: string; title: string; section: keyof typeof SECTION_LABELS }[];
  quotes: { id: string; title: string }[];
};

const EMPTY: SearchResult = { hubs: [], folders: [], assets: [], quotes: [] };

/**
 * Общая логика сквозного поиска — запрос/дебаунс/отмена/результаты.
 * Вынесена из GlobalSearch (шапка), чтобы её же использовал полноэкранный
 * поиск нижнего PWA-бара: обе оболочки хотят один и тот же запрос
 * к /api/search, только рисуют его по-разному.
 */
export function useGlobalSearch() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function runSearch(q: string) {
    abortRef.current?.abort();
    if (!q) {
      setResult(EMPTY);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data: SearchResult) => setResult(data))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      })
      .finally(() => setLoading(false));
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setQuery(next);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(next.trim()), DEBOUNCE_MS);
  }

  function reset() {
    setQuery("");
    setResult(EMPTY);
    setOpen(false);
  }

  const total =
    result.hubs.length +
    result.folders.length +
    result.assets.length +
    result.quotes.length;

  return { query, result, loading, open, total, onChange, reset, setOpen };
}
