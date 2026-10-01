import { INDUSTRIES, INDUSTRY_LABELS } from "@/lib/industry";
import { fieldClasses } from "@/components/ui/field";

/** Поле «Отрасль» для форм создания (уходит в FormData как `industry`). */
export function IndustrySelect() {
  return (
    <select
      name="industry"
      defaultValue=""
      aria-label="Отрасль"
      className={fieldClasses("w-full sm:w-44")}
    >
      <option value="">Отрасль не указана</option>
      {INDUSTRIES.map((i) => (
        <option key={i} value={i}>
          {INDUSTRY_LABELS[i]}
        </option>
      ))}
    </select>
  );
}
