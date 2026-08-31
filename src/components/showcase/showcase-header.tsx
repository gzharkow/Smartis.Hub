"use client";

import { brandTextOn, SHOWCASE_BACKDROP, textOnBrand } from "@/lib/brand-color";

// Шапка витрины. Отсюда её берут ДВА места: настоящая витрина клиента
// и предпросмотр в настройках хаба.
//
// Общий компонент здесь принципиален. Если бы предпросмотр рисовался своей
// копией разметки, любая правка витрины делала бы предпросмотр враньём —
// продавец видел бы одно, клиент другое. А смысл предпросмотра ровно в том,
// чтобы показать, что увидит клиент.

export type ShowcaseHeaderData = {
  brandColor: string;
  logoUrl: string;
  orgName: string;
  headline: string;
  greeting: string | null;
  descriptionHtml: string | null;
  /** Надпись на кнопке связи. null — кнопки нет. */
  cta: string | null;
  demo: { url: string; label: string; note: string | null } | null;
};

export function ShowcaseHeader({
  data,
  onContactsClick,
  onDemoClick,
}: {
  data: ShowcaseHeaderData;
  /** В предпросмотре не передаётся — кнопка там просто нарисована. */
  onContactsClick?: () => void;
  /** Клик по «Демо-кабинету» — для статистики. В предпросмотре не передаётся. */
  onDemoClick?: () => void;
}) {
  const { brandColor, logoUrl, orgName, headline, greeting, descriptionHtml, cta, demo } =
    data;

  return (
    <header className="mb-8">
      <div className="flex items-center gap-4">
        {/* Обычный img: логотип грузится из настроек и может быть любым,
            включая внешний адрес. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={orgName} className="h-12 w-auto shrink-0 sm:h-14" />
        <h1 className="text-2xl font-semibold tracking-tight text-balance text-white sm:text-3xl">
          {headline}
        </h1>
      </div>

      {greeting ? <p className="mt-5 text-lg text-zinc-200">{greeting}</p> : null}

      {descriptionHtml ? (
        <div
          // rich-text--on-dark перекрашивает ссылки и цитаты: в тёмном
          // окружении синий #2563eb почти сливается с фоном.
          className="rich-text rich-text--on-dark mt-4 max-w-2xl text-zinc-300"
          // Содержимое уже дважды пропущено через очистку —
          // при сохранении и при отдаче страницы.
          dangerouslySetInnerHTML={{ __html: descriptionHtml }}
        />
      ) : null}

      {cta || demo ? (
        // Демо-кабинет выше «Задать вопрос» намеренно: сначала предлагаем
        // попробовать самому, и только потом — спросить.
        <div className="mt-6 flex flex-col items-start gap-4">
          {demo ? (
            <div className="flex flex-col gap-2">
              <a
                href={demo.url}
                target="_blank"
                // Без noopener открытая вкладка получила бы доступ
                // к нашей странице через window.opener.
                rel="noopener noreferrer"
                // Ссылка открывается в новой вкладке, эта остаётся — событие
                // успеет уйти обычной отправкой очереди.
                onClick={onDemoClick}
                className="inline-flex items-center gap-1.5 self-start rounded-xl border-2 px-5 py-2.5 text-sm font-medium transition duration-100 hover:bg-white/10 active:scale-[0.97] pointer-coarse:min-h-11"
                // Рамка — всегда фирменного цвета, а надпись только если он
                // читается на тёмной подложке витрины. Синий по умолчанию давал
                // здесь 2,48:1 — надпись почти сливалась с фоном.
                style={{
                  borderColor: brandColor,
                  color: brandTextOn(SHOWCASE_BACKDROP, brandColor),
                }}
              >
                {demo.label}
                <span aria-hidden="true">↗</span>
              </a>

              {demo.note ? (
                // whitespace-pre-line сохраняет переносы строк:
                // логин и пароль набраны с новой строки каждый.
                <p className="max-w-xs rounded-lg bg-white/8 px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-line text-zinc-200 ring-1 ring-white/15 backdrop-blur-sm">
                  {demo.note}
                </p>
              ) : null}
            </div>
          ) : null}

          {cta ? (
            <button
              type="button"
              onClick={onContactsClick}
              className="cursor-pointer rounded-xl px-5 py-2.5 text-sm font-medium transition duration-100 hover:opacity-90 active:scale-[0.97] pointer-coarse:min-h-11"
              // Цвет надписи считается от самой заливки: фирменный цвет задаёт
              // продавец, и на светлом тоне жёстко заданный белый пропадал.
              style={{ backgroundColor: brandColor, color: textOnBrand(brandColor) }}
            >
              {cta}
            </button>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
