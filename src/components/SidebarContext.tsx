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
    try {
      const saved = localStorage.getItem("gloria-sidebar-collapsed");
      if (saved === "true") setCollapsed(true);
    } catch {
      // localStorage unavailable
    }
    requestAnimationFrame(() => setReady(true));
  }, []);

  // Mobile-only: publish the true visible viewport height as `--app-vh`
  // so the app layout (which uses `h-[var(--app-vh,100dvh)]`) contracts
  // when the soft keyboard opens. Desktop is unaffected because the
  // variable is never set and the layout falls back to `100dvh`.
  // Lives here (not in ChatInterface) so ALL authenticated pages share
  // the behavior, and fixes the previous bug where only the chat wrapper
  // shrank while its parent kept the pre-keyboard size.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    if (!window.matchMedia("(hover: none)").matches) return;
    const root = document.documentElement;
    const update = () => { root.style.setProperty("--app-vh", `${vv.height}px`); };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--app-vh");
    };
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
