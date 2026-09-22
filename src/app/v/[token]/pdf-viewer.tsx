"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";

// Свой просмотрщик вместо встроенного в браузер. Причина одна: встроенный
// показывает PDF внутри <iframe> и наружу не сообщает ничего — номер текущей
// страницы у него не спросить. А «клиент завис на странице с ценами на 4 минуты»
// — это и есть то, ради чего затевался весь трекинг.
//
// Здесь мы рисуем каждую страницу сами на холсте и потому точно знаем,
// что человек видит.

type Props = {
  src: string;
  /** Сколько страниц ждём. Из метаданных материала — чтобы разметить
   *  места под страницы до того, как файл догрузится. */
  pageCount: number | null;
  onPageChange: (page: number) => void;
};

/** За сколько экранов до появления начинаем рисовать страницу. */
const RENDER_MARGIN = "150% 0px";

export function PdfViewer({ src, pageCount, onPageChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const taskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pages, setPages] = useState(pageCount ?? 0);
  const [current, setCurrent] = useState(1);
  // Пропорции берём из самого документа по первой странице. Гадать нельзя:
  // презентации широкие (16:9), договоры вертикальные (A4). Ошибёшься —
  // заготовка не совпадёт со страницей, и лента будет дёргаться при отрисовке.
  const [ratio, setRatio] = useState<number | null>(null);

  // Какие страницы уже нарисованы — чтобы не рисовать одну дважды
  // при повторном попадании в поле зрения.
  const rendered = useRef(new Set<number>());

  useEffect(() => {
    let cancelled = false;
    // Копия ссылки на Set, а не повторное чтение rendered.current в cleanup —
    // так и просит react-hooks/exhaustive-deps (сам объект тут никогда не
    // переприсваивается, но линтер этого не знает и предупреждает всегда).
    const renderedPages = rendered.current;

    (async () => {
      try {
        // Грузим библиотеку только в браузере: она тянет за собой холст
        // и рабочий поток, на сервере ей делать нечего.
        const pdfjs = await import("pdfjs-dist");

        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.mjs",
          import.meta.url,
        ).toString();

        // Держим задачу загрузки: только у неё есть destroy().
        // У самого документа его нет — pdfjs-dist 6.
        const task = pdfjs.getDocument({ url: src });
        taskRef.current = task;

        const doc = await task.promise;
        if (cancelled) {
          void task.destroy();
          return;
        }

        const first = await doc.getPage(1);
        const size = first.getViewport({ scale: 1 });

        docRef.current = doc;
        setPages(doc.numPages);
        setRatio(size.width / size.height);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      // Через задачу, а не через документ: иначе рабочий поток pdf.js
      // не освобождается, и каждый открытый PDF течёт.
      void taskRef.current?.destroy();
      taskRef.current = null;
      docRef.current = null;
      renderedPages.clear();
    };
  }, [src]);

  const renderPage = useCallback(async (slot: HTMLElement, pageNum: number) => {
    const doc = docRef.current;
    if (!doc || rendered.current.has(pageNum)) return;
    rendered.current.add(pageNum);

    const page = await doc.getPage(pageNum);

    // Подгоняем по ширине колонки.
    const unscaled = page.getViewport({ scale: 1 });
    const scale = slot.clientWidth / unscaled.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    // На экранах с высокой плотностью точек рисуем крупнее, иначе текст мылит.
    // Потолок подняли с 2 до 3 (реальный DPR большинства смартфонов, а не
    // только десктопных Retina-экранов, под которые считался старый потолок).
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    // Запас поверх «по ширине колонки»: страница рисуется один раз при
    // попадании в область видимости и потом не перерисовывается — без
    // запаса при родном pinch-zoom браузера (a maximumScale нигде не
    // ограничен) растр упирается в свою же резолюцию раньше, чем в этом
    // есть смысл, и текст расползается на пиксели. x2 даёт зумиться
    // примерно вдвое, оставаясь читаемым.
    const ZOOM_HEADROOM = 2;
    const renderScale = scale * dpr * ZOOM_HEADROOM;
    canvas.width = Math.floor(viewport.width * dpr * ZOOM_HEADROOM);
    canvas.height = Math.floor(viewport.height * dpr * ZOOM_HEADROOM);
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.style.display = "block";

    await page.render({
      canvas,
      viewport: page.getViewport({ scale: renderScale }),
    }).promise;

    slot.replaceChildren(canvas);
    // Место под страницу больше не нужно — дальше высоту задаёт сам холст.
    // Важно для документов, где страницы разного размера: заготовка одна
    // на всех, а настоящий размер у каждой свой.
    slot.style.aspectRatio = "";
    slot.style.minHeight = "";
  }, []);

  // Рисуем страницы по мере приближения к экрану. Рисовать все сразу нельзя:
  // презентация на 42 страницы — это 42 больших холста, браузер задохнётся.
  useEffect(() => {
    if (status !== "ready" || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const slot = entry.target as HTMLElement;
          void renderPage(slot, Number(slot.dataset.page));
        }
      },
      { root: containerRef.current, rootMargin: RENDER_MARGIN },
    );

    for (const slot of containerRef.current.querySelectorAll("[data-page]")) {
      observer.observe(slot);
    }

    return () => observer.disconnect();
  }, [status, pages, renderPage]);

  // Отдельный наблюдатель — какая страница сейчас перед глазами.
  // Считаем текущей ту, что видна больше остальных.
  useEffect(() => {
    if (status !== "ready" || !containerRef.current) return;

    const visibility = new Map<number, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const page = Number((entry.target as HTMLElement).dataset.page);
          visibility.set(page, entry.intersectionRatio);
        }

        let best = 0;
        let bestRatio = 0;
        for (const [page, ratio] of visibility) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = page;
          }
        }

        if (best > 0) setCurrent(best);
      },
      {
        root: containerRef.current,
        // Много порогов: без них о частично видимой странице не узнать,
        // а «видна больше остальных» без долей не посчитать.
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const slot of containerRef.current.querySelectorAll("[data-page]")) {
      observer.observe(slot);
    }

    return () => observer.disconnect();
  }, [status, pages]);

  // Сообщаем наружу только при смене страницы, а не на каждую прокрутку.
  useEffect(() => {
    if (status === "ready") onPageChange(current);
  }, [current, status, onPageChange]);

  if (status === "error") {
    return (
      <div className="grid size-full place-items-center p-6 text-center">
        <p className="text-sm text-zinc-300">
          Не удалось открыть документ.
          <br />
          <a href={src} download className="underline">
            Скачать файл
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="relative size-full">
      <div ref={containerRef} className="size-full overflow-y-auto">
        <div className="mx-auto grid max-w-3xl gap-3 px-3 py-4">
          {Array.from({ length: pages }, (_, i) => (
            <div
              key={i}
              data-page={i + 1}
              className="grid place-items-center bg-white shadow-lg"
              // Пока страница не нарисована, держим место её же пропорциями —
              // тогда лента не прыгает, когда холст встаёт на место.
              style={{ aspectRatio: ratio ?? 1 / 1.414, minHeight: 120 }}
            >
              <span className="text-xs text-zinc-300">{i + 1}</span>
            </div>
          ))}
        </div>

        {status === "loading" ? (
          <p className="py-10 text-center text-sm text-zinc-400">
            Загружаем документ…
          </p>
        ) : null}
      </div>

      {pages > 0 && status === "ready" ? (
        <p className="pointer-events-none absolute right-4 bottom-4 rounded-lg bg-zinc-900/80 px-2.5 py-1 text-xs font-medium text-white tabular-nums">
          {current} / {pages}
        </p>
      ) : null}
    </div>
  );
}
