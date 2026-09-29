"use client";

import { useActionState, useState } from "react";
import { createAccount, type CreateAccountState } from "@/app/actions/users";
import { AccountVisibilityPicker, type AccountOption } from "./account-visibility-picker";
import { copyText } from "./copy-text";
import { buttonClasses } from "@/components/ui/button";
import { fieldClasses } from "@/components/ui/field";

/**
 * Обёртка нужна только чтобы «Создать ещё аккаунт» полностью пересоздавала
 * форму (свежий useActionState) — смена key размонтирует и создаёт заново.
 */
export function CreateAccountForm({ accountOptions }: { accountOptions: AccountOption[] }) {
  const [formKey, setFormKey] = useState(0);
  return (
    <CreateAccountFormInner
      key={formKey}
      accountOptions={accountOptions}
      onCreateAnother={() => setFormKey((k) => k + 1)}
    />
  );
}

function CreateAccountFormInner({
  accountOptions,
  onCreateAnother,
}: {
  accountOptions: AccountOption[];
  onCreateAnother: () => void;
}) {
  const [state, action, pending] = useActionState<CreateAccountState, FormData>(
    createAccount,
    undefined,
  );

  const [role, setRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [canAccessHubs, setCanAccessHubs] = useState(true);
  const [canAccessAssets, setCanAccessAssets] = useState(true);
  const [canAccessStats, setCanAccessStats] = useState(true);
  const [canAccessCalculator, setCanAccessCalculator] = useState(true);
  const [canAccessKpi, setCanAccessKpi] = useState(true);
  const [canManageKpi, setCanManageKpi] = useState(false);
  const [canAddAssets, setCanAddAssets] = useState(false);
  const [visibleOwnerIds, setVisibleOwnerIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  if (state && "success" in state) {
    return (
      <div className="rounded-xl border border-ok/30 bg-ok/5 p-5">
        <p className="font-medium text-ok">Аккаунт создан</p>
        <p className="mt-1 text-sm">
          Почта: <b>{state.email}</b>
        </p>
        <p className="mt-2 text-sm text-muted">
          Пароль нигде больше не сохранён — сообщите его пользователю сейчас:
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <code className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {state.password}
          </code>
          <button
            type="button"
            onClick={async () => {
              const ok = await copyText(state.password);
              if (ok) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }
            }}
            className="rounded-lg px-3 py-2 text-sm font-medium text-accent transition hover:bg-accent/10"
          >
            {copied ? "Скопировано" : "Копировать"}
          </button>
        </div>
        <button
          type="button"
          onClick={onCreateAnother}
          className={buttonClasses("primary", "md", "mt-4")}
        >
          Создать ещё аккаунт
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm">Почта</span>
          <input
            name="email"
            type="email"
            required
            placeholder="ivan@smartis.bi"
            className={fieldClasses()}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm">Имя</span>
          <input
            name="name"
            placeholder="Иван Иванов"
            className={fieldClasses()}
          />
        </label>
      </div>

      <div className="grid gap-1.5">
        <span className="text-sm">Роль</span>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="role"
              value="MEMBER"
              checked={role === "MEMBER"}
              onChange={() => setRole("MEMBER")}
              className="size-4"
            />
            Обычный пользователь — доступ к разделам настраивается ниже
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="role"
              value="ADMIN"
              checked={role === "ADMIN"}
              onChange={() => setRole("ADMIN")}
              className="size-4"
            />
            Администратор — полный доступ
          </label>
        </div>
      </div>

      {role === "MEMBER" ? (
        <div className="grid gap-4 rounded-lg border border-border p-4">
          <div className="grid gap-1.5">
            <span className="text-sm">Доступ к разделам</span>
            <div className="grid gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={canAccessHubs}
                  onChange={(e) => setCanAccessHubs(e.target.checked)}
                />
                Хабы
              </label>
              <input type="hidden" name="canAccessHubs" value={canAccessHubs ? "1" : "0"} />

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={canAccessAssets}
                  onChange={(e) => {
                    setCanAccessAssets(e.target.checked);
                    if (!e.target.checked) setCanAddAssets(false);
                  }}
                />
                Материалы
              </label>
              <input type="hidden" name="canAccessAssets" value={canAccessAssets ? "1" : "0"} />

              {canAccessAssets ? (
                <label className="ml-6 flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={canAddAssets}
                    onChange={(e) => setCanAddAssets(e.target.checked)}
                  />
                  Разрешить добавление, изменение и удаление материалов
                </label>
              ) : null}
              {canAccessAssets ? (
                <input type="hidden" name="canAddAssets" value={canAddAssets ? "1" : "0"} />
              ) : null}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={canAccessStats}
                  onChange={(e) => setCanAccessStats(e.target.checked)}
                />
                Статистика
              </label>
              <input type="hidden" name="canAccessStats" value={canAccessStats ? "1" : "0"} />

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={canAccessCalculator}
                  onChange={(e) => setCanAccessCalculator(e.target.checked)}
                />
                Генератор КП
              </label>
              <input
                type="hidden"
                name="canAccessCalculator"
                value={canAccessCalculator ? "1" : "0"}
              />

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={canAccessKpi}
                  onChange={(e) => {
                    setCanAccessKpi(e.target.checked);
                    if (!e.target.checked) setCanManageKpi(false);
                  }}
                />
                KPI план/факт
              </label>
              <input type="hidden" name="canAccessKpi" value={canAccessKpi ? "1" : "0"} />

              {canAccessKpi ? (
                <label className="ml-6 flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={canManageKpi}
                    onChange={(e) => setCanManageKpi(e.target.checked)}
                  />
                  Разрешить менять названия показателей и должности
                </label>
              ) : null}
              {canAccessKpi ? (
                <input type="hidden" name="canManageKpi" value={canManageKpi ? "1" : "0"} />
              ) : null}
            </div>
            <p className="text-xs text-muted">
              Закрытый раздел не отображается в меню, и попасть в него нельзя.
            </p>
          </div>

          <AccountVisibilityPicker
            options={accountOptions}
            selected={visibleOwnerIds}
            onChange={setVisibleOwnerIds}
          />
        </div>
      ) : null}

      {state && "error" in state ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={pending}
          className={buttonClasses("primary")}
        >
          {pending ? "Создаём…" : "Создать аккаунт"}
        </button>
      </div>
    </form>
  );
}
