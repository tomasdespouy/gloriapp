"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, RefreshCw } from "lucide-react";
import { ALERT_KIND_LABELS, ALERT_SEVERITY_LABELS, type AlertKind, type AlertSeverity } from "@/lib/chat-alerts";

type Alert = {
  id: string;
  conversation_id: string;
  student_id: string | null;
  ai_patient_id: string | null;
  source: "user" | "assistant";
  kind: AlertKind;
  severity: AlertSeverity;
  matched_terms: string | null;
  sample: string | null;
  turn_number: number | null;
  reviewed_at: string | null;
  created_at: string;
  student_name: string | null;
  student_email: string | null;
  patient_name: string | null;
};

const SEV_STYLES: Record<AlertSeverity, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [highOnly, setHighOnly] = useState(true);
  const [unreviewedOnly, setUnreviewedOnly] = useState(false);
  const [unreviewed, setUnreviewed] = useState(0);
  // Visor de conversación al hacer click en una alerta.
  const [openConv, setOpenConv] = useState<Alert | null>(null);
  const [transcript, setTranscript] = useState<{ role: string; content: string; created_at: string }[] | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (highOnly) params.set("severity", "high");
    if (unreviewedOnly) params.set("unreviewed", "1");
    try {
      const res = await fetch(`/api/admin/alerts?${params.toString()}`);
      const data = await res.json();
      setAlerts(data.alerts || []);
      setUnreviewed(data.unreviewed || 0);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [highOnly, unreviewedOnly]);

  useEffect(() => { void load(); }, [load]);

  // Carga la transcripción completa de la conversación de la alerta abierta.
  // Reutiliza el endpoint del monitor (alcance por rol + conversación↔alumno).
  useEffect(() => {
    if (!openConv?.conversation_id || !openConv.student_id) return;
    let cancelled = false;
    setTranscript(null);
    setTranscriptLoading(true);
    fetch(`/api/monitor/students/${openConv.student_id}/conversations/${openConv.conversation_id}/transcript`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { messages?: { role: string; content: string; created_at: string }[] }) => { if (!cancelled) setTranscript(d.messages || []); })
      .catch(() => { if (!cancelled) setTranscript([]); })
      .finally(() => { if (!cancelled) setTranscriptLoading(false); });
    return () => { cancelled = true; };
  }, [openConv]);

  // Cerrar el visor con Escape.
  useEffect(() => {
    if (!openConv) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenConv(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openConv]);

  const markReviewed = async (id: string, reviewed: boolean) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, reviewed_at: reviewed ? new Date().toISOString() : null } : a)));
    try {
      await fetch("/api/admin/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert_id: id, reviewed }),
      });
    } catch { /* optimistic; ignore */ }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2 text-gray-700">
          <AlertTriangle size={18} className="text-orange-500" />
          <span className="font-semibold">Alertas de conversación</span>
          {unreviewed > 0 && (
            <span className="text-xs font-semibold bg-orange-100 text-orange-700 rounded-full px-2 py-0.5">
              {unreviewed} sin revisar
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer text-gray-600">
            <input type="checkbox" checked={highOnly} onChange={(e) => setHighOnly(e.target.checked)} />
            Solo alta/crítica
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-gray-600">
            <input type="checkbox" checked={unreviewedOnly} onChange={(e) => setUnreviewedOnly(e.target.checked)} />
            Sin revisar
          </label>
          <button onClick={() => void load()} className="flex items-center gap-1 text-gray-500 hover:text-sidebar cursor-pointer">
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Cargando alertas…</p>
      ) : alerts.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">No hay alertas con los filtros actuales.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-2 font-medium">Severidad</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Origen</th>
                <th className="px-3 py-2 font-medium">Estudiante</th>
                <th className="px-3 py-2 font-medium">Paciente</th>
                <th className="px-3 py-2 font-medium">Muestra</th>
                <th className="px-3 py-2 font-medium">Cuándo</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setOpenConv(a)}
                  className={`group border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${a.reviewed_at ? "opacity-50" : ""}`}
                  title="Ver conversación completa"
                >
                  <td className="px-3 py-2">
                    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 border ${SEV_STYLES[a.severity]}`}>
                      {ALERT_SEVERITY_LABELS[a.severity]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{ALERT_KIND_LABELS[a.kind] ?? a.kind}</td>
                  <td className="px-3 py-2 text-gray-500">{a.source === "user" ? "Alumno" : "Paciente"}</td>
                  <td className="px-3 py-2">
                    <div className="text-gray-800">{a.student_name ?? "—"}</div>
                    {a.student_email && <div className="text-xs text-gray-400">{a.student_email}</div>}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{a.patient_name ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600 max-w-xs">
                    <div className="line-clamp-2 group-hover:text-sidebar">
                      {a.sample?.trim()
                        ? a.sample
                        : <span className="italic text-gray-400">Paciente sin respuesta · ver conversación</span>}
                    </div>
                    {a.matched_terms && <div className="text-xs text-gray-400 mt-0.5">[{a.matched_terms}]</div>}
                  </td>
                  <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{fmt(a.created_at)}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); void markReviewed(a.id, !a.reviewed_at); }}
                      className={`flex items-center gap-1 text-xs cursor-pointer ${a.reviewed_at ? "text-gray-400" : "text-green-600 hover:text-green-700"}`}
                      title={a.reviewed_at ? "Marcar como no revisada" : "Marcar como revisada"}
                    >
                      <Check size={14} /> {a.reviewed_at ? "Revisada" : "Revisar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openConv && (
        <div className="fixed inset-0 z-[90]" onClick={() => setOpenConv(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[460px] bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <header className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3 flex-shrink-0">
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Conversación</p>
                <h3 className="text-sm font-semibold text-gray-900 truncate">{openConv.patient_name ?? "Paciente"}</h3>
                <p className="text-xs text-gray-500 truncate">{openConv.student_name ?? openConv.student_email ?? "—"}</p>
                <p className="mt-1">
                  <span className={`text-[11px] font-semibold rounded px-1.5 py-0.5 border ${SEV_STYLES[openConv.severity]}`}>
                    {ALERT_SEVERITY_LABELS[openConv.severity]} · {ALERT_KIND_LABELS[openConv.kind] ?? openConv.kind}
                  </span>
                </p>
              </div>
              <button onClick={() => setOpenConv(null)} className="shrink-0 text-gray-400 hover:text-gray-700 cursor-pointer text-lg leading-none" aria-label="Cerrar">×</button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {transcriptLoading && <p className="text-xs text-gray-400 italic text-center py-6">Cargando conversación…</p>}
              {!transcriptLoading && transcript && transcript.length === 0 && (
                <p className="text-xs text-gray-400 italic text-center py-6">Sin mensajes o sin acceso a esta conversación.</p>
              )}
              {!transcriptLoading && transcript && transcript.map((m, i) => {
                const core = (openConv.sample ?? "").replace(/…$/, "").slice(0, 40).trim();
                const isAlertMsg = core.length > 0 && m.content.includes(core);
                return (
                  <div key={i} className={`rounded-lg px-3 py-2 text-xs ${m.role === "user" ? "bg-sidebar/10 text-gray-900" : "bg-gray-50 text-gray-700"} ${isAlertMsg ? "ring-2 ring-orange-300" : ""}`}>
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[9px] uppercase tracking-wide font-semibold text-gray-400">{m.role === "user" ? "Terapeuta" : "Paciente"}</span>
                      <span className="text-[9px] text-gray-400 tabular-nums">{new Date(m.created_at).toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
