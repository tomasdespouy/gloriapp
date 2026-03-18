"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Send, ArrowRight, Flame, Clock, GraduationCap, Maximize2, X, CheckCircle, XCircle, ExternalLink, Mic, Square, Loader2 } from "lucide-react";
import Confetti from "@/components/Confetti";
import CountUp from "@/components/CountUp";
import CompetencyRadar from "@/components/CompetencyRadar";
import CompetencyTooltip from "@/components/CompetencyTooltip";
import { COMPETENCY_INFO } from "@/lib/competency-definitions";
import type { CompetencyScores, CompetencyScoresV2 } from "@/lib/gamification";

type ActionItem = {
  id: string;
  content: string;
  resource_link: string | null;
  status: string;
  student_comment: string | null;
  created_at: string;
};

interface Props {
  conversationId: string;
  patient: { name: string; age: number; occupation: string; difficulty_level: string };
  sessionNumber: number;
  messageCount: number;
  existingEvaluation: Record<string, unknown> | null;
  feedbackStatus: "pending" | "approved" | null;
  tooShort: boolean;
  durationMinutes: number;
  activeSeconds: number;
  teacherComment: string | null;
  teacherScore: number | null;
  startedAt: string | null;
  endedAt: string | null;
  actionItems: ActionItem[];
}

export default function ReviewClient({
  conversationId,
  patient,
  sessionNumber,
  messageCount,
  existingEvaluation,
  feedbackStatus,
  tooShort,
  activeSeconds,
  teacherComment,
  teacherScore,
  startedAt,
  endedAt,
  actionItems: initialActionItems,
}: Props) {
  const router = useRouter();
  const canSeeResults = feedbackStatus === "approved";
  const [showRadarModal, setShowRadarModal] = useState(false);
  const [actionItems, setActionItems] = useState<ActionItem[]>(initialActionItems);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [respondComment, setRespondComment] = useState("");
  const [step, setStep] = useState<"reflect" | "loading" | "results" | "pending">(
    existingEvaluation
      ? canSeeResults ? "results" : "pending"
      : "reflect"
  );
  const [discomfortMoment, setDiscomfortMoment] = useState("");
  const [wouldRedo, setWouldRedo] = useState("");
  const [clinicalNote, setClinicalNote] = useState("");
  const [results, setResults] = useState<Record<string, unknown> | null>(
    existingEvaluation
      ? {
          evaluation: existingEvaluation,
          xp_earned: 0,
          level_up: false,
          new_achievements: [],
          total_xp: 0,
          streak: 0,
        }
      : null
  );

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioProcessing, setAudioProcessing] = useState<"idle" | "transcribing" | "organizing">("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Patient image
  const avatarSlug = patient.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
  const supabaseImageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/${avatarSlug}.png`;
  const [imgSrc, setImgSrc] = useState(supabaseImageUrl);
  const [imgError, setImgError] = useState(false);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const formatDateTime = (iso: string | null) => {
    if (!iso) return "--";
    const d = new Date(iso);
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${day} ${month}, ${h}:${m}`;
  };

  const formatDuration = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 1000) {
          // Too short / no audio
          setAudioProcessing("idle");
          return;
        }
        await processAudio(blob);
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } catch {
      // User denied microphone or not available
      alert("No se pudo acceder al micrófono. Verifica los permisos de tu navegador.");
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setAudioProcessing("transcribing");

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const processAudio = async (blob: Blob) => {
    setAudioProcessing("transcribing");

    try {
      const formData = new FormData();
      formData.append("audio", blob, "reflection.webm");

      setAudioProcessing("organizing");
      const res = await fetch("/api/reflection-audio", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Error");
      const data = await res.json();

      // Populate the fields with organized content
      if (data.discomfort_moment) setDiscomfortMoment(data.discomfort_moment);
      if (data.would_redo) setWouldRedo(data.would_redo);
      if (data.clinical_note) setClinicalNote(data.clinical_note);
    } catch {
      alert("Hubo un error al procesar el audio. Por favor, intenta de nuevo o escribe tu reflexión manualmente.");
    }

    setAudioProcessing("idle");
  };

  const respondToItem = async (itemId: string, status: "accepted" | "rejected") => {
    setRespondingId(itemId);
    try {
      const res = await fetch("/api/action-items/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemId, status, comment: respondComment || undefined }),
      });
      if (res.ok) {
        setActionItems((prev) =>
          prev.map((a) => a.id === itemId ? { ...a, status, student_comment: respondComment || null } : a)
        );
        setRespondComment("");
      }
    } catch { /* ignore */ }
    setRespondingId(null);
  };

  const handleSubmit = async () => {
    setStep("loading");

    try {
      const res = await fetch(`/api/sessions/${conversationId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discomfort_moment: discomfortMoment,
          would_redo: wouldRedo,
          clinical_note: clinicalNote,
        }),
      });

      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setResults(data);
      setStep("pending"); // Student must wait for teacher approval
    } catch {
      setStep("reflect");
    }
  };

  const evaluation = (results?.evaluation || existingEvaluation) as Record<string, unknown> | null;

  const isV2 = evaluation ? Number(evaluation.eval_version) === 2 : false;

  const scoresV2: CompetencyScoresV2 = evaluation
    ? {
        setting_terapeutico: Number(evaluation.setting_terapeutico) || 0,
        motivo_consulta: Number(evaluation.motivo_consulta) || 0,
        datos_contextuales: Number(evaluation.datos_contextuales) || 0,
        objetivos: Number(evaluation.objetivos) || 0,
        escucha_activa: Number(evaluation.escucha_activa) || 0,
        actitud_no_valorativa: Number(evaluation.actitud_no_valorativa) || 0,
        optimismo: Number(evaluation.optimismo) || 0,
        presencia: Number(evaluation.presencia) || 0,
        conducta_no_verbal: Number(evaluation.conducta_no_verbal) || 0,
        contencion_afectos: Number(evaluation.contencion_afectos) || 0,
      }
    : { setting_terapeutico: 0, motivo_consulta: 0, datos_contextuales: 0, objetivos: 0, escucha_activa: 0, actitud_no_valorativa: 0, optimismo: 0, presencia: 0, conducta_no_verbal: 0, contencion_afectos: 0 };

  const scoresV1: CompetencyScores = evaluation
    ? {
        empathy: Number(evaluation.empathy) || 0,
        active_listening: Number(evaluation.active_listening) || 0,
        open_questions: Number(evaluation.open_questions) || 0,
        reformulation: Number(evaluation.reformulation) || 0,
        confrontation: Number(evaluation.confrontation) || 0,
        silence_management: Number(evaluation.silence_management) || 0,
        rapport: Number(evaluation.rapport) || 0,
      }
    : { empathy: 0, active_listening: 0, open_questions: 0, reformulation: 0, confrontation: 0, silence_management: 0, rapport: 0 };

  return (
    <div className="min-h-screen py-8 px-6">
      <div className="max-w-2xl mx-auto">
        {/* Session summary header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-4">
            {/* Patient avatar with image */}
            <div className="w-12 h-12 rounded-full bg-sidebar flex items-center justify-center overflow-hidden flex-shrink-0">
              {!imgError ? (
                <img
                  src={imgSrc}
                  alt={patient.name}
                  className="w-full h-full object-cover"
                  onError={() => {
                    if (imgSrc === supabaseImageUrl) {
                      setImgSrc(`/patients/${avatarSlug}.png`);
                    } else {
                      setImgError(true);
                    }
                  }}
                />
              ) : (
                <span className="text-white font-bold">
                  {patient.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </span>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-gray-900">
                Sesión #{sessionNumber} con {patient.name}
              </h1>
              <p className="text-sm text-gray-500">
                {patient.age} años &middot; {patient.occupation} &middot;{" "}
                <span className="inline-flex items-center gap-1">
                  <MessageSquare size={12} />
                  {messageCount} mensajes
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                <p className="text-xs text-gray-400">
                  Inicio: {formatDateTime(startedAt)}
                </p>
                {endedAt && (
                  <p className="text-xs text-gray-400">
                    Cierre: {formatDateTime(endedAt)}
                  </p>
                )}
                {activeSeconds > 0 && (
                  <p className="text-xs text-gray-500 font-medium inline-flex items-center gap-1">
                    <Clock size={11} />
                    Tiempo efectivo: {formatDuration(activeSeconds)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ===== TOO SHORT SESSION ===== */}
        {tooShort && (
          <div className="bg-white rounded-xl border border-amber-200 p-8 text-center animate-fade-in">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 mb-4">
              <Clock size={32} className="text-amber-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Sesión muy breve
            </h2>
            <p className="text-sm text-gray-600 mb-2 max-w-md mx-auto">
              Esta sesión duró menos de 5 minutos, por lo que no es posible generar una evaluación de competencias clínicas significativa.
            </p>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              Para obtener retroalimentación útil, intenta mantener sesiones de al menos 5 minutos donde puedas explorar el motivo de consulta del paciente.
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="bg-sidebar hover:bg-[#354080] text-white py-2.5 px-8 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
            >
              Volver al inicio
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ===== NORMAL FLOW (not too short) ===== */}
        {!tooShort && (
          <>
            {/* Step: Reflection form */}
            {step === "reflect" && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 animate-fade-in">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">Reflexión post-sesión</h2>
                  <p className="text-sm text-gray-500">
                    Tomarse un momento para reflexionar mejora tu aprendizaje clínico.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Momento de mayor incomodidad
                  </label>
                  <textarea
                    value={discomfortMoment}
                    onChange={(e) => setDiscomfortMoment(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sidebar"
                    rows={3}
                    placeholder="¿Hubo algún momento donde no supiste cómo responder?"
                    disabled={audioProcessing !== "idle"}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Qué harías diferente
                  </label>
                  <textarea
                    value={wouldRedo}
                    onChange={(e) => setWouldRedo(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sidebar"
                    rows={3}
                    placeholder="Si pudieras repetir esta sesión, ¿qué cambiarías?"
                    disabled={audioProcessing !== "idle"}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Nota clínica
                  </label>
                  <textarea
                    value={clinicalNote}
                    onChange={(e) => setClinicalNote(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sidebar"
                    rows={3}
                    placeholder="Observaciones generales sobre la sesión..."
                    disabled={audioProcessing !== "idle"}
                  />
                </div>

                {/* Audio recording section */}
                <div className="border-t border-gray-100 pt-4">
                  {audioProcessing !== "idle" ? (
                    <div className="flex items-center justify-center gap-3 py-3">
                      <Loader2 size={18} className="animate-spin text-sidebar" />
                      <span className="text-sm text-gray-600">
                        {audioProcessing === "transcribing"
                          ? "Transcribiendo audio..."
                          : "Organizando tu reflexión..."}
                      </span>
                    </div>
                  ) : isRecording ? (
                    <div className="flex items-center justify-center gap-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm font-medium text-red-600">
                          Grabando {formatDuration(recordingSeconds)}
                        </span>
                      </div>
                      <button
                        onClick={stopRecording}
                        className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                      >
                        <Square size={14} />
                        Detener
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={startRecording}
                      className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-gray-500 hover:text-sidebar hover:bg-sidebar/5 rounded-lg transition-colors"
                    >
                      <Mic size={16} />
                      Cuéntanos de tu sesión en audio y lo digitamos por ti
                    </button>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSubmit}
                    disabled={audioProcessing !== "idle" || isRecording}
                    className="flex-1 bg-sidebar hover:bg-[#354080] text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Send size={16} />
                    Enviar reflexión y evaluar
                  </button>
                  <button
                    onClick={() => {
                      setDiscomfortMoment("");
                      setWouldRedo("");
                      setClinicalNote("");
                      handleSubmit();
                    }}
                    disabled={audioProcessing !== "idle" || isRecording}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Omitir
                  </button>
                </div>
              </div>
            )}

            {/* Step: Loading */}
            {step === "loading" && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center animate-fade-in">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sidebar/10 mb-4">
                  <svg className="animate-spin h-8 w-8 text-sidebar" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Evaluando tu sesión...
                </h3>
                <p className="text-sm text-gray-500">
                  La IA está analizando tus competencias clínicas.
                </p>
              </div>
            )}

            {/* Step: Pending teacher approval */}
            {step === "pending" && (
              <div className="text-center py-12 animate-stagger-fade">
                {/* Animated checkmark with expanding ring */}
                <div className="relative w-24 h-24 mx-auto mb-6 animate-float">
                  {/* Expanding ring behind */}
                  <div className="absolute inset-0 rounded-full bg-green-100 animate-ring-expand" />
                  {/* SVG animated checkmark */}
                  <svg className="relative w-24 h-24" viewBox="0 0 52 52">
                    <circle
                      className="animate-check-circle"
                      cx="26" cy="26" r="25"
                      fill="none"
                      stroke="#4ade80"
                      strokeWidth="2"
                    />
                    <path
                      className="animate-check-mark"
                      fill="none"
                      stroke="#16a34a"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.1 27.2l7.1 7.2 16.7-16.8"
                    />
                  </svg>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2">Sesión completada</h3>
                <p className="text-sm text-gray-600 max-w-md mx-auto mb-2">
                  Tu sesión fue evaluada por la IA y está pendiente de revisión por tu docente supervisor.
                </p>
                <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">
                  Recibirás una notificación en la plataforma y en tu correo cuando la retroalimentación esté disponible.
                </p>
                {results && Number(results.xp_earned) > 0 && (
                  <div className="inline-flex items-center gap-2 bg-sidebar/10 text-sidebar px-4 py-2 rounded-full text-sm font-semibold mb-6 animate-pop">
                    +<CountUp end={Number(results.xp_earned)} className="font-bold" /> XP ganados
                  </div>
                )}
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="bg-sidebar text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors"
                  >
                    Volver al inicio
                  </button>
                  <button
                    onClick={() => router.push("/pacientes")}
                    className="border border-gray-200 px-6 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Nueva sesión
                  </button>
                </div>
              </div>
            )}

            {/* Step: Results (only visible after teacher approval) */}
            {step === "results" && evaluation && (
              <div className="space-y-6 animate-fade-in">
                {/* XP & Level */}
                {results && Number(results.xp_earned) > 0 && (
                  <div className="bg-gradient-to-r from-sidebar to-[#354080] rounded-2xl p-6 text-white animate-pop">
                    <Confetti trigger={Boolean(results.level_up)} variant="fireworks" />
                    <Confetti trigger={!results.level_up && Number(results.xp_earned) > 0} variant="default" />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white/70 text-sm">Experiencia ganada</p>
                        <p className="text-4xl font-bold">
                          +<CountUp end={Number(results.xp_earned)} className="text-4xl font-bold" /> XP
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        {Number(results.streak) > 1 && (
                          <div className="flex items-center gap-1.5 bg-white/15 px-4 py-2 rounded-full">
                            <Flame size={18} className="text-orange-300" />
                            <span className="text-sm font-bold">{String(results.streak)} días</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {Boolean(results.level_up) && (
                      <div className="mt-4 bg-white/15 backdrop-blur-sm rounded-xl px-5 py-3 flex items-center gap-3 animate-pop">
                        <span className="text-2xl">🎉</span>
                        <div>
                          <p className="text-base font-bold">¡Subiste de nivel!</p>
                          <p className="text-sm text-white/80">
                            Ahora eres: {String((results.new_level as { name: string })?.name ?? "")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Competency Radar */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Competencias clínicas
                    </h3>
                    <button
                      onClick={() => setShowRadarModal(true)}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-sidebar transition-colors"
                    >
                      <Maximize2 size={14} />
                      Ampliar
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Puntaje general: {isV2
                      ? `${Number(evaluation.overall_score_v2).toFixed(1)}/4`
                      : `${Number(evaluation.overall_score).toFixed(1)}/10`
                    }
                  </p>
                  <CompetencyRadar
                    scores={isV2 ? scoresV2 : scoresV1}
                    version={isV2 ? 2 : 1}
                  />
                </div>

                {/* Evidence per competency (Proposal A — inline) */}
                {isV2 && Boolean((evaluation as Record<string, unknown>).evidence) && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Detalle por competencia</h3>
                    {["estructura", "actitudes"].map(domain => (
                      <div key={domain} className="mb-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                          {domain === "estructura" ? "Estructura de la sesión" : "Actitudes terapéuticas"}
                        </p>
                        <div className="space-y-3">
                          {Object.entries(COMPETENCY_INFO)
                            .filter(([, info]) => info.domain === domain)
                            .map(([key, info]) => {
                              const score = Number((evaluation as Record<string, unknown>)[key]) || 0;
                              const ev = ((evaluation as Record<string, unknown>).evidence as Record<string, { quote: string; observation: string }> | undefined)?.[key];
                              const color = score >= 3 ? "#22c55e" : score >= 2 ? "#eab308" : score > 0 ? "#ef4444" : "#d1d5db";
                              return (
                                <div key={key} className="border-b border-gray-50 pb-3 last:border-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium text-gray-800">{info.name}</span>
                                    <CompetencyTooltip compKey={key} />
                                    <span className="ml-auto text-sm font-bold" style={{ color }}>{score.toFixed(1)}</span>
                                  </div>
                                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                                    <div className="h-full rounded-full" style={{ width: `${(score/4)*100}%`, backgroundColor: color }} />
                                  </div>
                                  {ev?.quote && (
                                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs">
                                      <p className="text-gray-700 italic mb-1">&ldquo;{ev.quote}&rdquo;</p>
                                      {ev.observation && <p className="text-gray-500">{ev.observation}</p>}
                                    </div>
                                  )}
                                  {!ev?.quote && score > 0 && (
                                    <p className="text-[11px] text-gray-400 italic">Sin evidencia textual registrada</p>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Radar fullscreen modal */}
                {showRadarModal && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6" onClick={() => setShowRadarModal(false)}>
                    <div className="relative bg-white rounded-2xl p-8 w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setShowRadarModal(false)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                      >
                        <X size={20} />
                      </button>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">Competencias clínicas</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        Puntaje general: {isV2
                          ? `${Number(evaluation.overall_score_v2).toFixed(1)}/4`
                          : `${Number(evaluation.overall_score).toFixed(1)}/10`
                        }
                      </p>
                      <CompetencyRadar
                        scores={isV2 ? scoresV2 : scoresV1}
                        version={isV2 ? 2 : 1}
                        size={550}
                      />
                    </div>
                  </div>
                )}

                {/* AI Commentary */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Retroalimentación
                  </h3>
                  <p className="text-sm text-gray-700 leading-relaxed mb-4">
                    {String(evaluation.ai_commentary || evaluation.commentary || "")}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Strengths */}
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-green-800 mb-2">Fortalezas</p>
                      <ul className="space-y-1">
                        {(evaluation.strengths as string[] || []).map((s, i) => (
                          <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Areas to improve */}
                    <div className="bg-amber-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-amber-800 mb-2">Áreas de mejora</p>
                      <ul className="space-y-1">
                        {(evaluation.areas_to_improve as string[] || []).map((s, i) => (
                          <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Teacher feedback */}
                {(teacherComment || teacherScore !== null) && (
                  <div className="bg-white rounded-xl border-2 border-purple-200 p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <GraduationCap size={20} className="text-purple-600" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        Retroalimentación del docente
                      </h3>
                      {teacherScore !== null && (
                        <span className="ml-auto text-sm font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
                          {teacherScore}/10
                        </span>
                      )}
                    </div>
                    {teacherComment && (
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                        {teacherComment}
                      </p>
                    )}
                  </div>
                )}

                {/* Action items (acuerdos) */}
                {actionItems.length > 0 && (
                  <div className="bg-white rounded-xl border border-indigo-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Acuerdos con tu docente
                    </h3>
                    <div className="space-y-4">
                      {actionItems.map((item) => (
                        <div key={item.id} className="border border-gray-100 rounded-lg p-4">
                          <p className="text-sm text-gray-800 mb-1">{item.content}</p>
                          {item.resource_link && (
                            <a
                              href={item.resource_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-sidebar hover:underline inline-flex items-center gap-1 mb-2"
                            >
                              <ExternalLink size={11} /> Recurso sugerido
                            </a>
                          )}

                          {item.status === "pending" ? (
                            <div className="mt-3 space-y-2">
                              <textarea
                                value={respondingId === item.id ? respondComment : ""}
                                onChange={(e) => { setRespondingId(item.id); setRespondComment(e.target.value); }}
                                onFocus={() => setRespondingId(item.id)}
                                placeholder="Comentario opcional..."
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs resize-none focus:outline-none focus:ring-1 focus:ring-sidebar"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => respondToItem(item.id, "accepted")}
                                  disabled={respondingId === item.id && respondComment === "__loading"}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
                                >
                                  <CheckCircle size={13} /> Aceptar
                                </button>
                                <button
                                  onClick={() => respondToItem(item.id, "rejected")}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
                                >
                                  <XCircle size={13} /> Rechazar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                item.status === "accepted"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-600"
                              }`}>
                                {item.status === "accepted" ? "Aceptado" : "Rechazado"}
                              </span>
                              {item.student_comment && (
                                <p className="text-xs text-gray-500 mt-1 italic">{item.student_comment}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New achievements */}
                {results && (results.new_achievements as string[])?.length > 0 && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-6 animate-pop">
                    <Confetti trigger={true} variant="stars" />
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-2xl">🏆</span>
                      <h3 className="text-lg font-bold text-gray-900">
                        ¡{(results.new_achievements as string[]).length === 1 ? "Nuevo logro" : "Nuevos logros"} desbloqueados!
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(results.new_achievements as string[]).map((key, i) => (
                        <div
                          key={key}
                          className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-amber-100 animate-pop"
                          style={{ animationDelay: `${i * 150}ms` }}
                        >
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                            <span className="text-lg">🏅</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 capitalize">
                            {key.replace(/_/g, " ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="flex-1 bg-sidebar hover:bg-[#354080] text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    Volver al inicio
                    <ArrowRight size={16} />
                  </button>
                  <button
                    onClick={() => router.push("/historial")}
                    className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Ver historial
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
