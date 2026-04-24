"use client";

import { useEffect, useRef, useState } from "react";
import { Accessibility, Check } from "lucide-react";

export type A11yPrefs = {
  fontSize?: "m" | "l" | "xl";
  contrast?: "default" | "high";
};

const FONT_OPTIONS: { key: NonNullable<A11yPrefs["fontSize"]>; label: string; sample: string }[] = [
  { key: "m", label: "Medio", sample: "Aa" },
  { key: "l", label: "Grande", sample: "Aa" },
  { key: "xl", label: "Extra grande", sample: "Aa" },
];

const CONTRAST_OPTIONS: { key: NonNullable<A11yPrefs["contrast"]>; label: string }[] = [
  { key: "default", label: "Estándar" },
  { key: "high", label: "Alto contraste" },
];

function applyPrefsToDom(prefs: A11yPrefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // Font size classes are mutually exclusive
  root.classList.remove("a11y-font-m", "a11y-font-l", "a11y-font-xl");
  root.classList.add(`a11y-font-${prefs.fontSize || "m"}`);
  // Contrast
  root.classList.remove("contrast-high");
  if (prefs.contrast === "high") root.classList.add("contrast-high");
}

export default function AccessibilityButton({ initialPrefs }: { initialPrefs: A11yPrefs }) {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<A11yPrefs>(initialPrefs);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Apply the server-side initial prefs on mount (before paint where possible).
  useEffect(() => {
    applyPrefsToDom(prefs);
  }, [prefs]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const save = (next: A11yPrefs) => {
    setPrefs(next);
    applyPrefsToDom(next);
    // Persist in background; if this fails, the DOM change remains for
    // this session — next reload would revert to the server's value.
    fetch("/api/profile/a11y", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => { /* noop */ });
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Accesibilidad"
        title="Accesibilidad"
        className="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
      >
        <Accessibility size={18} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Ajustes de accesibilidad"
          className="fixed left-3 right-3 top-14 w-auto sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-72 z-[200] bg-white rounded-xl shadow-2xl border border-gray-100 p-4 animate-fade-in text-gray-900"
        >
          <p className="text-xs font-semibold text-gray-900 mb-0.5">Accesibilidad</p>
          <p className="text-[11px] text-gray-500 mb-3">
            Tus preferencias te siguen entre dispositivos.
          </p>

          <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-400 mb-1.5">
            Tamaño de letra
          </p>
          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {FONT_OPTIONS.map((opt) => {
              const active = (prefs.fontSize || "m") === opt.key;
              const sampleSize = opt.key === "xl" ? "text-xl" : opt.key === "l" ? "text-base" : "text-sm";
              return (
                <button
                  key={opt.key}
                  onClick={() => save({ ...prefs, fontSize: opt.key })}
                  className={`flex flex-col items-center gap-0.5 py-2 rounded-lg border cursor-pointer transition-colors ${
                    active ? "border-sidebar bg-sidebar/10 text-sidebar" : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <span className={`font-semibold ${sampleSize}`}>{opt.sample}</span>
                  <span className="text-[10px]">{opt.label}</span>
                </button>
              );
            })}
          </div>

          <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-400 mb-1.5">
            Contraste
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {CONTRAST_OPTIONS.map((opt) => {
              const active = (prefs.contrast || "default") === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => save({ ...prefs, contrast: opt.key })}
                  className={`flex items-center justify-center gap-1 py-2 text-xs rounded-lg border cursor-pointer transition-colors ${
                    active ? "border-sidebar bg-sidebar/10 text-sidebar font-semibold" : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {active && <Check size={12} />}
                  {opt.label}
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-gray-400 mt-3">
            Afecta principalmente el chat, los mensajes y los formularios.
          </p>
        </div>
      )}
    </div>
  );
}
