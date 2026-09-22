"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finalizeQuoteSpec } from "@/app/actions/quote-spec";
import { formatHubCreated } from "@/lib/format-datetime";
import { formatAmount, moneyParts } from "@/lib/rubles-in-words";
import {
  computeSpecValues,
  objectsLabel,
  unsupportedKopecks,
  usersLabel,
  type SpecEditableValues,
  type SpecIssue,
  type SpecMoney,
  type SpecValues,
} from "@/lib/spec-values";
import { NumberField } from "../calculator-panel-controls";
import { buttonClasses } from "@/components/ui/button";
import { PdfPreviewOverlay } from "@/components/pdf-preview-overlay";

// Экран проверки Спецификации перед выпуском.
//
// Правятся только базовые числа: четыре суммы таблицы 2.2, два количества и
// три цены за единицу таблицы 2.3. Суммы с НДС, итоги, прописи и склонения
// считаются из них и показываются только для чтения — ровно поэтому ошибку
// «178 000 вместо 178 500» здесь физически некуда ввести. Ради этого фича и
// делалась, так что «дать поправить итог руками» — не улучшение, а отмена
// единственной гарантии.

const MONEY_RE = /^\d{1,12}([.,]\d{1,2})?$/;

const inputCls =
  "w-32 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-right focus:border-accent";
const badInputCls =
  "w-32 rounded-lg border border-danger bg-background px-2 py-1.5 text-sm text-right";

export type ReleasedSpec = { id: string; createdAt: Date; sizeLabel: string | null };

export function SpecReview({
  quoteId,
  vatRatePct,
  clientType,
  initial,
  issues,
  kindTitle,
  previewAvailable,
  released,
}: {
  quoteId: string;
  vatRatePct: number;
  /** Определяет, как называется счётная строка таблицы 2.2: «объект
   * недвижимости» у застройщика или «дилерский центр» у автодилера. */
  clientType: "BUILDER" | "AUTO_DEALER" | null;
  initial: SpecEditableValues;
  issues: SpecIssue[];
  kindTitle: string;
  previewAvailable: boolean;
  released: ReleasedSpec[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [accepting, startAccept] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justReleased, setJustReleased] = useState<string | null>(null);

  const set = <K extends keyof SpecEditableValues>(key: K, value: SpecEditableValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setJustReleased(null);
  };

  const invalid = useMemo(() => {
    const bad = new Set<keyof SpecEditableValues>();
    for (const key of MONEY_FIELDS) {
      if (!MONEY_RE.test(String(values[key]).trim())) bad.add(key);
    }
    return bad;
  }, [values]);

  const computed: SpecValues | null = useMemo(
    () => (invalid.size > 0 ? null : computeSpecValues(values, vatRatePct, clientType)),
    [values, vatRatePct, clientType, invalid],
  );

  const badKopecks = computed ? unsupportedKopecks(computed) : [];
  const blocked = invalid.size > 0 || badKopecks.length > 0;

  const issueFor = (field: keyof SpecEditableValues) =>
    issues.find((i) => i.field === field)?.message ?? null;
  const documentIssues = issues.filter((i) => i.field === null);

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div className="grid grid-cols-1 gap-4">
        <p className="text-xs text-muted">
          Шаблон: {kindTitle} · ставка НДС {vatRatePct}%
        </p>

        {documentIssues.map((issue) => (
          <Warning key={issue.code}>{issue.message}</Warning>
        ))}

        <Card title="Таблица 2.2 — из чего складывается ежемесячная плата">
          <MoneyRow
            label="За предоставление доступа к платформе"
            value={values.platformNet}
            invalid={invalid.has("platformNet")}
            onChange={(v) => set("platformNet", v)}
            derived={computed?.t22.platform}
            issue={issueFor("platformNet")}
          />

          <ToggledMoneyRow
            label={clientType === "AUTO_DEALER" ? "Дилерские центры" : "Объекты недвижимости"}
            included={values.includeObjects}
            onToggle={(v) => set("includeObjects", v)}
            count={values.objectsCount}
            onCount={(v) => set("objectsCount", v)}
            caption={objectsLabel(values.objectsCount, clientType)}
            readOnlyTotal={computed?.t22.objects ?? null}
            derived={computed?.t22.objects ?? undefined}
            issue={issueFor("objectsCount")}
          />

          <ToggledMoneyRow
            label="Авторизованные пользователи"
            included={values.includeUsers}
            onToggle={(v) => set("includeUsers", v)}
            count={values.usersCount}
            onCount={(v) => set("usersCount", v)}
            caption={usersLabel(values.usersCount)}
            readOnlyTotal={computed?.t22.users ?? null}
            derived={computed?.t22.users ?? undefined}
            issue={issueFor("usersCount")}
          />

          <ToggledMoneyRow
            label="Импорт и контроль медиапланов"
            included={values.includeMediaPlan}
            onToggle={(v) => set("includeMediaPlan", v)}
            value={values.mediaPlanNet}
            invalid={invalid.has("mediaPlanNet")}
            onChange={(v) => set("mediaPlanNet", v)}
            derived={computed?.t22.mediaPlan ?? undefined}
            issue={issueFor("mediaPlanNet")}
          />
        </Card>

        <Card title="Таблица 2.3 — стоимость дополнительных единиц">
          <p className="px-4 pb-1 pt-3 text-xs text-muted">
            Печатается всегда, даже если позиция не куплена: это прайс за
            добавление, а не факт покупки.
          </p>
          <MoneyRow
            label={
              clientType === "AUTO_DEALER"
                ? "За каждый дополнительный дилерский центр"
                : "За каждый дополнительный объект"
            }
            value={values.unitObjectNet}
            invalid={invalid.has("unitObjectNet")}
            onChange={(v) => set("unitObjectNet", v)}
            derived={computed?.t23.object}
            issue={issueFor("unitObjectNet")}
          />
          <MoneyRow
            label="За каждого дополнительного пользователя"
            value={values.unitUserNet}
            invalid={invalid.has("unitUserNet")}
            onChange={(v) => set("unitUserNet", v)}
            derived={computed?.t23.user}
            issue={issueFor("unitUserNet")}
          />
          <MoneyRow
            label="За каждый дополнительный медиаплан"
            value={values.unitMediaPlanNet}
            invalid={invalid.has("unitMediaPlanNet")}
            onChange={(v) => set("unitMediaPlanNet", v)}
            derived={computed?.t23.mediaPlan}
            issue={issueFor("unitMediaPlanNet")}
          />
        </Card>

        <Totals values={computed} />

        {badKopecks.length > 0 ? (
          <Warning>
            Суммы дают {badKopecks.join(" и ")} копеек. В шаблоне слово «копеек»
            стоит текстом и рассчитано на «00» или «50» — документ получился бы
            неграмотным. Округлите суммы.
          </Warning>
        ) : null}

        {invalid.size > 0 ? (
          <Warning>
            Красные поля — не число. Ожидается сумма вида 15000 или 15000,50.
          </Warning>
        ) : null}

        {error ? <Warning>{error}</Warning> : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={blocked || accepting}
            onClick={() =>
              startAccept(async () => {
                setError(null);
                try {
                  const { assetId } = await finalizeQuoteSpec(quoteId, values);
                  setJustReleased(assetId);
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Не удалось выпустить документ");
                }
              })
            }
            className={buttonClasses("primary")}
          >
            {accepting ? "Выпускаем…" : "Принять"}
          </button>

          <DraftButton quoteId={quoteId} values={values} disabled={blocked} />
        </div>

        {justReleased ? (
          <div className="rounded-xl border border-border bg-border/20 p-4 text-sm">
            <p className="font-medium">Спецификация выпущена</p>
            <p className="mt-1 text-muted">
              Файл прикреплён к расчёту и лежит в «Генератор КП → Файлы».
            </p>
            <a
              href={`/api/assets/${justReleased}/file?download=1`}
              className="mt-2 inline-block rounded-lg border border-border px-3 py-1.5 transition hover:bg-border/60"
            >
              Скачать .docx
            </a>
          </div>
        ) : null}

        {released.length > 0 ? (
          <Card title="Выпущенные ранее">
            <ul className="grid grid-cols-1">
              {released.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <span className="text-muted">
                    {formatHubCreated(file.createdAt)}
                    {file.sizeLabel ? ` · ${file.sizeLabel}` : ""}
                  </span>
                  <a
                    href={`/api/assets/${file.id}/file?download=1`}
                    className="shrink-0 transition hover:text-accent"
                  >
                    Скачать
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <Preview
        quoteId={quoteId}
        values={values}
        available={previewAvailable}
        blocked={blocked}
      />
    </div>
  );
}

const MONEY_FIELDS = [
  "platformNet",
  "mediaPlanNet",
  "unitObjectNet",
  "unitUserNet",
  "unitMediaPlanNet",
] as const satisfies readonly (keyof SpecEditableValues)[];

// ─────────────────────────────  Предпросмотр  ─────────────────────────────

function Preview({
  quoteId,
  values,
  available,
  blocked,
}: {
  quoteId: string;
  values: SpecEditableValues;
  available: boolean;
  blocked: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentUrl = useRef<string | null>(null);
  // Только для тач-экрана — см. кнопку «Показать документ» ниже: встроенный
  // <iframe> там не листается системным PDF-плагином (особенно в PWA), а
  // окно поверх страницы со своим PdfViewer скроллится честно.
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!available || blocked) return;

    // Каждый рендер стоит запуска LibreOffice, поэтому не на каждое нажатие
    // клавиши, а с паузой после того, как правки утихли.
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/quotes/${quoteId}/spec/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? "Не удалось собрать предпросмотр");
        }
        const blob = await response.blob();
        const next = URL.createObjectURL(blob);
        if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
        currentUrl.current = next;
        setUrl(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось собрать предпросмотр");
      } finally {
        setLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [quoteId, values, available, blocked]);

  // Последний blob живёт до ухода со страницы — отзываем, чтобы не копить
  // документы в памяти вкладки.
  useEffect(
    () => () => {
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    },
    [],
  );

  if (!available) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6">
        <p className="font-medium">Точный предпросмотр недоступен</p>
        <p className="mt-1 max-w-lg text-sm text-muted">
          На сервере не установлен LibreOffice. Проверить документ можно, скачав
          черновик — в Word вёрстка будет точной. Сам файл при этом собирается
          как обычно: «Принять» работает.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>Так документ выглядит в Word</span>
        {loading ? <span>Собираем…</span> : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-sm">
          <p className="font-medium">Предпросмотр не собрался</p>
          <p className="mt-1 text-muted">{error}</p>
        </div>
      ) : url ? (
        <>
          {/* На мыши/десктопе — как раньше, встроенный просмотр. На
              тач-экране встроенный <iframe> полагается на системный
              PDF-плагин браузера — в PWA он часто не листается жестом,
              поэтому там вместо него кнопка, открывающая тот же документ
              в PdfPreviewOverlay (свой скроллящийся canvas-рендер). */}
          <iframe
            src={url}
            title="Предпросмотр Спецификации"
            className="h-[80vh] w-full rounded-xl border border-border bg-white pointer-coarse:hidden"
          />
          {/* Обёртка отдельно от buttonClasses() — у неё самой уже есть
              безусловный inline-flex, и hidden/pointer-coarse:inline-flex
              на том же элементе с ним конфликтовали бы (кнопка была видна
              всегда, включая мышь). */}
          <span className="hidden pointer-coarse:block">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className={buttonClasses("secondary", "md")}
            >
              Показать документ
            </button>
          </span>
          {previewOpen ? (
            <PdfPreviewOverlay
              title="Предпросмотр Спецификации"
              url={url}
              error={null}
              onClose={() => setPreviewOpen(false)}
            />
          ) : null}
        </>
      ) : (
        <div className="grid h-[80vh] place-items-center rounded-xl border border-dashed border-border text-sm text-muted">
          {blocked ? "Поправьте суммы слева" : "Собираем предпросмотр…"}
        </div>
      )}
    </div>
  );
}

function DraftButton({
  quoteId,
  values,
  disabled,
}: {
  quoteId: string;
  values: SpecEditableValues;
  disabled: boolean;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={async () => {
        setBusy(true);
        try {
          const response = await fetch(`/api/quotes/${quoteId}/spec/draft`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
          });
          if (!response.ok) return;
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "Спецификация (черновик).docx";
          link.click();
          URL.revokeObjectURL(url);
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-border/60 disabled:opacity-50"
    >
      {busy ? "Готовим…" : "Скачать черновик"}
    </button>
  );
}

// ─────────────────────────────  Мелочи формы  ─────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border">
      <h2 className="border-b border-border px-4 py-2.5 text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm">
      {children}
    </p>
  );
}

function Derived({ value }: { value?: SpecMoney }) {
  if (!value) return <span className="text-xs text-muted">строка не печатается</span>;
  return (
    <span className="text-xs text-muted">
      с НДС {formatAmount(value.gross)} · НДС {formatAmount(value.vat)}
    </span>
  );
}

function MoneyRow({
  label,
  value,
  invalid,
  onChange,
  derived,
  issue,
}: {
  label: string;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
  derived?: SpecMoney;
  issue: string | null;
}) {
  return (
    <div className="border-t border-border px-4 py-3 first:border-t-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">{label}</p>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          className={invalid ? badInputCls : inputCls}
        />
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        {issue ? (
          <span className="text-xs text-warn">{issue}</span>
        ) : (
          <span />
        )}
        <Derived value={derived} />
      </div>
    </div>
  );
}

function ToggledMoneyRow({
  label,
  included,
  onToggle,
  count,
  onCount,
  caption,
  readOnlyTotal,
  value,
  invalid,
  onChange,
  derived,
  issue,
}: {
  label: string;
  included: boolean;
  onToggle: (value: boolean) => void;
  count?: number;
  onCount?: (value: number) => void;
  caption?: string;
  /** Когда передан (объекты/пользователи) — итог считается как count × цена
   * за единицу из таблицы 2.3, и вместо поля ввода показывается только
   * результат. Отдельного свободного поля суммы для этой строки больше нет —
   * иначе количество и сумма опять могли бы разъехаться. */
  readOnlyTotal?: SpecMoney | null;
  value?: string;
  invalid?: boolean;
  onChange?: (value: string) => void;
  derived?: SpecMoney;
  issue: string | null;
}) {
  return (
    <div className="border-t border-border px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={included}
            onChange={(e) => onToggle(e.target.checked)}
          />
          {label}
        </label>
        {readOnlyTotal !== undefined ? (
          <div className="grid justify-items-end gap-0.5">
            <span
              className={`${inputCls} inline-flex items-center justify-end ${!included ? "opacity-40" : ""}`}
            >
              {included && readOnlyTotal ? formatAmount(readOnlyTotal.net) : "—"}
            </span>
            <span className="text-xs text-muted">Цена за единицу — в таблице 2.3 ниже</span>
          </div>
        ) : (
          <input
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={!included}
            inputMode="decimal"
            className={`${invalid ? badInputCls : inputCls} disabled:opacity-40`}
          />
        )}
      </div>

      {included && onCount ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-muted">В документе: «за {caption}»</span>
          <NumberField value={count ?? 0} onChange={onCount} />
        </div>
      ) : null}

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        {issue ? (
          <span className="text-xs text-warn">{issue}</span>
        ) : (
          <span />
        )}
        <Derived value={included ? derived : undefined} />
      </div>
    </div>
  );
}

function Totals({ values }: { values: SpecValues | null }) {
  if (!values) return null;

  const month = moneyParts(values.monthly.gross);
  const stage = moneyParts(values.stage.gross);

  return (
    <section className="rounded-xl border border-border bg-border/20 px-4 py-3">
      <p className="text-sm font-medium">Что попадёт в текст документа</p>

      <dl className="mt-2 grid grid-cols-1 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted">п.2.1 — ежемесячная стоимость</dt>
          <dd>
            {month.sum} ({month.words}) {month.rub} {month.kop} копеек, включая НДС
            (5%) — {formatAmount(values.monthly.vat)} рублей
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">п.1.2.1 и п.1.2.2 — платёж за этап</dt>
          <dd>
            {stage.sum} ({stage.words}) {stage.rub} {stage.kop} копеек, включая НДС
            (5%) — {formatAmount(values.stage.vat)} рублей
          </dd>
        </div>
      </dl>
    </section>
  );
}
