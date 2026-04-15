"use client";

import { useEffect, useRef, useState } from "react";
import { Undo2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

/**
 * Reusable URL field for an institutional logo with:
 *  - Real preview (tries to load the image)
 *  - Clear error message if the URL doesn't point to a valid image
 *  - "Restaurar" button to revert to the initial value
 *  - Lightweight URL format validation before even attempting load
 *
 * The component NEVER writes anywhere by itself — it's a controlled
 * input. Parent owns the value and persists it when it wants.
 */

type LoadState = "idle" | "loading" | "ok" | "error";

function isLikelyImageUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    return true;
  } catch {
    return false;
  }
}

export default function LogoUrlField({
  value,
  onChange,
  initialValue = "",
  label = "Logo de la institución",
  helper,
  placeholder = "https://universidad.cl/logos/marca.png",
}: {
  value: string;
  onChange: (v: string) => void;
  initialValue?: string;
  label?: string;
  helper?: React.ReactNode;
  placeholder?: string;
}) {
  const [state, setState] = useState<LoadState>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced validation: wait for the user to stop typing, then try
  // to actually load the image to confirm the URL points to a real
  // resource a browser would render.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = value.trim();

    if (!trimmed) {
      setState("idle");
      return;
    }
    if (!isLikelyImageUrl(trimmed)) {
      setState("error");
      return;
    }

    setState("loading");
    debounceRef.current = setTimeout(() => {
      const img = new window.Image();
      img.onload = () => setState("ok");
      img.onerror = () => setState("error");
      img.src = trimmed;
    }, 450);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const canRestore = value !== initialValue;

  const borderClass =
    state === "error"
      ? "border-red-300 focus-within:ring-red-300"
      : state === "ok"
        ? "border-emerald-300 focus-within:ring-emerald-300"
        : "border-gray-200 focus-within:ring-sidebar/30";

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-600">{label}</label>

      <div className={`flex items-stretch gap-2 rounded-lg border focus-within:ring-2 bg-white ${borderClass}`}>
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm bg-transparent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onChange(initialValue)}
          disabled={!canRestore}
          title="Restaurar al valor anterior"
          className="flex items-center gap-1 px-2.5 text-xs text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          <Undo2 size={12} />
          Restaurar
        </button>
      </div>

      {/* Status + preview */}
      <div className="flex items-start gap-3">
        <div className="w-40 h-16 rounded-lg border border-gray-100 bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
          {state === "loading" && (
            <Loader2 size={16} className="animate-spin text-gray-400" />
          )}
          {state === "ok" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Vista previa del logo"
              className="max-w-full max-h-full object-contain"
            />
          )}
          {(state === "idle" || state === "error") && (
            <span className="text-[10px] text-gray-300">sin vista previa</span>
          )}
        </div>

        <div className="flex-1 text-[11px] space-y-0.5 mt-0.5">
          {state === "ok" && (
            <p className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 size={12} /> URL válida, imagen carga correctamente.
            </p>
          )}
          {state === "error" && (
            <p className="flex items-center gap-1 text-red-600">
              <AlertCircle size={12} />
              No se pudo cargar la imagen. Verifica que sea una URL directa a un
              archivo (.png, .jpg, .svg) y no una página de búsqueda.
            </p>
          )}
          {state === "loading" && (
            <p className="flex items-center gap-1 text-gray-400">
              <Loader2 size={12} className="animate-spin" /> Validando…
            </p>
          )}
          {state === "idle" && (
            <p className="text-gray-400">
              Pega una URL pública directa al archivo (.png, .jpg, .svg).
            </p>
          )}
          {helper && <div className="text-gray-400">{helper}</div>}
        </div>
      </div>
    </div>
  );
}
