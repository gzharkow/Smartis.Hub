"use client";

import { useTransition } from "react";
import { duplicateHub } from "@/app/actions/hubs";
import { buttonClasses } from "@/components/ui/button";

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
      className={buttonClasses("secondary", "md")}
    >
      {pending ? "Копируем…" : "Сделать копию"}
    </button>
  );
}
