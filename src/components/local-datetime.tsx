"use client";

import {
  formatEventTime,
  formatHubCreated,
  formatShortDate,
  formatVisitWhen,
  formatWhen,
} from "@/lib/format-datetime";

type Props =
  | { kind: "hubCreated"; date: Date }
  | { kind: "relative"; date: Date | null }
  | { kind: "visitWhen"; date: Date }
  | { kind: "eventTime"; date: Date }
  | { kind: "shortDate"; date: Date };

/**
 * Единая точка показа даты/времени в интерфейсе. Рендерится в браузере
 * нарочно: часовой пояс процесса Node на сервере никем не задан и не
 * гарантирован (см. AGENTS.md), а единственный пояс, который точно тот,
 * что нужен, — пояс устройства, на котором открыт продукт. Server Component
 * может вставлять этот компонент обычным ребёнком, не становясь клиентским
 * целиком — `Date` в props пересекает границу сервер/клиент без проблем.
 */
export function LocalDateTime(props: Props) {
  switch (props.kind) {
    case "hubCreated":
      return <>{formatHubCreated(props.date)}</>;
    case "relative":
      return <>{formatWhen(props.date)}</>;
    case "visitWhen":
      return <>{formatVisitWhen(props.date)}</>;
    case "eventTime":
      return <>{formatEventTime(props.date)}</>;
    case "shortDate":
      return <>{formatShortDate(props.date)}</>;
  }
}
