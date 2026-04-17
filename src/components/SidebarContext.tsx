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
  //
  // Also applies a `.app-locked` class to <body> while the user is
  // inside the (app) layout. Without this, iOS Safari auto-scrolls the
  // document body when the chat input gains focus, which leaves the
  // keyboard partially covering the input even when --app-vh is set.
  // The class pins the body to the viewport (position: fixed); marketing
  // / landing pages never receive it because SidebarProvider only mounts
  // under (app)/layout.tsx.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(hover: none)").matches) return;
    document.body.classList.add("app-locked");
    const vv = window.visualViewport;
    if (!vv) {
      return () => { document.body.classList.remove("app-locked"); };
    }
    const root = document.documentElement;
    const update = () => { root.style.setProperty("--app-vh", `${vv.height}px`); };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--app-vh");
      document.body.classList.remove("app-locked");
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
