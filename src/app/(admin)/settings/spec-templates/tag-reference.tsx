"use client";

import { useState } from "react";
import { copyText } from "../administration/copy-text";
import type { SpecTag, SpecTagGroup } from "@/lib/spec-tags";

// Справочник меток: что писать в шаблоне и что туда подставится.
//
// Метки набираются в Word руками, поэтому каждую можно скопировать одним
// нажатием: набранная вручную «{{MONTH_SUМ}}» с кириллической «М» выглядит
// неотличимо от правильной, а шаблон из-за неё не примется.

type Group = { key: SpecTagGroup; title: string; hint: string };

export function TagReference({ groups, tags }: { groups: Group[]; tags: SpecTag[] }) {
  return (
    // Свёрнуто по умолчанию — 4 группы и 30 меток растягивали страницу,
    // а нужны только при заведении нового шаблона. <details>/<summary>,
    // а не самодельный аккордеон — тот же приём, что и в quote-editor.tsx,
    // assets/page.tsx и др.: клавиатура и фокус работают из коробки.
    <details className="grid gap-4 rounded-xl border border-border">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        Метки для шаблона
      </summary>

      <div className="grid gap-4 px-4 pb-4">
        <p className="max-w-2xl text-xs text-muted">
          Вставьте их в .docx на месте прочерков. Всё остальное — реквизиты,
          номер договора, даты, подписи — остаётся как есть: мы заполняем только
          деньги. Строки таблицы 2.2 с объектами, пользователями и медиапланами
          удаляются целиком, если позиции нет в расчёте.
        </p>

        {groups.map((group) => (
          <div key={group.key} className="rounded-xl border border-border">
            <div className="border-b border-border px-4 py-2.5">
              <h3 className="text-sm font-medium">{group.title}</h3>
              <p className="mt-0.5 text-xs text-muted">{group.hint}</p>
            </div>

            <ul className="grid grid-cols-1">
              {tags
                .filter((tag) => tag.group === group.key)
                .map((tag) => (
                  <TagRow key={tag.tag} tag={tag} />
                ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

function TagRow({ tag }: { tag: SpecTag }) {
  const [copied, setCopied] = useState(false);
  const placeholder = `{{${tag.tag}}}`;

  return (
    <li className="grid gap-1 border-t border-border px-4 py-2.5 first:border-t-0 sm:grid-cols-[minmax(0,260px)_1fr_auto] sm:items-center sm:gap-3">
      <button
        type="button"
        onClick={async () => {
          if (await copyText(placeholder)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        }}
        title="Скопировать"
        className="justify-self-start rounded bg-border/60 px-2 py-1 font-mono text-xs transition hover:bg-border"
      >
        {copied ? "скопировано" : placeholder}
      </button>

      <span className="text-xs text-muted">
        {tag.label}
        {tag.removable ? " · строка удаляется, если позиции нет" : ""}
      </span>

      <span className="text-xs text-muted sm:text-right">{tag.example}</span>
    </li>
  );
}
