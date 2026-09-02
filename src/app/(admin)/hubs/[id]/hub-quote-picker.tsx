"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addQuotePdfToHub, removeItemFromHub } from "@/app/actions/hubs";
import { backfillThumbnail } from "@/lib/backfill-thumbnail";
import { fieldClasses } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";

type QuoteOption = { id: string; clientName: string };

/** Уже добавленный в хаб КП — id здесь это HubItem.id, не Quote.id. */
type AddedQuoteItem = { id: string; title: string; meta: string };

const DEBOUNCE_MS = 250;

/**
 * Добавление PDF расчёта из «Генератора КП» в хаб — отдельно от «Материалы»
 * (КП не материал, см. quoteId в hubs.ts/addQuotePdfToHub). Строка поиска
 * только по названиям клиентов КП, а под ней сразу видно последние 3 расчёта,
 * чтобы не набирать текст ради того, что и так свежее всего. Каждое нажатие
 * «Добавить» генерирует PDF заново и кладёт его снимком в библиотеку — см.
 * addQuotePdfToHub в actions/hubs.ts. Уже добавленные в этот хаб КП показаны
 * своим списком «В хабе» — тем же паттерном, что и материалы в HubMaterials.
 */
export function HubQuotePicker({
  hubId,
  items,
}: {
  hubId: string;
  items: AddedQuoteItem[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [quotes, setQuotes] = useState<QuoteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Сам fetch не трогает "loading" — вызывающая сторона решает, когда
  // включать индикатор синхронно (событие) и когда нет (эффект при монтировании,
  // где правило react-hooks/set-state-in-effect запрещает setState напрямую
  // в теле эффекта — только из колбэков промиса, как здесь и сделано).
  function fetchQuotes(q: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    return fetch(`/api/quotes/search?q=${encodeURIComponent(q)}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data: { quotes: QuoteOption[] }) => setQuotes(data.quotes))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
  }

  // Список последних расчётов сразу при открытии — без этого пришлось бы
  // начать печатать ради того, что и так на виду. "loading" уже стартует
  // true (см. useState выше), поэтому здесь его включать не нужно.
  useEffect(() => {
    fetchQuotes("").finally(() => setLoading(false));
  }, []);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setQuery(next);
    setLoading(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => fetchQuotes(next.trim()).finally(() => setLoading(false)),
      DEBOUNCE_MS,
    );
  }

  function add(quote: QuoteOption) {
    setAddingId(quote.id);
    startTransition(() => {
      addQuotePdfToHub(hubId, quote.id)
        .then(async ({ assetId }) => {
          setAddedIds((prev) => new Set(prev).add(quote.id));
          // Сам расчёт собирается на сервере (pdf-lib, без браузера) — превью
          // для витрины клиента дорисовываем отдельным шагом тем же способом,
          // что и у обычных загруженных файлов (см. backfill-thumbnail.ts):
          // качаем только что сохранённый PDF в браузер и рендерим первую
          // страницу. Не критично, если не получится — тайл на витрине
          // просто останется без картинки, как раньше.
          await backfillThumbnail(assetId);
          router.refresh();
        })
        .finally(() => setAddingId(null));
    });
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-3">
        <h3 className="mb-1.5 text-xs font-medium text-muted">
          В хабе — {items.length}
        </h3>
        {items.length === 0 ? null : (
          <ul className="grid grid-cols-1 gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {item.title}
                </span>
                <span className="hidden shrink-0 text-xs text-muted sm:inline">
                  {item.meta}
                </span>
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
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="grid gap-1.5">
        <span className="text-xs font-medium text-muted">
          Поиск по расчётам (Генератор КП)
        </span>
        <input
          value={query}
          onChange={onChange}
          placeholder="Название клиента…"
          className={fieldClasses()}
        />
      </label>

      <ul className="mt-3 grid grid-cols-1 gap-2">
        {loading ? (
          <li className="px-1 py-2 text-sm text-muted">Ищем…</li>
        ) : quotes.length === 0 ? (
          <li className="px-1 py-2 text-sm text-muted">
            {query.trim()
              ? `Ничего не найдено по «${query.trim()}»`
              : "В калькуляторе пока нет расчётов."}
          </li>
        ) : (
          quotes.map((quote) => {
            const added = addedIds.has(quote.id);
            return (
              <li
                key={quote.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {quote.clientName}
                </span>
                <button
                  type="button"
                  disabled={pending && addingId === quote.id}
                  onClick={() => add(quote)}
                  className={buttonClasses("link", "sm", "shrink-0")}
                >
                  {addingId === quote.id
                    ? "Добавляем…"
                    : added
                      ? "Добавлено ещё раз"
                      : "Добавить"}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
