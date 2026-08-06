"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createShareLink,
  restoreShareLink,
  revokeShareLink,
  type CreateLinkState,
} from "@/app/actions/share-links";

type Link = {
  id: string;
  token: string;
  recipientCompany: string | null;
  greeting: string | null;
  expiresAt: string | null;
  revoked: boolean;
  expired: boolean;
  visits: number;
};

// navigator.clipboard существует только в "secure context" (https или
// localhost) — на голом http (наш прод без домена/TLS) он undefined целиком,
// и обращение к .writeText падало молча: кнопка не делала вообще ничего.
// Запасной путь — старый execCommand("copy") через невидимый textarea,
// ему secure context не нужен.
async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // упадём на запасной путь ниже
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyText(url);
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      }}
      className="shrink-0 rounded px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-500/10 dark:text-blue-400"
    >
      {copied ? "Скопировано" : "Копировать"}
    </button>
  );
}

export function HubShareLinks({
  hubId,
  links,
  baseUrl,
  published,
}: {
  hubId: string;
  links: Link[];
  baseUrl: string;
  published: boolean;
}) {
  const [state, action, pending] = useActionState<CreateLinkState, FormData>(
    createShareLink,
    undefined,
  );
  const [busy, startTransition] = useTransition();

  return (
    <div className="grid grid-cols-1 gap-5">
      {!published ? (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          Хаб не опубликован — выданные ссылки пока не открываются. Опубликуйте
          его, когда будете готовы.
        </p>
      ) : null}

      <form action={action} className="grid grid-cols-1 gap-3 rounded-lg border border-border p-4">
        <input type="hidden" name="hubId" value={hubId} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Компания клиента</span>
            <input
              name="recipientCompany"
              required
              maxLength={120}
              placeholder='например «ГК РОЛЬФ»'
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Срок жизни</span>
            <select
              name="expiresInDays"
              defaultValue=""
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="">Бессрочно</option>
              <option value="7">7 дней</option>
              <option value="14">14 дней</option>
              <option value="30">30 дней</option>
              <option value="90">90 дней</option>
            </select>
          </label>
        </div>

        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Приветствие</span>
          <input
            name="greeting"
            maxLength={200}
            defaultValue="Коллеги, добрый день!"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <span className="text-xs text-muted">
            Обращение к компании — встанет над описанием подборки
          </span>
        </label>

        {state?.error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        ) : null}

        <div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? "Создаём…" : "Выдать ссылку"}
          </button>
        </div>
      </form>

      {links.length === 0 ? (
        <p className="text-sm text-muted">Ссылок пока нет.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {links.map((link) => {
            const url = `${baseUrl}/v/${link.token}`;
            const dead = link.revoked || link.expired;

            return (
              <li
                key={link.id}
                className={`grid grid-cols-1 gap-1.5 rounded-lg border border-border px-3 py-2.5 ${
                  dead ? "opacity-55" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {link.recipientCompany}
                  </span>

                  {link.revoked ? (
                    <span className="shrink-0 rounded bg-border/70 px-1.5 py-0.5 text-xs">
                      Отозвана
                    </span>
                  ) : link.expired ? (
                    <span className="shrink-0 rounded bg-border/70 px-1.5 py-0.5 text-xs">
                      Истекла
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted">
                      {link.visits} заходов
                    </span>
                  )}

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      startTransition(() =>
                        link.revoked
                          ? restoreShareLink(hubId, link.id)
                          : revokeShareLink(hubId, link.id),
                      )
                    }
                    className="shrink-0 rounded px-2 py-1 text-xs text-muted transition hover:bg-border/60 hover:text-foreground disabled:opacity-50"
                  >
                    {link.revoked ? "Вернуть" : "Отозвать"}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1 font-mono text-xs text-muted">
                    {url}
                  </code>
                  <CopyButton url={url} />
                </div>

                {link.expiresAt && !link.revoked ? (
                  <p className="text-xs text-muted">
                    {link.expired ? "Истекла" : "Действует до"} {link.expiresAt}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
