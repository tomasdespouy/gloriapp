"use client";

import { useEffect, useState } from "react";
import { XCircle } from "lucide-react";

// Visor de conversaciones de una persona — fuente única de verdad.
// Es presentacional + fetch genérico por URL: cada vista (monitor de
// supradmin/admin, panel de Pilotos) le pasa sus propios endpoints, así
// conserva su propia autorización server-side. Lista las conversaciones y,
// al abrir una, muestra la transcripción inline para depurar.

export type DrawerConversation = {
  id: string;
  patient_name: string;
  status: string;
  created_at: string;
  active_seconds: number;
  message_count: number;
  overall_score: number | null;
};

type TranscriptMessage = { role: string; content: string; created_at: string };

const TZ = "America/Santiago";
// Clave de día estable (YYYY-MM-DD en hora de Chile) para detectar cambios de día.
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
// Etiqueta de día legible para el separador, p. ej. "miércoles, 27 de mayo de 2026".
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CL", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-CL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
// Brecha legible entre dos mensajes ("3 h", "2 días", "45 min").
const formatGap = (ms: number) => {
  const min = Math.round(ms / 60000);
  if (min >= 1440) return `${Math.round(min / 1440)} día${Math.round(min / 1440) === 1 ? "" : "s"}`;
  if (min >= 60) return `${Math.round(min / 60)} h`;
  return `${min} min`;
};

export default function ConversationsDrawer({
  name,
  subtitle,
  listUrl,
  buildTranscriptUrl,
  onClose,
  allowReeval = false,
}: {
  name: string;
  subtitle?: string | null;
  /** GET que devuelve `{ conversations: DrawerConversation[] }`. */
  listUrl: string;
  /** Construye la URL de transcripción para una conversación. */
  buildTranscriptUrl: (conversationId: string) => string;
  onClose: () => void;
  /** Muestra "Reenviar evaluación IA" por conversación (solo superadmin). */
  allowReeval?: boolean;
}) {
  const [conversations, setConversations] = useState<DrawerConversation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openConvoId, setOpenConvoId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[] | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [reeval, setReeval] = useState<Record<string, "loading" | "done" | "error">>({});

  const reevalSession = async (conversationId: string) => {
    setReeval((p) => ({ ...p, [conversationId]: "loading" }));
    try {
      const r = await fetch("/api/admin/reeval-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      setReeval((p) => ({ ...p, [conversationId]: r.ok ? "done" : "error" }));
    } catch {
      setReeval((p) => ({ ...p, [conversationId]: "error" }));
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch(listUrl)
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => null);
          throw new Error(d?.error || `Error ${r.status}`);
        }
        return r.json();
      })
      .then((d: { conversations?: DrawerConversation[] }) => { if (!cancelled) setConversations(d.conversations || []); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [listUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!openConvoId) return;
    let cancelled = false;
    const run = async () => {
      setTranscript(null);
      setTranscriptLoading(true);
      try {
        const r = await fetch(buildTranscriptUrl(openConvoId));
        if (!r.ok) throw new Error(`Error ${r.status}`);
        const d: { messages?: TranscriptMessage[] } = await r.json();
        if (!cancelled) setTranscript(d.messages || []);
      } catch {
        if (!cancelled) setTranscript([]);
      } finally {
        if (!cancelled) setTranscriptLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
    // buildTranscriptUrl se recrea por render; dependemos de openConvoId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openConvoId]);

  const total = conversations?.length || 0;

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/30 animate-fade-in" onClick={onClose} />
      <aside className="absolute right-0 top-0 bottom-0 w-full sm:w-[440px] bg-white shadow-2xl flex flex-col">
        <header className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Persona</p>
              <h3 className="text-sm font-semibold text-gray-900 truncate">{name}</h3>
              {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
              <p className="text-[11px] text-gray-400 mt-1">
                {loading ? "Cargando…" : `${total} sesion${total === 1 ? "" : "es"}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 cursor-pointer"
              aria-label="Cerrar"
            >
              <XCircle size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="p-4">
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
            </div>
          )}

          {!error && !loading && !openConvoId && (
            <div className="p-4 space-y-2">
              {total === 0 && (
                <p className="text-xs text-gray-400 italic text-center py-8">
                  Esta persona aún no ha tenido sesiones con pacientes.
                </p>
              )}
              {conversations?.map((c) => {
                const when = new Date(c.created_at).toLocaleString("es-CL", {
                  timeZone: "America/Santiago",
                  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                });
                const statusBadge =
                  c.status === "completed" ? "bg-green-100 text-green-700"
                  : c.status === "active" ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600";
                const minutes = Math.round((c.active_seconds || 0) / 60);
                return (
                  <div key={c.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.patient_name}</p>
                        <p className="text-[11px] text-gray-500">{when}</p>
                      </div>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusBadge}`}>
                        {c.status === "completed" ? "Completada" : c.status === "active" ? "En curso" : c.status === "abandoned" ? "Abandonada" : c.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1">
                      <span>{c.message_count} msgs</span>
                      <span>·</span>
                      <span>{minutes} min</span>
                      {typeof c.overall_score === "number" && c.overall_score > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-sidebar font-medium">{c.overall_score.toFixed(1)}/4</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => setOpenConvoId(c.id)}
                        className="text-[11px] text-sidebar hover:underline cursor-pointer"
                      >
                        Ver conversación →
                      </button>
                      <a
                        href={`/docente/sesion/${c.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-gray-400 hover:text-gray-700 hover:underline cursor-pointer"
                      >
                        Ficha completa ↗
                      </a>
                      {allowReeval && c.message_count >= 2 && (
                        reeval[c.id] === "done" ? (
                          <span className="text-[11px] text-emerald-600">✓ Evaluación enviada al docente</span>
                        ) : (
                          <button
                            onClick={() => reevalSession(c.id)}
                            disabled={reeval[c.id] === "loading"}
                            className="text-[11px] text-sidebar hover:underline cursor-pointer disabled:opacity-50"
                          >
                            {reeval[c.id] === "loading" ? "Evaluando…" : reeval[c.id] === "error" ? "Error, reintentar" : "Reenviar evaluación IA"}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {openConvoId && (
            <div className="p-4 space-y-3">
              <button
                onClick={() => setOpenConvoId(null)}
                className="text-[11px] text-sidebar hover:underline cursor-pointer"
              >
                ← Volver al listado
              </button>

              {(() => {
                const convo = conversations?.find((c) => c.id === openConvoId);
                if (!convo) return null;
                return (
                  <div className="border-b border-gray-100 pb-2 mb-2">
                    <p className="text-sm font-medium text-gray-900">{convo.patient_name}</p>
                    <p className="text-[11px] text-gray-500">
                      {new Date(convo.created_at).toLocaleString("es-CL", { timeZone: "America/Santiago", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {" · "}{convo.message_count} msgs
                    </p>
                  </div>
                );
              })()}

              {/* Aviso: la conversación abarca varios días → probablemente se
                  reanudó sin cerrar la sesión, uniendo varias sesiones en una. */}
              {!transcriptLoading && transcript && transcript.length > 0 && (() => {
                const days = new Set(transcript.map((m) => dayKey(m.created_at)));
                if (days.size <= 1) return null;
                return (
                  <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-1">
                    Esta conversación abarca <strong>{days.size} días distintos</strong>. Probablemente se reanudó sin cerrar la sesión anterior, por lo que varias sesiones quedaron unidas en este mismo registro.
                  </div>
                );
              })()}

              {transcriptLoading && (
                <p className="text-xs text-gray-400 italic text-center py-6">Cargando transcripción…</p>
              )}
              {!transcriptLoading && transcript && transcript.length === 0 && (
                <p className="text-xs text-gray-400 italic text-center py-6">Sin mensajes registrados.</p>
              )}
              {!transcriptLoading && transcript && transcript.length > 0 && (
                <div className="space-y-2">
                  {transcript.map((m, i) => {
                    const prev = i > 0 ? transcript[i - 1] : null;
                    const showDay = !prev || dayKey(m.created_at) !== dayKey(prev.created_at);
                    const gapMs = prev ? Date.parse(m.created_at) - Date.parse(prev.created_at) : 0;
                    // Salto grande dentro del mismo día (p. ej. pausa de horas).
                    const showGap = !showDay && gapMs >= 2 * 3600 * 1000;
                    return (
                      <div key={i}>
                        {showDay && (
                          <div className={`flex items-center gap-2 ${i === 0 ? "mb-3" : "my-3"}`}>
                            <div className="flex-1 h-px bg-gray-200" />
                            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                              {dayLabel(m.created_at)}
                            </span>
                            <div className="flex-1 h-px bg-gray-200" />
                          </div>
                        )}
                        {showGap && (
                          <p className="text-[10px] text-amber-600 text-center my-1.5">
                            ··· reanudada {formatGap(gapMs)} después ···
                          </p>
                        )}
                        <div
                          className={`rounded-lg px-3 py-2 text-xs ${
                            m.role === "user" ? "bg-sidebar/10 text-gray-900" : "bg-gray-50 text-gray-700"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className="text-[9px] uppercase tracking-wide font-semibold text-gray-400">
                              {m.role === "user" ? "Terapeuta" : "Paciente"}
                            </span>
                            <span className="text-[9px] text-gray-400 tabular-nums">{timeLabel(m.created_at)}</span>
                          </div>
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
