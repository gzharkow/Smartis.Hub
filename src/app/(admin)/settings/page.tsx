import { redirect } from "next/navigation";

// «Общие» доступны всем и открываются по умолчанию; «Администрирование» —
// второй подраздел, виден только админу (см. SettingsTabs).
export default function SettingsPage() {
  redirect("/settings/general");
}
