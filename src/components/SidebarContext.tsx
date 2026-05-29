"use client";
import { createContext, useContext, useState, useCallback, useEffect } from "react";

type SidebarContextType = {
  collapsed: boolean;
  toggleSidebar: () => void;
  /** Programmatic setter. `persist=false` makes the change ephemeral
   *  (does not touch localStorage). Used by the chat route to auto-collapse
   *  on entry and restore on exit without affecting the user's saved
   *  preference. */
  setCollapsed: (value: boolean, persist?: boolean) => void;
  ready: boolean;
};

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  toggleSidebar: () => {},
  setCollapsed: () => {},
  ready: false,
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("gloria-sidebar-collapsed");
      if (saved === "true") setCollapsedState(true);
    } catch {
      // localStorage unavailable
    }
    requestAnimationFrame(() => setReady(true));
  }, []);

  const toggleSidebar = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      try { localStorage.setItem("gloria-sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  }, []);

  const setCollapsed = useCallback((value: boolean, persist: boolean = true) => {
    setCollapsedState(value);
    if (persist) {
      try { localStorage.setItem("gloria-sidebar-collapsed", String(value)); } catch {}
    }
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, toggleSidebar, setCollapsed, ready }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
