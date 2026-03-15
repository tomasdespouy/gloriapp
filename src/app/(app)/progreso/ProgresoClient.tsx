"use client";

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

  // type === "bars"
  if (props.type === "bars" && props.compData) {
    return (
      <div className="space-y-4">
        {props.compData.map((comp, i) => {
          const pct = (comp.value / 4) * 100;
          const color = comp.value >= 3.5 ? "#22c55e" : comp.value >= 2.5 ? "#eab308" : comp.value >= 1.5 ? "#f97316" : "#ef4444";
          const label = comp.value >= 3.5 ? "Excelente" : comp.value >= 2.5 ? "Adecuado" : comp.value >= 1.5 ? "Básico" : comp.value > 0 ? "Deficiente" : "N/A";

          return (
            <div key={comp.key} className="animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-sm font-medium text-gray-700">{comp.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{
                    backgroundColor: `${color}15`,
                    color,
                  }}>
                    {label}
                  </span>
                  <CountUp end={comp.value} decimals={1} className="text-sm font-bold text-gray-900" />
                </div>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full animate-fill"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: color,
                    animationDelay: `${i * 80 + 200}ms`,
                    animationFillMode: "backwards",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}
