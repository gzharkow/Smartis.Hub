"use client";

import { useTransition } from "react";
import { duplicateHub } from "@/app/actions/hubs";

/**
 * Копия хаба. Отдельных шаблонов в сервисе нет намеренно: удачно собранный
 * хаб и есть шаблон — скопировал и доработал под нового клиента.
 *
 * Подтверждения не спрашиваем: копия ничего не портит и не публикуется,
 * лишний черновик удаляется в одно нажатие.
 */
export function DuplicateHubButton({ hubId }: { hubId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => duplicateHub(hubId))}
      title="Создать черновик с теми же настройками и материалами"
      className="rounded-lg border border-border px-3 py-1.5 text-sm transition hover:bg-border/60 disabled:opacity-50"
    >
      {pending ? "Копируем…" : "Сделать копию"}
    </button>
  );
}
