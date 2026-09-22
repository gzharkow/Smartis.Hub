"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { RichTextEditor } from "@/components/rich-text-editor";
import { ShowcaseBackdrop } from "@/components/showcase/showcase-backdrop";
import { ShowcaseHeader } from "@/components/showcase/showcase-header";
import { updateHub, type UpdateHubState } from "@/app/actions/hubs";
import { buttonClasses } from "@/components/ui/button";
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
  /** Способы связи для кнопки «Задать вопрос» — собственность этого хаба. */
  contacts: ContactMethod[];
  /** Личный шаблон контактов текущего аккаунта, если сохранён — см. чекбокс
   *  «Сохранить как шаблон» ниже. null — шаблона ещё нет. */
  contactTemplate: ContactMethod[] | null;
};

const MAX_CONTACTS = 8;
/** Пауза тишины после правки, прежде чем автосохранение уйдёт само —
 *  достаточно, чтобы не слать запрос на каждую букву, но не настолько
 *  долго, чтобы уход со страницы ощущался как потеря правок. */
const AUTOSAVE_DELAY_MS = 1500;

export function HubSettingsForm({
  hub,
  brandColor,
  logoUrl,
  orgName,
  contacts: initialContacts,
  contactTemplate,
  canEdit = true,
}: Props & { canEdit?: boolean }) {
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
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  // Автосохранение: раньше форма уходила только по клику на «Сохранить»,
  // и правки легко забывали отправить. Сам сабмит не переписываем — просто
  // дёргаем ту же форму программно после паузы в наборе, тем же путём,
  // которым идёт кнопка (FormData → updateHub → вся валидация как была).
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  const mountedFields = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // После успешного экшена React сам вызывает нативный form.reset() —
  // у чекбоксов это откатывает checked к defaultChecked, а React его
  // никогда не обновляет (мы задаём только checked, не defaultChecked).
  // Если значение при сохранении совпадает и до, и после (а оно совпадает —
  // мы же его не трогали), React не видит diff и не перезаписывает DOM,
  // так что откат остаётся видимым, хотя в базе всё сохранилось верно.
  // Пересоздаём чекбоксы через key сразу после сохранения — на свежем узле
  // React выставит checked заново из актуального состояния. Заодно тут же
  // снимаем «есть несохранённые изменения», раз сохранение завершилось.
  const [checkboxGen, setCheckboxGen] = useState(0);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) {
      setCheckboxGen((g) => g + 1);
      setDirty(false);
    }
    wasPending.current = pending;
  }, [pending]);

  useEffect(() => {
    if (!mountedFields.current) {
      mountedFields.current = true;
      return;
    }
    setDirty(true);
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null;
      formRef.current?.requestSubmit();
    }, AUTOSAVE_DELAY_MS);
  }, [
    title,
    headline,
    descriptionHtml,
    ctaLabel,
    ctaEnabled,
    demoUrl,
    demoLabel,
    demoNote,
    contacts,
    saveAsTemplate,
  ]);

  // Уход со страницы/сворачивание вкладки не должны терять последнюю правку,
  // если таймер автосохранения ещё не сработал — досылаем сразу, тем же
  // приёмом, что уже применяется для трекинга просмотров в use-tracker.ts.
  useEffect(() => {
    function flush() {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
        formRef.current?.requestSubmit();
      }
    }
    function onVisibility() {
      if (document.hidden) flush();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, []);
  // Подсказка «есть шаблон» видна, пока пользователь явно не выбрал один
  // из двух путей — заполнить из шаблона или вручную. Если контакты и так
  // не пустые (хаб уже настроен) или шаблона нет вовсе, подсказка не нужна.
  const [templateChoiceMade, setTemplateChoiceMade] = useState(false);
  const showTemplatePrompt =
    !templateChoiceMade && contacts.length === 0 && !!contactTemplate?.length;

  function applyTemplate() {
    setContacts(contactTemplate ?? []);
    setTemplateChoiceMade(true);
  }

  function fillManually() {
    setTemplateChoiceMade(true);
  }

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

  // Приоритет статуса рядом с кнопкой: пока не сработало автосохранение —
  // «есть несохранённые изменения» важнее старого результата предыдущего
  // сохранения (он иначе завис бы «Сохранено» поверх свежих правок).
  const saveStatus = pending
    ? null
    : dirty
      ? { kind: "dirty" as const }
      : state?.error
        ? { kind: "error" as const, message: state.error }
        : state?.saved
          ? { kind: "saved" as const }
          : null;

  const input =
    "rounded-lg border border-border bg-background px-3 py-2 focus:border-accent";

  return (
    // lg:grid-cols-2 — на широком экране форма и предпросмотр рядом.
    // На узком предпросмотр уходит вниз: втискивать витрину в половину
    // телефона бессмысленно. Без прав на редактирование колонка формы
    // не нужна вовсе — остаётся один предпросмотр.
    <div className={canEdit ? "grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start" : "grid grid-cols-1 gap-4"}>
      {canEdit ? (
      <form ref={formRef} action={action} className="grid grid-cols-1 gap-5">
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
              key={`cta-${checkboxGen}`}
              type="checkbox"
              name="ctaEnabled"
              checked={ctaEnabled}
              onChange={(e) => setCtaEnabled(e.target.checked)}
              className="size-4"
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
                  ? "По нажатию клиент увидит их в окне связи."
                  : "Ни одного не задано — кнопка не появится ни на витрине, ни на странице недоступной ссылки."}
              </p>
            </div>

            {showTemplatePrompt ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm">
                <span>У вас есть сохранённый шаблон контактов.</span>
                <button
                  type="button"
                  onClick={applyTemplate}
                  className={buttonClasses("primary", "sm")}
                >
                  Заполнить из шаблона
                </button>
                <button
                  type="button"
                  onClick={fillManually}
                  className={buttonClasses("secondary", "sm")}
                >
                  Заполнить вручную
                </button>
              </div>
            ) : null}

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
                      className="order-2 rounded-lg px-2 py-2 text-sm text-muted transition hover:bg-danger/10 hover:text-danger sm:order-4"
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
                className={buttonClasses("secondary", "sm", "justify-self-start")}
              >
                Добавить контакт
              </button>
            ) : null}

            <label className="flex items-center gap-2 pt-1">
              <input
                key={`template-${checkboxGen}`}
                type="checkbox"
                name="saveAsTemplate"
                checked={saveAsTemplate}
                onChange={(e) => setSaveAsTemplate(e.target.checked)}
                className="size-4"
              />
              <span className="text-sm">Сохранить как шаблон</span>
            </label>
            <p className="-mt-1 text-xs text-muted">
              Эти контакты предложатся заготовкой при создании ваших следующих
              хабов — привязано к вашему аккаунту, других сотрудников не
              затронет.
            </p>

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
            className={buttonClasses("primary")}
          >
            {pending ? "Сохраняем…" : "Сохранить"}
          </button>

          {saveStatus?.kind === "dirty" ? (
            <span className="text-sm text-muted">Есть несохранённые изменения…</span>
          ) : saveStatus?.kind === "error" ? (
            <span role="alert" className="text-sm text-danger">
              {saveStatus.message}
            </span>
          ) : saveStatus?.kind === "saved" ? (
            <span className="text-sm text-ok">Сохранено</span>
          ) : null}
        </div>
      </form>
      ) : (
        <p className="text-sm text-muted">
          Недостаточно прав для изменения оформления хаба — показан только предпросмотр.
        </p>
      )}

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
