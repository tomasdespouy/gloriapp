"use client";
import { useSidebar } from "./SidebarContext";

export default function ContentWrapper({ children }: { children: React.ReactNode }) {
  const { collapsed, ready } = useSidebar();
  return (
    <div
      style={ready ? { transition: "margin-left 200ms ease-out" } : undefined}
      className={`flex-1 flex flex-col min-h-0 min-w-0 ml-0 ${
        collapsed ? "md:ml-0" : "md:ml-[260px]"
      }`}
    >
      {children}
    </div>
  );
}
