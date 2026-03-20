"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COMPETENCIES = [
  { key: "setting_terapeutico", label: "Setting terap\u00e9utico", domain: "estructura", color: "#4A55A2" },
  { key: "motivo_consulta", label: "Motivo de consulta", domain: "estructura", color: "#5C6BC0" },
  { key: "datos_contextuales", label: "Datos contextuales", domain: "estructura", color: "#7986CB" },
  { key: "objetivos", label: "Objetivos", domain: "estructura", color: "#9FA8DA" },
  { key: "escucha_activa", label: "Escucha activa", domain: "actitudes", color: "#10B981" },
  { key: "actitud_no_valorativa", label: "Actitud no valorativa", domain: "actitudes", color: "#34D399" },
  { key: "optimismo", label: "Optimismo", domain: "actitudes", color: "#6EE7B7" },
  { key: "presencia", label: "Presencia", domain: "actitudes", color: "#059669" },
  { key: "conducta_no_verbal", label: "Conducta no verbal", domain: "actitudes", color: "#047857" },
  { key: "contencion_afectos", label: "Contenci\u00f3n de afectos", domain: "actitudes", color: "#065F46" },
];

interface Props {
  evolutionData: Record<string, number | string>[];
}

export default function StudentDashboardClient({ evolutionData }: Props) {
  const [activeComps, setActiveComps] = useState<Set<string>>(
    new Set(["overall"])
  );
  const [showAll, setShowAll] = useState(false);

  const toggleComp = (key: string) => {
    setActiveComps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleDomain = (domain: string) => {
    const domainKeys = COMPETENCIES.filter((c) => c.domain === domain).map((c) => c.key);
    const allActive = domainKeys.every((k) => activeComps.has(k));
    setActiveComps((prev) => {
      const next = new Set(prev);
      domainKeys.forEach((k) => {
        if (allActive) next.delete(k); else next.add(k);
      });
      return next;
    });
  };

  if (evolutionData.length === 0) {
    return (
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          {"Evoluci\u00f3n de competencias"}
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">
            {"Completa tu primera sesi\u00f3n para ver c\u00f3mo evolucionan tus competencias"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">
          {"Evoluci\u00f3n de competencias"}
        </h2>
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-[10px] text-sidebar hover:underline"
        >
          {showAll ? "Ocultar filtros" : "Filtrar competencias"}
        </button>
      </div>

      {/* Competency toggles */}
      {showAll && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3 animate-fade-in">
          <div className="flex flex-wrap gap-4">
            {/* Overall toggle */}
            <button
              onClick={() => toggleComp("overall")}
              className={`text-[11px] font-medium px-3 py-1 rounded-full transition-colors ${
                activeComps.has("overall")
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              Puntaje general
            </button>

            {/* Domain: Estructura */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => toggleDomain("estructura")}
                className="text-[9px] font-bold text-sidebar uppercase tracking-wider hover:underline"
              >
                Estructura
              </button>
              {COMPETENCIES.filter((c) => c.domain === "estructura").map((c) => (
                <button
                  key={c.key}
                  onClick={() => toggleComp(c.key)}
                  className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                    activeComps.has(c.key)
                      ? "text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                  style={activeComps.has(c.key) ? { backgroundColor: c.color } : {}}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Domain: Actitudes */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => toggleDomain("actitudes")}
                className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider hover:underline"
              >
                Actitudes
              </button>
              {COMPETENCIES.filter((c) => c.domain === "actitudes").map((c) => (
                <button
                  key={c.key}
                  onClick={() => toggleComp(c.key)}
                  className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                    activeComps.has(c.key)
                      ? "text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                  style={activeComps.has(c.key) ? { backgroundColor: c.color } : {}}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={evolutionData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="session"
              tick={{ fontSize: 11, fill: "#999" }}
              axisLine={{ stroke: "#e5e5e5" }}
            />
            <YAxis
              domain={[0, 4]}
              ticks={[0, 1, 2, 3, 4]}
              tick={{ fontSize: 11, fill: "#999" }}
              axisLine={{ stroke: "#e5e5e5" }}
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                borderRadius: 8,
                border: "1px solid #e5e5e5",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
              formatter={(value: number | string | undefined, name: string | undefined) => {
                const comp = COMPETENCIES.find((c) => c.key === name);
                const label = name === "overall" ? "Puntaje general" : (comp?.label || name || "");
                return [Number(value ?? 0).toFixed(1), label];
              }}
            />

            {/* Overall line */}
            {activeComps.has("overall") && (
              <Line
                type="monotone"
                dataKey="overall"
                stroke="#1A1A1A"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#1A1A1A" }}
                activeDot={{ r: 6 }}
                name="overall"
              />
            )}

            {/* Individual competency lines */}
            {COMPETENCIES.map((c) =>
              activeComps.has(c.key) ? (
                <Line
                  key={c.key}
                  type="monotone"
                  dataKey={c.key}
                  stroke={c.color}
                  strokeWidth={1.5}
                  dot={{ r: 3, fill: c.color }}
                  activeDot={{ r: 5 }}
                  name={c.key}
                />
              ) : null
            )}
          </LineChart>
        </ResponsiveContainer>

        {/* Legend hint */}
        <div className="flex items-center justify-center gap-4 mt-2">
          {activeComps.has("overall") && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-gray-900 rounded-full" />
              <span className="text-[10px] text-gray-500">General</span>
            </div>
          )}
          {COMPETENCIES.filter((c) => activeComps.has(c.key)).map((c) => (
            <div key={c.key} className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="text-[10px] text-gray-500">{c.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
