import { useId } from "react";

// Простая плоская иконка папки (в духе стандартных папок Finder/Проводника):
// корпус со скруглёнными углами, язычок сверху-слева, светлая «передняя
// панель» внизу для лёгкой двухтоновости. viewBox 5:4 — то же соотношение,
// что и контейнер иконки в folder-row.tsx, так что иконка не растягивается
// (preserveAspectRatio по умолчанию), в отличие от прежней версии, которая
// подгонялась под форму всей плитки.
const FOLDER_OUTLINE_PATH =
  "M 12 0 L 38 0 Q 42 0 42 4 L 48 14 L 92 14 Q 100 14 100 22 " +
  "L 100 72 Q 100 80 92 80 L 8 80 Q 0 80 0 72 L 0 22 Q 0 14 8 14 L 8 4 Q 8 0 12 0 Z";

const FOLDER_TAB_PATH = "M 12 0 L 38 0 Q 42 0 42 4 L 48 14 L 8 14 L 8 4 Q 8 0 12 0 Z";

// Иконка теперь не фон-подложка под текстом (текст — подпись под ней), а
// самостоятельная маленькая картинка, поэтому заливка может быть
// полноцветной без риска съесть контраст.
const FALLBACK_FILL = "var(--border)";

/** Небольшая цветная иконка папки — используется на плитке в «Хабы → Папки». */
export function FolderShape({
  color,
  className,
}: {
  color: string | null;
  className?: string;
}) {
  const uid = useId();
  const clipId = `folder-clip-${uid}`;
  const fill = color ?? FALLBACK_FILL;

  return (
    <svg aria-hidden="true" viewBox="0 0 100 80" className={className}>
      <defs>
        <clipPath id={clipId}>
          <path d={FOLDER_OUTLINE_PATH} />
        </clipPath>
      </defs>

      <path
        d={FOLDER_OUTLINE_PATH}
        fill={fill}
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <path d={FOLDER_TAB_PATH} fill="#fff" opacity="0.22" />

      <g clipPath={`url(#${clipId})`}>
        <rect x="6" y="34" width="88" height="40" rx="6" fill="#fff" opacity="0.12" />
      </g>
    </svg>
  );
}
