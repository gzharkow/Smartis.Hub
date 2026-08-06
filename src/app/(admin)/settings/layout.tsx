import { requireAdmin } from "@/lib/auth";

// Весь раздел «Настройки» жёстко доступен только администратору — это
// НЕ часть настраиваемой матрицы прав (иначе обычный пользователь в теории
// мог бы получить право заводить новые аккаунты, а значит и себе — админку).
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <>{children}</>;
}
