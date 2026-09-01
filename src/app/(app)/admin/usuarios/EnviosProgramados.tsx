"use client";

/**
 * Panel de envíos de credenciales programados.
 *
 * Existe por una razón concreta: hasta ahora el reporte de "a quién le llegó y
 * a quién no" vivía en el estado de React y se perdía al recargar la página. Si
 * un lunes a las 9:00 un curso entero reclama que no recibió sus claves, este
 * panel es el lugar donde se responde, con el motivo por persona.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  CalendarClock, ChevronDown, ChevronRight, X, Loader2,
  CircleCheck, CircleAlert, CircleMinus, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { formatChileDateTime, chileLocalToUtcIso, utcIsoToChileLocal } from "@/lib/datetime-cl";

interface Stats {
  total: number;
  pendientes: number;
  procesando: number;
  enviados: number;
  omitidos: number;
  fallidos: number;
  cancelados: number;
  proximo_envio: string | null;
}

interface Batch {
  id: string;
  label: string | null;
  starts_at: string;
  per_batch: number;
  every_minutes: number;
  reminder_after_days: number | null;
  cancel_requested_at: string | null;
  closed_at: string | null;
  created_at: string;
  stats: Stats | null;
}

interface Fila {
  id: string;
  kind: string;
  email_snapshot: string;
  name_snapshot: string | null;
  send_after: string;
  status: string;
  skip_reason: string | null;
  skip_label: string | null;
  sent_at: string | null;
  last_error: string | null;
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "En espera",
  procesando: "Enviando",
  enviado: "Enviado",
  omitido: "Omitido",
  fallido: "Con error",
  cancelado: "Cancelado",
};

export default function EnviosProgramados({ refreshKey }: { refreshKey: number }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargandoFilas, setCargandoFilas] = useState(false);
  const [reprogramando, setReprogramando] = useState<string | null>(null);
  const pedidoRef = useRef<string | null>(null);
  const [nuevaFecha, setNuevaFecha] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/admin/credential-dispatches");
      const data = await res.json();
      if (res.ok) setBatches(data.batches ?? []);
    } catch {
      // El panel es informativo: si falla, no vale interrumpir al admin.
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, refreshKey]);

  // Mientras haya algo en vuelo, refrescar solo: el worker corre cada 5 min y
  // el admin no debería tener que recargar la página para ver el avance.
  useEffect(() => {
    const enVuelo = batches.some(
      (b) => (b.stats?.pendientes ?? 0) > 0 || (b.stats?.procesando ?? 0) > 0,
    );
    if (!enVuelo) return;
    const t = setInterval(cargar, 60_000);
    return () => clearInterval(t);
  }, [batches, cargar]);

  const verDetalle = async (id: string) => {
    if (abierto === id) {
      setAbierto(null);
      return;
    }
    setAbierto(id);
    setFilas([]);
    setCargandoFilas(true);
    // Marca de cuál petición es esta. Si el admin abre otro lote mientras esta
    // viaja, la respuesta que llegue tarde no debe pisar las filas del que está
    // mirando ahora — mostraría personas de OTRO envío.
    pedidoRef.current = id;
    try {
      const res = await fetch(`/api/admin/credential-dispatches/${id}`);
      const data = await res.json();
      if (pedidoRef.current !== id) return;
      if (res.ok) setFilas(data.filas ?? []);
      else toast.error(data.error || "No se pudo cargar el detalle");
    } catch {
      if (pedidoRef.current === id) toast.error("No se pudo conectar para cargar el detalle");
    } finally {
      if (pedidoRef.current === id) setCargandoFilas(false);
    }
  };

  const cancelar = async (b: Batch) => {
    const pend = (b.stats?.pendientes ?? 0) + (b.stats?.procesando ?? 0);
    if (!confirm(`¿Cancelar este envío? Quedan ${pend} correo(s) sin salir. Los ya enviados no se pueden deshacer.`)) return;
    try {
      const res = await fetch(`/api/admin/credential-dispatches/${b.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "No se pudo cancelar");
        return;
      }
      toast.success(`Envío cancelado. ${data.canceladas} correo(s) no saldrán.`);
      cargar();
    } catch {
      toast.error("No se pudo conectar. El envío NO fue cancelado: vuelve a intentarlo.");
    }
  };

  const reprogramar = async (b: Batch) => {
    if (!nuevaFecha) return;
    const iso = chileLocalToUtcIso(nuevaFecha);

    // Una fecha en el pasado deja todas las filas vencidas y el despachador las
    // manda en la corrida siguiente. Puede ser lo que el admin quiere, pero
    // nunca debería pasarle por accidente al corregir un día.
    if (new Date(iso).getTime() < Date.now()) {
      const ok = confirm(
        "La fecha que elegiste ya pasó. Si continúas, los correos saldrán en los próximos minutos. ¿Seguir?",
      );
      if (!ok) return;
    }

    try {
      const res = await fetch(`/api/admin/credential-dispatches/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: iso }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "No se pudo reprogramar");
        return;
      }
      toast.success(`Envío movido. ${data.movidas} correo(s) reprogramados.`);
      setReprogramando(null);
      cargar();
    } catch {
      toast.error("No se pudo conectar. El envío quedó en su fecha original.");
    }
  };

  if (cargando && !batches.length) return null;
  if (!batches.length) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarClock size={17} className="text-sidebar" />
        <h3 className="text-sm font-bold text-gray-900">Envíos programados</h3>
        <span className="text-xs text-gray-400">({batches.length})</span>
      </div>

      <div className="space-y-2">
        {batches.map((b) => {
          const s = b.stats;
          const cancelado = !!b.cancel_requested_at;
          const enVuelo = (s?.pendientes ?? 0) + (s?.procesando ?? 0);
          return (
            <div key={b.id} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-start gap-3 p-3">
                <button
                  onClick={() => verDetalle(b.id)}
                  className="mt-0.5 text-gray-400 hover:text-gray-700 cursor-pointer shrink-0"
                  aria-label="Ver detalle"
                >
                  {abierto === b.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {b.label || "Envío sin nombre"}
                    {cancelado && <span className="ml-2 text-xs text-red-600">cancelado</span>}
                    {!cancelado && b.closed_at && (
                      <span className="ml-2 text-xs text-gray-400">terminado</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {enVuelo > 0 ? (
                      <>
                        Próximo:{" "}
                        {formatChileDateTime(s?.proximo_envio ?? b.starts_at)}
                        {b.per_batch > 0 && ` · tandas de ${b.per_batch} cada ${b.every_minutes} min`}
                      </>
                    ) : (
                      <>Programado para {formatChileDateTime(b.starts_at)}</>
                    )}
                    {b.reminder_after_days && ` · recordatorio a los ${b.reminder_after_days} día(s)`}
                  </p>

                  {s && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs">
                      {s.enviados > 0 && (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CircleCheck size={12} /> {s.enviados} enviados
                        </span>
                      )}
                      {enVuelo > 0 && (
                        <span className="inline-flex items-center gap-1 text-sidebar">
                          <Clock size={12} /> {enVuelo} en espera
                        </span>
                      )}
                      {s.omitidos > 0 && (
                        <span className="inline-flex items-center gap-1 text-gray-500">
                          <CircleMinus size={12} /> {s.omitidos} omitidos
                        </span>
                      )}
                      {s.fallidos > 0 && (
                        <span className="inline-flex items-center gap-1 text-red-600">
                          <CircleAlert size={12} /> {s.fallidos} con error
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {!cancelado && enVuelo > 0 && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        setReprogramando(reprogramando === b.id ? null : b.id);
                        setNuevaFecha(utcIsoToChileLocal(b.starts_at));
                      }}
                      className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      Mover
                    </button>
                    <button
                      onClick={() => cancelar(b)}
                      className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <X size={12} /> Cancelar
                    </button>
                  </div>
                )}
              </div>

              {reprogramando === b.id && (
                <div className="px-3 pb-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                  <input
                    type="datetime-local"
                    value={nuevaFecha}
                    onChange={(e) => setNuevaFecha(e.target.value)}
                    className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg"
                  />
                  <span className="text-xs text-gray-400">hora de Chile</span>
                  <button
                    onClick={() => reprogramar(b)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-sidebar text-white hover:opacity-90 cursor-pointer"
                  >
                    Guardar
                  </button>
                  <span className="text-xs text-gray-400">
                    Las tandas se mantienen; solo se corre el bloque completo.
                  </span>
                </div>
              )}

              {abierto === b.id && (
                <div className="border-t border-gray-100 bg-gray-50/60 max-h-72 overflow-y-auto">
                  {cargandoFilas ? (
                    <p className="p-3 text-xs text-gray-400 flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" /> Cargando…
                    </p>
                  ) : (
                    <table className="w-full text-xs">
                      <tbody>
                        {filas.map((f) => (
                          <tr key={f.id} className="border-b border-gray-100 last:border-0">
                            <td className="px-3 py-1.5 text-gray-800">
                              {f.name_snapshot || "—"}
                              {f.kind === "recordatorio" && (
                                <span className="ml-1.5 text-[10px] text-sidebar">recordatorio</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-gray-500">{f.email_snapshot}</td>
                            <td className="px-3 py-1.5 text-gray-600">
                              {ESTADO_LABEL[f.status] ?? f.status}
                            </td>
                            <td className="px-3 py-1.5 text-gray-400">
                              {f.skip_label || f.last_error || (f.sent_at ? formatChileDateTime(f.sent_at) : formatChileDateTime(f.send_after))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
