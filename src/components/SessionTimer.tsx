"use client";

/**
 * SessionTimer — Componente aislado para el temporizador de sesión.
 *
 * IMPORTANTE: Este componente está separado de ChatInterface.tsx a propósito.
 * NO debe modificarse al hacer cambios en el chat, notas, voz, o silencio.
 * Solo se modifica si cambia la lógica del temporizador en sí.
 *
 * Responsabilidades:
 * - Cuenta wall-clock time desde que la sesión inicia
 * - Muestra MM:SS en el header del chat
 * - Persiste active_seconds a BD cada 15s
 * - Envía beacon al desmontar para no perder tiempo
 * - Expone activeSeconds via onTick callback para uso externo
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Clock } from "lucide-react";

interface SessionTimerProps {
  /** Whether the session has started */
  sessionStarted: boolean;
  /** Conversation ID (needed for persistence) */
  conversationId?: string;
  /** Seconds carried over from a previous/resumed session */
  initialActiveSeconds: number;
  /** Called every second with the current elapsed seconds */
  onTick?: (seconds: number) => void;
}

export default function SessionTimer({
  sessionStarted,
  conversationId,
  initialActiveSeconds,
  onTick,
}: SessionTimerProps) {
  const [displaySeconds, setDisplaySeconds] = useState(initialActiveSeconds);
  const sessionStartRef = useRef(initialActiveSeconds > 0 ? Date.now() : 0);
  const activeSecondsRef = useRef(initialActiveSeconds);
  const onTickRef = useRef(onTick);

  // Keep callback ref fresh without re-triggering effect
  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    if (!sessionStarted) return;

    // Set start time when session begins (if not already set from resume)
    if (sessionStartRef.current === 0) {
      sessionStartRef.current = Date.now();
    }
    const start = sessionStartRef.current;

    const tick = () => {
      const elapsed = initialActiveSeconds + Math.round((Date.now() - start) / 1000);
      activeSecondsRef.current = elapsed;
      setDisplaySeconds(elapsed);
      onTickRef.current?.(elapsed);
    };

    const interval = setInterval(tick, 1000);

    // Persist every 15 seconds
    const persistInterval = setInterval(() => {
      if (conversationId && activeSecondsRef.current > 0) {
        fetch(`/api/sessions/${conversationId}/active-time`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active_seconds: activeSecondsRef.current }),
        }).catch(() => {});
      }
    }, 15000);

    return () => {
      clearInterval(interval);
      clearInterval(persistInterval);
      // Final persist on unmount
      if (conversationId && activeSecondsRef.current > 0) {
        navigator.sendBeacon?.(
          `/api/sessions/${conversationId}/active-time`,
          new Blob(
            [JSON.stringify({ active_seconds: activeSecondsRef.current })],
            { type: "application/json" }
          )
        );
      }
    };
  }, [conversationId, sessionStarted, initialActiveSeconds]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-400 tabular-nums flex-shrink-0">
      <Clock size={13} />
      {formatTimer(displaySeconds)}
    </span>
  );
}

/**
 * Hook para acceder al activeSeconds desde ChatInterface sin re-render del timer.
 * Uso: const activeSecondsRef = useActiveSecondsRef();
 */
export function useActiveSecondsRef() {
  const ref = useRef(0);
  const updateRef = useCallback((seconds: number) => {
    ref.current = seconds;
  }, []);
  return { ref, updateRef };
}
