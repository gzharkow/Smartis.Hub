import { redirect } from "next/navigation";

// Единственный подраздел пока — «Администрирование»; когда появится ещё
// один, здесь будет смысл показать выбор вместо редиректа.
export default function SettingsPage() {
  redirect("/settings/administration");
}
