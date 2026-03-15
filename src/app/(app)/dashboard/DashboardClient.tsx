"use client";

import CountUp from "@/components/CountUp";
import { Flame, MessageSquare, TrendingUp } from "lucide-react";

type StatCardProps = {
  type: "streak" | "sessions" | "score";
  value: number;
};

export default function DashboardClient({ type, value }: StatCardProps) {
  if (type === "streak") {
    return (
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-sm">
          <Flame size={24} className="text-white" />
        </div>
        <div>
          <CountUp end={value} className="text-3xl font-bold text-gray-900" />
          <p className="text-xs text-gray-500 mt-0.5">Días de racha</p>
          {value >= 3 && (
            <p className="text-[10px] text-orange-500 font-medium mt-0.5">
              ¡Sigue así!
            </p>
          )}
        </div>
      </div>
    );
  }

  if (type === "sessions") {
    return (
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-sm">
          <MessageSquare size={24} className="text-white" />
        </div>
        <div>
          <CountUp end={value} className="text-3xl font-bold text-gray-900" />
          <p className="text-xs text-gray-500 mt-0.5">Sesiones totales</p>
        </div>
      </div>
    );
  }

  // score
  return (
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-sm">
        <TrendingUp size={24} className="text-white" />
      </div>
      <div>
        {value > 0 ? (
          <CountUp end={value} decimals={1} className="text-3xl font-bold text-gray-900" />
        ) : (
          <p className="text-3xl font-bold text-gray-900">—</p>
        )}
        <p className="text-xs text-gray-500 mt-0.5">Puntaje promedio</p>
        {value >= 7 && (
          <p className="text-[10px] text-emerald-500 font-medium mt-0.5">
            Excelente rendimiento
          </p>
        )}
      </div>
    </div>
  );
}
