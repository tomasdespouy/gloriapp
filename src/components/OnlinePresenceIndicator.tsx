"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, GripVertical, X } from "lucide-react";

/**
 * Cápsula flotante y arrastrable con las personas conectadas ahora, para
 * superadmin (todos) y admin (sus estudiantes y docentes). El alcance lo
 * decide /api/presence/online con el rol real; acá solo se pinta.
 * Adaptado del indicador de superadmin de Perro Leo.
 */

type Persona = {
  id: string;
  name: string;
  role: string;
  inSessionWith: string | null;
  detail: string | null;
};
type Posicion = { left: number; top: number };

const POLL_MS = 20_000;
const STORAGE_KEY = "gloria:presencia-posicion";
const ANCHO_PANEL = 320;
const ANCHO_CERRADA = 150; // cápsula cerrada aprox., solo para la posición inicial

const ROLE_LABEL: Record<string, string> = {
  student: "Estudiante",
  instructor: "Docente",
  admin: "Admin",
  superadmin: "Superadmin",
};

function nombreCorto(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length < 2) return partes[0] || "Usuario";
  return `${partes[0]} ${partes[partes.length - 1][0]}.`;
}

function leerPosicion(): Posicion | null {
  try {
    const valor = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return valor && Number.isFinite(valor.left) && Number.isFinite(valor.top) ? valor : null;
  } catch {
    return null;
  }
}

// Se limita con el ancho REAL de lo que se ve: con el del panel abierto, la
// cápsula cerrada nunca llegaba al borde derecho.
function limitar(p: Posicion, ancho: number, alto: number, anchoCapsula: number, altoCapsula = 44): Posicion {
  return {
    left: Math.max(12, Math.min(p.left, Math.max(12, ancho - anchoCapsula - 12))),
    top: Math.max(12, Math.min(p.top, Math.max(12, alto - altoCapsula - 12))),
  };
}

/** Verde que late si hay alguien conectado; gris si no hay nadie. */
function Luz({ encendida }: { encendida: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
      {encendida && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${encendida ? "bg-emerald-500" : "bg-gray-300"}`} />
    </span>
  );
}

export default function OnlinePresenceIndicator() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [actualizado, setActualizado] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [todas, setTodas] = useState(false);
  const [posicion, setPosicion] = useState<Posicion | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [, forzarTick] = useState(0);
  const raizRef = useRef<HTMLDivElement>(null);
  const arrastreRef = useRef<{ dx: number; dy: number } | null>(null);
  const medida = () => ({ w: raizRef.current?.offsetWidth ?? 140, h: raizRef.current?.offsetHeight ?? 44 });

  // La posición depende de window: se fija después del montaje.
  useEffect(() => {
    setPosicion(leerPosicion() ?? { left: Math.max(12, window.innerWidth - ANCHO_CERRADA - 24), top: 80 });
  }, []);

  const cargar = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const res = await fetch("/api/presence/online", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { online: Persona[] };
      setPersonas(data.online);
      setActualizado(Date.now());
      setError(false);
    } catch {
      // El indicador nunca debe interrumpir el trabajo en la plataforma.
      setError(true);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
    const id = window.setInterval(() => void cargar(), POLL_MS);
    const tick = window.setInterval(() => forzarTick((n) => n + 1), 5_000);
    const volver = () => { if (document.visibilityState === "visible") void cargar(); };
    document.addEventListener("visibilitychange", volver);
    return () => {
      window.clearInterval(id);
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", volver);
    };
  }, [cargar]);

  useEffect(() => {
    const reajustar = () => setPosicion((p) => (p ? limitar(p, window.innerWidth, window.innerHeight, medida().w, medida().h) : p));
    window.addEventListener("resize", reajustar);
    return () => window.removeEventListener("resize", reajustar);
  }, []);

  useEffect(() => {
    if (!arrastrando) return;
    const mover = (e: PointerEvent) => {
      if (!arrastreRef.current) return;
      const { w, h } = medida();
      setPosicion(limitar({ left: e.clientX - arrastreRef.current.dx, top: e.clientY - arrastreRef.current.dy }, window.innerWidth, window.innerHeight, w, h));
    };
    const soltar = () => {
      setArrastrando(false);
      arrastreRef.current = null;
      setPosicion((p) => {
        try { if (p) localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* sin almacenamiento */ }
        return p;
      });
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar, { once: true });
    return () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };
  }, [arrastrando]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => { if (!raizRef.current?.contains(e.target as Node)) setAbierto(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  // Primero quienes están en sesión, después docentes, después el resto.
  const ordenadas = useMemo(() => {
    const rango = (p: Persona) => (p.inSessionWith ? 0 : p.role === "instructor" ? 1 : 2);
    return [...personas].sort((a, b) => rango(a) - rango(b));
  }, [personas]);

  if (!posicion) return null;

  const enSesion = personas.filter((p) => p.inSessionWith).length;
  const docentes = personas.filter((p) => p.role === "instructor").length;
  const otras = personas.length - enSesion - docentes;
  const visibles = todas ? ordenadas : ordenadas.slice(0, 6);
  const antiguedad = actualizado == null ? null : Math.max(0, Math.floor((Date.now() - actualizado) / 1000));
  const sinConexion = error && actualizado == null;
  const hayGente = !cargando && !sinConexion && personas.length > 0;
  const etiqueta = personas.length === 1 ? "conectada" : "conectadas";

  // Abierto, el panel es más ancho: si la cápsula está pegada a la derecha se
  // corre mientras está abierto y vuelve a su lugar al cerrarlo.
  const left = abierto
    ? Math.max(12, Math.min(posicion.left, window.innerWidth - Math.min(ANCHO_PANEL, window.innerWidth - 24) - 12))
    : posicion.left;
  const top = abierto
    ? Math.min(posicion.top, Math.max(12, window.innerHeight - Math.min(window.innerHeight * 0.6, 520) - 12))
    : posicion.top;

  function iniciarArrastre(e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    const rect = raizRef.current?.getBoundingClientRect();
    if (!rect) return;
    arrastreRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setArrastrando(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function restablecer() {
    setPosicion({ left: Math.max(12, window.innerWidth - ANCHO_CERRADA - 24), top: 80 });
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* sin almacenamiento */ }
  }

  const asa = (
    <button
      type="button"
      onPointerDown={iniciarArrastre}
      aria-label="Mover el indicador de personas conectadas"
      title="Arrastrar"
      className="flex h-10 w-9 items-center justify-center text-gray-400 hover:text-sidebar touch-none cursor-grab active:cursor-grabbing"
    >
      <GripVertical size={16} aria-hidden />
    </button>
  );

  return (
    <div ref={raizRef} className="fixed z-[60] print:hidden" style={{ left, top }}>
      {!abierto ? (
        <div className="flex items-center rounded-full border border-[#E5E5E5] bg-white shadow-lg">
          {asa}
          <button
            type="button"
            onClick={() => setAbierto(true)}
            aria-expanded="false"
            aria-label={`${personas.length} personas conectadas. Abrir detalle`}
            className="flex h-10 items-center gap-2 rounded-r-full pl-1 pr-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 cursor-pointer"
          >
            <Luz encendida={hayGente} />
            {cargando ? <span aria-hidden>···</span> : sinConexion ? <span aria-hidden>—</span> : <span>{personas.length}</span>}
            <span className="hidden sm:inline font-normal text-gray-500">{sinConexion ? "sin conexión" : etiqueta}</span>
            <ChevronDown size={14} className="text-gray-400" aria-hidden />
          </button>
        </div>
      ) : (
        <section
          role="dialog"
          aria-label="Personas conectadas"
          className="flex max-h-[60vh] w-[min(320px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white shadow-xl"
        >
          <div className="flex items-center border-b border-gray-100 pr-2">
            {asa}
            <button type="button" onClick={() => setAbierto(false)} className="flex h-11 min-w-0 flex-1 items-center justify-between gap-2 text-left text-sm font-semibold text-gray-900 cursor-pointer">
              <span className="flex items-center gap-2"><Luz encendida={hayGente} />{personas.length} {etiqueta}</span>
              <ChevronUp size={14} className="text-gray-400 shrink-0" aria-hidden />
            </button>
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 sm:hidden">
              <X size={16} aria-hidden />
            </button>
          </div>
          <div className="border-b border-gray-100 px-4 py-2 text-[11px] text-gray-500" aria-live="polite">
            {enSesion} en sesión · {docentes} {docentes === 1 ? "docente" : "docentes"} · {otras} en la plataforma
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-1">
            {visibles.length === 0 ? (
              <p className="py-5 text-center text-xs text-gray-400">{sinConexion ? "Sin conexión" : "No hay personas conectadas."}</p>
            ) : visibles.map((p) => (
              <div key={p.id} className="border-b border-gray-50 py-2 last:border-0">
                <div className="flex min-w-0 items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium text-gray-900">{nombreCorto(p.name)}</span>
                  <span className={`shrink-0 text-[11px] ${p.inSessionWith ? "font-semibold text-emerald-600" : "text-gray-500"}`}>
                    {p.inSessionWith ? "En sesión" : ROLE_LABEL[p.role] ?? p.role}
                  </span>
                </div>
                <p className="truncate text-[11px] text-gray-400">
                  {[p.inSessionWith ? `con ${p.inSessionWith}` : null, p.detail].filter(Boolean).join(" · ") || "Sin asignatura"}
                </p>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-500 space-y-1">
            {ordenadas.length > 6 && (
              <button type="button" onClick={() => setTodas((v) => !v)} className="block font-semibold text-sidebar hover:underline cursor-pointer">
                {todas ? "Mostrar menos" : `Ver las ${ordenadas.length}`}
              </button>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className={error ? "text-red-500" : ""}>
                {sinConexion ? "Sin conexión" : actualizado == null ? "Cargando…" : `Actualizado hace ${antiguedad ?? 0} s`}
              </span>
              <Link href="/admin/metricas" className="font-medium text-sidebar hover:underline">Monitor completo</Link>
            </div>
            <button type="button" onClick={restablecer} className="block hover:text-gray-800 hover:underline cursor-pointer">Restablecer posición</button>
          </div>
        </section>
      )}
    </div>
  );
}
