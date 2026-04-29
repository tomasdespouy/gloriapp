"use client";

import { useEffect, useRef, useState } from "react";

// Spike: diarización post-hoc con LLM. El observador aprieta "Iniciar",
// graba la sesión completa sin walkie-talkie, y al detener manda el
// audio al endpoint /api/live-session-llm que devuelve los turnos
// separados por speaker, summary, temperatura de la conversación,
// tono por turno y alertas de seguridad.
//
// La idea es validar si el approach LLM (sin enrollment, sin Eagle)
// resuelve el caso clínico. La UI permite corregir manualmente cada
// turno por si el LLM se equivoca.

type Phase = "idle" | "recording" | "processing" | "ready" | "error";

type SafetyFlags = {
  profanity: string[];
  clinical_risk: string[];
};

type Turn = {
  speaker: string;
  text: string;
  confidence: "alta" | "media" | "baja" | string;
  overlap: "ninguno" | "solapado" | "interrupcion" | string;
  tone: "calmado" | "emocional" | "evasivo" | "asertivo" | "neutro" | string;
  safety_flags: SafetyFlags;
};

type DiarizationResult = {
  raw_transcript: string;
  enriched_transcript?: string;
  speakers: Array<{ label: string; role: string }>;
  turns: Turn[];
  overlaps_detected: number;
  coverage_pct?: number;
  summary: string;
  conversation_temperature: string;
  temperature_reason: string;
  safety_summary: { profanity_turns: number; clinical_risk_turns: number };
  notes: string;
  timings_ms?: { whisper: number; llm: number; total: number };
};

const SPEAKER_TERAPEUTA = "TERAPEUTA";
const SPEAKER_PACIENTE = "PACIENTE";

const SOFT_LIMIT_SECONDS = 30 * 60;
const HARD_HINT_SECONDS = 60 * 60;

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

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function SpikeClient() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiarizationResult | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>("");

  // Inputs opcionales para anclar identidades en la diarizacion.
  const [therapistName, setTherapistName] = useState("");
  const [patientName, setPatientName] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleStart = async () => {
    setError(null);
    setResult(null);
    setSeconds(0);
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "permiso denegado";
      setError(`No se pudo acceder al micrófono: ${msg}`);
      setPhase("error");
      return;
    }
    streamRef.current = stream;

    const mimeOptions = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
    const supportedMime = mimeOptions.find((m) => MediaRecorder.isTypeSupported(m)) || "";
    const recorder = new MediaRecorder(stream, {
      mimeType: supportedMime || undefined,
      audioBitsPerSecond: 32000,
    });
    mediaRecorderRef.current = recorder;

    recorder.addEventListener("dataavailable", (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    });

    recorder.addEventListener("stop", async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;

      const blob = new Blob(chunksRef.current, { type: supportedMime || "audio/webm" });
      const sizeKB = (blob.size / 1024).toFixed(0);
      setProgressMessage(`Subiendo audio (${sizeKB} KB) y procesando — esto puede tardar 1-3 min para sesiones largas...`);
      setPhase("processing");

      try {
        const fd = new FormData();
        fd.append("audio", blob, `session.${supportedMime.includes("ogg") ? "ogg" : "webm"}`);
        if (therapistName.trim()) fd.append("therapistName", therapistName.trim());
        if (patientName.trim()) fd.append("patientName", patientName.trim());
        const res = await fetch("/api/live-session-llm", { method: "POST", body: fd });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as DiarizationResult;
        setResult(data);
        setPhase("ready");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "error desconocido";
        setError(`Error al procesar: ${msg}`);
        setPhase("error");
      } finally {
        setProgressMessage("");
      }
    });

    recorder.start(1000);
    setPhase("recording");
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const handleStop = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleReset = () => {
    setPhase("idle");
    setSeconds(0);
    setResult(null);
    setError(null);
    setProgressMessage("");
  };

  const handleToggleSpeaker = (idx: number) => {
    setResult((prev) => {
      if (!prev) return prev;
      const turns = [...prev.turns];
      const cur = turns[idx];
      const next = cur.speaker === SPEAKER_TERAPEUTA ? SPEAKER_PACIENTE
        : cur.speaker === SPEAKER_PACIENTE ? SPEAKER_TERAPEUTA
        : SPEAKER_TERAPEUTA;
      turns[idx] = { ...cur, speaker: next };
      return { ...prev, turns };
    });
  };

  const handleEditTurn = (idx: number, newText: string) => {
    setResult((prev) => {
      if (!prev) return prev;
      const turns = [...prev.turns];
      turns[idx] = { ...turns[idx], text: newText };
      return { ...prev, turns };
    });
  };

  const handleDeleteTurn = (idx: number) => {
    setResult((prev) => {
      if (!prev) return prev;
      const turns = prev.turns.filter((_, i) => i !== idx);
      return { ...prev, turns };
    });
  };

  const handleAddTurn = (idx: number, position: "before" | "after") => {
    setResult((prev) => {
      if (!prev) return prev;
      const newTurn: Turn = {
        speaker: SPEAKER_TERAPEUTA,
        text: "",
        confidence: "alta",
        overlap: "ninguno",
        tone: "neutro",
        safety_flags: { profanity: [], clinical_risk: [] },
      };
      const turns = [...prev.turns];
      const insertAt = idx < 0 ? turns.length : (position === "before" ? idx : idx + 1);
      turns.splice(insertAt, 0, newTurn);
      return { ...prev, turns };
    });
  };

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto space-y-5">
      <header className="space-y-1 pb-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold">
            Spike experimental
          </span>
          <span className="text-[10px] text-gray-400">/observacion-spike-llm</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Diarización con LLM</h1>
        <p className="text-sm text-gray-500">
          Pantalla aislada para probar diarización post-hoc: graba toda la sesión continua, al detener
          el audio se transcribe con Whisper y un LLM separa los turnos por contenido. Devuelve summary,
          tono por turno, temperatura de la conversación y alertas de seguridad.
        </p>
      </header>

      {/* Identidades opcionales — buena práctica */}
      {(phase === "idle" || phase === "recording") && (
        <section className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
          <details open={phase === "idle"}>
            <summary className="text-sm font-semibold text-gray-900 cursor-pointer">
              Identidades (opcional · buena práctica)
            </summary>
            <p className="text-xs text-gray-500 mt-1 mb-3">
              Antes de empezar, podés escribir el nombre del/la terapeuta y del/la paciente.
              Si en la sesión se mencionan por nombre, el LLM los usa para anclar la atribución
              de turnos y reduce errores. <strong>No es obligatorio.</strong>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tu nombre (terapeuta)</label>
                <input
                  type="text"
                  value={therapistName}
                  onChange={(e) => setTherapistName(e.target.value)}
                  placeholder="Ej: Tomás"
                  disabled={phase === "recording"}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del/la paciente</label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Ej: Josefina"
                  disabled={phase === "recording"}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:bg-gray-50"
                />
              </div>
            </div>
          </details>
        </section>
      )}

      {/* Recording controls */}
      <section className="border border-gray-200 rounded-xl p-5 bg-white space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            {phase === "idle" && (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-medium hover:bg-rose-700 cursor-pointer"
              >
                <span className="w-3 h-3 rounded-full bg-white" /> Iniciar grabación
              </button>
            )}
            {phase === "recording" && (
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-medium hover:bg-gray-900 cursor-pointer"
              >
                <span className="w-3 h-3 bg-white" /> Detener y procesar
              </button>
            )}
            {(phase === "ready" || phase === "error") && (
              <button
                onClick={handleReset}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 cursor-pointer"
              >
                Nueva sesión
              </button>
            )}
            {phase === "processing" && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Procesando...
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(phase === "recording" || (phase !== "idle" && seconds > 0)) && (
              <span className="font-mono text-xl tabular-nums text-gray-700">{formatTime(seconds)}</span>
            )}
            {phase === "recording" && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="grabando" />
            )}
          </div>
        </div>

        {phase === "recording" && seconds >= SOFT_LIMIT_SECONDS && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2">
            {seconds >= HARD_HINT_SECONDS
              ? "Llevás más de 1 hora grabando. Te recomiendo detener — sesiones más largas pueden saturar el procesamiento (Vercel max 5 min)."
              : "Llevás más de 30 min. La calidad y el tiempo de procesamiento siguen siendo razonables, pero considerá detener antes de 1 h."}
          </div>
        )}

        {phase === "processing" && progressMessage && (
          <div className="text-xs text-gray-600">{progressMessage}</div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </section>

      {/* Result */}
      {result && phase === "ready" && (
        <section className="border border-gray-200 rounded-xl p-5 bg-white space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Resultado</h2>
            <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
              <span><strong>{result.turns.length}</strong> turnos</span>
              <span>· <strong>{result.overlaps_detected}</strong> overlaps</span>
              {typeof result.coverage_pct === "number" && (
                <span className={result.coverage_pct >= 95 ? "text-emerald-700" : "text-rose-700 font-semibold"}>
                  · cobertura {result.coverage_pct}%
                </span>
              )}
              {result.timings_ms && (
                <span>· Whisper {(result.timings_ms.whisper / 1000).toFixed(1)}s · LLM {(result.timings_ms.llm / 1000).toFixed(1)}s</span>
              )}
            </div>
          </div>

          {/* Alertas de seguridad globales */}
          <SafetyBanner result={result} />

          {/* Notas del LLM (warnings de cobertura, etc.) */}
          {result.notes && (
            <div className={`border text-xs rounded-lg px-3 py-2 ${
              result.notes.startsWith("⚠")
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}>
              <strong>Notas:</strong> {result.notes}
            </div>
          )}

          {/* Resumen de la sesión */}
          {result.summary && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-indigo-700 font-semibold">Resumen</p>
              <p className="text-sm leading-relaxed text-indigo-900">{result.summary}</p>
            </div>
          )}

          {/* Termómetro de la conversación */}
          {result.conversation_temperature && (
            <TemperatureBadge
              temperature={result.conversation_temperature}
              reason={result.temperature_reason}
            />
          )}

          {/* Lista de turnos */}
          <div className="space-y-1">
            <AddTurnButton onClick={() => handleAddTurn(0, "before")} />
            {result.turns.map((turn, i) => (
              <div key={i}>
                <TurnRow
                  turn={turn}
                  idx={i}
                  onToggleSpeaker={() => handleToggleSpeaker(i)}
                  onEdit={(newText) => handleEditTurn(i, newText)}
                  onDelete={() => handleDeleteTurn(i)}
                />
                <AddTurnButton onClick={() => handleAddTurn(i, "after")} />
              </div>
            ))}
          </div>

          <details className="pt-3 border-t border-gray-100">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
              Ver transcripción cruda (raw)
            </summary>
            <pre className="text-[11px] font-mono text-gray-600 whitespace-pre-wrap leading-relaxed mt-2 bg-gray-50 p-3 rounded">
              {result.raw_transcript}
            </pre>
            {result.enriched_transcript && result.enriched_transcript !== result.raw_transcript && (
              <>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mt-3 mb-1">Con timestamps (input al LLM)</p>
                <pre className="text-[11px] font-mono text-gray-600 whitespace-pre-wrap leading-relaxed bg-gray-50 p-3 rounded">
                  {result.enriched_transcript}
                </pre>
              </>
            )}
          </details>
        </section>
      )}
    </div>
  );
}

// ─── Banner global de alertas de safety ──────────────────────────
function SafetyBanner({ result }: { result: DiarizationResult }) {
  const { profanity_turns, clinical_risk_turns } = result.safety_summary || { profanity_turns: 0, clinical_risk_turns: 0 };
  if (profanity_turns === 0 && clinical_risk_turns === 0) return null;
  return (
    <div className={`border-2 rounded-lg p-3 space-y-1 ${
      clinical_risk_turns > 0
        ? "bg-rose-50 border-rose-300 text-rose-900"
        : "bg-amber-50 border-amber-300 text-amber-900"
    }`}>
      <p className="text-xs font-semibold uppercase tracking-wide">
        {clinical_risk_turns > 0 ? "🚨 Alertas de seguridad" : "⚠ Alertas de lenguaje"}
      </p>
      <ul className="text-sm space-y-0.5">
        {clinical_risk_turns > 0 && (
          <li><strong>{clinical_risk_turns}</strong> turno(s) con posible riesgo clínico (ideación suicida, autolesión, violencia). Revisar marcados con 🚨.</li>
        )}
        {profanity_turns > 0 && (
          <li><strong>{profanity_turns}</strong> turno(s) con vulgaridad detectada. Revisar marcados con ⚠.</li>
        )}
      </ul>
    </div>
  );
}

// ─── Badge de temperatura ────────────────────────────────────────
function TemperatureBadge({ temperature, reason }: { temperature: string; reason: string }) {
  const style = TEMPERATURE_STYLES[temperature] || TEMPERATURE_STYLES.tranquila;
  return (
    <div className={`border rounded-lg p-3 flex items-start gap-3 ${style.color}`}>
      <span className="text-2xl flex-shrink-0">{style.emoji}</span>
      <div>
        <p className="text-[10px] uppercase tracking-wider font-semibold">Temperatura de la conversación</p>
        <p className="text-base font-bold">{style.label}</p>
        {reason && <p className="text-xs mt-0.5 opacity-90">{reason}</p>}
      </div>
    </div>
  );
}

// ─── Botón "+ agregar turno" entre filas ─────────────────────────
function AddTurnButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex items-center justify-center group h-2 hover:h-7 transition-all">
      <button
        onClick={onClick}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-gray-400 hover:text-gray-700 border border-dashed border-gray-300 hover:border-gray-500 rounded-full px-2 py-0.5 bg-white cursor-pointer"
        title="Agregar turno aquí"
      >
        + agregar turno
      </button>
    </div>
  );
}

// ─── Una fila de turno ───────────────────────────────────────────
function TurnRow({
  turn, idx, onToggleSpeaker, onEdit, onDelete,
}: {
  turn: Turn;
  idx: number;
  onToggleSpeaker: () => void;
  onEdit: (newText: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(turn.text === "");
  const [draft, setDraft] = useState(turn.text);

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

  const commitEdit = () => {
    onEdit(draft);
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraft(turn.text);
    setEditing(false);
  };

  return (
    <div className={`border rounded-lg p-3 ${speakerColor} ${safetyBorder}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${speakerBadge}`}>
            #{idx + 1} · {turn.speaker}
          </span>
          {turn.overlap !== "ninguno" && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded border bg-amber-50 border-amber-300 text-amber-800">
              {turn.overlap === "solapado" ? "🔀 solapado" : "✂ interrupción"}
            </span>
          )}
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${confColor}`}>
            confianza: {turn.confidence}
          </span>
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
        <div className="flex items-center gap-2">
          {(isTer || isPac) && !editing && (
            <button
              onClick={onToggleSpeaker}
              className="text-[10px] text-gray-500 hover:text-gray-800 underline cursor-pointer"
              title="Cambiar atribución de speaker"
            >
              cambiar speaker
            </button>
          )}
          {!editing && (
            <button
              onClick={() => { setDraft(turn.text); setEditing(true); }}
              className="text-[10px] text-gray-500 hover:text-gray-800 underline cursor-pointer"
              title="Editar texto del turno"
            >
              editar
            </button>
          )}
          <button
            onClick={onDelete}
            className="text-[10px] text-rose-500 hover:text-rose-800 underline cursor-pointer"
            title="Borrar turno"
          >
            borrar
          </button>
        </div>
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.max(2, Math.min(8, draft.split("\n").length + 1))}
            autoFocus
            className="w-full text-sm leading-relaxed text-gray-800 bg-white border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="Texto del turno..."
          />
          <div className="flex gap-2">
            <button
              onClick={commitEdit}
              className="text-[11px] px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 cursor-pointer"
            >
              Guardar
            </button>
            <button
              onClick={cancelEdit}
              className="text-[11px] px-3 py-1 border border-gray-300 text-gray-600 rounded hover:bg-gray-50 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <p
          className="text-sm leading-relaxed text-gray-800 cursor-text"
          onClick={() => { setDraft(turn.text); setEditing(true); }}
          title="Click para editar"
        >
          {turn.text || <span className="text-gray-400 italic">(turno vacío — click para editar)</span>}
        </p>
      )}
    </div>
  );
}
