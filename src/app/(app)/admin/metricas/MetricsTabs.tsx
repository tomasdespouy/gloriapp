"use client";

import { useState } from "react";
import { Activity, BarChart3, Server } from "lucide-react";
import LiveMetrics from "./LiveMetrics";
import SystemMetrics from "./SystemMetrics";

export default function MetricsTabs({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState<"live" | "historic" | "system">("live");

  return (
    <div>
      <div className="flex border-b border-gray-200 mb-6 px-4 sm:px-8">
        <button
          onClick={() => setTab("live")}
          className={`tab-btn flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
            tab === "live" ? "border-green-500 text-green-600" : "border-transparent text-gray-400"
          }`}
        >
          <Activity size={16} />
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          En vivo
        </button>
        <button
          onClick={() => setTab("historic")}
          className={`tab-btn flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
            tab === "historic" ? "border-sidebar text-sidebar" : "border-transparent text-gray-400"
          }`}
        >
          <BarChart3 size={16} />
          Historico
        </button>
        <button
          onClick={() => setTab("system")}
          className={`tab-btn flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
            tab === "system" ? "border-purple-500 text-purple-600" : "border-transparent text-gray-400"
          }`}
        >
          <Server size={16} />
          Sistema
        </button>
      </div>

      {tab === "live" && (
        <div className="px-4 sm:px-8 pb-8">
          <LiveMetrics />
        </div>
      )}
      {tab === "historic" && children}
      {tab === "system" && (
        <div className="px-4 sm:px-8 pb-8">
          <SystemMetrics />
        </div>
      )}
    </div>
  );
}
