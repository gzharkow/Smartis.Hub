import type { ReactNode } from "react";
import type { PostViewTierChoice } from "@/lib/quote-calculator";

// Общие мелкие элементы формы для BuilderConfigPanel/AutoDealerConfigPanel —
// строка «название — контрол — посчитанная цена», числовое поле, пара
// взаимоисключающих галочек для тарифа «до/более 1 млн».

export const checkboxCls = "size-4 accent-blue-600";

const numberFieldCls =
  "w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-right outline-none focus:border-blue-500";

export function CalcRow({
  label,
  control,
  price,
  hint,
}: {
  label: string;
  control: ReactNode;
  /** Посчитанная цена этой строки — не показываем, если строка выключена
   * (условие не выполнено, в документ она не попадёт). */
  price?: string;
  hint?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[1fr_auto_130px] sm:items-center">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      </div>
      <div className="sm:justify-self-end">{control}</div>
      <div className="text-sm font-semibold sm:text-right">{price ?? "—"}</div>
    </div>
  );
}

export function NumberField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="number"
      min={0}
      step={1}
      value={value}
      onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
      placeholder={placeholder}
      className={className ?? numberFieldCls}
    />
  );
}

export function ToggleField({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className={checkboxCls}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      включить
    </label>
  );
}

/** «до 1 млн»/«более 1 млн» — две галочки поверх одного tri-state поля, так
 * что «отмечены обе» не существует как состояние данных, а не только на UI. */
export function TierChoiceField({
  value,
  onChange,
}: {
  value: PostViewTierChoice;
  onChange: (value: PostViewTierChoice) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          className={checkboxCls}
          checked={value === "UNDER_1M"}
          onChange={(e) => onChange(e.target.checked ? "UNDER_1M" : "NONE")}
        />
        до 1 млн
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          className={checkboxCls}
          checked={value === "OVER_1M"}
          onChange={(e) => onChange(e.target.checked ? "OVER_1M" : "NONE")}
        />
        более 1 млн
      </label>
    </div>
  );
}
