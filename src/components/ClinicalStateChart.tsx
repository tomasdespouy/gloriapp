"use client";

import { useState, useEffect } from "react";
import { Activity, Lock } from "lucide-react";

interface StatePoint {
  turn_number: number;
  intervention_type: string;
  resistencia: number;
  alianza: number;
  apertura_emocional: number;
  sintomatologia: number;
  disposicion_cambio: number;
}

const DIMENSIONS = [
  { key: "alianza", label: "Alianza", color: "#4A55A2" },
  { key: "apertura_emocional", label: "Apertura emocional", color: "#22C55E" },
  { key: "resistencia", label: "Resistencia", color: "#EF4444" },
  { key: "sintomatologia", label: "Sintomatología", color: "#F59E0B" },
  { key: "disposicion_cambio", label: "Disposición al cambio", color: "#8B5CF6" },
] as const;

type DimKey = typeof DIMENSIONS[number]["key"];

interface Props {
  conversationId: string;
  canView: boolean;
}

export default function ClinicalStateChart({ conversationId, canView }: Props) {
  const [data, setData] = useState<StatePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleDims, setVisibleDims] = useState<Set<DimKey>>(
    new Set(["alianza", "apertura_emocional", "resistencia"])
  );
  const [hoveredTurn, setHoveredTurn] = useState<number | null>(null);

  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    fetch(`/api/sessions/${conversationId}/clinical-state`)
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((res) => setData(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [conversationId, canView]);

  if (!canView) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-2">
          <Lock size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-500">Dinámica clínica</h3>
        </div>
        <p className="text-xs text-gray-400">
          Disponible cuando tu docente apruebe la retroalimentación.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-sidebar animate-pulse" />
          <span className="text-sm text-gray-400">Cargando dinámica clínica...</span>
        </div>
      </div>
    );
  }

  if (data.length < 2) return null;

  // Chart dimensions
  const W = 600, H = 200, PAD_L = 40, PAD_R = 16, PAD_T = 12, PAD_B = 28;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const maxTurn = data[data.length - 1].turn_number;
  const minTurn = data[0].turn_number;
  const xScale = (turn: number) => PAD_L + ((turn - minTurn) / Math.max(maxTurn - minTurn, 1)) * chartW;
  const yScale = (val: number) => PAD_T + chartH - (val / 10) * chartH;

  const toggleDim = (key: DimKey) => {
    setVisibleDims((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  };

  const hoveredPoint = hoveredTurn != null ? data.find((d) => d.turn_number === hoveredTurn) : null;

  const INTERVENTION_LABELS: Record<string, string> = {
    pregunta_abierta: "Pregunta abierta",
    pregunta_cerrada: "Pregunta cerrada",
    validacion_empatica: "Validación empática",
    reformulacion: "Reformulación",
    confrontacion: "Confrontación",
    silencio_terapeutico: "Silencio terapéutico",
    directividad: "Directividad",
    interpretacion: "Interpretación",
    normalizacion: "Normalización",
    resumen: "Resumen",
    otro: "Otro",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={16} className="text-sidebar" />
        <h3 className="text-sm font-semibold text-gray-900">Dinámica clínica del paciente</h3>
      </div>

      {/* Legend / toggles */}
      <div className="flex flex-wrap gap-2 mb-3">
        {DIMENSIONS.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => toggleDim(key)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors ${
              visibleDims.has(key)
                ? "border-current text-gray-900"
                : "border-gray-200 text-gray-400"
            }`}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: visibleDims.has(key) ? color : "#D1D5DB" }}
            />
            {label}
          </button>
        ))}
      </div>

      {/* SVG Chart */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {[0, 2.5, 5, 7.5, 10].map((v) => (
          <g key={v}>
            <line
              x1={PAD_L} y1={yScale(v)} x2={W - PAD_R} y2={yScale(v)}
              stroke="#F3F4F6" strokeWidth={1}
            />
            <text x={PAD_L - 6} y={yScale(v) + 3} textAnchor="end" fontSize={9} fill="#9CA3AF">
              {v}
            </text>
          </g>
        ))}

        {/* X axis labels */}
        {data.map((d) => (
          <text
            key={d.turn_number}
            x={xScale(d.turn_number)}
            y={H - 4}
            textAnchor="middle"
            fontSize={8}
            fill="#9CA3AF"
          >
            {d.turn_number}
          </text>
        ))}

        {/* Lines */}
        {DIMENSIONS.filter(({ key }) => visibleDims.has(key)).map(({ key, color }) => {
          const points = data.map((d) => `${xScale(d.turn_number)},${yScale(d[key])}`).join(" ");
          return (
            <polyline
              key={key}
              points={points}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}

        {/* Dots */}
        {DIMENSIONS.filter(({ key }) => visibleDims.has(key)).map(({ key, color }) =>
          data.map((d) => (
            <circle
              key={`${key}-${d.turn_number}`}
              cx={xScale(d.turn_number)}
              cy={yScale(d[key])}
              r={hoveredTurn === d.turn_number ? 4 : 2.5}
              fill={color}
              stroke="white"
              strokeWidth={1}
            />
          ))
        )}

        {/* Hover zones */}
        {data.map((d) => (
          <rect
            key={`hover-${d.turn_number}`}
            x={xScale(d.turn_number) - chartW / data.length / 2}
            y={PAD_T}
            width={chartW / data.length}
            height={chartH}
            fill="transparent"
            onMouseEnter={() => setHoveredTurn(d.turn_number)}
            onMouseLeave={() => setHoveredTurn(null)}
          />
        ))}

        {/* Hover line */}
        {hoveredTurn != null && (
          <line
            x1={xScale(hoveredTurn)} y1={PAD_T} x2={xScale(hoveredTurn)} y2={PAD_T + chartH}
            stroke="#E5E7EB" strokeWidth={1} strokeDasharray="3,3"
          />
        )}
      </svg>

      {/* Tooltip */}
      {hoveredPoint && (
        <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2 text-[11px] animate-fade-in">
          <span className="font-semibold text-gray-700">
            Turno {hoveredPoint.turn_number}
          </span>
          <span className="text-gray-400 ml-2">
            {INTERVENTION_LABELS[hoveredPoint.intervention_type] || hoveredPoint.intervention_type}
          </span>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
            {DIMENSIONS.filter(({ key }) => visibleDims.has(key)).map(({ key, label, color }) => (
              <span key={key} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-gray-500">{label}:</span>
                <span className="font-medium text-gray-800">{hoveredPoint[key].toFixed(1)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
