"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, Radio } from "lucide-react";

interface ObservationSession {
  id: string;
  title: string;
  status: string;
  total_duration_seconds: number;
  semantic_analysis: Record<string, unknown> | null;
  created_at: string;
  ended_at: string | null;
}

interface Segment {
  id: string;
  speaker: "observer" | "patient";
  transcript: string | null;
  duration_seconds: number;
  segment_order: number;
  created_at: string;
}

export default function ObservacionReviewClient({
  session,
  segments,
}: {
  session: ObservationSession;
  segments: Segment[];
}) {
  const router = useRouter();

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    return `${d.getDate()} de ${months[d.getMonth()]} ${d.getFullYear()}, ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const analysis = session.semantic_analysis as Record<string, unknown> | null;

  return (
    <div className="px-4 sm:px-8 py-5">
      <button onClick={() => router.push("/historial")} className="flex items-center gap-1.5 text-xs text-sidebar hover:underline mb-4">
        <ArrowLeft size={14} /> Volver al historial
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-sidebar/10 flex items-center justify-center flex-shrink-0">
          <Radio size={22} className="text-sidebar" />
        </div>
        <div className="flex-1">
          <p className="text-base font-bold text-gray-900">{session.title}</p>
          <p className="text-xs text-gray-500">
            {formatDate(session.created_at)} · {formatTime(session.total_duration_seconds)}
          </p>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
          session.status === "completed" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
        }`}>
          {session.status === "completed" ? "Completada" : session.status === "active" ? "En curso" : "Abandonada"}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        {/* Left: Transcript */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Transcripción ({segments.length} segmentos)
            </p>
          </div>
          <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
            {segments.length > 0 ? segments.map((seg) => (
              <div key={seg.id} className={`flex ${seg.speaker === "observer" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  seg.speaker === "observer"
                    ? "bg-sidebar text-white rounded-br-md"
                    : "bg-gray-100 text-gray-800 rounded-bl-md"
                }`}>
                  <p className={`text-[10px] font-medium mb-0.5 ${
                    seg.speaker === "observer" ? "text-white/60" : "text-gray-400"
                  }`}>
                    {seg.speaker === "observer" ? "Observador" : "Paciente"}
                  </p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {seg.transcript || "(sin transcripción)"}
                  </p>
                  <p className={`text-[9px] mt-1 ${
                    seg.speaker === "observer" ? "text-white/40" : "text-gray-300"
                  }`}>
                    <Clock size={9} className="inline mr-0.5" />
                    {formatTime(seg.duration_seconds)}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-gray-400 text-center py-8">Sin segmentos registrados</p>
            )}
          </div>
        </div>

        {/* Right: Semantic analysis */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Radio size={14} className="text-sidebar" />
              <p className="text-xs font-semibold text-gray-500 uppercase">Análisis semántico</p>
            </div>
            {analysis ? (
              <div className="space-y-3">
                {typeof analysis.summary === "string" && (
                  <p className="text-sm text-gray-700 leading-relaxed">{analysis.summary}</p>
                )}
                {Array.isArray(analysis.themes) && analysis.themes.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Temas identificados</p>
                    {(analysis.themes as string[]).map((t, i) => (
                      <p key={i} className="text-xs text-gray-600 mb-0.5">&#8226; {t}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">
                Análisis no disponible aún
              </p>
            )}
          </div>

          {/* Session info */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Detalles de la sesión</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Duración total</span>
                <span className="text-xs font-medium text-gray-700">{formatTime(session.total_duration_seconds)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Segmentos</span>
                <span className="text-xs font-medium text-gray-700">{segments.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Observador</span>
                <span className="text-xs font-medium text-gray-700">{segments.filter(s => s.speaker === "observer").length} intervenciones</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Paciente</span>
                <span className="text-xs font-medium text-gray-700">{segments.filter(s => s.speaker === "patient").length} intervenciones</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
