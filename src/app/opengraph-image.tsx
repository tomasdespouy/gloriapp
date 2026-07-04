import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "GlorIA — Plataforma de Pacientes IA para Psicología";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// La misma foto del login (co-ubicada como ./og-bg.jpg). Next inlinea el asset
// vía `new URL(..., import.meta.url)`. La embebemos como data URI para que Satori
// la pinte sin depender de un fetch a la propia URL.
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export default async function OGImage() {
  const buf = await fetch(new URL("./og-bg.jpg", import.meta.url)).then((r) => r.arrayBuffer());
  const bg = `data:image/jpeg;base64,${toBase64(buf)}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative" }}>
        {/* Foto de fondo a sangre */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bg}
          width={1200}
          height={630}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 26%" }}
        />

        {/* Degradado navy para legibilidad (como el login) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(90deg, rgba(11,20,37,0.94) 0%, rgba(11,20,37,0.80) 45%, rgba(11,20,37,0.12) 100%)",
          }}
        />

        {/* Contenido de marca */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: "64%",
            height: "100%",
            padding: 76,
          }}
        >
          {/* Wordmark */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 66,
                height: 66,
                borderRadius: 16,
                background: "#4A55A2",
                marginRight: 20,
              }}
            >
              <span style={{ fontSize: 36, color: "white", fontWeight: 700 }}>G</span>
            </div>
            <div style={{ display: "flex" }}>
              <span style={{ fontSize: 66, fontWeight: 800, color: "white", letterSpacing: "-1px" }}>Glor</span>
              <span style={{ fontSize: 66, fontWeight: 800, color: "#A5ADE0", letterSpacing: "-1px" }}>IA</span>
            </div>
          </div>

          {/* Tagline principal */}
          <p style={{ fontSize: 32, fontWeight: 600, color: "white", lineHeight: 1.3, margin: "28px 0 0 0", maxWidth: 620 }}>
            Practica terapia con pacientes simulados por inteligencia artificial
          </p>

          {/* Separador */}
          <div style={{ width: 66, height: 4, borderRadius: 2, background: "#6B74C9", margin: "28px 0" }} />

          {/* Subtítulo */}
          <p style={{ fontSize: 21, color: "rgba(255,255,255,0.82)", margin: 0, maxWidth: 560 }}>
            Plataforma de formación clínica para estudiantes de psicología
          </p>
        </div>
      </div>
    ),
    { ...size }
  );
}
