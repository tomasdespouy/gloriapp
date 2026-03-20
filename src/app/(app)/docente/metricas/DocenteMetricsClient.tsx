"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import { BarChart3, Users, MessageSquare, TrendingUp, CalendarDays } from "lucide-react";

type Props = {
  scoreDistribution: { range: string; count: number }[];
  competencyAverages: { key: string; label: string; avg: number }[];
  weeklyProgression: { week: string; avg: number; sessions: number }[];
  summary: {
    totalStudents: number;
    totalSessions: number;
    avgScore: number;
    reviewCompletionRate: number;
    sessionsThisWeek: number;
  };
};

const COLORS = {
  primary: "#4A55A2",
  secondary: "#8B95D4",
  tertiary: "#C5CAE9",
};

export default function DocenteMetricsClient({
  scoreDistribution,
  competencyAverages,
  weeklyProgression,
  summary,
}: Props) {
  // Sort competencies ascending for "weakest first" view
  const sortedCompetencies = [...competencyAverages].sort((a, b) => a.avg - b.avg);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="px-4 sm:px-8 py-5 animate-fade-in">
        <div className="flex items-center gap-2.5">
          <BarChart3 size={22} className="text-[#4A55A2]" />
          <h1 className="text-2xl font-bold text-[#1A1A1A]">
            M&eacute;tricas grupales
          </h1>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          Rendimiento agregado de todos los estudiantes
        </p>
      </header>

      <div className="px-4 sm:px-8 pb-8 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
          <SummaryCard
            icon={<Users size={20} className="text-[#4A55A2]" />}
            iconBg="bg-[#4A55A2]/10"
            value={summary.totalStudents}
            label="Estudiantes"
          />
          <SummaryCard
            icon={<MessageSquare size={20} className="text-[#4A55A2]" />}
            iconBg="bg-[#4A55A2]/10"
            value={summary.totalSessions}
            label="Sesiones completadas"
          />
          <SummaryCard
            icon={<TrendingUp size={20} className="text-[#4A55A2]" />}
            iconBg="bg-[#4A55A2]/10"
            value={summary.avgScore.toFixed(1)}
            label="Puntaje promedio"
            suffix="/4"
          />
          <SummaryCard
            icon={<CalendarDays size={20} className="text-[#4A55A2]" />}
            iconBg="bg-[#4A55A2]/10"
            value={summary.sessionsThisWeek}
            label="Sesiones esta semana"
          />
        </div>

        {/* Charts row 1: Score distribution + Competencies */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up">
          {/* Score distribution */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">
              Distribuci&oacute;n de puntajes
            </h3>
            {scoreDistribution.some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={scoreDistribution}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                  <XAxis
                    dataKey="range"
                    tick={{ fill: "#1A1A1A", fontSize: 12 }}
                    axisLine={{ stroke: "#E5E5E5" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#1A1A1A", fontSize: 12 }}
                    axisLine={{ stroke: "#E5E5E5" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #E5E5E5",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [`${value} sesiones`, "Cantidad"]}
                  />
                  <Bar
                    dataKey="count"
                    fill={COLORS.primary}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState />
            )}
          </div>

          {/* Weakest competencies — horizontal bars */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">
              Competencias (promedio grupal)
            </h3>
            {sortedCompetencies.some((c) => c.avg > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={sortedCompetencies}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 4]}
                    ticks={[0, 1, 2, 3, 4]}
                    tick={{ fill: "#1A1A1A", fontSize: 12 }}
                    axisLine={{ stroke: "#E5E5E5" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={140}
                    tick={{ fill: "#1A1A1A", fontSize: 11 }}
                    axisLine={{ stroke: "#E5E5E5" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #E5E5E5",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [Number(value).toFixed(2), "Promedio"]}
                  />
                  <Bar
                    dataKey="avg"
                    fill={COLORS.secondary}
                    radius={[0, 6, 6, 0]}
                    maxBarSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState />
            )}
          </div>
        </div>

        {/* Charts row 2: Weekly progression */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 animate-slide-up">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">
            Progresi&oacute;n semanal (puntaje promedio)
          </h3>
          {weeklyProgression.some((w) => w.avg > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={weeklyProgression}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis
                  dataKey="week"
                  tick={{ fill: "#1A1A1A", fontSize: 12 }}
                  axisLine={{ stroke: "#E5E5E5" }}
                />
                <YAxis
                  domain={[0, 4]}
                  ticks={[0, 1, 2, 3, 4]}
                  tick={{ fill: "#1A1A1A", fontSize: 12 }}
                  axisLine={{ stroke: "#E5E5E5" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #E5E5E5",
                    borderRadius: "8px",
                    fontSize: 12,
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => {
                    if (name === "avg") return [Number(value).toFixed(2), "Puntaje promedio"];
                    return [value, "Sesiones"];
                  }}
                  labelFormatter={(label) => `Semana del ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke={COLORS.primary}
                  strokeWidth={2.5}
                  dot={{ fill: COLORS.primary, r: 4 }}
                  activeDot={{ r: 6, fill: COLORS.primary }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </div>

        {/* Review completion */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 animate-slide-up">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">
            Tasa de revisi&oacute;n docente
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(summary.reviewCompletionRate, 100)}%`,
                    backgroundColor: COLORS.primary,
                  }}
                />
              </div>
            </div>
            <span className="text-sm font-bold text-[#1A1A1A] min-w-[48px] text-right">
              {summary.reviewCompletionRate}%
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Porcentaje de sesiones completadas con comentario del docente
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  iconBg,
  value,
  label,
  suffix,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: string | number;
  label: string;
  suffix?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-[#1A1A1A]">
          {value}
          {suffix && <span className="text-sm font-normal text-gray-400">{suffix}</span>}
        </p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
      Sin datos disponibles
    </div>
  );
}
