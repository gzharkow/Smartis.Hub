"use client";

import { useActionState, useState } from "react";
import { RichTextEditor } from "@/components/rich-text-editor";
import { ShowcaseBackdrop } from "@/components/showcase/showcase-backdrop";
import { ShowcaseHeader } from "@/components/showcase/showcase-header";
import { updateHub, type UpdateHubState } from "@/app/actions/hubs";
import {
  CONTACT_KINDS,
  CONTACT_KIND_LABELS,
  type ContactMethod,
} from "@/lib/contact-methods";

type Props = {
  hub: {
    id: string;
    title: string;
    headline: string | null;
    descriptionHtml: string | null;
    ctaLabel: string;
    ctaEnabled: boolean;
    demoUrl: string | null;
    demoLabel: string;
    demoNote: string | null;
  };
  /** Из настроек организации — предпросмотр должен показывать тот же бренд. */
  brandColor: string;
  logoUrl: string;
  orgName: string;
  /** Способы связи из настроек компании — общие для всех хабов организации. */
  contacts: ContactMethod[];
};

const MAX_CONTACTS = 8;

export function HubSettingsForm({
  hub,
  brandColor,
  logoUrl,
  orgName,
  contacts: initialContacts,
}: Props) {
  const [state, action, pending] = useActionState<UpdateHubState, FormData>(
    updateHub,
    undefined,
  );

  // Поля держим в состоянии, чтобы предпросмотр обновлялся по мере набора.
  // В форму они всё равно уходят обычным способом — action не меняется.
  const [headline, setHeadline] = useState(hub.headline ?? "");
  const [descriptionHtml, setDescriptionHtml] = useState(hub.descriptionHtml ?? "");
  const [ctaLabel, setCtaLabel] = useState(hub.ctaLabel);
  const [ctaEnabled, setCtaEnabled] = useState(hub.ctaEnabled);
  const [demoUrl, setDemoUrl] = useState(hub.demoUrl ?? "");
  const [demoLabel, setDemoLabel] = useState(hub.demoLabel);
  const [demoNote, setDemoNote] = useState(hub.demoNote ?? "");
  const [title, setTitle] = useState(hub.title);
  const [contacts, setContacts] = useState<ContactMethod[]>(initialContacts);

  function addContact() {
    if (contacts.length >= MAX_CONTACTS) return;
    setContacts((prev) => [...prev, { kind: "PHONE", label: "", value: "" }]);
  }

  function updateContact(index: number, patch: Partial<ContactMethod>) {
    setContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  }

  function removeContact(index: number) {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  }

  const hasContacts = contacts.some((c) => c.value.trim().length > 0);

  const input =
    "rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-blue-500";

  return (
    // lg:grid-cols-2 — на широком экране форма и предпросмотр рядом.
    // На узком предпросмотр уходит вниз: втискивать витрину в половину
    // телефона бессмысленно.
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
      <form action={action} className="grid grid-cols-1 gap-5">
        <input type="hidden" name="hubId" value={hub.id} />

        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Название</span>
          <input
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={120}
            className={input}
          />
          <span className="text-xs text-muted">
            Внутреннее — клиент его не увидит
          </span>
        </label>

        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Заголовок на витрине</span>
          <input
            name="headline"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={160}
            placeholder="Материалы для «ГК ИНСИТИ»"
            className={input}
          />
          <span className="text-xs text-muted">Это клиент увидит первым</span>
        </label>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium">Описание</span>
          <RichTextEditor
            name="descriptionHtml"
            defaultValue={hub.descriptionHtml ?? ""}
            onChange={setDescriptionHtml}
          />
          <span className="text-xs text-muted">
            Что за подборка, зачем её смотреть. Ссылки внутри будут кликабельными
          </span>
        </div>

        <fieldset className="grid gap-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium">Кнопка связи</legend>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="ctaEnabled"
              checked={ctaEnabled}
              onChange={(e) => setCtaEnabled(e.target.checked)}
              className="size-4 accent-blue-600"
            />
            <span className="text-sm">Показывать кнопку на витрине</span>
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm">Надпись на кнопке</span>
            <input
              name="ctaLabel"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              maxLength={40}
              className={`w-64 ${input}`}
            />
          </label>

          <div className="grid gap-2 border-t border-border pt-3">
            <div>
              <span className="text-sm">Контакты</span>
              <p className="text-xs text-muted">
                {hasContacts
                  ? "По нажатию клиент увидит их в окне связи. Общие для всех ваших хабов — правка здесь изменит их везде."
                  : "Ни одного не задано — кнопка не появится ни на витрине, ни на странице недоступной ссылки."}
              </p>
            </div>

            {contacts.length > 0 ? (
              <ul className="grid gap-2">
                {contacts.map((c, i) => (
                  <li
                    key={i}
                    // На телефоне 4 колонки в ряд — по паре символов на поле,
                    // нечитаемо. grid-cols-[1fr_auto] + order-* даёт две строки
                    // (раздел+удалить, потом подпись и значение во всю ширину),
                    // на sm и шире — прежний единый ряд. min-w-0 остаётся:
                    // без него 1fr-колонка не сжимается уже содержимого
                    // (классическая ловушка), и форма вылезала за пределы.
                    className="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[auto_1fr_1fr_auto]"
                  >
                    {/* DOM-порядок остаётся select → подпись → значение →
                        удалить (обычный порядок Tab); order-* только
                        переставляет визуально на телефоне. */}
                    <select
                      value={c.kind}
                      onChange={(e) =>
                        updateContact(i, {
                          kind: e.target.value as ContactMethod["kind"],
                        })
                      }
                      className="order-1 min-w-0 rounded-lg border border-border bg-background px-2 py-2 text-sm"
                    >
                      {CONTACT_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {CONTACT_KIND_LABELS[k]}
                        </option>
                      ))}
                    </select>
                    <input
                      value={c.label}
                      onChange={(e) => updateContact(i, { label: e.target.value })}
                      placeholder="Подпись, например «Отдел продаж»"
                      maxLength={60}
                      className={`order-3 col-span-2 min-w-0 text-sm sm:order-2 sm:col-span-1 ${input}`}
                    />
                    <input
                      value={c.value}
                      onChange={(e) => updateContact(i, { value: e.target.value })}
                      placeholder="Номер, адрес, ссылка…"
                      maxLength={200}
                      className={`order-4 col-span-2 min-w-0 text-sm sm:order-3 sm:col-span-1 ${input}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeContact(i)}
                      aria-label="Удалить контакт"
                      className="order-2 rounded-lg px-2 py-2 text-sm text-muted transition hover:bg-red-500/10 hover:text-red-600 sm:order-4 dark:hover:text-red-400"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {contacts.length < MAX_CONTACTS ? (
              <button
                type="button"
                onClick={addContact}
                className="justify-self-start rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-border/60"
              >
                Добавить контакт
              </button>
            ) : null}

            <input
              type="hidden"
              name="contactMethods"
              value={JSON.stringify(contacts)}
            />
          </div>
        </fieldset>

        <fieldset className="grid gap-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium">Демо-кабинет</legend>

          <label className="grid gap-1.5">
            <span className="text-sm">Ссылка</span>
            <input
              name="demoUrl"
              type="url"
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
              placeholder="https://my.smartis.bi/login"
              className={input}
            />
            <span className="text-xs text-muted">
              Пусто — кнопки не будет. Откроется в новой вкладке
            </span>
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm">Надпись на кнопке</span>
            <input
              name="demoLabel"
              value={demoLabel}
              onChange={(e) => setDemoLabel(e.target.value)}
              maxLength={40}
              className={`w-64 ${input}`}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm">Подпись под кнопкой</span>
            <textarea
              name="demoNote"
              value={demoNote}
              onChange={(e) => setDemoNote(e.target.value)}
              rows={4}
              maxLength={600}
              placeholder={"Логин: Demo@mail.ru\nПароль: demopassword22"}
              className={`font-mono text-sm ${input}`}
            />
            <span className="text-xs text-muted">
              Логин и пароль от демо. Переносы строк сохранятся. Это увидит
              любой, у кого есть ссылка
            </span>
          </label>
        </fieldset>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? "Сохраняем…" : "Сохранить"}
          </button>

          {state?.saved ? (
            <span className="text-sm text-green-600 dark:text-green-400">
              Сохранено
            </span>
          ) : null}
          {state?.error ? (
            <span role="alert" className="text-sm text-red-600 dark:text-red-400">
              {state.error}
            </span>
          ) : null}
        </div>
      </form>

      {/* Предпросмотр. sticky — при прокрутке длинной формы витрина
          остаётся перед глазами. */}
      <div className="min-w-0 lg:sticky lg:top-6">
        <p className="mb-2 text-xs text-muted">
          Так увидит клиент — обновляется по мере набора
        </p>

        <div className="relative overflow-hidden rounded-xl border border-border">
          <ShowcaseBackdrop brandColor={brandColor} absolute />

          <div className="relative px-5 py-6">
            <ShowcaseHeader
              data={{
                brandColor,
                logoUrl,
                orgName,
                headline: headline || title || "Заголовок витрины",
                // Приветствие живёт на ссылке, а не на хабе: у каждой компании
                // своё. Показываем образец, чтобы шапка выглядела целиком.
                greeting: "Коллеги, добрый день!",
                descriptionHtml: descriptionHtml || null,
                cta: ctaEnabled && hasContacts ? ctaLabel : null,
                demo: demoUrl
                  ? { url: demoUrl, label: demoLabel, note: demoNote || null }
                  : null,
              }}
            />

            <p className="-mt-4 text-xs text-zinc-500">
              Ниже — плитки материалов
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
