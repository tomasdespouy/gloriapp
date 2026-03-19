"use client";

import { useEffect, useRef } from "react";

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds

/**
 * Invisible component that pings /api/activity every 30s
 * while the browser tab is visible. Tracks total platform time.
 */
export default function PlatformActivityTracker() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const ping = () => {
      if (document.visibilityState === "visible") {
        navigator.sendBeacon("/api/activity");
      }
    };

    // Start heartbeat
    intervalRef.current = setInterval(ping, HEARTBEAT_INTERVAL);

    // Pause when tab is hidden, resume when visible
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
      } else {
        if (!intervalRef.current) {
          ping(); // Immediate ping on return
          intervalRef.current = setInterval(ping, HEARTBEAT_INTERVAL);
        }
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
