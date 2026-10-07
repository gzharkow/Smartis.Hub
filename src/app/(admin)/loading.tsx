// Показывается вместо содержимого страницы, пока сервер собирает следующую.
// Шапка, меню и нижний бар остаются на месте (они в layout), а без этого
// файла экран замирал бы на старой странице до конца серверного рендера.
export default function Loading() {
  return (
    <div role="status" aria-label="Загрузка" className="animate-pulse">
      <div className="mb-2 h-7 w-48 rounded-md bg-border/60" />
      <div className="mb-6 h-4 w-72 max-w-full rounded-md bg-border/40" />
      <div className="mb-6 flex gap-1.5">
        <div className="h-8 w-16 rounded-full bg-border/50" />
        <div className="h-8 w-24 rounded-full bg-border/50" />
        <div className="h-8 w-24 rounded-full bg-border/50" />
      </div>
      <div className="grid gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl border border-border bg-surface" />
        ))}
      </div>
    </div>
  );
}
