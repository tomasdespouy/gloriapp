"use client";

import { useEffect, useRef, useState } from "react";

// Spike: diarización post-hoc con LLM. El observador aprieta "Iniciar",
// graba la sesión completa sin walkie-talkie, y al detener manda el
// audio al endpoint /api/live-session-llm que devuelve los turnos
// separados por speaker con marcadores de overlap.
//
// La idea es validar si el approach LLM (sin enrollment, sin Eagle)
// resuelve el caso clínico — los overlaps son el caso difícil. La UI
// permite corregir manualmente la atribución de cada turno por si el
// LLM se equivoca.

type Phase = "idle" | "recording" | "processing" | "ready" | "error";

type Turn = {
  speaker: string;
  text: string;
  confidence: "alta" | "media" | "baja" | string;
  overlap: "ninguno" | "solapado" | "interrupcion" | string;
};

type DiarizationResult = {
  raw_transcript: string;
  speakers: Array<{ label: string; role: string }>;
  turns: Turn[];
  overlaps_detected: number;
  notes: string;
  timings_ms?: { whisper: number; llm: number; total: number };
};

const SOFT_LIMIT_SECONDS = 30 * 60; // 30 min — solo aviso visual, no bloqueo
const HARD_HINT_SECONDS = 60 * 60;  // 1 h — recomendamos detener

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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup al desmontar
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

    // MediaRecorder con codec opus a bitrate bajo. 1h ~14 MB → cabe en
    // una sola request de Whisper (limite 25 MB).
    const mimeOptions = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
    ];
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

    recorder.start(1000); // emite chunks cada 1s para no perder data si crashea
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

  // Toggle speaker manual: alterna entre OBSERVADOR y PACIENTE para un
  // turno especifico. Util para corregir cuando el LLM se equivoca.
  const handleToggleSpeaker = (idx: number) => {
    setResult((prev) => {
      if (!prev) return prev;
      const turns = [...prev.turns];
      const cur = turns[idx];
      const next = cur.speaker === "OBSERVADOR" ? "PACIENTE"
        : cur.speaker === "PACIENTE" ? "OBSERVADOR"
        : "OBSERVADOR";
      turns[idx] = { ...cur, speaker: next };
      return { ...prev, turns };
    });
  };

  // ─── Render ─────────────────────────────────────────────────────
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
          el audio se transcribe con Whisper y un LLM separa los turnos por contenido. Sin walkie-talkie,
          sin enrollment.
        </p>
      </header>

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
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span><strong>{result.turns.length}</strong> turnos</span>
              <span>· <strong>{result.overlaps_detected}</strong> overlaps</span>
              {result.timings_ms && (
                <span>· Whisper {(result.timings_ms.whisper / 1000).toFixed(1)}s · LLM {(result.timings_ms.llm / 1000).toFixed(1)}s</span>
              )}
            </div>
          </div>

          {result.notes && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg px-3 py-2">
              <strong>Notas del LLM:</strong> {result.notes}
            </div>
          )}

          <div className="space-y-2">
            {result.turns.map((turn, i) => (
              <TurnRow key={i} turn={turn} idx={i} onToggleSpeaker={() => handleToggleSpeaker(i)} />
            ))}
          </div>

          <details className="pt-3 border-t border-gray-100">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
              Ver transcripción cruda (raw)
            </summary>
            <pre className="text-[11px] font-mono text-gray-600 whitespace-pre-wrap leading-relaxed mt-2 bg-gray-50 p-3 rounded">
              {result.raw_transcript}
            </pre>
          </details>
        </section>
      )}
    </div>
  );
}

// ─── Sub-componente: una fila de turno ────────────────────────────
function TurnRow({ turn, idx, onToggleSpeaker }: { turn: Turn; idx: number; onToggleSpeaker: () => void }) {
  const isObs = turn.speaker === "OBSERVADOR";
  const isPac = turn.speaker === "PACIENTE";
  const speakerColor = isObs ? "bg-indigo-50 border-indigo-200 text-indigo-900"
    : isPac ? "bg-orange-50 border-orange-200 text-orange-900"
    : "bg-gray-50 border-gray-200 text-gray-700";
  const speakerBadge = isObs ? "bg-indigo-600 text-white"
    : isPac ? "bg-orange-500 text-white"
    : "bg-gray-400 text-white";
  const confColor = turn.confidence === "alta" ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : turn.confidence === "media" ? "text-amber-700 bg-amber-50 border-amber-200"
    : "text-rose-700 bg-rose-50 border-rose-200";

  return (
    <div className={`border rounded-lg p-3 ${speakerColor}`}>
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
        </div>
        {(isObs || isPac) && (
          <button
            onClick={onToggleSpeaker}
            className="text-[10px] text-gray-500 hover:text-gray-800 underline cursor-pointer"
            title="Cambiar atribución de speaker"
          >
            cambiar speaker
          </button>
        )}
      </div>
      <p className="text-sm leading-relaxed text-gray-800">{turn.text}</p>
    </div>
  );
}
