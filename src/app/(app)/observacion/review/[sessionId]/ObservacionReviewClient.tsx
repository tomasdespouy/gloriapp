"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, Radio } from "lucide-react";

// Read-only view de una sesión LLM guardada. El shape llm_v1 vive
// dentro de semantic_analysis (JSONB) y trae turns + summary +
// temperatura + alertas + raw transcript.
//
// Sesiones del walkie-talkie viejo tienen otro shape — si nos topamos
// con una, mostramos un fallback simple. (Tras el DELETE acordado
// post-deploy esto no debería ocurrir, pero la defensa cuesta poco).

type SafetyFlags = { profanity: string[]; clinical_risk: string[] };

type Turn = {
  speaker: string;
  text: string;
  confidence: string;
  overlap: string;
  tone: string;
  safety_flags: SafetyFlags;
};

type LlmAnalysis = {
  version?: string;
  // Metadata ingresada por el usuario antes de grabar
  session_name?: string | null;
  session_description?: string | null;
  therapist_name?: string | null;
  patient_name?: string | null;
  turns?: Turn[];
  speakers?: Array<{ label: string; role: string }>;
  overlaps_detected?: number;
  coverage_pct?: number;
  summary?: string;
  conversation_temperature?: string;
  temperature_reason?: string;
  safety_summary?: { profanity_turns: number; clinical_risk_turns: number };
  notes?: string;
  raw_transcript?: string;
  enriched_transcript?: string;
};

interface ObservationSession {
  id: string;
  title: string;
  status: string;
  total_duration_seconds: number | null;
  semantic_analysis: LlmAnalysis | Record<string, unknown> | null;
  created_at: string;
  ended_at: string | null;
}

const SPEAKER_TERAPEUTA = "TERAPEUTA";
const SPEAKER_PACIENTE = "PACIENTE";

const TEMPERATURE_STYLES: Record<string, { color: string; label: string; emoji: string }> = {
  tranquila:    { color: "bg-emerald-100 text-emerald-800 border-emerald-300", label: "Tranquila",    emoji: "🟢" },
  exploratoria: { color: "bg-sky-100 text-sky-800 border-sky-300",             label: "Exploratoria", emoji: "🔵" },
  emocional:    { color: "bg-amber-100 text-amber-800 border-amber-300",       label: "Emocional",    emoji: "🟠" },
  tensa:        { color: "bg-rose-100 text-rose-800 border-rose-300",          label: "Tensa",        emoji: "🔴" },
  fragmentada:  { color: "bg-violet-100 text-violet-800 border-violet-300",    label: "Fragmentada",  emoji: "🟣" },
};

const TONE_STYLES: Record<string, { color: string; label: string }> = {
  calmado:   { color: "bg-emerald-50 border-emerald-200 text-emerald-800", label: "calmado" },
  emocional: { color: "bg-amber-50 border-amber-200 text-amber-800",       label: "emocional" },
  evasivo:   { color: "bg-violet-50 border-violet-200 text-violet-800",    label: "evasivo" },
  asertivo:  { color: "bg-sky-50 border-sky-200 text-sky-800",             label: "asertivo" },
  neutro:    { color: "bg-gray-50 border-gray-200 text-gray-700",          label: "neutro" },
};

function formatDuration(s: number | null) {
  if (s === null || s === undefined) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

export default function ObservacionReviewClient({
  session,
}: {
  session: ObservationSession;
}) {
  const router = useRouter();
  const analysis = (session.semantic_analysis || {}) as LlmAnalysis;
  const isLlmShape = analysis.version === "llm_v1" || Array.isArray(analysis.turns);

  return (
    <div className="px-4 sm:px-8 py-5 max-w-5xl mx-auto">
      <button
        onClick={() => router.push("/historial")}
        className="flex items-center gap-1.5 text-xs text-sidebar hover:underline mb-4"
      >
        <ArrowLeft size={14} /> Volver al historial
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-start gap-4">
        <div className="w-11 h-11 rounded-full bg-sidebar/10 flex items-center justify-center flex-shrink-0">
          <Radio size={22} className="text-sidebar" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-gray-900">{session.title}</p>
          {analysis.patient_name && analysis.session_name && (
            <p className="text-sm text-orange-700 mt-0.5">Paciente — {analysis.patient_name}</p>
          )}
          {analysis.therapist_name && (
            <p className="text-xs text-indigo-700 mt-0.5">Terapeuta — {analysis.therapist_name}</p>
          )}
          {analysis.session_description && (
            <p className="text-xs text-gray-600 mt-2 leading-relaxed italic">{analysis.session_description}</p>
          )}
          <p className="text-xs text-gray-500 mt-2">
            {formatDate(session.created_at)} · <Clock size={11} className="inline" /> {formatDuration(session.total_duration_seconds)}
          </p>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
          session.status === "completed" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
        }`}>
          {session.status === "completed" ? "Completada" : session.status === "active" ? "En curso" : "Abandonada"}
        </span>
      </div>

      {!isLlmShape && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3 mb-4">
          Esta sesión fue grabada con el módulo anterior (walkie-talkie) y no tiene el formato nuevo.
          Su detalle no es visible en esta vista. Al iniciar una nueva grabación se guardará con el formato actualizado.
        </div>
      )}

      {isLlmShape && (
        <div className="space-y-4">
          {/* Safety banner */}
          {analysis.safety_summary && (
            (analysis.safety_summary.clinical_risk_turns > 0 || analysis.safety_summary.profanity_turns > 0) && (
              <div className={`border-2 rounded-lg p-3 space-y-1 ${
                analysis.safety_summary.clinical_risk_turns > 0
                  ? "bg-rose-50 border-rose-300 text-rose-900"
                  : "bg-amber-50 border-amber-300 text-amber-900"
              }`}>
                <p className="text-xs font-semibold uppercase tracking-wide">
                  {analysis.safety_summary.clinical_risk_turns > 0 ? "🚨 Alertas de seguridad" : "⚠ Alertas de lenguaje"}
                </p>
                <ul className="text-sm space-y-0.5">
                  {analysis.safety_summary.clinical_risk_turns > 0 && (
                    <li><strong>{analysis.safety_summary.clinical_risk_turns}</strong> turno(s) con posible riesgo clínico.</li>
                  )}
                  {analysis.safety_summary.profanity_turns > 0 && (
                    <li><strong>{analysis.safety_summary.profanity_turns}</strong> turno(s) con vulgaridad detectada.</li>
                  )}
                </ul>
              </div>
            )
          )}

          {/* Notes */}
          {analysis.notes && (
            <div className={`border text-xs rounded-lg px-3 py-2 ${
              analysis.notes.startsWith("⚠")
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}>
              <strong>Notas:</strong> {analysis.notes}
            </div>
          )}

          {/* Summary */}
          {analysis.summary && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-indigo-700 font-semibold">Resumen</p>
              <p className="text-sm leading-relaxed text-indigo-900">{analysis.summary}</p>
            </div>
          )}

          {/* Temperature */}
          {analysis.conversation_temperature && (() => {
            const style = TEMPERATURE_STYLES[analysis.conversation_temperature] || TEMPERATURE_STYLES.tranquila;
            return (
              <div className={`border rounded-lg p-3 flex items-start gap-3 ${style.color}`}>
                <span className="text-2xl flex-shrink-0">{style.emoji}</span>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold">Temperatura de la conversación</p>
                  <p className="text-base font-bold">{style.label}</p>
                  {analysis.temperature_reason && (
                    <p className="text-xs mt-0.5 opacity-90">{analysis.temperature_reason}</p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Turns */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap pb-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase">
                Transcripción ({analysis.turns?.length || 0} turnos)
              </p>
              <div className="flex items-center gap-3 text-[11px] text-gray-500">
                {typeof analysis.overlaps_detected === "number" && (
                  <span>{analysis.overlaps_detected} overlaps</span>
                )}
                {typeof analysis.coverage_pct === "number" && (
                  <span className={analysis.coverage_pct >= 95 ? "text-emerald-700" : "text-rose-700 font-semibold"}>
                    cobertura {analysis.coverage_pct}%
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {(analysis.turns || []).map((turn, i) => (
                <TurnRow key={i} turn={turn} idx={i} />
              ))}
            </div>
          </div>

          {/* Raw transcript */}
          {analysis.raw_transcript && (
            <details className="bg-white rounded-xl border border-gray-200 p-3">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                Ver transcripción cruda (raw)
              </summary>
              <pre className="text-[11px] font-mono text-gray-600 whitespace-pre-wrap leading-relaxed mt-2 bg-gray-50 p-3 rounded">
                {analysis.raw_transcript}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function TurnRow({ turn, idx }: { turn: Turn; idx: number }) {
  const isTer = turn.speaker === SPEAKER_TERAPEUTA;
  const isPac = turn.speaker === SPEAKER_PACIENTE;
  const speakerColor = isTer ? "bg-indigo-50 border-indigo-200 text-indigo-900"
    : isPac ? "bg-orange-50 border-orange-200 text-orange-900"
    : "bg-gray-50 border-gray-200 text-gray-700";
  const speakerBadge = isTer ? "bg-indigo-600 text-white"
    : isPac ? "bg-orange-500 text-white"
    : "bg-gray-400 text-white";
  const confColor = turn.confidence === "alta" ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : turn.confidence === "media" ? "text-amber-700 bg-amber-50 border-amber-200"
    : "text-rose-700 bg-rose-50 border-rose-200";
  const toneStyle = TONE_STYLES[turn.tone] || TONE_STYLES.neutro;

  const hasRisk = turn.safety_flags?.clinical_risk?.length > 0;
  const hasProfanity = turn.safety_flags?.profanity?.length > 0;
  const safetyBorder = hasRisk ? "ring-2 ring-rose-400" : hasProfanity ? "ring-2 ring-amber-400" : "";

  return (
    <div className={`border rounded-lg p-3 ${speakerColor} ${safetyBorder}`}>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${speakerBadge}`}>
          #{idx + 1} · {turn.speaker}
        </span>
        {turn.overlap !== "ninguno" && turn.overlap && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded border bg-amber-50 border-amber-300 text-amber-800">
            {turn.overlap === "solapado" ? "🔀 solapado" : "✂ interrupción"}
          </span>
        )}
        {turn.confidence && (
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${confColor}`}>
            confianza: {turn.confidence}
          </span>
        )}
        {turn.tone && (
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${toneStyle.color}`}>
            tono: {toneStyle.label}
          </span>
        )}
        {hasRisk && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded border bg-rose-100 border-rose-400 text-rose-900">
            🚨 riesgo clínico: {turn.safety_flags.clinical_risk.join(", ")}
          </span>
        )}
        {hasProfanity && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded border bg-amber-100 border-amber-400 text-amber-900">
            ⚠ lenguaje: {turn.safety_flags.profanity.join(", ")}
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-gray-800">{turn.text}</p>
    </div>
  );
}
