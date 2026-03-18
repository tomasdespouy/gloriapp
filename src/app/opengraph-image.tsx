import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "GlorIA — Plataforma de Pacientes IA para Psicología";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #FAFAFA 0%, #F0F0F5 50%, #E8E8F0 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Subtle decorative circles */}
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -80,
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: "rgba(74, 85, 162, 0.06)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -60,
            left: -60,
            width: 250,
            height: 250,
            borderRadius: "50%",
            background: "rgba(74, 85, 162, 0.04)",
          }}
        />

        {/* Logo mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 80,
            height: 80,
            borderRadius: 20,
            background: "#4A55A2",
            marginBottom: 28,
          }}
        >
          <span style={{ fontSize: 40, color: "white", fontWeight: 700 }}>G</span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: "#1A1A1A",
            margin: 0,
            letterSpacing: "-1px",
          }}
        >
          Glor<span style={{ color: "#4A55A2" }}>IA</span>
        </h1>

        {/* Tagline */}
        <p
          style={{
            fontSize: 22,
            color: "#666",
            margin: "12px 0 0 0",
            fontWeight: 400,
          }}
        >
          Practica terapia con pacientes simulados por IA
        </p>

        {/* Separator */}
        <div
          style={{
            width: 60,
            height: 3,
            background: "#4A55A2",
            borderRadius: 2,
            margin: "28px 0",
          }}
        />

        {/* Subtitle */}
        <p
          style={{
            fontSize: 16,
            color: "#999",
            margin: 0,
            fontWeight: 400,
          }}
        >
          Plataforma de formación clínica para estudiantes de psicología
        </p>

        {/* Bottom bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            background: "linear-gradient(90deg, #4A55A2, #6B74C9)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
