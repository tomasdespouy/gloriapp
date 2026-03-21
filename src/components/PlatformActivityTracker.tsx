"use client";

import { useEffect, useRef } from "react";

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds
const PRESENCE_INTERVAL = 60_000; // 60 seconds

/**
 * Invisible component that pings /api/activity every 30s
 * and /api/presence every 60s while the browser tab is visible.
 * Tracks total platform time and online presence.
 */
export default function PlatformActivityTracker() {
  const activityRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const presenceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const pingActivity = () => {
      if (document.visibilityState === "visible") {
        navigator.sendBeacon("/api/activity");
      }
    };

    const pingPresence = () => {
      if (document.visibilityState === "visible") {
        navigator.sendBeacon("/api/presence");
      }
    };

    // Start heartbeats
    activityRef.current = setInterval(pingActivity, HEARTBEAT_INTERVAL);
    presenceRef.current = setInterval(pingPresence, PRESENCE_INTERVAL);
    // Immediate presence ping on mount
    pingPresence();

    // Pause when tab is hidden, resume when visible
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (activityRef.current) clearInterval(activityRef.current);
        activityRef.current = null;
        if (presenceRef.current) clearInterval(presenceRef.current);
        presenceRef.current = null;
      } else {
        if (!activityRef.current) {
          pingActivity(); // Immediate ping on return
          activityRef.current = setInterval(pingActivity, HEARTBEAT_INTERVAL);
        }
        if (!presenceRef.current) {
          pingPresence();
          presenceRef.current = setInterval(pingPresence, PRESENCE_INTERVAL);
        }
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (activityRef.current) clearInterval(activityRef.current);
      if (presenceRef.current) clearInterval(presenceRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
