"use client";

import { useState } from "react";
import {
  BarChart, Bar, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { ArrowUpDown } from "lucide-react";

type EstablishmentRow = {
  id: string;
  name: string;
  country: string;
  students: number;
  activeStudents: number;
  sessions: number;
  sessionsPerStudent: number;
  avgScore: number;
};

type Props = {
  sessionsPerWeek: { week: string; sessions: number }[];
  registrations: { week: string; registrations: number }[];
  radarData: { competency: string; value: number }[];
  heatmap: number[][];
  establishmentTable: EstablishmentRow[];
  isSuperadmin: boolean;
};

const dayLabels = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

type SortKey = "sessions" | "students" | "avgScore" | "sessionsPerStudent" | "activeStudents";

export default function AdminDashboardClient({
  sessionsPerWeek,
  registrations,
  radarData,
  heatmap,
  establishmentTable,
  isSuperadmin,
}: Props) {
  const maxHeatVal = Math.max(...heatmap.flat(), 1);
  const [sortKey, setSortKey] = useState<SortKey>("sessions");
  const [sortAsc, setSortAsc] = useState(false);

  const sortedEstablishments = [...establishmentTable].sort((a, b) =>
    sortAsc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]
  );

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Row 1: Sessions per week + Radar competencies ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sessions per week */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Sesiones por semana</h3>
          <p className="text-[10px] text-gray-400 mb-3">Últimas 12 semanas</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sessionsPerWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="sessions" fill="#4A55A2" radius={[3, 3, 0, 0]} name="Sesiones" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Competency Radar */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Competencias clínicas promedio</h3>
          <p className="text-[10px] text-gray-400 mb-3">Escala 0-10, todas las sesiones evaluadas</p>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="#e5e5e5" />
                <PolarAngleAxis dataKey="competency" tick={{ fontSize: 9, fill: "#666" }} />
                <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 8 }} tickCount={6} />
                <Radar
                  dataKey="value"
                  stroke="#4A55A2"
                  fill="#4A55A2"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => [Number(v).toFixed(1), "Promedio"]} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-xs text-gray-400">Sin evaluaciones aún</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Registrations + Heatmap (compact) ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registrations per week */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Registros de alumnos</h3>
          <p className="text-[10px] text-gray-400 mb-3">Últimas 12 semanas</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={registrations}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="registrations"
                stroke="#059669"
                fill="#059669"
                fillOpacity={0.15}
                name="Registros"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Heatmap compact */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Actividad por horario</h3>
              <p className="text-[10px] text-gray-400">Día de la semana vs. hora del día</p>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-gray-400">0</span>
              <div className="flex gap-[1px]">
                {[0.15, 0.35, 0.55, 0.75, 1].map((opacity, i) => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-[2px]"
                    style={{ backgroundColor: `rgba(74, 85, 162, ${opacity})` }}
                  />
                ))}
              </div>
              <span className="text-[9px] text-gray-400">{maxHeatVal}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div
              className="grid gap-[2px]"
              style={{ gridTemplateColumns: "36px repeat(24, 1fr)" }}
            >
              {/* Header */}
              <div />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="text-[8px] text-gray-400 text-center">
                  {h % 3 === 0 ? h.toString().padStart(2, "0") : ""}
                </div>
              ))}

              {/* Data rows */}
              {heatmap.map((row, dayIdx) => (
                <div key={dayIdx} className="contents">
                  <div className="text-[9px] text-gray-500 flex items-center">
                    {dayLabels[dayIdx]}
                  </div>
                  {row.map((val, h) => (
                    <div
                      key={h}
                      className="rounded-[2px] aspect-square min-h-[12px]"
                      style={{
                        backgroundColor:
                          val > 0
                            ? `rgba(74, 85, 162, ${0.15 + (val / maxHeatVal) * 0.85})`
                            : "#f5f5f5",
                      }}
                      title={`${dayLabels[dayIdx]} ${h}:00 — ${val} sesiones`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 3: Establishment table ──────────────────── */}
      {isSuperadmin && establishmentTable.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Establecimientos</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-[10px] font-medium text-gray-500 uppercase tracking-wider pb-2 pr-4">
                    País
                  </th>
                  <th className="text-[10px] font-medium text-gray-500 uppercase tracking-wider pb-2 pr-4">
                    Establecimiento
                  </th>
                  <SortableHeader label="Alumnos" sortKey="students" currentKey={sortKey} asc={sortAsc} onSort={handleSort} />
                  <SortableHeader label="Activos (7d)" sortKey="activeStudents" currentKey={sortKey} asc={sortAsc} onSort={handleSort} />
                  <SortableHeader label="Sesiones" sortKey="sessions" currentKey={sortKey} asc={sortAsc} onSort={handleSort} />
                  <SortableHeader label="Ses./alumno" sortKey="sessionsPerStudent" currentKey={sortKey} asc={sortAsc} onSort={handleSort} />
                  <SortableHeader label="Puntaje prom." sortKey="avgScore" currentKey={sortKey} asc={sortAsc} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {sortedEstablishments.map((est) => (
                  <tr key={est.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-2 pr-4 text-xs text-gray-500">{est.country}</td>
                    <td className="py-2 pr-4 text-xs font-medium text-gray-900">{est.name}</td>
                    <td className="py-2 pr-4 text-xs text-gray-700 text-right">{est.students}</td>
                    <td className="py-2 pr-4 text-xs text-gray-700 text-right">
                      {est.activeStudents}
                      {est.students > 0 && (
                        <span className="text-gray-400 ml-1">
                          ({Math.round((est.activeStudents / est.students) * 100)}%)
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-xs text-gray-700 text-right">{est.sessions}</td>
                    <td className="py-2 pr-4 text-xs text-gray-700 text-right">{est.sessionsPerStudent}</td>
                    <td className="py-2 pr-4 text-xs text-right">
                      {est.avgScore > 0 ? (
                        <span className={est.avgScore >= 7 ? "text-green-600 font-medium" : est.avgScore >= 5 ? "text-amber-600" : "text-red-500"}>
                          {est.avgScore}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sortable table header ───────────────────────────────── */
function SortableHeader({
  label,
  sortKey: key,
  currentKey,
  asc,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  asc: boolean;
  onSort: (key: SortKey) => void;
}) {
  const isActive = currentKey === key;

  return (
    <th className="pb-2 pr-4 text-right">
      <button
        onClick={() => onSort(key)}
        className="inline-flex items-center gap-0.5 text-[10px] font-medium uppercase tracking-wider hover:text-gray-900 transition-colors"
        style={{ color: isActive ? "#1a1a1a" : "#9ca3af" }}
      >
        {label}
        <ArrowUpDown size={10} className={isActive ? "text-sidebar" : "text-gray-300"} />
        {isActive && (
          <span className="text-[8px] text-sidebar">{asc ? "↑" : "↓"}</span>
        )}
      </button>
    </th>
  );
}
