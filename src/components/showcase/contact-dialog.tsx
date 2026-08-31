"use client";

import { brandTextOn } from "@/lib/brand-color";
import {
  contactHref,
  CONTACT_KIND_LABELS,
  type ContactMethod,
} from "@/lib/contact-methods";

// Окно со способами связи. Общее для двух мест: живой витрины (кнопка
// «Задать вопрос») и страницы недоступной ссылки (кнопка «Связаться с нами») —
// у отозванной/просроченной ссылки те же контакты, что и у хаба, к которому
// она относилась.

export function ContactDialog({
  contacts,
  onClose,
  brandColor,
}: {
  contacts: ContactMethod[];
  onClose: () => void;
  brandColor: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid cursor-pointer place-items-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Способы связи"
        onClick={(e) => e.stopPropagation()}
        // Курсор с фона (клик по нему закрывает окно) сюда наследоваться не
        // должен — здесь клик по пустому месту ничего не делает.
        className="w-full max-w-sm cursor-auto rounded-2xl bg-white p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-zinc-900">Связаться с нами</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="grid size-8 cursor-pointer place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            ✕
          </button>
        </div>

        <ul className="grid grid-cols-1 gap-2">
          {contacts.map((c, i) => {
            const href = contactHref(c);
            const inner = (
              <>
                <span className="text-xs text-zinc-400">
                  {c.label || CONTACT_KIND_LABELS[c.kind]}
                </span>
                <span
                  className="font-medium"
                  // Карточка окна белая — фирменный цвет пускаем в текст только
                  // если он на белом читается, иначе обычный тёмный.
                  style={{ color: brandTextOn("#ffffff", brandColor, "#18181b") }}
                >
                  {c.value}
                </span>
              </>
            );

            return (
              <li key={i}>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid rounded-xl border border-zinc-200 px-3 py-2.5 transition hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    {inner}
                  </a>
                ) : (
                  <span className="grid rounded-xl border border-zinc-200 px-3 py-2.5">
                    {inner}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
