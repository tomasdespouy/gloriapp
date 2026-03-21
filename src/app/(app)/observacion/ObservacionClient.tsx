"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Clock, ArrowLeft, Radio } from "lucide-react";

type Segment = {
  speaker: "observer" | "patient";
  transcript: string;
  durationSeconds: number;
};

export default function ObservacionClient() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<"observer" | "patient">("observer");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [segmentSeconds, setSegmentSeconds] = useState(0);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const segmentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Session timer
  useEffect(() => {
    if (!sessionStarted) return;
    timerRef.current = setInterval(() => setTotalSeconds((s) => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionStarted]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const startSession = async () => {
    const res = await fetch("/api/observation/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Observación en vivo" }),
    });
    if (res.ok) {
      const data = await res.json();
      setSessionId(data.id);
      setSessionStarted(true);
    }
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 500) return;

        // Transcribe
        const formData = new FormData();
        formData.append("audio", blob, "segment.webm");
        formData.append("session_id", sessionId || "");
        formData.append("speaker", currentSpeaker);
        formData.append("duration", String(segmentSeconds));
        formData.append("order", String(segments.length));

        try {
          const res = await fetch("/api/observation/segments", { method: "POST", body: formData });
          if (res.ok) {
            const data = await res.json();
            setSegments((prev) => [...prev, {
              speaker: currentSpeaker,
              transcript: data.transcript || "(sin transcripción)",
              durationSeconds: segmentSeconds,
            }]);
          }
        } catch { /* silent */ }
      };

      recorder.start(1000);
      setIsRecording(true);
      setSegmentSeconds(0);
      segmentTimerRef.current = setInterval(() => setSegmentSeconds((s) => s + 1), 1000);
    } catch {
      alert("No se pudo acceder al micrófono.");
    }
  }, [sessionId, currentSpeaker, segmentSeconds, segments.length]);

  const stopRecording = useCallback(() => {
    if (segmentTimerRef.current) clearInterval(segmentTimerRef.current);
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Spacebar handler
  useEffect(() => {
    if (!sessionStarted) return;
    const handler = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();

      if (isRecording) {
        // Stop current, switch speaker
        stopRecording();
        setCurrentSpeaker((prev) => (prev === "observer" ? "patient" : "observer"));
      } else {
        startRecording();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sessionStarted, isRecording, stopRecording, startRecording]);

  const endSession = async () => {
    if (isRecording) stopRecording();
    if (!sessionId) return;
    setAnalyzing(true);

    await fetch(`/api/observation/sessions/${sessionId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ total_duration: totalSeconds }),
    });

    router.push(`/observacion/review/${sessionId}`);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (segmentTimerRef.current) clearInterval(segmentTimerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (!sessionStarted) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-sidebar/10 flex items-center justify-center mx-auto mb-4">
            <Radio size={32} className="text-sidebar" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Observación en vivo</h1>
          <p className="text-sm text-gray-500 mb-6">
            Graba una sesión de observación alternando entre observador y paciente con la barra espaciadora.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-2">
            <p className="text-xs font-semibold text-gray-700">Instrucciones:</p>
            <ul className="text-[11px] text-gray-500 space-y-1.5">
              <li className="flex gap-2"><span className="text-sidebar font-bold">1.</span> Presiona &quot;Iniciar&quot; para comenzar la sesión.</li>
              <li className="flex gap-2"><span className="text-sidebar font-bold">2.</span> Presiona <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono">Espacio</kbd> para grabar.</li>
              <li className="flex gap-2"><span className="text-sidebar font-bold">3.</span> Vuelve a presionar para cambiar de hablante.</li>
              <li className="flex gap-2"><span className="text-sidebar font-bold">4.</span> Al finalizar, se generará un análisis semántico.</li>
            </ul>
          </div>
          <button
            onClick={startSession}
            className="w-full bg-sidebar text-white py-3 rounded-xl text-sm font-medium hover:bg-[#354080] transition-colors"
          >
            Iniciar observación
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={() => router.push("/dashboard")} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={18} className="text-gray-500" />
        </button>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-gray-900">Observación en vivo</h2>
          <p className="text-[10px] text-gray-500">Modo walkie-talkie</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-gray-400 tabular-nums">
          <Clock size={13} />
          {formatTime(totalSeconds)}
        </span>
        <button
          onClick={endSession}
          disabled={analyzing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
        >
          {analyzing ? "Analizando..." : "Finalizar"}
        </button>
      </header>

      {/* Main walkie-talkie area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {/* Speaker indicator */}
        <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-6 transition-all duration-300 ${
          isRecording
            ? "bg-red-500 animate-pulse shadow-lg shadow-red-500/30"
            : "bg-gray-200"
        }`}>
          {isRecording ? (
            <Mic size={48} className="text-white" />
          ) : (
            <MicOff size={48} className="text-gray-400" />
          )}
        </div>

        <p className="text-lg font-bold text-gray-900 mb-1">
          {isRecording ? "Grabando..." : "Pausado"}
        </p>
        <p className="text-sm text-gray-500 mb-2">
          Hablante: <span className="font-semibold text-sidebar">{currentSpeaker === "observer" ? "Observador" : "Paciente"}</span>
        </p>
        {isRecording && (
          <p className="text-xs text-gray-400 tabular-nums mb-4">{formatTime(segmentSeconds)}</p>
        )}

        <div className="bg-gray-100 rounded-lg px-4 py-2 text-xs text-gray-500">
          Presiona <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-300 font-mono text-[10px] mx-0.5">Espacio</kbd> para {isRecording ? "cambiar hablante" : "grabar"}
        </div>
      </div>

      {/* Segments list */}
      {segments.length > 0 && (
        <div className="border-t border-gray-200 max-h-48 overflow-y-auto">
          <div className="px-4 py-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2">Segmentos ({segments.length})</p>
            {segments.map((seg, i) => (
              <div key={i} className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  seg.speaker === "observer" ? "bg-sidebar/10 text-sidebar" : "bg-emerald-50 text-emerald-600"
                }`}>
                  {seg.speaker === "observer" ? "OBS" : "PAC"}
                </span>
                <p className="text-xs text-gray-600 flex-1 line-clamp-1">{seg.transcript}</p>
                <span className="text-[10px] text-gray-400 tabular-nums">{formatTime(seg.durationSeconds)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
