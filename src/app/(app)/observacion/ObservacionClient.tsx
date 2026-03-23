"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Clock, ArrowLeft, Radio, Pencil } from "lucide-react";

type Segment = {
  speaker: "observer" | "patient";
  transcript: string;
  durationSeconds: number;
};

interface ObservacionProps {
  userName: string;
  userAvatarUrl: string | null;
}

export default function ObservacionClient({ userName, userAvatarUrl }: ObservacionProps) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<"observer" | "patient">("observer");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [segmentSeconds, setSegmentSeconds] = useState(0);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Pre-session editable fields
  const [therapistName, setTherapistName] = useState(userName || "");
  const [patientName, setPatientName] = useState("");
  const [editingTherapist, setEditingTherapist] = useState(false);
  const [editingPatient, setEditingPatient] = useState(true);

  const userInitials = (therapistName || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
    const title = patientName.trim()
      ? `Sesión con ${patientName.trim()}`
      : "Grabación en vivo";
    const res = await fetch("/api/observation/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
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
    // Force-stop all media tracks to release the microphone
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (segmentTimerRef.current) clearInterval(segmentTimerRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);

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
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 max-w-md w-full">
          {/* Two avatars: Patient (left) — Therapist (right) */}
          <div className="flex items-center justify-center gap-8 mb-6">
            {/* Patient */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 shadow-md bg-gray-100 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-300">
                  {patientName.trim() ? patientName.trim().split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "?"}
                </span>
              </div>
              {editingPatient ? (
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  onBlur={() => { if (patientName.trim()) setEditingPatient(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && patientName.trim()) setEditingPatient(false); }}
                  placeholder="Nombre del paciente"
                  autoFocus
                  className="text-sm font-medium text-gray-700 text-center border-b-2 border-sidebar/40 outline-none w-36 py-0.5 bg-transparent placeholder:text-gray-300"
                />
              ) : (
                <button onClick={() => setEditingPatient(true)} className="flex items-center gap-1 group cursor-pointer">
                  <p className="text-sm font-medium text-gray-700">{patientName || "Paciente"}</p>
                  <Pencil size={11} className="text-gray-300 group-hover:text-sidebar transition-colors" />
                </button>
              )}
              <p className="text-[11px] text-gray-500">Paciente</p>
            </div>

            <div className="w-10 h-px bg-gray-300 -mt-8" />

            {/* Therapist */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-sidebar/30 shadow-md bg-sidebar/10 flex items-center justify-center">
                {userAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={userAvatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-sidebar">{userInitials}</span>
                )}
              </div>
              {editingTherapist ? (
                <input
                  type="text"
                  value={therapistName}
                  onChange={(e) => setTherapistName(e.target.value)}
                  onBlur={() => setEditingTherapist(false)}
                  onKeyDown={(e) => { if (e.key === "Enter") setEditingTherapist(false); }}
                  autoFocus
                  className="text-sm font-medium text-gray-700 text-center border-b-2 border-sidebar/40 outline-none w-36 py-0.5 bg-transparent"
                />
              ) : (
                <button onClick={() => setEditingTherapist(true)} className="flex items-center gap-1 group cursor-pointer">
                  <p className="text-sm font-medium text-gray-700">{therapistName || "Terapeuta"}</p>
                  <Pencil size={11} className="text-gray-300 group-hover:text-sidebar transition-colors" />
                </button>
              )}
              <p className="text-[11px] text-gray-500">Terapeuta</p>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-2">
            <p className="text-xs font-semibold text-gray-700">Instrucciones:</p>
            <ul className="text-[11px] text-gray-500 space-y-1.5">
              <li className="flex gap-2"><span className="text-sidebar font-bold">1.</span> Presiona <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono">Espacio</kbd> para grabar.</li>
              <li className="flex gap-2"><span className="text-sidebar font-bold">2.</span> Vuelve a presionar para cambiar de hablante.</li>
              <li className="flex gap-2"><span className="text-sidebar font-bold">3.</span> Al finalizar, se generará un análisis semántico.</li>
            </ul>
          </div>

          <button
            onClick={startSession}
            disabled={!patientName.trim()}
            className="w-full bg-sidebar text-white py-3 rounded-xl text-sm font-medium hover:bg-[#354080] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Iniciar grabación
          </button>
        </div>
      </div>
    );
  }

  const isTherapistSpeaking = currentSpeaker === "observer";
  const patientInitials = (patientName || "P").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const handleTapSwitch = () => {
    if (isRecording) {
      stopRecording();
      setCurrentSpeaker(prev => prev === "observer" ? "patient" : "observer");
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Compact header */}
      <header className="bg-white border-b border-gray-200 px-3 sm:px-4 py-2.5 flex items-center gap-2 flex-shrink-0">
        <button onClick={() => router.push("/dashboard")} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
          <ArrowLeft size={16} className="text-gray-500" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-gray-900 truncate">Grabación en vivo</h2>
        </div>
        <span className="flex items-center gap-1 text-sm font-bold text-gray-700 tabular-nums">
          <Clock size={13} className="text-gray-400" />
          {formatTime(totalSeconds)}
        </span>
        <button
          onClick={endSession}
          disabled={analyzing}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {analyzing ? "Analizando..." : "Finalizar"}
        </button>
      </header>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 overflow-hidden" onClick={handleTapSwitch}>

        {/* Two speakers side by side */}
        <div className="flex items-end justify-center gap-6 sm:gap-10 mb-6">
          {/* Therapist avatar */}
          <div className={`flex flex-col items-center transition-all duration-300 ${isTherapistSpeaking ? "scale-100 opacity-100" : "scale-75 opacity-40"}`}>
            <div className="relative">
              {isRecording && isTherapistSpeaking && (
                <>
                  <span className="absolute -inset-3 rounded-full bg-red-400/25 animate-[ripple_2s_ease-out_infinite]" />
                  <span className="absolute -inset-3 rounded-full bg-red-400/15 animate-[ripple_2s_ease-out_0.6s_infinite]" />
                  <span className="absolute -inset-3 rounded-full bg-red-400/8 animate-[ripple_2s_ease-out_1.2s_infinite]" />
                </>
              )}
              <div className={`relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden flex items-center justify-center transition-all duration-300 ${
                isTherapistSpeaking
                  ? isRecording ? "ring-4 ring-red-400 shadow-lg shadow-red-400/30" : "ring-4 ring-sidebar/40"
                  : "ring-2 ring-gray-200"
              } ${isTherapistSpeaking ? "bg-sidebar/10" : "bg-gray-100"}`}>
                {userAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={userAvatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className={`text-xl sm:text-2xl font-bold ${isTherapistSpeaking ? "text-sidebar" : "text-gray-300"}`}>{userInitials}</span>
                )}
              </div>
              {isRecording && isTherapistSpeaking && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 z-20 bg-red-500 rounded-full p-1.5 shadow-md">
                  <Mic size={12} className="text-white" />
                </div>
              )}
            </div>
            <p className={`mt-3 text-xs sm:text-sm font-semibold text-center truncate max-w-[100px] sm:max-w-[120px] ${isTherapistSpeaking ? "text-gray-900" : "text-gray-400"}`}>
              {(therapistName || "Terapeuta").split(" ")[0]}
            </p>
            <p className={`text-[10px] ${isTherapistSpeaking ? "text-sidebar font-medium" : "text-gray-300"}`}>Terapeuta</p>
          </div>

          {/* VS divider */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-8 h-px bg-gray-200" />
          </div>

          {/* Patient avatar */}
          <div className={`flex flex-col items-center transition-all duration-300 ${!isTherapistSpeaking ? "scale-100 opacity-100" : "scale-75 opacity-40"}`}>
            <div className="relative">
              {isRecording && !isTherapistSpeaking && (
                <>
                  <span className="absolute -inset-3 rounded-full bg-red-400/25 animate-[ripple_2s_ease-out_infinite]" />
                  <span className="absolute -inset-3 rounded-full bg-red-400/15 animate-[ripple_2s_ease-out_0.6s_infinite]" />
                  <span className="absolute -inset-3 rounded-full bg-red-400/8 animate-[ripple_2s_ease-out_1.2s_infinite]" />
                </>
              )}
              <div className={`relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden flex items-center justify-center transition-all duration-300 ${
                !isTherapistSpeaking
                  ? isRecording ? "ring-4 ring-red-400 shadow-lg shadow-red-400/30" : "ring-4 ring-emerald-400/40"
                  : "ring-2 ring-gray-200"
              } ${!isTherapistSpeaking ? "bg-emerald-50" : "bg-gray-100"}`}>
                <span className={`text-xl sm:text-2xl font-bold ${!isTherapistSpeaking ? "text-emerald-600" : "text-gray-300"}`}>{patientInitials}</span>
              </div>
              {isRecording && !isTherapistSpeaking && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 z-20 bg-red-500 rounded-full p-1.5 shadow-md">
                  <Mic size={12} className="text-white" />
                </div>
              )}
            </div>
            <p className={`mt-3 text-xs sm:text-sm font-semibold text-center truncate max-w-[100px] sm:max-w-[120px] ${!isTherapistSpeaking ? "text-gray-900" : "text-gray-400"}`}>
              {(patientName || "Paciente").split(" ")[0]}
            </p>
            <p className={`text-[10px] ${!isTherapistSpeaking ? "text-emerald-600 font-medium" : "text-gray-300"}`}>Paciente</p>
          </div>
        </div>

        {/* Status + timer */}
        <div className="text-center mb-4">
          {isRecording ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-semibold text-red-600">Grabando</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">{formatTime(segmentSeconds)}</p>
            </>
          ) : (
            <p className="text-sm font-medium text-gray-400">Pausado</p>
          )}
        </div>

        {/* Action hint */}
        <div className="bg-gray-100/80 rounded-full px-5 py-2 text-xs text-gray-500">
          <span className="sm:hidden">Toca para {isRecording ? "cambiar hablante" : "grabar"}</span>
          <span className="hidden sm:inline">
            Presiona <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-300 font-mono text-[10px] mx-0.5">Espacio</kbd> o toca para {isRecording ? "cambiar hablante" : "grabar"}
          </span>
        </div>
      </div>

      {/* Segments list */}
      {segments.length > 0 && (
        <div className="border-t border-gray-200 max-h-36 sm:max-h-48 overflow-y-auto flex-shrink-0">
          <div className="px-3 sm:px-4 py-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-1.5">Segmentos ({segments.length})</p>
            {segments.map((seg, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${
                  seg.speaker === "observer" ? "bg-sidebar/10 text-sidebar" : "bg-emerald-50 text-emerald-600"
                }`}>
                  {seg.speaker === "observer"
                    ? (therapistName || "T").charAt(0).toUpperCase()
                    : (patientName || "P").charAt(0).toUpperCase()}
                </div>
                <p className="text-xs text-gray-600 flex-1 line-clamp-1">{seg.transcript}</p>
                <span className="text-[10px] text-gray-400 tabular-nums flex-shrink-0">{formatTime(seg.durationSeconds)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
