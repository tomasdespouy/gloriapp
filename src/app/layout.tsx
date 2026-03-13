import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

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
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="ml-[260px] flex-1 bg-bg-main">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
