"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, PlayCircle, Compass, MessageSquare } from "lucide-react";

/**
 * Botón de ayuda del header (programa de certificación). Reabre, cuando el
 * alumno quiera, el video de bienvenida, el recorrido de la plataforma y —si
 * está dentro de una sesión— la guía del chat. Se comunica por eventos de
 * ventana para no acoplarse a los componentes que los muestran.
 */
export default function HelpMenuButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const inChat = pathname?.startsWith("/chat/") ?? false;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const fire = (name: string) => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent(name));
  };

  const items = [
    { label: "Ver video de bienvenida", icon: PlayCircle, event: "gloria:replay-welcome-video" },
    { label: "Ver recorrido de la plataforma", icon: Compass, event: "gloria:start-platform-tour" },
    ...(inChat ? [{ label: "Ver guía del chat", icon: MessageSquare, event: "gloria:open-chat-tour" }] : []),
  ];

  return (
    <div ref={ref} className="relative" data-tour="help">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Ayuda"
        title="Ayuda"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/15 transition-all cursor-pointer hover:scale-105"
      >
        <HelpCircle size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-700">Ayuda</p>
          </div>
          {items.map(({ label, icon: Icon, event }) => (
            <button
              key={event}
              onClick={() => fire(event)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <Icon size={16} className="text-sidebar flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
