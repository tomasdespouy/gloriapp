"use client";

import { getLevelInfo } from "@/lib/gamification";
import { Eye, Pencil, GraduationCap, Award, Crown } from "lucide-react";
import CountUp from "@/components/CountUp";

const levelIcons = [Eye, Pencil, GraduationCap, Award, Crown];
const levelColors = [
  "from-gray-400 to-gray-500",
  "from-blue-400 to-blue-600",
  "from-emerald-400 to-emerald-600",
  "from-amber-400 to-amber-600",
  "from-purple-400 to-purple-600",
];

interface Props {
  totalXp: number;
  showBar?: boolean;
  size?: "default" | "large";
}

export default function LevelBadge({ totalXp, showBar = true, size = "default" }: Props) {
  const { current, next, xpInLevel, xpForNext, progress } = getLevelInfo(totalXp);
  const Icon = levelIcons[current.level - 1] || Eye;
  const gradient = levelColors[current.level - 1] || levelColors[0];

  if (size === "large") {
    return (
      <div className="flex items-center gap-4">
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
          <Icon size={28} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Nivel {current.level}</p>
          <p className="text-xl font-bold text-gray-900">{current.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <CountUp end={totalXp} className="text-sm font-semibold text-sidebar" suffix=" XP" />
          </div>
          {showBar && next && (
            <div className="mt-2">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sidebar to-[#354080] rounded-full animate-fill"
                  style={{ width: `${Math.min(progress * 100, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                {xpInLevel} de {xpForNext} XP para <span className="font-medium text-gray-600">{next.name}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">
            Nivel {current.level}: {current.name}
          </span>
          <span className="text-xs text-gray-400">{totalXp} XP</span>
        </div>
        {showBar && next && (
          <div className="mt-1">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sidebar to-[#354080] rounded-full animate-fill"
                style={{ width: `${Math.min(progress * 100, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {xpInLevel}/{xpForNext} XP para {next.name}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
