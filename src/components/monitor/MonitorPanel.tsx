"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users, Search, MessageSquare,
  ChevronRight, RefreshCw, AlertCircle, CheckCircle2,
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
  role: string;
  avatar_url: string | null;
  establishment_id: string | null;
  establishment_name: string | null;
  course_id: string | null;
  course_name: string | null;
  section_id: string | null;
  section_name: string | null;
  online: boolean;
  last_seen_at: string | null;
  last_activity_at: string | null;
  sessions_count: number;
  has_active_session: boolean;
  pending_reviews: number;
  credentials_sent_at: string | null;
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

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

const ROLE_LABEL: Record<string, string> = { student: "Estudiante", instructor: "Docente", admin: "Admin" };

type SortKey = "name" | "role" | "establishment" | "course" | "section" | "status" | "activity" | "conversations" | "credentials";

function sortValue(s: RosterStudent, key: SortKey): string | number {
  switch (key) {
    case "name": return (s.full_name || s.email || "").toLowerCase();
    case "role": return s.role || "";
    case "establishment": return (s.establishment_name || "").toLowerCase();
    case "course": return (s.course_name || "").toLowerCase();
    case "section": return (s.section_name || "").toLowerCase();
    case "status": return s.has_active_session ? 2 : s.online ? 1 : 0;
    case "activity": return s.last_activity_at ? Date.parse(s.last_activity_at) : 0;
    case "conversations": return s.sessions_count;
    case "credentials": return s.credentials_sent_at ? Date.parse(s.credentials_sent_at) : 0;
  }
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
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  // El filtro en cascada sobreescribe el scope base; el servidor igual lo
  // intersecta con la autoridad, así que nunca amplía el alcance.
  const [filterScope, setFilterScope] = useState<RequestedScope | null>(null);

  const sortBy = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

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

  const displayed = sortKey
    ? [...filtered].sort((a, b) => {
        const va = sortValue(a, sortKey);
        const vb = sortValue(b, sortKey);
        const cmp = typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb));
        return sortDir === "asc" ? cmp : -cmp;
      })
    : filtered;

  const showEstColumn = showEstablishment && (data?.scope.isSuperadmin ?? false);

  const renderTh = (label: string, k: SortKey, align: "left" | "right" = "left") => (
    <th
      onClick={() => sortBy(k)}
      className={`px-3 py-2.5 font-semibold cursor-pointer select-none hover:text-gray-600 ${align === "right" ? "text-right" : ""}`}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}>
        {label}
        <span className="text-sidebar w-2">{sortKey === k ? (sortDir === "asc" ? "▲" : "▼") : ""}</span>
      </span>
    </th>
  );

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

      {/* Controles — fila 1: búsqueda + filtro por grupos */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nombre o correo…"
            className="w-full h-9 pl-9 pr-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sidebar/30"
          />
        </div>
        {showFilters && <MonitorFilter onScopeChange={setFilterScope} />}
      </div>

      {/* Controles — fila 2: acciones de vista */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setOnlineOnly((v) => !v)}
          className={`text-xs h-9 px-3 rounded-lg border cursor-pointer ${
            onlineOnly ? "bg-green-50 border-green-300 text-green-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"
          }`}
        >
          Solo conectados
        </button>
        <button
          onClick={() => load()}
          className="text-xs h-9 px-2.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center"
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
                  <th className="px-3 py-2.5 font-semibold text-right w-10">#</th>
                  {renderTh("Persona", "name")}
                  {showFilters && renderTh("Rol", "role")}
                  {showEstColumn && renderTh("Establecimiento", "establishment")}
                  {showFilters && renderTh("Asignatura", "course")}
                  {showFilters && renderTh("Sección", "section")}
                  {renderTh("Estado", "status")}
                  {renderTh("Última actividad", "activity")}
                  {renderTh("Conversaciones", "conversations", "right")}
                  {showFilters && renderTh("Credenciales", "credentials")}
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((s, idx) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-3 py-2.5 text-right text-xs text-gray-400 tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{s.full_name || "—"}</p>
                        {s.email && <p className="text-[11px] text-gray-400 truncate">{s.email}</p>}
                      </div>
                    </td>
                    {showFilters && (
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          s.role === "admin" ? "bg-amber-100 text-amber-700"
                          : s.role === "instructor" ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                        }`}>
                          {ROLE_LABEL[s.role] || s.role}
                        </span>
                      </td>
                    )}
                    {showEstColumn && (
                      <td className="px-3 py-2.5 text-xs text-gray-500 truncate max-w-[160px]">{s.establishment_name || "—"}</td>
                    )}
                    {showFilters && (
                      <td className="px-3 py-2.5 text-xs text-gray-500 truncate max-w-[150px]">{s.course_name || "—"}</td>
                    )}
                    {showFilters && (
                      <td className="px-3 py-2.5 text-xs text-gray-500 truncate max-w-[130px]">{s.section_name || "—"}</td>
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
                    {showFilters && (
                      <td className="px-3 py-2.5 text-[11px]">
                        {s.credentials_sent_at ? (
                          <span className="inline-flex items-center gap-1 text-green-700" title={`Credenciales enviadas — ${formatDateTime(s.credentials_sent_at)}`}>
                            <CheckCircle2 size={12} /> {formatDateTime(s.credentials_sent_at)}
                          </span>
                        ) : (
                          <span className="text-gray-400">Sin enviar</span>
                        )}
                      </td>
                    )}
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
