"use client";

import { useEffect, useRef, useState } from "react";
import { Undo2, CheckCircle2, AlertCircle, Loader2, Upload } from "lucide-react";

/**
 * Campo del logo institucional. Dos caminos hacia el mismo valor:
 *
 *  - Subir un archivo desde el computador (o soltarlo sobre la zona): se guarda
 *    en el bucket público `universities` y el campo queda con su URL.
 *  - Pegar una URL pública, para instituciones que ya alojan su logo.
 *
 * Además: vista previa sobre el fondo real de la barra lateral, validación de
 * que la URL carga de verdad, y "Restaurar" para volver al valor anterior.
 *
 * El componente NUNCA guarda en la base: es un input controlado. El formulario
 * dueño del valor lo persiste cuando el usuario envía.
 */

type LoadState = "idle" | "loading" | "ok" | "error";

const ACCEPTED = "image/png,image/jpeg,image/webp,image/svg+xml";
const MAX_SIZE = 2 * 1024 * 1024;

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
  uploadSlug = "",
  label = "Logo de la institución",
  helper,
  placeholder = "https://universidad.cl/logos/marca.png",
}: {
  value: string;
  onChange: (v: string) => void;
  initialValue?: string;
  /** Se usa para nombrar el archivo subido (slug de la institución). */
  uploadSlug?: string;
  label?: string;
  helper?: React.ReactNode;
  placeholder?: string;
}) {
  const [state, setState] = useState<LoadState>("idle");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragging, setDragging] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Validación con retardo: espera a que deje de escribir y recién ahí intenta
  // cargar la imagen, para confirmar que la URL apunta a algo que el navegador
  // realmente puede mostrar.
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

  const upload = async (file: File) => {
    setUploadError("");

    if (!ACCEPTED.split(",").includes(file.type)) {
      setUploadError("Formato no admitido. Usa PNG, JPG, WEBP o SVG.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setUploadError("El archivo supera los 2 MB. Comprime el logo antes de subirlo.");
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("slug", uploadSlug);

      const res = await fetch("/api/admin/establishments/logo", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo subir el logo");

      onChange(data.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "No se pudo subir el logo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

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

      {/* Subir desde el computador */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) upload(file);
        }}
        className={`rounded-lg border border-dashed px-4 py-4 text-center transition-colors ${
          dragging ? "border-sidebar bg-sidebar/5" : "border-gray-200 bg-gray-50/50"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-sidebar text-white text-xs font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {uploading ? "Subiendo…" : "Subir archivo"}
        </button>
        <p className="text-[11px] text-gray-400 mt-1.5">
          o arrastra el archivo aquí — PNG, JPG, WEBP o SVG, hasta 2 MB
        </p>
        {uploadError && (
          <p className="flex items-center justify-center gap-1 text-[11px] text-red-600 mt-1.5">
            <AlertCircle size={12} /> {uploadError}
          </p>
        )}
      </div>

      <p className="text-[11px] text-gray-400">O pega la URL pública del logo:</p>

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

      {/* Estado + vista previa sobre el fondo real de la barra lateral */}
      <div className="flex items-start gap-3">
        <div className="w-40 h-16 rounded-lg bg-sidebar flex items-center justify-center overflow-hidden flex-shrink-0 p-2">
          {state === "loading" && <Loader2 size={16} className="animate-spin text-white/60" />}
          {state === "ok" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Vista previa del logo"
              className="max-w-full max-h-full object-contain"
            />
          )}
          {(state === "idle" || state === "error") && (
            <span className="text-[10px] text-white/40">sin vista previa</span>
          )}
        </div>

        <div className="flex-1 text-[11px] space-y-0.5 mt-0.5">
          {state === "ok" && (
            <p className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 size={12} /> Imagen válida. Así se verá en la barra lateral.
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
              Sube el archivo o pega una URL pública directa (.png, .jpg, .svg).
            </p>
          )}
          <p className="text-gray-400">
            El logo se guarda al presionar {initialValue ? "«Guardar cambios»" : "«Crear institución»"}.
          </p>
          {helper && <div className="text-gray-400">{helper}</div>}
        </div>
      </div>
    </div>
  );
}
