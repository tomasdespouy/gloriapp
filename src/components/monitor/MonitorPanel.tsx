"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users, Search, MessageSquare, ClipboardCheck,
  ChevronRight, RefreshCw, AlertCircle,
} from "lucide-react";
import type { RequestedScope } from "@/lib/monitor/scope";
import ConversationsDrawer from "./ConversationsDrawer";
import MonitorFilter from "./MonitorFilter";

// Panel operacional reutilizable: una tabla de personas (conectado, última
// actividad, sesiones, pendientes) con un visor lateral para entrar a las
// conversaciones de cualquiera y depurar. Sirve a supradmin, admin e
// instructor — y, tras PR-C, a la vista de Pilotos — cambiando solo `scope`.
// El servidor recorta por autoridad, así que pasar scope={kind:"all"} es
// seguro: cada rol verá únicamente lo que le corresponde.

const POLL_MS = 15_000;

type RosterStudent = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  establishment_id: string | null;
  establishment_name: string | null;
  section_id: string | null;
  online: boolean;
  last_seen_at: string | null;
  last_activity_at: string | null;
  sessions_count: number;
  has_active_session: boolean;
  pending_reviews: number;
};

type RosterResponse = {
  students: RosterStudent[];
  scope: { authority: string; isSuperadmin: boolean; sectionFallback: boolean; requestedKind: string };
  generatedAt: string;
};

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  if (hours < 24) return `Hace ${hours}h`;
  if (days < 7) return `Hace ${days}d`;
  const d = new Date(iso);
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export default function MonitorPanel({
  scope,
  showEstablishment = true,
  showFilters = false,
}: {
  scope: RequestedScope;
  /** Oculta la columna establecimiento (p. ej. en la vista de un piloto). */
  showEstablishment?: boolean;
  /** Muestra el filtro Universidad→Asignatura→Sección (supradmin/admin). */
  showFilters?: boolean;
}) {
  const [data, setData] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [selected, setSelected] = useState<RosterStudent | null>(null);
  // El filtro en cascada sobreescribe el scope base; el servidor igual lo
  // intersecta con la autoridad, así que nunca amplía el alcance.
  const [filterScope, setFilterScope] = useState<RequestedScope | null>(null);

  const effectiveScope = filterScope ?? scope;
  const scopeParam = JSON.stringify(effectiveScope);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/monitor/roster?scope=${encodeURIComponent(scopeParam)}`, { signal });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || `Error ${res.status}`);
      }
      const json: RosterResponse = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [scopeParam]);

  useEffect(() => {
    // `loading` arranca en true; el polling refresca en silencio (sin spinner).
    const ctrl = new AbortController();
    load(ctrl.signal);
    const t = setInterval(() => load(), POLL_MS);
    return () => { ctrl.abort(); clearInterval(t); };
  }, [load]);

  const students = data?.students || [];
  const onlineCount = students.filter((s) => s.online).length;
  const inSessionCount = students.filter((s) => s.has_active_session).length;

  const q = query.trim().toLowerCase();
  const filtered = students.filter((s) => {
    if (onlineOnly && !s.online) return false;
    if (!q) return true;
    return (s.full_name || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q);
  });

  const showEstColumn = showEstablishment && (data?.scope.isSuperadmin ?? false);

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <SummaryChip icon={<Users size={18} className="text-blue-500" />} value={students.length} label="Personas" tone="blue" />
        <SummaryChip icon={<span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />} value={onlineCount} label="Conectados" tone="green" />
        <SummaryChip icon={<MessageSquare size={18} className="text-sidebar" />} value={inSessionCount} label="En sesión" tone="indigo" />
      </div>

      {data?.scope.sectionFallback && (
        <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 flex items-center gap-1.5">
          <AlertCircle size={13} />
          Sin sección asignada: mostrando todo el establecimiento.
        </p>
      )}

      {/* Controles */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sidebar/30"
          />
        </div>
        {showFilters && <MonitorFilter onScopeChange={setFilterScope} />}
        <button
          onClick={() => setOnlineOnly((v) => !v)}
          className={`text-xs px-3 py-2 rounded-lg border cursor-pointer ${
            onlineOnly ? "bg-green-50 border-green-300 text-green-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"
          }`}
        >
          Solo conectados
        </button>
        <button
          onClick={() => load()}
          className="text-xs px-2.5 py-2 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 cursor-pointer"
          aria-label="Actualizar"
          title="Actualizar"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 px-4 py-3">{error}</p>
        )}
        {loading && !data && (
          <p className="text-sm text-gray-400 text-center py-12">Cargando…</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-12">
            {students.length === 0 ? "No hay personas en este alcance." : "Sin coincidencias."}
          </p>
        )}
        {filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="px-4 py-2.5 font-semibold">Persona</th>
                  {showEstColumn && <th className="px-3 py-2.5 font-semibold">Establecimiento</th>}
                  <th className="px-3 py-2.5 font-semibold">Estado</th>
                  <th className="px-3 py-2.5 font-semibold">Última actividad</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Sesiones</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Pendientes</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{s.full_name || "—"}</p>
                        {s.email && <p className="text-[11px] text-gray-400 truncate">{s.email}</p>}
                      </div>
                    </td>
                    {showEstColumn && (
                      <td className="px-3 py-2.5 text-xs text-gray-500 truncate max-w-[160px]">{s.establishment_name || "—"}</td>
                    )}
                    <td className="px-3 py-2.5">
                      {s.has_active_session ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sidebar bg-sidebar/10 px-2 py-0.5 rounded">
                          <span className="w-1.5 h-1.5 rounded-full bg-sidebar animate-pulse" /> En sesión
                        </span>
                      ) : s.online ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> En línea
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" /> Desconectado
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{formatRelativeTime(s.last_activity_at)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-700">{s.sessions_count}</td>
                    <td className="px-3 py-2.5 text-right">
                      {s.pending_reviews > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                          <ClipboardCheck size={11} /> {s.pending_reviews}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <ChevronRight size={14} className="text-gray-300 inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <ConversationsDrawer
          key={selected.id}
          name={selected.full_name || selected.email || "Persona"}
          subtitle={selected.email}
          listUrl={`/api/monitor/students/${selected.id}/conversations`}
          buildTranscriptUrl={(c) => `/api/monitor/students/${selected.id}/conversations/${c}/transcript`}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function SummaryChip({ icon, value, label }: { icon: React.ReactNode; value: number; label: string; tone?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
