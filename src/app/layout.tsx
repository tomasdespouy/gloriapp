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
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            if (localStorage.getItem('theme') === 'dark') {
              document.documentElement.classList.add('dark');
            }
          } catch {}
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
