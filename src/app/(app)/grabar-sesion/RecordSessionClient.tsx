"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Download, AlertCircle, Check, ChevronDown } from "lucide-react";

type Turn = { speaker: string; text: string };
type Speaker = { name: string; role: string };
type Phase = "intro" | "recording" | "processing" | "results";
type ProcessStep = "transcribing" | "identifying" | "separating" | "done";

export default function RecordSessionClient() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [processStep, setProcessStep] = useState<ProcessStep>("transcribing");

  // Results
  const [rawTranscript, setRawTranscript] = useState("");
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [notes, setNotes] = useState("");

  // Recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio level for waveform
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  // Animate audio level
  const updateLevel = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.fftSize);
    analyserRef.current.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    setAudioLevel(Math.sqrt(sum / data.length));
    animFrameRef.current = requestAnimationFrame(updateLevel);
  }, []);

  const startRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
      streamRef.current = stream;

      // Audio analyser for waveform
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      animFrameRef.current = requestAnimationFrame(updateLevel);

      // Use low bitrate for longer recordings
      const options: MediaRecorderOptions = { mimeType: "audio/webm" };
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options.mimeType = "audio/webm;codecs=opus";
        options.audioBitsPerSecond = 32000; // 32kbps — ~0.24 MB/min
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        analyserRef.current = null;
        setAudioLevel(0);

        const blob = new Blob(chunksRef.current, { type: options.mimeType || "audio/webm" });
        if (blob.size < 2000) {
          setError("Audio demasiado corto. Intenta de nuevo.");
          setPhase("intro");
          return;
        }
        await processAudio(blob);
      };

      mediaRecorder.start(1000);
      setPhase("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("No se pudo acceder al micr\u00f3fono. Verifica los permisos de tu navegador.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setPhase("processing");
    setProcessStep("transcribing");
  };

  const processAudio = async (blob: Blob) => {
    setPhase("processing");
    setProcessStep("transcribing");

    try {
      // Simulate step progress (we can't know exactly when each step finishes on server)
      const stepTimer = setTimeout(() => setProcessStep("identifying"), 5000);
      const stepTimer2 = setTimeout(() => setProcessStep("separating"), 12000);

      const formData = new FormData();
      formData.append("audio", blob, "live-session.webm");

      const res = await fetch("/api/live-session", {
        method: "POST",
        body: formData,
      });

      clearTimeout(stepTimer);
      clearTimeout(stepTimer2);
      setProcessStep("done");

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al procesar");
      }

      const data = await res.json();
      setRawTranscript(data.raw_transcript || "");
      setSpeakers(data.speakers || []);
      setTurns(data.turns || []);
      setNotes(data.notes || "");
      setPhase("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al procesar el audio");
      setPhase("intro");
    }
  };

  const downloadTranscript = () => {
    const header = `Transcripci\u00f3n de sesi\u00f3n en vivo\nDuraci\u00f3n: ${formatTime(seconds)}\nParticipantes: ${speakers.map((s) => `${s.name} (${s.role})`).join(", ")}\n${"═".repeat(50)}\n\n`;
    const body = turns.map((t) => `${t.speaker}:\n${t.text}\n`).join("\n");
    const blob = new Blob([header + body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sesion-en-vivo-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setPhase("intro");
    setRawTranscript("");
    setSpeakers([]);
    setTurns([]);
    setNotes("");
    setSeconds(0);
    setError("");
  };

  const ROLE_COLORS: Record<string, string> = {
    terapeuta: "border-l-sidebar bg-sidebar/5",
    consultante: "border-l-emerald-500 bg-emerald-50/50",
  };
  const ROLE_DOT: Record<string, string> = {
    terapeuta: "bg-sidebar",
    consultante: "bg-emerald-500",
  };

  // Waveform bars
  const waveformBars = 16;
  const barHeights = Array.from({ length: waveformBars }, (_, i) => {
    const variance = Math.sin(Date.now() / 200 + i * 0.7) * 0.3 + 0.7;
    return Math.max(4, Math.min(32, audioLevel * 200 * variance));
  });

  return (
    <div className="max-w-lg mx-auto px-4 py-6 min-h-[calc(100vh-120px)] flex flex-col">
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-4">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ═══ INTRO ═══ */}
      {phase === "intro" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
          <div className="w-24 h-24 rounded-full bg-sidebar/10 flex items-center justify-center">
            <Mic size={44} className="text-sidebar" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Grabar sesi&oacute;n en vivo
            </h1>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">
              {"Graba una conversaci\u00f3n terap\u00e9utica presencial o de role-play"}
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-5 w-full max-w-sm space-y-3">
            {[
              "Ambas personas digan su nombre al inicio",
              "Mantengan el dispositivo cerca",
              "Hablen de forma natural y clara",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-sidebar/10 flex items-center justify-center text-[11px] font-bold text-sidebar">
                  {i + 1}
                </span>
                <p className="text-sm text-gray-600 text-left">{step}</p>
              </div>
            ))}
          </div>

          <button
            onClick={startRecording}
            className="w-full max-w-sm bg-sidebar text-white py-4 rounded-2xl text-base font-semibold hover:bg-sidebar-hover transition-colors shadow-lg shadow-sidebar/20 flex items-center justify-center gap-2"
          >
            <Mic size={20} />
            {"Comenzar grabaci\u00f3n"}
          </button>
        </div>
      )}

      {/* ═══ RECORDING ═══ */}
      {phase === "recording" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
          {/* Pulsing red dot */}
          <div className="relative">
            <div className="w-5 h-5 rounded-full bg-red-500 animate-pulse" />
            <div className="absolute inset-0 w-5 h-5 rounded-full bg-red-500/30 animate-ping" />
          </div>

          {/* Timer HUGE */}
          <p className="text-6xl sm:text-7xl font-bold text-gray-900 font-mono tracking-wider">
            {formatTime(seconds)}
          </p>

          <p className="text-sm text-red-500 font-medium">Grabando...</p>

          {/* Waveform */}
          <div className="flex items-center justify-center gap-1 h-10">
            {barHeights.map((h, i) => (
              <div
                key={i}
                className="w-1.5 bg-sidebar/60 rounded-full transition-all duration-100"
                style={{ height: `${h}px` }}
              />
            ))}
          </div>

          {/* Reminder (first 10 seconds) */}
          {seconds < 10 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 max-w-xs">
              <p className="text-xs text-amber-700">
                Recuerda: cada persona debe decir su nombre al inicio
              </p>
            </div>
          )}

          {/* STOP button — big circular */}
          <button
            onClick={stopRecording}
            className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-500/30 transition-colors active:scale-95"
          >
            <Square size={28} fill="white" />
          </button>
          <p className="text-xs text-gray-400 -mt-4">Toca para detener</p>
        </div>
      )}

      {/* ═══ PROCESSING ═══ */}
      {phase === "processing" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
          {/* Spinner */}
          <div className="w-16 h-16 rounded-full border-4 border-gray-200 border-t-sidebar animate-spin" />

          <div>
            <p className="text-lg font-semibold text-gray-900">Procesando tu sesi&oacute;n</p>
            <p className="text-sm text-gray-400 mt-1">Esto puede tomar entre 30 seg y 2 min</p>
          </div>

          {/* Step indicators */}
          <div className="w-full max-w-xs space-y-3">
            {([
              { key: "transcribing" as ProcessStep, label: "Transcribiendo audio" },
              { key: "identifying" as ProcessStep, label: "Identificando participantes" },
              { key: "separating" as ProcessStep, label: "Separando turnos de habla" },
            ]).map((s, i) => {
              const steps: ProcessStep[] = ["transcribing", "identifying", "separating", "done"];
              const currentIdx = steps.indexOf(processStep);
              const stepIdx = steps.indexOf(s.key);
              const isDone = currentIdx > stepIdx;
              const isActive = currentIdx === stepIdx;

              return (
                <div key={s.key} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isDone
                      ? "bg-emerald-500 text-white"
                      : isActive
                      ? "bg-sidebar text-white animate-pulse"
                      : "bg-gray-200 text-gray-400"
                  }`}>
                    {isDone ? <Check size={14} /> : i + 1}
                  </div>
                  <p className={`text-sm ${isDone ? "text-emerald-600" : isActive ? "text-gray-900 font-medium" : "text-gray-400"}`}>
                    {s.label} {isDone && "\u2713"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ RESULTS ═══ */}
      {phase === "results" && (
        <div className="flex-1 space-y-4">
          {/* Header */}
          <div className="text-center py-2">
            <p className="text-lg font-bold text-gray-900">{"Sesi\u00f3n procesada"}</p>
            <p className="text-sm text-gray-400">
              {formatTime(seconds)} &middot; {speakers.length} participantes
            </p>
          </div>

          {/* Speakers */}
          {speakers.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex justify-center gap-6">
                {speakers.map((s) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${ROLE_DOT[s.role] || "bg-gray-400"}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{s.name}</p>
                      <p className="text-[10px] text-gray-400 uppercase">{s.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transcript */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {"Transcripci\u00f3n"} ({turns.length} turnos)
              </p>
              <button
                onClick={downloadTranscript}
                className="flex items-center gap-1 text-[10px] text-sidebar hover:underline font-medium"
              >
                <Download size={12} />
                Descargar
              </button>
            </div>
            <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
              {turns.map((turn, i) => {
                const speaker = speakers.find((s) => s.name === turn.speaker);
                const role = speaker?.role || "unknown";
                return (
                  <div
                    key={i}
                    className={`border-l-4 rounded-lg p-3 ${ROLE_COLORS[role] || "border-l-gray-300 bg-gray-50"}`}
                  >
                    <p className="text-[11px] font-semibold text-gray-600 mb-1">{turn.speaker}</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{turn.text}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          {notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-700"><strong>Notas:</strong> {notes}</p>
            </div>
          )}

          {/* Raw transcript (collapsible) */}
          <details className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <summary className="px-4 py-3 text-xs text-gray-400 cursor-pointer hover:text-gray-600 flex items-center gap-1">
              <ChevronDown size={12} />
              {"Ver transcripci\u00f3n original"}
            </summary>
            <div className="px-4 pb-4">
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{rawTranscript}</p>
            </div>
          </details>

          {/* Actions */}
          <div className="space-y-2 pt-2">
            <button
              onClick={downloadTranscript}
              className="w-full bg-sidebar text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-sidebar-hover transition-colors flex items-center justify-center gap-2"
            >
              <Download size={16} />
              Descargar transcripci&oacute;n
            </button>
            <button
              onClick={reset}
              className="w-full border border-gray-200 text-gray-700 py-3.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Grabar otra sesi&oacute;n
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
