import "dotenv/config";
import { db } from "../src/lib/db";

// Разовая настройка брендинга и контактов организации.
// Временная мера: экрана настроек ещё нет, а витрину надо на чём-то проверять.
// Когда появится раздел настроек — скрипт удалить.

async function main() {
  const org = await db.organization.update({
    where: { slug: "default" },
    data: {
      name: "Smartis",
      logoUrl: "/logo.png",
      brandColor: "#7CA82D",
      contactMethods: [
        { kind: "EMAIL", label: "Почта", value: "get@smartis.bi" },
        { kind: "PHONE", label: "Телефон", value: "+7 495 021-07-51" },
        { kind: "WEBSITE", label: "Сайт", value: "https://smartis.bi" },
      ],
    },
  });

  console.log("Брендинг обновлён:", {
    name: org.name,
    logoUrl: org.logoUrl,
    brandColor: org.brandColor,
    contacts: org.contactMethods,
  });
}

main()
  .catch((e) => {
    console.error("Ошибка:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
