// Фон витрины. Вынесен отдельно, чтобы менять картинку в одном месте.
//
// Файл лежит в public/hub-bg.jpg — это копия присланного «фон.jfif»
// с латинским именем: кириллица и расширение .jfif в веб-адресах
// ведут себя непредсказуемо.

export function ShowcaseBackdrop({ brandColor }: { brandColor: string }) {
  return (
    <div
      aria-hidden="true"
      // fixed, а не absolute: фон не уезжает при прокрутке длинного
      // списка материалов, картинка остаётся на месте.
      className="pointer-events-none fixed inset-0 -z-10 bg-[#0b0f14]"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/hub-bg.jpg')" }}
      />

      {/* Пятно фирменного цвета поверх картинки: витрина под другой бренд
          сменит оттенок без замены файла. */}
      <div
        className="absolute inset-0 opacity-25 mix-blend-screen"
        style={{
          background: `radial-gradient(65% 50% at 15% 5%, ${brandColor}, transparent 65%)`,
        }}
      />

      {/* Затемнение книзу. Картинка 1600×900, а витрина длинная: без этого
          на высоких экранах низ страницы оказался бы светлее верха,
          и текст на нём терял бы контраст. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/45 to-[#0b0f14]" />
    </div>
  );
}
