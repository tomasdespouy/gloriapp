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
                <tr key={a.id} className={`border-b border-gray-100 ${a.reviewed_at ? "opacity-50" : ""}`}>
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
                    <span className="line-clamp-2" title={a.sample ?? ""}>{a.sample ?? "—"}</span>
                    {a.matched_terms && <div className="text-xs text-gray-400 mt-0.5">[{a.matched_terms}]</div>}
                  </td>
                  <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{fmt(a.created_at)}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => markReviewed(a.id, !a.reviewed_at)}
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
    </div>
  );
}
