import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_BRAND_COLOR } from "@/lib/brand-color";

// Картинка для превью ссылки в мессенджерах — то же оформление, что у плитки
// хаба (HubTilePreview), только паучок крупнее и заметнее: на плитке это
// водяной знак, здесь — главный элемент. Одинакова для всех витрин и данных
// из базы не читает: токен в адресе не проверяется и ничего не раскрывает.
export const alt = "Контент-хабы для клиентов";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PUBLIC = path.join(process.cwd(), "public");

export default async function Image() {
  const [bg, logo] = await Promise.all([
    readFile(path.join(PUBLIC, "hub-bg.jpg")),
    readFile(path.join(PUBLIC, "logo.png")),
  ]);

  const bgUrl = `data:image/jpeg;base64,${bg.toString("base64")}`;
  const logoUrl = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#0b0f14",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bgUrl}
          alt=""
          width={1200}
          height={630}
          style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, width: 1200, height: 630,
            opacity: 0.45,
            background: `radial-gradient(circle 700px at 180px 0px, ${DEFAULT_BRAND_COLOR}, transparent 65%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, width: 1200, height: 630,
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.6))",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, width: 1200, height: 630,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt=""
            width={344} height={260}
            style={{ height: 260, width: 344, opacity: 0.92 }}
          />
        </div>
      </div>
    ),
    size,
  );
}
