import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Los Bronces \u2014 An\u00e1lisis Mineral\u00f3gico Longitudinal",
  robots: "noindex, nofollow",
};

export default function AngloLayout({ children }: { children: React.ReactNode }) {
  return children;
}
