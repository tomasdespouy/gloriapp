"use client";

import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type Props = {
  sessionsPerDay: { date: string; sessions: number }[];
  weeklyScore: { week: string; score: number }[];
  registrations: { week: string; registrations: number }[];
  byEstablishment: { name: string; students: number; sessions: number; avgScore: number }[];
  heatmap: number[][];
  isSuperadmin: boolean;
};

const dayLabels = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

export default function AdminDashboardClient({
  sessionsPerDay,
  weeklyScore,
  registrations,
  byEstablishment,
  heatmap,
  isSuperadmin,
}: Props) {
  const maxHeatVal = Math.max(...heatmap.flat(), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sessions per day */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Sesiones por día (30 días)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={sessionsPerDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => String(v).slice(5)}
              />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                labelFormatter={(v) => `Fecha: ${v}`}
              />
              <Line
                type="monotone"
                dataKey="sessions"
                stroke="#4A55A2"
                strokeWidth={2}
                dot={false}
                name="Sesiones"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly average score */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Puntaje promedio semanal (12 semanas)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weeklyScore}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 10]} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#7C3AED"
                strokeWidth={2}
                dot={false}
                name="Puntaje"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Registrations per week */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Registros de alumnos por semana</h3>
          <ResponsiveContainer width="100%" height={220}>
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

        {/* Comparison by establishment (superadmin only) */}
        {isSuperadmin && byEstablishment.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Comparativa por establecimiento</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byEstablishment}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="students" fill="#4A55A2" name="Alumnos" />
                <Bar dataKey="sessions" fill="#7C3AED" name="Sesiones" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Activity heatmap */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Heatmap de actividad</h3>
        <div className="overflow-x-auto">
          <div className="grid gap-[2px]" style={{ gridTemplateColumns: `60px repeat(24, 1fr)` }}>
            {/* Header row */}
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="text-[9px] text-gray-400 text-center">
                {h.toString().padStart(2, "0")}
              </div>
            ))}

            {/* Data rows */}
            {heatmap.map((row, dayIdx) => (
              <div key={dayIdx} className="contents">
                <div className="text-[10px] text-gray-500 flex items-center">{dayLabels[dayIdx]}</div>
                {row.map((val, h) => (
                  <div
                    key={h}
                    className="rounded-sm aspect-square min-h-[14px]"
                    style={{
                      backgroundColor: val > 0
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
  );
}
