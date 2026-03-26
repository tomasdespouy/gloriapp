"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Global navigation progress bar.
 * Shows an animated bar at the top of the viewport on every route change.
 * Inspired by NProgress but zero-dependency.
 */
export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevUrl = useRef("");

  const cleanup = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  // Start progress bar
  const start = useCallback(() => {
    cleanup();
    setProgress(0);
    setVisible(true);
    setActive(true);

    // Fast initial jump, then slow trickle
    let p = 0;
    intervalRef.current = setInterval(() => {
      p += p < 30 ? 8 : p < 60 ? 3 : p < 80 ? 1 : 0.3;
      if (p > 95) p = 95;
      setProgress(p);
    }, 150);
  }, [cleanup]);

  // Complete progress bar
  const done = useCallback(() => {
    cleanup();
    setProgress(100);
    setActive(false);

    timeoutRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 300);
  }, [cleanup]);

  // Detect route changes via pathname + searchParams
  useEffect(() => {
    const url = pathname + searchParams.toString();
    if (prevUrl.current && prevUrl.current !== url) {
      done();
    }
    prevUrl.current = url;
  }, [pathname, searchParams, done]);

  // Intercept link clicks to start progress immediately
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto:")) return;
      if (anchor.target === "_blank") return;
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;

      // Same page — skip
      const current = window.location.pathname + window.location.search;
      if (href === current) return;

      start();
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [start]);

  // Safety: if active for too long (10s), force complete
  useEffect(() => {
    if (!active) return;
    const safety = setTimeout(done, 10000);
    return () => clearTimeout(safety);
  }, [active, done]);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none">
      <div
        className="h-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
