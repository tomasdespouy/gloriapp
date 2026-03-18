"use client";

import { useState } from "react";
import CountUp from "@/components/CountUp";
import { TrendingUp, Flame, Trophy } from "lucide-react";

type Props =
  | { type: "score"; value: number; bestComp?: string; longestStreak?: never; total?: never; compData?: never }
  | { type: "streak"; value: number; longestStreak?: number; bestComp?: never; total?: never; compData?: never }
  | { type: "achievements"; value: number; total?: number; bestComp?: never; longestStreak?: never; compData?: never }
  | { type: "bars"; compData?: { key: string; label: string; value: number }[]; value?: never; bestComp?: never; longestStreak?: never; total?: never };

export default function ProgresoClient(props: Props) {
  if (props.type === "score") {
    return (
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-sm">
          <TrendingUp size={24} className="text-white" />
        </div>
        <div>
          {props.value > 0 ? (
            <CountUp end={props.value} decimals={1} className="text-3xl font-bold text-gray-900" suffix="/4" />
          ) : (
            <p className="text-3xl font-bold text-gray-900">—</p>
          )}
          <p className="text-xs text-gray-500 mt-0.5">Puntaje promedio</p>
          {props.bestComp && (
            <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
              Mejor: {props.bestComp}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (props.type === "streak") {
    return (
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-sm">
          <Flame size={24} className="text-white" />
        </div>
        <div>
          <CountUp end={props.value} className="text-3xl font-bold text-gray-900" />
          <p className="text-xs text-gray-500 mt-0.5">Días de racha</p>
          {(props.longestStreak || 0) > 0 && (
            <p className="text-[10px] text-orange-500 font-medium mt-0.5">
              Récord: {props.longestStreak} días
            </p>
          )}
        </div>
      </div>
    );
  }

  if (props.type === "achievements") {
    const pct = props.total ? Math.round((props.value / props.total) * 100) : 0;
    return (
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center shadow-sm">
          <Trophy size={24} className="text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-1">
            <CountUp end={props.value} className="text-3xl font-bold text-gray-900" />
            <span className="text-sm text-gray-400">/{props.total}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Logros</p>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5 max-w-[120px]">
            <div
              className="h-full bg-gradient-to-r from-purple-400 to-indigo-500 rounded-full animate-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // type === "bars" → gauge circles grid
  if (props.type === "bars" && props.compData) {
    return <GaugeGrid compData={props.compData} />;
  }

  return null;
}

const COMP_DEFINITIONS: Record<string, string> = {
  setting_terapeutico: "Capacidad de explicitar el encuadre terapéutico, aclarar roles, confidencialidad y dudas del paciente.",
  motivo_consulta: "Capacidad de indagar e integrar el motivo manifiesto y latente de consulta, explorando recursos del paciente.",
  datos_contextuales: "Capacidad de entrevistar e integrar información de contextos relevantes (familia, trabajo, salud).",
  objetivos: "Capacidad de construir objetivos terapéuticos colaborativamente con el paciente.",
  escucha_activa: "Atención coherente a la comunicación verbal y no verbal, respondiendo en congruencia.",
  actitud_no_valorativa: "Aceptación incondicional sin juicios explícitos ni implícitos hacia el paciente.",
  optimismo: "Transmisión proactiva de esperanza integrada con intervenciones técnicas.",
  presencia: "Atención sostenida, flexibilidad y sintonía emocional con el paciente.",
  conducta_no_verbal: "Atención a lo no verbal del paciente e integración con el contenido verbal.",
  contencion_afectos: "Contención emocional con presencia, calidez, empatía y validación.",
};

function GaugeGrid({ compData }: { compData: { key: string; label: string; value: number }[] }) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  return (
    <div className="relative">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {compData.map((comp, i) => {
          const pct = (comp.value / 4) * 100;
          const color = comp.value >= 3.5 ? "#22c55e" : comp.value >= 2.5 ? "#eab308" : comp.value >= 1.5 ? "#f97316" : comp.value > 0 ? "#ef4444" : "#d1d5db";
          const levelLabel = comp.value >= 3.5 ? "Excelente" : comp.value >= 2.5 ? "Adecuado" : comp.value >= 1.5 ? "Básico" : comp.value > 0 ? "Deficiente" : "N/A";

          // SVG gauge arc
          const r = 42;
          const circumference = Math.PI * r; // half circle
          const offset = circumference - (pct / 100) * circumference;

          return (
            <div
              key={comp.key}
              className="relative flex flex-col items-center p-3 rounded-xl border border-gray-100 hover:border-sidebar/30 hover:shadow-sm transition-all cursor-default animate-fade-in"
              style={{ animationDelay: `${i * 60}ms` }}
              onMouseEnter={() => setHoveredKey(comp.key)}
              onMouseLeave={() => setHoveredKey(null)}
            >
              {/* Gauge */}
              <svg width="96" height="56" viewBox="0 0 96 56" className="mb-1.5">
                {/* Background arc */}
                <path
                  d="M 6 50 A 42 42 0 0 1 90 50"
                  fill="none"
                  stroke="#f3f4f6"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                {/* Value arc */}
                <path
                  d="M 6 50 A 42 42 0 0 1 90 50"
                  fill="none"
                  stroke={color}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${circumference}`}
                  strokeDashoffset={offset}
                  className="transition-all duration-700"
                />
                {/* Score text */}
                <text x="48" y="44" textAnchor="middle" dominantBaseline="middle"
                  style={{ fontSize: "20px", fontWeight: 700, fill: color }}>
                  {comp.value > 0 ? comp.value.toFixed(1) : "—"}
                </text>
              </svg>

              {/* Label */}
              <p className="text-xs font-semibold text-gray-700 text-center leading-tight min-h-[32px] flex items-center">
                {comp.label}
              </p>
              <p className="text-[10px] font-medium mt-0.5" style={{ color }}>
                {levelLabel}
              </p>

              {/* Tooltip on hover */}
              {hoveredKey === comp.key && COMP_DEFINITIONS[comp.key] && (
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-gray-900 text-white text-[10px] leading-relaxed rounded-lg px-3 py-2 shadow-lg pointer-events-none">
                  {COMP_DEFINITIONS[comp.key]}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
