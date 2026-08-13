import "dotenv/config";
import { db } from "../src/lib/db";

// Разовая настройка брендинга организации.
// Временная мера: экрана настроек ещё нет, а витрину надо на чём-то проверять.
// Когда появится раздел настроек — скрипт удалить.
//
// Контакты кнопки «Задать вопрос» сюда больше не входят — они теперь
// собственность конкретного хаба и настраиваются на его странице
// (см. HubSettingsForm), а не одной строкой на всю организацию.

async function main() {
  const org = await db.organization.update({
    where: { slug: "default" },
    data: {
      name: "Smartis",
      logoUrl: "/logo.png",
      brandColor: "#7CA82D",
    },
  });

  console.log("Брендинг обновлён:", {
    name: org.name,
    logoUrl: org.logoUrl,
    brandColor: org.brandColor,
  });
}

main()
  .catch((e) => {
    console.error("Ошибка:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
