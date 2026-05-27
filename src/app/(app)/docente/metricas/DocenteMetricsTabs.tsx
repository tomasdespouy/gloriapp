"use client";

import { useState } from "react";
import { BarChart3, Users } from "lucide-react";
import MonitorPanel from "@/components/monitor/MonitorPanel";

// Tabs de la vista de métricas docente: las métricas grupales existentes y
// el nuevo panel "Personas". El alcance lo recorta el servidor según la
// autoridad del instructor (su sección → curso → establecimiento), así que
// basta con montar MonitorPanel con scope={kind:"all"}.

export default function DocenteMetricsTabs({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState<"grupales" | "personas">("grupales");

  return (
    <div>
      <div className="flex border-b border-gray-200 px-4 sm:px-8">
        <button
          onClick={() => setTab("grupales")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap cursor-pointer ${
            tab === "grupales" ? "border-sidebar text-sidebar" : "border-transparent text-gray-400"
          }`}
        >
          <BarChart3 size={16} />
          Métricas grupales
        </button>
        <button
          onClick={() => setTab("personas")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap cursor-pointer ${
            tab === "personas" ? "border-sidebar text-sidebar" : "border-transparent text-gray-400"
          }`}
        >
          <Users size={16} />
          Personas
        </button>
      </div>

      {tab === "grupales" && children}
      {tab === "personas" && (
        <div className="px-4 sm:px-8 py-6">
          <header className="mb-5">
            <div className="flex items-center gap-2.5">
              <Users size={22} className="text-[#4A55A2]" />
              <h1 className="text-2xl font-bold text-[#1A1A1A]">Personas</h1>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Seguimiento en vivo de tus estudiantes y acceso rápido a sus conversaciones
            </p>
          </header>
          <MonitorPanel scope={{ kind: "all" }} />
        </div>
      )}
    </div>
  );
}
