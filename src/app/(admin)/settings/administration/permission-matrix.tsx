"use client";

import { Fragment } from "react";
import { PERMISSION_SECTIONS } from "@/lib/permission-sections";
import type { Permissions } from "@/lib/access-levels";

/**
 * Сетка чекбоксов «Просмотр / Изменение» по каждому разделу и подразделу.
 * Управляемый компонент — состояние матрицы живёт в родительской форме
 * (создание аккаунта, правка аккаунта, правка именованного уровня), сюда
 * приходит value/onChange, как и у остальных полей формы в проекте.
 */
export function PermissionMatrix({
  value,
  onChange,
}: {
  value: Permissions;
  onChange: (next: Permissions) => void;
}) {
  function entryOf(key: string) {
    return value.find((p) => p.section === key) ?? { section: key, view: false, edit: false };
  }

  function update(key: string, patch: Partial<{ view: boolean; edit: boolean }>) {
    const current = entryOf(key);
    const next = { ...current, ...patch };
    onChange([...value.filter((p) => p.section !== key), next]);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-border bg-border/30 text-left text-xs text-muted">
            <th className="px-3 py-2 font-medium">Раздел</th>
            <th className="w-24 px-3 py-2 text-center font-medium">Просмотр</th>
            <th className="w-24 px-3 py-2 text-center font-medium">Изменение</th>
          </tr>
        </thead>
        <tbody>
          {PERMISSION_SECTIONS.map((section) => {
            const parent = entryOf(section.key);
            return (
              <Fragment key={section.key}>
                <MatrixRow
                  label={section.label}
                  view={parent.view}
                  edit={parent.edit}
                  editable={section.editable !== false}
                  onView={(v) => update(section.key, { view: v })}
                  onEdit={(v) => update(section.key, { edit: v })}
                />
                {section.children.map((child) => {
                  const row = entryOf(child.key);
                  return (
                    <MatrixRow
                      key={child.key}
                      label={child.label}
                      indent
                      view={row.view}
                      edit={row.edit}
                      onView={(v) => update(child.key, { view: v })}
                      onEdit={(v) => update(child.key, { edit: v })}
                    />
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MatrixRow({
  label,
  indent = false,
  view,
  edit,
  editable = true,
  onView,
  onEdit,
}: {
  label: string;
  indent?: boolean;
  view: boolean;
  edit: boolean;
  editable?: boolean;
  onView: (value: boolean) => void;
  onEdit: (value: boolean) => void;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className={`px-3 py-2 ${indent ? "pl-8 text-muted" : "font-medium"}`}>{label}</td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={view}
          onChange={(e) => onView(e.target.checked)}
          className="size-4 accent-blue-600"
          aria-label={`Просмотр: ${label}`}
        />
      </td>
      <td className="px-3 py-2 text-center">
        {editable ? (
          <input
            type="checkbox"
            checked={edit}
            onChange={(e) => onEdit(e.target.checked)}
            className="size-4 accent-blue-600"
            aria-label={`Изменение: ${label}`}
          />
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
    </tr>
  );
}
