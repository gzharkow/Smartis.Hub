"use client";

import { useRouter } from "next/navigation";

type Member = { id: string; name: string | null; email: string };

/**
 * Только для ADMIN: переключатель, чьи «Мои материалы» показываются на
 * странице. Остальным (MEMBER) видна только своя личная библиотека — этот
 * компонент для них даже не рендерится (см. mine/page.tsx: orgMembers
 * пустой, если запрашивал не ADMIN).
 */
export function OwnerSwitcher({
  members,
  currentUserId,
  selectedUserId,
}: {
  members: Member[];
  currentUserId: string;
  selectedUserId: string;
}) {
  const router = useRouter();

  return (
    <label className="mb-4 flex items-center gap-2 text-sm">
      <span className="text-muted">Чья библиотека</span>
      <select
        value={selectedUserId}
        onChange={(e) => {
          const id = e.target.value;
          router.push(id === currentUserId ? "/assets/mine" : `/assets/mine?user=${id}`);
        }}
        className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm pointer-coarse:min-h-11"
      >
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.id === currentUserId ? "Моя" : m.name ?? m.email}
          </option>
        ))}
      </select>
    </label>
  );
}
