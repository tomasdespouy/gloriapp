"use client";

/**
 * SessionTimer — Componente aislado para el temporizador de sesión.
 *
 * IMPORTANTE: Este componente está separado de ChatInterface.tsx a propósito.
 * NO debe modificarse al hacer cambios en el chat, notas, voz, o silencio.
 * Solo se modifica si cambia la lógica del temporizador en sí.
 *
 * Responsabilidades:
 * - Cuenta el tiempo REAL de trabajo: no corre con la pestaña oculta ni
 *   después de que la sesión terminó
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
  /**
   * La sesión ya terminó (el paciente se retiró, o se cerró formalmente).
   * El reloj se detiene aquí y no cuando el alumno cierra la ventana: antes,
   * dejar la pestaña abierta tras la despedida sumaba media hora que nadie
   * trabajó.
   */
  sessionEnded?: boolean;
  /** Conversation ID (needed for persistence) */
  conversationId?: string;
  /** Seconds carried over from a previous/resumed session */
  initialActiveSeconds: number;
  /** Called every second with the current elapsed seconds */
  onTick?: (seconds: number) => void;
}

export default function SessionTimer({
  sessionStarted,
  sessionEnded = false,
  conversationId,
  initialActiveSeconds,
  onTick,
}: SessionTimerProps) {
  const [displaySeconds, setDisplaySeconds] = useState(initialActiveSeconds);

  // Segundos ya acumulados y confirmados. A diferencia de la versión anterior,
  // NO se deriva de un único instante de inicio: se va sumando por tramos, y
  // los tramos en que la pestaña está oculta simplemente no se suman.
  const acumuladoRef = useRef(initialActiveSeconds);
  // Instante en que empezó el tramo activo actual. null = el reloj está detenido.
  const tramoDesdeRef = useRef<number | null>(null);
  const onTickRef = useRef(onTick);

  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    if (!sessionStarted || sessionEnded) {
      // Cierra el tramo abierto, si lo había, para no perder lo trabajado.
      if (tramoDesdeRef.current !== null) {
        acumuladoRef.current += Math.round((Date.now() - tramoDesdeRef.current) / 1000);
        tramoDesdeRef.current = null;
        setDisplaySeconds(acumuladoRef.current);
        onTickRef.current?.(acumuladoRef.current);
      }
      return;
    }

    const visible = () =>
      typeof document === "undefined" || document.visibilityState === "visible";

    const abrirTramo = () => {
      if (tramoDesdeRef.current === null) tramoDesdeRef.current = Date.now();
    };
    const cerrarTramo = () => {
      if (tramoDesdeRef.current !== null) {
        acumuladoRef.current += Math.round((Date.now() - tramoDesdeRef.current) / 1000);
        tramoDesdeRef.current = null;
      }
    };

    if (visible()) abrirTramo();

    const total = () =>
      acumuladoRef.current +
      (tramoDesdeRef.current !== null
        ? Math.round((Date.now() - tramoDesdeRef.current) / 1000)
        : 0);

    const tick = () => {
      const t = total();
      setDisplaySeconds(t);
      onTickRef.current?.(t);
    };
    const interval = setInterval(tick, 1000);

    // La pestaña oculta no es trabajo: se cierra el tramo y se reabre al volver.
    const onVisibility = () => {
      if (visible()) abrirTramo();
      else {
        cerrarTramo();
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const persistir = (usarBeacon: boolean) => {
      const t = total();
      if (!conversationId || t <= 0) return;
      const cuerpo = JSON.stringify({ active_seconds: t });
      if (usarBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(
          `/api/sessions/${conversationId}/active-time`,
          new Blob([cuerpo], { type: "application/json" }),
        );
      } else {
        fetch(`/api/sessions/${conversationId}/active-time`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: cuerpo,
        }).catch(() => {});
      }
    };

    const persistInterval = setInterval(() => persistir(false), 15000);

    return () => {
      clearInterval(interval);
      clearInterval(persistInterval);
      document.removeEventListener("visibilitychange", onVisibility);
      cerrarTramo();
      persistir(true);
    };
  }, [conversationId, sessionStarted, sessionEnded, initialActiveSeconds]);

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
