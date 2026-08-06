// Единый реестр разделов и подразделов сайта, которыми управляет матрица
// доступа уровней (AccessLevel). Без "server-only": нужен и серверным
// проверкам, и клиентской форме матрицы прав.
//
// «Настройки → Администрирование» сюда намеренно не входит — она доступна
// только role = ADMIN, жёстко, в обход этого реестра (см. src/lib/permissions.ts).

export type PermissionSection = {
  key: string;
  label: string;
  /** Раздел без подразделов (например, «Статистика») не даёт «Изменение» — там нечего менять. */
  editable?: boolean;
  children: readonly { key: string; label: string }[];
};

export const PERMISSION_SECTIONS: readonly PermissionSection[] = [
  {
    key: "hubs",
    label: "Хабы",
    children: [
      { key: "hubs.folders", label: "Папки" },
      { key: "hubs.trash", label: "Недавно удалённые" },
    ],
  },
  {
    key: "assets",
    label: "Материалы",
    children: [
      { key: "assets.auto", label: "Авторынок" },
      { key: "assets.realty", label: "Недвижимость" },
      { key: "assets.common", label: "Общие" },
      { key: "assets.cases", label: "Кейсы" },
    ],
  },
  {
    key: "calculator",
    label: "Генератор КП",
    children: [{ key: "calculator.files", label: "Файлы" }],
  },
  {
    key: "stats",
    label: "Статистика",
    editable: false,
    children: [],
  },
] as const;

/** Все ключи (разделы и подразделы) одним плоским списком — удобно для дефолтов матрицы. */
export const ALL_SECTION_KEYS: readonly string[] = PERMISSION_SECTIONS.flatMap((s) => [
  s.key,
  ...s.children.map((c) => c.key),
]);
