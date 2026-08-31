"use client";

import { useState } from "react";
import type { UnavailableContact } from "@/lib/showcase";
import { ContactDialog } from "@/components/showcase/contact-dialog";
import { textOnBrand } from "@/lib/brand-color";

const MESSAGES: Record<string, { title: string; text: string }> = {
  not_found: {
    title: "Ссылка не найдена",
    text: "Проверьте, что адрес скопирован целиком — возможно, при пересылке он разорвался на две строки.",
  },
  revoked: {
    title: "Ссылка отозвана",
    text: "Отправитель закрыл доступ к этой подборке. Свяжитесь с ним, если материалы всё ещё нужны.",
  },
  expired: {
    title: "Срок ссылки истёк",
    text: "Подборка была доступна ограниченное время. Попросите отправителя выдать новую ссылку.",
  },
  unpublished: {
    title: "Подборка ещё готовится",
    text: "Материалы пока не опубликованы. Попробуйте открыть ссылку позже.",
  },
  // Хаб удалён. Формулировка как у отозванной ссылки: подборки больше нет,
  // и звать клиента «зайти позже» было бы неправдой.
  archived: {
    title: "Подборка больше недоступна",
    text: "Отправитель закрыл доступ к этим материалам. Свяжитесь с ним, если они всё ещё нужны.",
  },
};

export function ShowcaseUnavailable({
  reason,
  contact,
}: {
  reason: string;
  /** Есть только когда ссылка существует (не "not_found") и в хабе включена
   *  кнопка связи. Те же контакты, что показала бы «Задать вопрос» в хабе. */
  contact?: UnavailableContact;
}) {
  const { title, text } = MESSAGES[reason] ?? MESSAGES.not_found;
  const [open, setOpen] = useState(false);

  return (
    <main className="flex flex-1 items-center justify-center bg-white p-6 text-zinc-900">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-zinc-500">{text}</p>

        {contact ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-5 cursor-pointer rounded-xl px-5 py-2.5 text-sm font-medium transition duration-100 hover:opacity-90 active:scale-[0.97] pointer-coarse:min-h-11"
            style={{
              backgroundColor: contact.brandColor,
              color: textOnBrand(contact.brandColor),
            }}
          >
            Связаться с нами
          </button>
        ) : null}
      </div>

      {open && contact ? (
        <ContactDialog
          contacts={contact.contacts}
          brandColor={contact.brandColor}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </main>
  );
}
