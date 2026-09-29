"use client";

import { useState, useTransition } from "react";
import { deletePerson, savePerson } from "@/app/actions/kpi";
import type { KpiPersonRow } from "@/lib/kpi-data";
import { Button } from "@/components/ui";
import { ROLE_LABEL, type KpiRole } from "@/lib/kpi";

const SELECT =
  "rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none pointer-coarse:py-2.5";

const NAME =
  "min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none pointer-coarse:py-2.5";

function PersonLine({ person }: { person: KpiPersonRow }) {
  const [pending, start] = useTransition();
  const [name, setName] = useState(person.name);

  function save(patch: Partial<KpiPersonRow>) {
    const next = { ...person, name, ...patch };
    if (!next.name.trim()) {
      setName(person.name);
      return;
    }
    start(async () => {
      try {
        await savePerson({
          id: person.id,
          name: next.name,
          inActivity: next.inActivity,
          inSales: next.inSales,
          role: next.role,
          archived: next.archived,
        });
      } catch {
        setName(person.name);
      }
    });
  }

  return (
    <li
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${pending ? "opacity-50" : ""} ${person.archived ? "opacity-60" : ""}`}
    >
      <input
        value={name}
        aria-label="Имя"
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name !== person.name && save({})}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className={NAME}
      />
      <label className="flex items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          className="size-4"
          checked={person.inActivity}
          onChange={(e) => save({ inActivity: e.target.checked })}
        />
        Активность
      </label>
      <label className="flex items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          className="size-4"
          checked={person.inSales}
          onChange={(e) => save({ inSales: e.target.checked })}
        />
        Менеджер
      </label>
      <select
        value={person.role}
        aria-label={`Должность: ${person.name}`}
        onChange={(e) => save({ role: e.target.value as KpiRole })}
        className={SELECT}
      >
        <option value="DEVELOPMENT">{ROLE_LABEL.DEVELOPMENT}</option>
        <option value="ASSISTANT">{ROLE_LABEL.ASSISTANT}</option>
      </select>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onClick={() => save({ archived: !person.archived })}
      >
        {person.archived ? "Вернуть" : "В архив"}
      </Button>
      <Button
        variant="ghostDanger"
        size="sm"
        type="button"
        onClick={() => {
          if (
            !window.confirm(
              `Удалить «${person.name}» полностью? Все его планы и факты по неделям тоже удалятся, вернуть их будет нельзя. Чтобы сохранить данные, используйте «В архив».`,
            )
          )
            return;
          start(async () => {
            try {
              await deletePerson(person.id);
            } catch {
              /* строка останется на месте */
            }
          });
        }}
      >
        Удалить
      </Button>
    </li>
  );
}

/** Список участников: кто ведёт активность, кто менеджер по сделкам. */
export function PeopleManager({ people }: { people: KpiPersonRow[] }) {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [inActivity, setInActivity] = useState(true);
  const [inSales, setInSales] = useState(false);
  const [role, setRole] = useState<KpiRole>("DEVELOPMENT");

  function add() {
    if (!name.trim()) return;
    start(async () => {
      try {
        await savePerson({ name, inActivity, inSales, role });
        setName("");
      } catch {
        /* оставляем введённое */
      }
    });
  }

  return (
    <div className="grid gap-4">
      <ul className="grid gap-3">
        {people.map((p) => (
          <PersonLine key={`${p.id}-${p.name}-${p.inActivity}-${p.inSales}-${p.role}-${p.archived}`} person={p} />
        ))}
        {people.length === 0 ? (
          <li className="text-sm text-muted">Пока никого нет — добавьте первого участника.</li>
        ) : null}
      </ul>
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 ${pending ? "opacity-50" : ""}`}>
        <input
          value={name}
          placeholder="Имя нового участника"
          aria-label="Имя нового участника"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className={NAME}
        />
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={inActivity}
            onChange={(e) => setInActivity(e.target.checked)}
          />
          Активность
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={inSales}
            onChange={(e) => setInSales(e.target.checked)}
          />
          Менеджер
        </label>
        <select
          value={role}
          aria-label="Должность нового участника"
          onChange={(e) => setRole(e.target.value as KpiRole)}
          className={SELECT}
        >
          <option value="DEVELOPMENT">{ROLE_LABEL.DEVELOPMENT}</option>
          <option value="ASSISTANT">{ROLE_LABEL.ASSISTANT}</option>
        </select>
        <Button type="button" size="sm" onClick={add} disabled={!name.trim()}>
          Добавить
        </Button>
      </div>
    </div>
  );
}
