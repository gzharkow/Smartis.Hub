import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Значок Next.js во время разработки по умолчанию висит слева внизу —
  // ровно поверх кнопки «Выйти» в боковом меню. Отодвигаем вправо.
  // На боевом сайте этого значка нет вовсе.
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
