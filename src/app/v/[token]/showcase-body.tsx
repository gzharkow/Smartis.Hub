"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssetKind } from "@/generated/prisma/enums";
import type { ContactMethod } from "@/lib/contact-methods";
import { useTracker } from "./use-tracker";
import { PdfViewer } from "./pdf-viewer";
import { ShowcaseBackdrop } from "@/components/showcase/showcase-backdrop";
import { ShowcaseHeader } from "@/components/showcase/showcase-header";
import { ContactDialog } from "@/components/showcase/contact-dialog";

export type ShowcaseItem = {
  id: string;
  title: string;
  description: string | null;
  kind: AssetKind;
  kindLabel: string;
  externalUrl: string | null;
  /** Ссылка, которую сайт разрешил показывать внутри страницы. */
  embeddable: boolean;
  pageCount: number | null;
  /** Есть ли картинка превью. Нет — покажем цветную заглушку. */
  hasThumbnail: boolean;
  meta: string;
};

type Props = {
  token: string;
  brandColor: string;
  logoUrl: string;
  orgName: string;
  headline: string;
  greeting: string | null;
  descriptionHtml: string | null;
  cta: string | null;
  contacts: ContactMethod[];
  demo: { url: string; label: string; note: string | null } | null;
  items: ShowcaseItem[];
};

const KIND_TINT: Record<AssetKind, string> = {
  PDF: "#dc2626",
  VIDEO: "#7c3aed",
  IMAGE: "#0891b2",
  LINK: "#0d9488",
  FILE: "#64748b",
};

function Tile({
  item,
  token,
  onOpen,
}: {
  item: ShowcaseItem;
  token: string;
  onOpen: () => void;
}) {
  return (
    // Настоящая кнопка, а не div с обработчиком: работает с клавиатуры
    // и видна программам чтения с экрана. У Paperflite плитки — мёртвые div'ы.
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <span
        className="relative grid h-40 place-items-center overflow-hidden"
        style={{ backgroundColor: `${KIND_TINT[item.kind]}12` }}
      >
        {item.hasThumbnail ? (
          <>
            {/* Обычный img: файл приватный, оптимизатор Next до него
                не достанет. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/v/${token}/asset/${item.id}?thumb=1`}
              alt=""
              // object-top, а не center: у презентаций и договоров всё важное
              // в верхней части страницы, обрезать надо низ.
              className="absolute inset-0 size-full object-cover object-top"
              loading="lazy"
            />
            {/* Значок типа поверх картинки — с подложкой, иначе на светлом
                слайде белые буквы исчезнут. */}
            <span className="absolute top-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-xs font-semibold tracking-wide text-white backdrop-blur-sm">
              {item.kindLabel}
            </span>
          </>
        ) : (
          <span
            className="rounded-lg px-2.5 py-1 text-xs font-semibold tracking-wide text-white"
            style={{ backgroundColor: KIND_TINT[item.kind] }}
          >
            {item.kindLabel}
          </span>
        )}
      </span>

      <span className="flex flex-1 flex-col gap-1 p-4">
        <span className="line-clamp-2 font-medium text-zinc-900">
          {item.title}
        </span>
        {item.description ? (
          <span className="line-clamp-2 text-sm text-zinc-500">
            {item.description}
          </span>
        ) : null}
        {item.meta ? (
          <span className="mt-auto pt-2 text-xs text-zinc-400">{item.meta}</span>
        ) : null}
      </span>
    </button>
  );
}

function Viewer({
  token,
  items,
  openId,
  onSelect,
  onClose,
  onVideoProgress,
  onDownload,
  onLinkClick,
  onPageChange,
}: {
  token: string;
  items: ShowcaseItem[];
  openId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  onVideoProgress: (itemId: string, positionSec: number) => void;
  onDownload: (itemId: string) => void;
  onLinkClick: (itemId: string) => void;
  onPageChange: (itemId: string, page: number) => void;
}) {
  const item = items.find((i) => i.id === openId);

  // Escape закрывает — обычное ожидание от полноэкранного окна.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Фон не должен прокручиваться под открытым вьюером.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!item) return null;

  const src = `/v/${token}/asset/${item.id}`;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-zinc-900">
      <div className="flex shrink-0 items-center gap-3 px-4 py-2.5">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
        >
          ← Назад
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
          {item.title}
        </span>
        <span className="shrink-0 text-xs text-zinc-400">{item.meta}</span>
      </div>

      <div className="min-h-0 flex-1 bg-zinc-800">
        {item.kind === "VIDEO" ? (
          <video
            src={src}
            controls
            autoPlay
            className="size-full"
            // Браузер шлёт это событие несколько раз в секунду — записывать
            // каждое было бы безумием. Сохраняем позицию не чаще раза
            // в 5 секунд, этого хватает, чтобы понять, докуда досмотрели.
            onTimeUpdate={(e) => {
              const sec = Math.floor(e.currentTarget.currentTime);
              if (sec > 0 && sec % 5 === 0) onVideoProgress(item.id, sec);
            }}
          />
        ) : item.kind === "IMAGE" ? (
          <div className="grid size-full place-items-center p-4">
            {/* Обычный img: размеры картинки заранее неизвестны,
                а оптимизатор Next тут ничего не даст — файл приватный. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={item.title} className="max-h-full max-w-full" />
          </div>
        ) : item.kind === "LINK" && item.externalUrl ? (
          item.embeddable ? (
            <iframe
              src={item.externalUrl}
              title={item.title}
              className="size-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          ) : (
            // Сайт запретил показывать себя в рамке. Раньше здесь был всё тот
            // же iframe — клиент видел пустой белый прямоугольник и решал, что
            // сломалось. Честнее сказать прямо и дать кнопку.
            <div className="grid size-full place-items-center p-6 text-center">
              <div className="max-w-sm">
                <p className="text-sm text-zinc-300">
                  Этот материал открывается на сайте отдельной вкладкой —
                  показать его прямо здесь сайт не разрешает.
                </p>
                <a
                  href={item.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onLinkClick(item.id)}
                  className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
                >
                  Открыть ↗
                </a>
                <p className="mt-3 truncate text-xs text-zinc-500">
                  {item.externalUrl}
                </p>
              </div>
            </div>
          )
        ) : item.kind === "FILE" ? (
          <div className="grid size-full place-items-center">
            <a
              href={src}
              download
              onClick={() => onDownload(item.id)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900"
            >
              Скачать файл
            </a>
          </div>
        ) : (
          <PdfViewer
            // key заставляет пересоздать просмотрщик при переключении между
            // документами. Без него состояние — номер страницы, отрисованные
            // холсты — утекло бы из прошлого PDF в новый.
            key={item.id}
            src={src}
            pageCount={item.pageCount}
            onPageChange={(page) => onPageChange(item.id, page)}
          />
        )}
      </div>

      {items.length > 1 ? (
        // Лента остальных материалов: можно прыгать между ними, не возвращаясь.
        // Прямо лечит болезнь «посмотрел одну плитку и ушёл».
        <div className="flex shrink-0 gap-2 overflow-x-auto px-4 py-2.5">
          {items.map((other) => (
            <button
              key={other.id}
              type="button"
              onClick={() => onSelect(other.id)}
              className={`shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-xs whitespace-nowrap transition ${
                other.id === openId
                  ? "bg-white text-zinc-900"
                  : "bg-white/10 text-zinc-300 hover:bg-white/20"
              }`}
            >
              {other.title.length > 34
                ? other.title.slice(0, 34) + "…"
                : other.title}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ShowcaseBody({
  token,
  brandColor,
  logoUrl,
  orgName,
  headline,
  greeting,
  descriptionHtml,
  cta,
  contacts,
  demo,
  items,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [contactsOpen, setContactsOpen] = useState(false);
  const { track, setFocus } = useTracker(token);

  // Открытие витрины. Пустой список зависимостей — событие ровно одно
  // на загрузку страницы, а не на каждую перерисовку.
  useEffect(() => {
    track({ type: "HUB_VIEW" });
  }, [track]);

  // Что открыто — дублируем в ref. Нужно потому, что события НЕЛЬЗЯ слать
  // изнутри setOpenId(prev => ...): React вправе вызвать такую функцию
  // несколько раз, и каждый вызов слал бы лишнее закрытие. Проверено на живых
  // данных: закрытий приходило вдвое больше, чем открытий.
  const openIdRef = useRef<string | null>(null);

  const open = useCallback(
    (id: string) => {
      // Переключение между материалами внутри вьюера: старый закрываем сами,
      // иначе он остался бы «открытым» навсегда.
      const prev = openIdRef.current;
      if (prev && prev !== id) track({ type: "ITEM_CLOSE", itemId: prev });
      track({ type: "ITEM_OPEN", itemId: id });

      openIdRef.current = id;
      setOpenId(id);
      setFocus(id);
    },
    [track, setFocus],
  );

  const close = useCallback(() => {
    const prev = openIdRef.current;
    if (prev) track({ type: "ITEM_CLOSE", itemId: prev });

    openIdRef.current = null;
    setOpenId(null);
    // Вьюер закрыт — человек снова листает витрину, пульс идёт на хаб.
    setFocus(null);
  }, [track, setFocus]);

  // Позиция видео летит каждые 5 секунд просмотра — пропускаем повторы,
  // иначе перемотка назад-вперёд насыпала бы дубликатов.
  const lastVideoSec = useRef<Record<string, number>>({});
  const onVideoProgress = useCallback(
    (itemId: string, positionSec: number) => {
      if (lastVideoSec.current[itemId] === positionSec) return;
      lastVideoSec.current[itemId] = positionSec;
      track({ type: "VIDEO_PROGRESS", itemId, positionSec });
    },
    [track],
  );

  const onDownload = useCallback(
    (itemId: string) => track({ type: "DOWNLOAD", itemId }),
    [track],
  );

  // Уход на внешний сайт. Дальше мы клиента не видим — на чужой странице
  // наш счётчик не работает, — поэтому сам факт перехода тем важнее.
  const onLinkClick = useCallback(
    (itemId: string) => track({ type: "LINK_CLICK", itemId }),
    [track],
  );

  // Нажал «Задать вопрос» — открываем окно связи и отмечаем интерес.
  const onContact = useCallback(() => {
    track({ type: "CONTACT_CLICK" });
    setContactsOpen(true);
  }, [track]);

  // Ушёл в демо-кабинет пробовать сервис — сильный сигнал заинтересованности.
  const onDemo = useCallback(() => track({ type: "DEMO_CLICK" }), [track]);

  // Смена страницы в PDF. Делаем две вещи:
  //   1. PAGE_VIEW — «долистал до страницы N». По максимуму видно, дочитал ли.
  //   2. Переводим пульс на эту страницу — так набирается время по каждой.
  const onPageChange = useCallback(
    (itemId: string, page: number) => {
      track({ type: "PAGE_VIEW", itemId, pageNumber: page });
      setFocus(itemId, page);
    },
    [track, setFocus],
  );

  return (
    <main className="relative flex-1 text-zinc-100">
      <ShowcaseBackdrop brandColor={brandColor} />

      <div className="mx-auto max-w-7xl px-5 py-8 sm:py-12">
        <ShowcaseHeader
          data={{
            brandColor,
            logoUrl,
            orgName,
            headline,
            greeting,
            descriptionHtml,
            cta,
            demo,
          }}
          onContactsClick={onContact}
          onDemoClick={onDemo}
        />

        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/20 py-16 text-center text-sm text-zinc-400">
            В подборке пока нет материалов.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {items.map((item) => (
              <li key={item.id}>
                <Tile
                  item={item}
                  token={token}
                  onOpen={() => open(item.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {openId ? (
        <Viewer
          token={token}
          items={items}
          openId={openId}
          onSelect={open}
          onClose={close}
          onVideoProgress={onVideoProgress}
          onDownload={onDownload}
          onLinkClick={onLinkClick}
          onPageChange={onPageChange}
        />
      ) : null}

      {contactsOpen ? (
        <ContactDialog
          contacts={contacts}
          brandColor={brandColor}
          onClose={() => setContactsOpen(false)}
        />
      ) : null}
    </main>
  );
}
