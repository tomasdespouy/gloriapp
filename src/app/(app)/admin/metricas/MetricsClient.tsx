"use client";

import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { BarChart3, Download } from "lucide-react";

type Props = {
  competencies: { key: string; label: string }[];
  heatmapData: Record<string, string | number>[];
  scoreDistribution: { range: string; count: number }[];
  byEstablishment: { name: string; id: string; sessions: number; avgScore: number }[];
  timeTrend: { week: string; score: number; sessions: number }[];
  establishments: { id: string; name: string }[];
  isSuperadmin: boolean;
};

export default function MetricsClient({
  competencies,
  heatmapData,
  scoreDistribution,
  byEstablishment,
  timeTrend,
  establishments,
  isSuperadmin,
}: Props) {
  const [estFilter, setEstFilter] = useState("");

  const filteredHeatmap = estFilter
    ? heatmapData.filter((row) => row.establishmentId === estFilter)
    : heatmapData;

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (estFilter) params.set("establishment_id", estFilter);
    const res = await fetch(`/api/admin/metrics/export?${params.toString()}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "metricas.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex justify-end px-8 mb-4">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Download size={16} />
          Exportar CSV
        </button>
      </div>

      <div className="px-8 pb-8 space-y-6">
        {/* Filters */}
        <div className="flex items-center gap-3">
          {(isSuperadmin || establishments.length > 1) && (
            <select
              value={estFilter}
              onChange={(e) => setEstFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todos los establecimientos</option>
              {establishments.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Competency heatmap */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Heatmap de competencias por alumno
          </h3>
          {filteredHeatmap.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left text-[10px] font-semibold text-gray-500 px-2 py-1">Alumno</th>
                    {competencies.map((c) => (
                      <th key={c.key} className="text-center text-[10px] font-semibold text-gray-500 px-2 py-1">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredHeatmap.map((row, i) => (
                    <tr key={i}>
                      <td className="text-xs text-gray-700 px-2 py-1.5 truncate max-w-[120px]">
                        {row.name as string}
                      </td>
                      {competencies.map((c) => {
                        const val = Number(row[c.key]) || 0;
                        const intensity = val / 10;
                        return (
                          <td key={c.key} className="text-center px-1 py-1">
                            <div
                              className="rounded text-[10px] font-mono px-2 py-1 mx-auto w-fit"
                              style={{
                                backgroundColor: val > 0
                                  ? `rgba(74, 85, 162, ${0.1 + intensity * 0.8})`
                                  : "#f5f5f5",
                                color: intensity > 0.5 ? "white" : "#333",
                              }}
                            >
                              {val > 0 ? val.toFixed(1) : "—"}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-4">Sin datos</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Score distribution */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Distribución de puntajes</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="#4A55A2" name="Sesiones" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Establishment comparison */}
          {isSuperadmin && byEstablishment.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Comparativa por establecimiento</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byEstablishment}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="sessions" fill="#4A55A2" name="Sesiones" />
                  <Bar dataKey="avgScore" fill="#7C3AED" name="Puntaje prom." />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Time trend */}
          <div className={`bg-white rounded-xl border border-gray-200 p-5 ${!isSuperadmin || byEstablishment.length === 0 ? "" : "lg:col-span-2"}`}>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Tendencia temporal (12 semanas)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timeTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 10]} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#4A55A2"
                  strokeWidth={2}
                  dot={false}
                  name="Puntaje prom."
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
