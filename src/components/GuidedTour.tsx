"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/**
 * Recorrido guiado de la plataforma para alumnos de un programa de
 * certificación. Se dispara solo la primera vez (después del video de
 * bienvenida, si aún no lo vio) y se puede repetir siempre desde el botón de
 * ayuda del header (evento "gloria:start-platform-tour").
 *
 * "Ya lo vio" vive en localStorage por usuario: es una conveniencia por
 * navegador, no un dato de negocio, así que no hay columna ni migración.
 */

export type GuidedTourConfig = {
  minHoursBetweenSessions: number;
  feedbackMode: "auto" | "docente";
  emailNotifications: boolean;
  minSessionMinutes: number | null;
  maxSessionMinutes: number | null;
  blockPaste: boolean;
  watchTabSwitch: boolean;
};

type Step = {
  title: string;
  body: string;
  /** Selector CSS del elemento a destacar. Sin él (o si no se ve), el paso va centrado. */
  target?: string;
  placement?: "right" | "below-end";
};

const POPOVER_W = 340;
const PAD = 6;

function buildSteps(c: GuidedTourConfig): Step[] {
  const duracion = c.minSessionMinutes && c.maxSessionMinutes
    ? `Se espera una sesión de entre ${c.minSessionMinutes} y ${c.maxSessionMinutes} minutos. `
    : c.minSessionMinutes
      ? `Se espera una sesión de al menos ${c.minSessionMinutes} minutos. `
      : "";
  const guardia: string[] = [];
  if (c.blockPaste) guardia.push("no se puede pegar texto largo");
  if (c.watchTabSwitch) guardia.push("cambiar de pestaña queda registrado");
  const guardiaTxt = guardia.length ? `Para cuidar tu atención, ${guardia.join(" y ")}. ` : "";

  return [
    {
      title: "Bienvenida al programa",
      body: "Este recorrido dura un minuto y te muestra dónde está cada cosa. Puedes volver a verlo cuando quieras desde el botón de ayuda (?) de la barra superior.",
    },
    {
      title: "Pacientes",
      body: "Aquí están todos los pacientes de GlorIA. Los que están habilitados para tu programa aparecen primero y a color; los grises todavía no están disponibles para ti.",
      target: 'a[href="/pacientes"]',
      placement: "right",
    },
    {
      title: "Tu primera sesión y las siguientes",
      body: `Tu primera sesión la inicias de inmediato desde la tarjeta del paciente. Desde la segunda debes agendar día y hora —siempre en hora de Chile— con al menos ${c.minHoursBetweenSessions} horas desde que termine la anterior. Puedes reagendar para adelantarla o posponerla.`,
    },
    {
      title: "Dentro de la sesión",
      body: `La conversación es por texto y el paciente reacciona como lo haría una persona real. ${duracion}${guardiaTxt}Al terminar, cierra con una despedida o acordando una próxima sesión.`,
    },
    {
      title: "Tu retroalimentación",
      body: c.feedbackMode === "docente"
        ? `Tu docente revisa cada sesión antes de entregarte la retroalimentación. Te avisamos aquí, en la campana${c.emailNotifications ? ", y también por correo" : ""}, cuando esté lista.`
        : "Al terminar cada sesión recibes retroalimentación automática, y te avisamos aquí, en la campana.",
      target: '[data-tour="notifications"]',
      placement: "below-end",
    },
    {
      title: "¿Dudas más adelante?",
      body: "Desde este botón puedes volver a ver el video de bienvenida y este recorrido. Dentro de una sesión también encontrarás la guía del chat.",
      target: '[data-tour="help"]',
      placement: "below-end",
    },
  ];
}

export default function GuidedTour({
  userId,
  welcomeVideoSeen,
  config,
}: {
  userId: string;
  /** profiles.welcome_video_seen_at: si es false, el recorrido espera a que se cierre el video. */
  welcomeVideoSeen: boolean;
  config: GuidedTourConfig;
}) {
  const doneKey = `gloria_platform_tour_done:${userId}`;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const waitingForVideo = useRef(false);
  const steps = buildSteps(config);
  const current = steps[step];

  const start = useCallback(() => {
    setStep(0);
    setOpen(true);
  }, []);

  const finish = useCallback(() => {
    try { localStorage.setItem(doneKey, "1"); } catch { /* noop */ }
    setOpen(false);
  }, [doneKey]);

  // Primera vez: arranca solo, pero después del video si todavía no lo vio.
  useEffect(() => {
    let done = false;
    let videoLocal = false;
    try {
      done = !!localStorage.getItem(doneKey);
      videoLocal = !!localStorage.getItem(`gloria_welcome_seen:${userId}`) || !!localStorage.getItem("gloria_welcome_seen");
    } catch { /* sin localStorage: no se autodispara */ return; }
    if (done) return;

    if (!welcomeVideoSeen && !videoLocal) {
      waitingForVideo.current = true;
      return;
    }
    const t = setTimeout(start, 1200);
    return () => clearTimeout(t);
  }, [doneKey, userId, welcomeVideoSeen, start]);

  // Eventos: cierre del video de bienvenida (primera vez) y repetición manual.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const onVideoClosed = () => {
      if (!waitingForVideo.current) return;
      waitingForVideo.current = false;
      t = setTimeout(start, 500);
    };
    window.addEventListener("gloria:welcome-video-closed", onVideoClosed);
    window.addEventListener("gloria:start-platform-tour", start);
    return () => {
      window.removeEventListener("gloria:welcome-video-closed", onVideoClosed);
      window.removeEventListener("gloria:start-platform-tour", start);
      if (t) clearTimeout(t);
    };
  }, [start]);

  // Ubica el elemento destacado. Si no existe o no se ve (p. ej. sidebar oculto
  // en móvil), el paso se muestra centrado.
  const measure = useCallback(() => {
    if (!open || !current?.target) { setRect(null); return; }
    const el = document.querySelector(current.target) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect(r.width > 0 && r.height > 0 ? r : null);
  }, [open, current]);

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure();
  }, [measure]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, measure, finish]);

  if (!open || !current) return null;

  const isLast = step === steps.length - 1;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const width = Math.min(POPOVER_W, vw - 24);

  let popStyle: React.CSSProperties;
  if (rect && current.placement === "right") {
    popStyle = {
      left: Math.min(rect.right + 16, vw - width - 12),
      top: Math.max(12, Math.min(rect.top - 8, vh - 280)),
      width,
    };
  } else if (rect) {
    popStyle = {
      left: Math.max(12, Math.min(rect.right - width, vw - width - 12)),
      top: rect.bottom + 14,
      width,
    };
  } else {
    popStyle = { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width };
  }

  return (
    <div className="fixed inset-0 z-[95]" role="dialog" aria-modal="true" aria-label="Recorrido de la plataforma">
      {/* Fondo: con foco recortado si hay elemento, oscuro liso si no. */}
      {rect ? (
        <div
          className="absolute rounded-xl pointer-events-none transition-all duration-200"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
            outline: "2px solid rgba(255,255,255,0.9)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/55" />
      )}
      {/* Captura clics para que el recorrido sea guiado y no se interactúe por detrás. */}
      <div className="absolute inset-0" />

      <div className="absolute bg-white rounded-2xl shadow-2xl p-5 animate-pop" style={popStyle}>
        <button
          onClick={finish}
          aria-label="Cerrar recorrido"
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 cursor-pointer"
        >
          <X size={16} />
        </button>
        <h3 className="text-base font-bold text-gray-900 pr-6 mb-2">{current.title}</h3>
        <p className="text-sm text-gray-600 leading-relaxed">{current.body}</p>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <span className="text-[10px] text-gray-400">{step + 1} de {steps.length}</span>
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">
                &larr; Atrás
              </button>
            )}
            {isLast ? (
              <button onClick={finish} className="bg-sidebar text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#354080] transition-colors cursor-pointer">
                Terminar
              </button>
            ) : (
              <button onClick={() => setStep(step + 1)} className="bg-sidebar text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#354080] transition-colors cursor-pointer">
                Siguiente &rarr;
              </button>
            )}
          </div>
        </div>
        {!isLast && (
          <button onClick={finish} className="mt-2 text-[11px] text-gray-400 hover:text-gray-600 cursor-pointer">
            Omitir recorrido
          </button>
        )}
      </div>
    </div>
  );
}
