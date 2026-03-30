"use client";
import { createContext, useContext, useState, useCallback, useEffect } from "react";

type SidebarContextType = {
  collapsed: boolean;
  toggleSidebar: () => void;
  ready: boolean;
};

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  toggleSidebar: () => {},
  ready: false,
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("gloria-sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
    requestAnimationFrame(() => setReady(true));
  }, []);

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("gloria-sidebar-collapsed", String(next));
      return next;
    });
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, toggleSidebar, ready }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
