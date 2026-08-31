"use client";

import { useState, useTransition } from "react";
import { addQuoteSection, reorderQuoteSections } from "@/app/actions/quotes";
import { calculateQuote } from "@/lib/quote-calc";
import { QuoteSectionBlock } from "./quote-section";
import { QuotePreview } from "./quote-preview";
import { QuoteMetaForm } from "./quote-meta-form";
import { QuoteTotalsSummary } from "./quote-totals-summary";
import type { QuoteData, QuoteLineData } from "./quote-types";
import { buttonClasses } from "@/components/ui/button";

// Свободный редактор — сегодняшнее поведение калькулятора, без изменений
// логики. Используется только для КП без выбранного clientType; см.
// quote-editor.tsx (диспетчер) и план "Калькулятор: замена ручного ввода
// цен на структурированный выбор".
export function FreeformQuoteEditor({ quote }: { quote: QuoteData }) {
  // Живой предпросмотр итогов по мере набора — сохранение шапки всё равно
  // явное, кнопкой (см. hub-settings-form.tsx — тот же приём).
  const [clientName, setClientName] = useState(quote.clientName);
  const [vatRatePct, setVatRatePct] = useState(quote.vatRatePct);
  const [documentDate, setDocumentDate] = useState(quote.documentDate);

  // Секции/строки продавец правит внутри QuoteSectionBlock/QuoteLineRow —
  // там своё локальное состояние на поле, сохранение по blur. Чтобы
  // предпросмотр документа справа обновлялся НА КАЖДОЕ нажатие клавиши,
  // а не только после сохранения, эти компоненты параллельно шлют сюда
  // копию правки через onLive*-колбэки — реального стейта для сохранения
  // это не трогает, только зеркало для рендера предпросмотра.
  const [liveSections, setLiveSections] = useState(quote.sections);

  // Структурные правки (добавить/удалить/переставить секцию или строку) идут
  // через revalidatePath — quote.sections обновится не мгновенно, а вслед за
  // перерисовкой сервера. Когда сервер пришлёт новый пропс, зеркало нужно
  // пересобрать. Правило react-hooks/set-state-in-effect запрещает делать это
  // через useEffect+setState — вместо него "подгонка состояния при рендере":
  // сравниваем с последним увиденным пропсом прямо в теле компонента.
  const [prevSections, setPrevSections] = useState(quote.sections);
  if (quote.sections !== prevSections) {
    setPrevSections(quote.sections);
    setLiveSections(quote.sections);
  }

  function updateLiveLine(
    sectionId: string,
    lineId: string,
    patch: Partial<QuoteLineData>,
  ) {
    setLiveSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, lines: s.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) }
          : s,
      ),
    );
  }

  function updateLiveSectionTitle(sectionId: string, title: string) {
    setLiveSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, title } : s)),
    );
  }

  const [addingSection, startAddSection] = useTransition();
  const [reordering, startReorder] = useTransition();

  const totals = calculateQuote(liveSections, vatRatePct);
  const sectionIds = quote.sections.map((s) => s.id);

  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sectionIds.length) return;
    const next = [...sectionIds];
    [next[index], next[target]] = [next[target], next[index]];
    startReorder(() => reorderQuoteSections(quote.id, next));
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <QuoteMetaForm
        quoteId={quote.id}
        clientName={clientName}
        setClientName={setClientName}
        vatRatePct={vatRatePct}
        setVatRatePct={setVatRatePct}
        documentDate={documentDate}
        setDocumentDate={setDocumentDate}
      />

      <div className="grid grid-cols-1 gap-4">
        {quote.sections.map((section, index) => (
          <QuoteSectionBlock
            key={section.id}
            quoteId={quote.id}
            section={section}
            vatRatePct={vatRatePct}
            isFirst={index === 0}
            isLast={index === quote.sections.length - 1}
            onMoveUp={() => moveSection(index, -1)}
            onMoveDown={() => moveSection(index, 1)}
            reordering={reordering}
            onLiveTitleChange={(title) => updateLiveSectionTitle(section.id, title)}
            onLiveLineChange={(lineId, patch) =>
              updateLiveLine(section.id, lineId, patch)
            }
          />
        ))}
      </div>

      <button
        type="button"
        disabled={addingSection}
        onClick={() => startAddSection(() => addQuoteSection(quote.id))}
        className={buttonClasses("secondary", "md", "justify-self-start")}
      >
        {addingSection ? "Добавляем…" : "+ Добавить секцию"}
      </button>

      <QuoteTotalsSummary totals={totals} />

      {/* Предпросмотр — внизу страницы, а не сбоку: секции с таблицами и так
          не помещаются рядом на разумных ширинах. <details> даёт разворот/
          сворачивание бесплатно, без своего стейта — тот же приём, что и у
          «Недавно удалённых» в хабах/материалах. */}
      <details open className="rounded-xl border border-border bg-surface">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
          Предпросмотр документа — обновляется по мере ввода
        </summary>
        <div className="border-t border-border p-4">
          <QuotePreview
            clientName={clientName}
            vatRatePct={vatRatePct}
            documentDate={documentDate}
            sections={liveSections}
          />
        </div>
      </details>
    </div>
  );
}
