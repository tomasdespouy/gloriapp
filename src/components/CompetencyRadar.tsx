"use client";

import { COMPETENCY_LABELS_V2, COMPETENCY_KEYS_V2, COMPETENCY_DOMAINS, SCORE_LEVELS, type CompetencyScoresV2 } from "@/lib/gamification";

// Also support legacy scores
import type { CompetencyScores } from "@/lib/gamification";

interface Props {
  scores: CompetencyScoresV2 | CompetencyScores;
  size?: number;
  version?: 1 | 2;
}

export default function CompetencyRadar({ scores, size = 400, version = 2 }: Props) {
  if (version === 1) return <RadarV1 scores={scores as CompetencyScores} size={size} />;
  return <RadarV2 scores={scores as CompetencyScoresV2} size={size} />;
}

function RadarV2({ scores, size }: { scores: CompetencyScoresV2; size: number }) {
  const pad = 85;
  const vb = size + pad * 2;
  const center = vb / 2;
  const radius = size * 0.38;
  const labelRadius = radius + 45;
  const gridLevels = 4; // 0-4 scale
  const keys = COMPETENCY_KEYS_V2;
  const n = keys.length;

  const getPoint = (index: number, value: number) => {
    const angle = (2 * Math.PI * index) / n - Math.PI / 2;
    const dist = (value / 4) * radius; // 0-4 scale
    return { x: center + dist * Math.cos(angle), y: center + dist * Math.sin(angle) };
  };

  const getLabelPos = (index: number) => {
    const angle = (2 * Math.PI * index) / n - Math.PI / 2;
    return { x: center + labelRadius * Math.cos(angle), y: center + labelRadius * Math.sin(angle) };
  };

  const polygonPoints = (value: number) =>
    keys.map((_, i) => { const p = getPoint(i, value); return `${p.x},${p.y}`; }).join(" ");

  const dataPoints = keys.map((key, i) => {
    const val = scores[key as keyof CompetencyScoresV2] || 0;
    return { ...getPoint(i, val), val };
  });
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // Color domain sections
  const structureKeys = COMPETENCY_DOMAINS.structure.keys;

  return (
    <svg viewBox={`0 0 ${vb} ${vb}`} className="w-full mx-auto" style={{ maxWidth: size }} overflow="visible">
      {/* Grid */}
      {Array.from({ length: gridLevels }, (_, i) => (
        <polygon key={i} points={polygonPoints(i + 1)}
          fill={i === gridLevels - 1 ? "rgba(74, 85, 162, 0.03)" : "none"}
          stroke="#E5E7EB" strokeWidth="0.8" />
      ))}

      {/* Axes */}
      {keys.map((_, i) => {
        const p = getPoint(i, 4);
        return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="#E5E7EB" strokeWidth="0.8" />;
      })}

      {/* Data area */}
      <polygon points={dataPolygon} fill="rgba(74, 85, 162, 0.12)" stroke="#4A55A2" strokeWidth="2.5" strokeLinejoin="round" />

      {/* Data dots */}
      {dataPoints.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="5" fill="#4A55A2" />
          <circle cx={p.x} cy={p.y} r="3" fill="white" />
        </g>
      ))}

      {/* Labels */}
      {keys.map((key, i) => {
        const pos = getLabelPos(i);
        const score = scores[key as keyof CompetencyScoresV2] || 0;
        const level = SCORE_LEVELS.find(l => l.value === Math.round(score)) || SCORE_LEVELS[0];
        const isDomain1 = structureKeys.includes(key);

        return (
          <g key={i}>
            <text x={pos.x} y={pos.y - 9} textAnchor="middle" dominantBaseline="middle"
              className="font-bold" style={{ fontSize: "12.5px", fill: isDomain1 ? "#7C3AED" : "#4A55A2" }}>
              {COMPETENCY_LABELS_V2[key]}
            </text>
            <text x={pos.x} y={pos.y + 8} textAnchor="middle" dominantBaseline="middle"
              style={{ fontSize: "12px", fontWeight: 700, fill: score > 0 ? level.color : "#9ca3af" }}>
              {score > 0 ? score.toFixed(1) : "N/A"}
            </text>
          </g>
        );
      })}

      {/* Domain legend */}
      <g>
        <circle cx={center - 90} cy={vb - 28} r="4" fill="#7C3AED" />
        <text x={center - 82} y={vb - 24} style={{ fontSize: "11px", fontWeight: 600, fill: "#6b7280" }}>
          Estructura de la sesión
        </text>
        <circle cx={center + 40} cy={vb - 28} r="4" fill="#4A55A2" />
        <text x={center + 48} y={vb - 24} style={{ fontSize: "11px", fontWeight: 600, fill: "#6b7280" }}>
          Actitudes terapéuticas
        </text>
      </g>

      {/* Scale legend */}
      <text x={center} y={vb - 5} textAnchor="middle" style={{ fontSize: "11px", fontWeight: 500, fill: "#6b7280" }}>
        Escala: 0 (N/A) · 1 (Deficiente) · 2 (Básico) · 3 (Adecuado) · 4 (Excelente)
      </text>
    </svg>
  );
}

// Legacy V1 radar (for old sessions)
function RadarV1({ scores, size }: { scores: CompetencyScores; size: number }) {
  const LABELS: Record<string, string> = {
    empathy: "Empatía", active_listening: "Escucha activa", open_questions: "Preguntas abiertas",
    reformulation: "Reformulación", confrontation: "Confrontación", silence_management: "Silencios", rapport: "Rapport",
  };
  const keys = Object.keys(LABELS);
  const pad = 65;
  const vb = size + pad * 2;
  const center = vb / 2;
  const radius = size * 0.36;
  const labelRadius = radius + 36;
  const n = keys.length;

  const getPoint = (index: number, value: number) => {
    const angle = (2 * Math.PI * index) / n - Math.PI / 2;
    return { x: center + (value / 10) * radius * Math.cos(angle), y: center + (value / 10) * radius * Math.sin(angle) };
  };

  const polygonPoints = (value: number) => keys.map((_, i) => { const p = getPoint(i, value); return `${p.x},${p.y}`; }).join(" ");
  const dataPoints = keys.map((key, i) => ({ ...getPoint(i, (scores as Record<string, number>)[key] || 0), val: (scores as Record<string, number>)[key] || 0 }));

  return (
    <svg viewBox={`0 0 ${vb} ${vb}`} className="w-full mx-auto" style={{ maxWidth: size }} overflow="visible">
      {Array.from({ length: 5 }, (_, i) => <polygon key={i} points={polygonPoints(((i + 1) / 5) * 10)} fill="none" stroke="#E5E7EB" strokeWidth="0.8" />)}
      {keys.map((_, i) => { const p = getPoint(i, 10); return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="#E5E7EB" strokeWidth="0.8" />; })}
      <polygon points={dataPoints.map(p => `${p.x},${p.y}`).join(" ")} fill="rgba(74,85,162,0.12)" stroke="#4A55A2" strokeWidth="2.5" strokeLinejoin="round" />
      {dataPoints.map((p, i) => <g key={i}><circle cx={p.x} cy={p.y} r="5" fill="#4A55A2" /><circle cx={p.x} cy={p.y} r="3" fill="white" /></g>)}
      {keys.map((key, i) => {
        const pos = { x: center + labelRadius * Math.cos((2 * Math.PI * i) / n - Math.PI / 2), y: center + labelRadius * Math.sin((2 * Math.PI * i) / n - Math.PI / 2) };
        return <text key={i} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle" className="fill-gray-600 font-semibold" style={{ fontSize: "11px" }}>{LABELS[key]}</text>;
      })}
    </svg>
  );
}
