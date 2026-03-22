import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Planta Mo — Dashboard Operacional",
  robots: "noindex, nofollow",
};

export default function PaulinaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
