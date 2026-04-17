import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import CookieConsent from "@/components/CookieConsent";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  viewportFit: "cover",
  maximumScale: 1,
  // Android Chrome: when the soft keyboard opens, shrink the layout
  // viewport (resizes-content) instead of overlaying, so our dvh-based
  // heights recompute and the chat input stays visible.
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  title: "GlorIA — Pacientes IA para Psicología",
  description: "Practica terapia con pacientes simulados por inteligencia artificial. Plataforma de formación clínica para estudiantes de psicología.",
  metadataBase: new URL("https://glor-ia.com"),
  openGraph: {
    title: "GlorIA — Pacientes IA para Psicología",
    description: "Practica terapia con pacientes simulados por inteligencia artificial. Plataforma de formación clínica para estudiantes de psicología.",
    url: "https://glor-ia.com",
    siteName: "GlorIA",
    locale: "es_CL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GlorIA — Pacientes IA para Psicología",
    description: "Practica terapia con pacientes simulados por inteligencia artificial.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[10000] focus:bg-white focus:text-sidebar focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-sm focus:font-semibold"
        >
          Ir al contenido principal
        </a>
        {children}
        <CookieConsent />
        <Analytics />
      </body>
    </html>
  );
}
