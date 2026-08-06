import { requireUser } from "@/lib/auth";

// «Настройки» доступны любому вошедшему — там же теперь общий подраздел
// (тема, аккаунт, смена пароля). Раздел «Администрирование» — НЕ часть
// настраиваемой матрицы прав (иначе обычный пользователь в теории мог бы
// получить право заводить новые аккаунты, а значит и себе — админку) —
// он гейтится отдельно, requireAdmin() внутри settings/administration/page.tsx.
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return <>{children}</>;
}
