import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GloriA",
  description:
    "Practica terapéutica con pacientes simulados por IA. Un entorno seguro para entrenar habilidades clínicas antes de la práctica real.",
  openGraph: {
    title: "GloriA — Pacientes IA para formación clínica",
    description:
      "Entrena tus habilidades clínicas conversando con pacientes simulados por inteligencia artificial. Plataforma de la Universidad Gabriela Mistral.",
    type: "website",
    locale: "es_CL",
    siteName: "GloriA",
    images: [
      {
        url: "/branding/gloria-logo.png",
        width: 512,
        height: 512,
        alt: "GloriA - Pacientes IA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GloriA — Pacientes IA para formación clínica",
    description:
      "Entrena tus habilidades clínicas conversando con pacientes simulados por inteligencia artificial.",
    images: ["/branding/gloria-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
