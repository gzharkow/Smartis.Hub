"use client";

export type AccountOption = { id: string; email: string; name: string | null };

/** Список аккаунтов, чьи хабы/расчёты дополнительно видит редактируемый —
 * персональный грант, не привязанный к роли. Чекбоксы, а не select с
 * multiple: список короткий (сотрудники одной организации), а не сотни строк. */
export function AccountVisibilityPicker({
  options,
  selected,
  onChange,
}: {
  options: AccountOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  if (options.length === 0) return null;

  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium">Видит хабы и расчёты аккаунтов</span>
      <div className="grid max-h-40 gap-1.5 overflow-y-auto rounded-lg border border-border p-2.5">
        {options.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-blue-600"
              checked={selected.includes(o.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, o.id]
                    : selected.filter((id) => id !== o.id),
                )
              }
            />
            {o.name || o.email}
          </label>
        ))}
      </div>
      {selected.map((id) => (
        <input key={id} type="hidden" name="visibleOwnerIds" value={id} />
      ))}
    </div>
  );
}
