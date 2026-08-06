import { ownerColorClass } from "@/lib/owner-color";

/**
 * Кто создал запись — только там, где список показывает записи разных
 * людей вперемешку (администратору в «Хабах»/«Генераторе КП»). У обычного
 * пользователя все записи и так его собственные, бейдж был бы шумом —
 * решает вызывающая страница, передавая (или не передавая) owner в строку.
 */
export function OwnerBadge({ id, label }: { id: string; label: string }) {
  return (
    <span
      className={`w-fit shrink-0 truncate rounded-full px-2 py-0.5 text-xs font-medium ${ownerColorClass(id)}`}
      title={label}
    >
      {label}
    </span>
  );
}
