"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, Download, Clock, AlertTriangle } from "lucide-react";

export interface StudentData {
  id: string;
  full_name: string | null;
  email: string;
  level_name: string | null;
  sessions_completed: number;
  current_streak: number;
  last_session_date: string | null;
  pending_count: number;
}

interface Props {
  students: StudentData[];
  defaultFilter?: string | null;
}

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "pending", label: "Con pendientes" },
  { id: "inactive", label: "Inactivos" },
] as const;

export default function DocenteStudentList({ students, defaultFilter }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>(defaultFilter || "all");
  const [exporting, setExporting] = useState(false);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const filtered = students.filter((s) => {
    // Search filter
    const q = search.toLowerCase();
    if (q && !(s.full_name?.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))) {
      return false;
    }
    // Status filter
    if (filter === "pending" && s.pending_count === 0) return false;
    if (filter === "inactive") {
      if (s.last_session_date && new Date(s.last_session_date) >= sevenDaysAgo) return false;
    }
    return true;
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/docente/students-export");
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alumnos-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-2">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Alumnos</h3>
        <span className="text-xs text-gray-400">{filtered.length} de {students.length}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1 text-[10px] text-sidebar hover:underline disabled:opacity-50"
            title="Exportar lista a CSV"
          >
            <Download size={12} />
            {exporting ? "Exportando..." : "Exportar"}
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar alumno..."
            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sidebar/20"
          />
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`text-[11px] px-3 py-1.5 rounded-full font-medium transition-colors ${
                filter === f.id
                  ? "bg-sidebar text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Student list */}
      {filtered.length > 0 ? (
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {filtered.map((student) => {
            const initials = student.full_name
              ?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?";
            const isInactive = !student.last_session_date || new Date(student.last_session_date) < sevenDaysAgo;

            return (
              <Link
                key={student.id}
                href={`/docente/alumno/${student.id}`}
                className="flex items-center gap-3 py-2.5 px-3 -mx-1 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-sidebar flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {student.full_name || student.email}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {student.level_name || "Sin actividad"} &middot; {student.sessions_completed}{" "}
                    {student.sessions_completed === 1 ? "sesi\u00f3n" : "sesiones"}
                    {student.current_streak > 0 && <span> &middot; {student.current_streak}d racha</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isInactive && (
                    <Clock size={12} className="text-amber-400" title="Inactivo" />
                  )}
                  {student.pending_count > 0 && (
                    <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                      {student.pending_count}
                    </span>
                  )}
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-sidebar transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-8">
          {search ? "Sin resultados para esta b\u00fasqueda" : "Sin alumnos registrados"}
        </p>
      )}
    </div>
  );
}
