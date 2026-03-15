import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GloriA",
  description: "Plataforma de Pacientes IA - Universidad Gabriela Mistral",
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
