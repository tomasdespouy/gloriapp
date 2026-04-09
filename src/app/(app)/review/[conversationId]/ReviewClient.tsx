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
  patient: { id?: string; name: string; age: number; occupation: string; difficulty_level: string };
  sessionNumber: number;
  messageCount: number;
  existingEvaluation: Record<string, unknown> | null;
  feedbackStatus: "pending" | "approved" | "evaluated" | null;
  tooShort: boolean;
  durationMinutes: number;
  activeSeconds: number;
  teacherComment: string | null;
  teacherScore: number | null;
  startedAt: string | null;
  endedAt: string | null;
  actionItems: ActionItem[];
  initialSessionNotes: string;
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
  initialSessionNotes,
}: Props) {
  const router = useRouter();
  const canSeeResults = feedbackStatus === "approved" || feedbackStatus === "evaluated";
  const [showRadarModal, setShowRadarModal] = useState(false);
  const [actionItems, setActionItems] = useState<ActionItem[]>(initialActionItems);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [respondComment, setRespondComment] = useState("");
  const [currentFeedbackStatus, setCurrentFeedbackStatus] = useState(feedbackStatus);
  const [acknowledging, setAcknowledging] = useState(false);
  const [step, setStep] = useState<"reflect" | "loading" | "results" | "pending">(
    existingEvaluation
      ? canSeeResults ? "results" : "pending"
      : "reflect"
  );
  // Legacy fields (kept for old data compatibility)
  const [discomfortMoment, setDiscomfortMoment] = useState("");
  const [wouldRedo, setWouldRedo] = useState("");
  const [clinicalNote, setClinicalNote] = useState("");
  // V2 clinical reflection fields
  const [allianceFraming, setAllianceFraming] = useState("");
  const [ruptureMoment, setRuptureMoment] = useState("");
  const [nonverbalCues, setNonverbalCues] = useState("");
  const [interventionTypes, setInterventionTypes] = useState("");
  const [clinicalHypothesis, setClinicalHypothesis] = useState("");
  const [sessionNotes, setSessionNotes] = useState(initialSessionNotes);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
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

      // Populate v2 fields with organized content
      if (data.alliance_framing) setAllianceFraming(data.alliance_framing);
      if (data.rupture_moment) setRuptureMoment(data.rupture_moment);
      if (data.nonverbal_cues) setNonverbalCues(data.nonverbal_cues);
      if (data.intervention_types) setInterventionTypes(data.intervention_types);
      if (data.clinical_hypothesis) setClinicalHypothesis(data.clinical_hypothesis);
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
        const data = await res.json();
        setActionItems((prev) =>
          prev.map((a) => a.id === itemId ? { ...a, status, student_comment: respondComment || null } : a)
        );
        setRespondComment("");
        if (data.all_responded) {
          setCurrentFeedbackStatus("evaluated");
        }
      }
    } catch { /* ignore */ }
    setRespondingId(null);
  };

  const acknowledgeReview = async () => {
    setAcknowledging(true);
    try {
      const res = await fetch(`/api/sessions/${conversationId}/acknowledge`, {
        method: "POST",
      });
      if (res.ok) {
        setCurrentFeedbackStatus("evaluated");
      }
    } catch { /* ignore */ }
    setAcknowledging(false);
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
          alliance_framing: allianceFraming,
          rupture_moment: ruptureMoment,
          nonverbal_cues: nonverbalCues,
          intervention_types: interventionTypes,
          clinical_hypothesis: clinicalHypothesis,
        }),
      });

      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setResults(data);
      setStep("pending"); // Student must wait for teacher approval

      // Trigger any pending experience survey now that the student has
      // completed their post-session reflection. SurveyModal in
      // (app)/layout.tsx listens for this event and refetches active
      // surveys, popping the modal if one is found.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("gloria:reflection-submitted"));
      }
    } catch {
      setStep("reflect");
    }
  };

  const trySubmit = () => {
    const allEmpty = !allianceFraming.trim() && !ruptureMoment.trim() && !nonverbalCues.trim() && !interventionTypes.trim() && !clinicalHypothesis.trim();
    if (allEmpty) {
      setShowEmptyConfirm(true);
      return;
    }
    handleSubmit();
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
      <div className="max-w-5xl mx-auto">
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
          <div className="bg-white rounded-xl border border-amber-200 p-8 animate-fade-in">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 mb-4">
                <Clock size={32} className="text-amber-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Sesi&oacute;n muy breve para evaluar
              </h2>
              <p className="text-sm text-gray-600 max-w-md mx-auto">
                Para generar una evaluaci&oacute;n de competencias cl&iacute;nicas, necesitamos al menos <strong>5 minutos de conversaci&oacute;n</strong> y <strong>6 intervenciones tuyas</strong>. Esta sesi&oacute;n no alcanz&oacute; esos m&iacute;nimos.
              </p>
            </div>

            <div className="bg-amber-50/50 rounded-lg p-4 mb-6 max-w-md mx-auto">
              <p className="text-xs font-semibold text-amber-700 mb-2">&iquest;Por qu&eacute; estos m&iacute;nimos?</p>
              <ul className="text-xs text-amber-600 space-y-1.5">
                <li>&bull; El v&iacute;nculo terap&eacute;utico requiere tiempo para establecerse</li>
                <li>&bull; Se necesitan suficientes intervenciones para evaluar escucha activa, preguntas y encuadre</li>
                <li>&bull; Una sesi&oacute;n breve no permite explorar el motivo de consulta en profundidad</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => router.push(`/chat/${patient.id || ""}`)}
                className="bg-sidebar hover:bg-[#354080] text-white py-2.5 px-6 rounded-lg text-sm font-medium transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                Volver a intentar
              </button>
              <button
                onClick={() => router.push("/pacientes")}
                className="border border-sidebar text-sidebar py-2.5 px-6 rounded-lg text-sm font-medium hover:bg-sidebar/5 transition-colors cursor-pointer"
              >
                Ir a otro paciente
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="border border-gray-300 text-gray-500 py-2.5 px-6 rounded-lg text-sm hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Volver al inicio
              </button>
            </div>
          </div>
        )}

        {/* ===== NORMAL FLOW (not too short) ===== */}
        {!tooShort && (
          <>
            {/* Step: Reflection form */}
            {step === "reflect" && (
              <div className="space-y-4 animate-fade-in">
                {/* Header + Audio recorder */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-0.5">
                        Reflexión post-sesión
                      </h2>
                      <p className="text-sm text-gray-500">
                        5 preguntas para pensar como terapeuta. Responde las que puedas.
                      </p>
                    </div>
                    {/* Audio recorder button - right side */}
                    <div className="flex-shrink-0 ml-4">
                      {audioProcessing !== "idle" ? (
                        <div className="flex items-center gap-2">
                          <Loader2 size={16} className="animate-spin text-sidebar" />
                          <span className="text-xs font-medium text-sidebar">
                            {audioProcessing === "transcribing" ? "Transcribiendo..." : "Organizando..."}
                          </span>
                        </div>
                      ) : isRecording ? (
                        <button
                          onClick={stopRecording}
                          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors cursor-pointer"
                        >
                          <Square size={14} />
                          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                          {formatDuration(recordingSeconds)}
                        </button>
                      ) : (
                        <button
                          onClick={startRecording}
                          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors shadow-sm cursor-pointer"
                        >
                          <Mic size={16} />
                          Grabar reflexión en audio
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">
                    Revisar siempre las transcripciones, la IA puede generar imprecisiones.
                  </p>
                </div>

                {/* Question cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {([
                  {
                    num: "01",
                    dimension: "V\u00cdNCULO",
                    color: "border-l-[#4A55A2]",
                    label: "Alianza y encuadre",
                    placeholder: "\u00bfEstableciste confidencialidad, roles y objetivos al inicio? \u00bfC\u00f3mo percibiste que el paciente respondi\u00f3 a tu encuadre?",
                    value: allianceFraming,
                    onChange: setAllianceFraming,
                  },
                  {
                    num: "02",
                    dimension: "V\u00cdNCULO",
                    color: "border-l-[#4A55A2]",
                    label: "Momento de ruptura",
                    placeholder: "\u00bfDetectaste alg\u00fan momento de incomodidad, silencio tenso o cambio emocional en el paciente? \u00bfC\u00f3mo lo abordaste (o qu\u00e9 har\u00edas distinto)?",
                    value: ruptureMoment,
                    onChange: setRuptureMoment,
                  },
                  {
                    num: "03",
                    dimension: "ENTREVISTA",
                    color: "border-l-emerald-500",
                    label: "Conducta no verbal",
                    placeholder: "El paciente mostr\u00f3 se\u00f1ales no verbales (suspiros, mirar al suelo, cruzar brazos). \u00bfLas notaste? \u00bfLas integraste en tu intervenci\u00f3n?",
                    value: nonverbalCues,
                    onChange: setNonverbalCues,
                  },
                  {
                    num: "04",
                    dimension: "ENTREVISTA",
                    color: "border-l-emerald-500",
                    label: "Tipo de intervenciones",
                    placeholder: "\u00bfPredominaron tus preguntas o tambi\u00e9n usaste reflejos, s\u00edntesis o validaciones? \u00bfHubo alg\u00fan momento donde diste un consejo prematuro?",
                    value: interventionTypes,
                    onChange: setInterventionTypes,
                  },
                  {
                    num: "05",
                    dimension: "INTEGRACI\u00d3N",
                    color: "border-l-purple-500",
                    label: "Hip\u00f3tesis cl\u00ednica",
                    placeholder: "Con lo explorado en esta sesi\u00f3n, \u00bfcu\u00e1l ser\u00eda tu hip\u00f3tesis inicial sobre el motivo de consulta? \u00bfQu\u00e9 explorar\u00edas en una segunda sesi\u00f3n?",
                    value: clinicalHypothesis,
                    onChange: setClinicalHypothesis,
                  },
                ] as const).map((q) => (
                  <div
                    key={q.num}
                    className={`bg-white rounded-xl border border-gray-200 ${q.color} border-l-4 p-4`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-400">
                        {q.num}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-semibold text-gray-900">{q.label}</h3>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                            {q.dimension}
                          </span>
                        </div>
                      </div>
                    </div>
                    <textarea
                      value={q.value}
                      onChange={(e) => q.onChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-sidebar/30 focus:border-sidebar/50 placeholder:text-gray-400/70"
                      rows={4}
                      placeholder={q.placeholder}
                      disabled={audioProcessing !== "idle"}
                    />
                  </div>
                ))}
                </div>

                {/* Notes */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-xs font-semibold text-gray-700 mb-2">Mis notas de sesión</h3>
                  <textarea
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    placeholder="Apuntes personales sobre la sesión..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sidebar/30 placeholder:text-gray-400/70 cursor-text"
                    rows={3}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={trySubmit}
                    disabled={audioProcessing !== "idle" || isRecording}
                    className="flex-1 bg-sidebar hover:bg-[#354080] text-white py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer hover:shadow-md"
                  >
                    <Send size={16} />
                    Enviar reflexi&oacute;n y evaluar
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
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="bg-sidebar text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors cursor-pointer"
                  >
                    Volver al inicio
                  </button>
                  <button
                    onClick={() => router.push("/pacientes")}
                    className="bg-amber-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors cursor-pointer"
                  >
                    Ir a Pacientes
                  </button>
                </div>
              </div>
            )}

            {/* Step: Results (only visible after teacher approval) */}
            {step === "results" && evaluation && (
              <div className="space-y-6 animate-fade-in">
                {/* Competency Radar */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Competencias clínicas
                    </h3>
                    <button
                      onClick={() => setShowRadarModal(true)}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-sidebar transition-colors cursor-pointer"
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
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer"
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
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors cursor-pointer"
                                >
                                  <CheckCircle size={13} /> Aceptar
                                </button>
                                <button
                                  onClick={() => respondToItem(item.id, "rejected")}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors cursor-pointer"
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

                {/* Evaluated banner */}
                {currentFeedbackStatus === "evaluated" && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-3">
                    <CheckCircle size={22} className="text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">Sesión evaluada</p>
                      <p className="text-xs text-green-600">El ciclo de evaluación se completó. Tu docente fue notificado.</p>
                    </div>
                  </div>
                )}

                {/* Confirm review button (when no action items and status is approved) */}
                {currentFeedbackStatus === "approved" && actionItems.length === 0 && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
                    <p className="text-sm text-gray-700 mb-3">
                      Revisa los resultados y confirma que los revisaste para cerrar el ciclo de evaluación.
                    </p>
                    <button
                      onClick={acknowledgeReview}
                      disabled={acknowledging}
                      className="bg-sidebar text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#354080] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {acknowledging ? "Confirmando..." : "Confirmar revisión"}
                    </button>
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
                    className="flex-1 bg-sidebar hover:bg-[#354080] text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Volver al inicio
                    <ArrowRight size={16} />
                  </button>
                  <button
                    onClick={() => router.push("/historial")}
                    className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Ver historial
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showEmptyConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowEmptyConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4 animate-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                <GraduationCap size={20} className="text-amber-500" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Reflexión vacía</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              La reflexión post-sesión es un componente clave del proceso formativo. Tomarte unos minutos para reflexionar sobre tu práctica fortalece tus competencias clínicas.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => setShowEmptyConfirm(false)}
                className="flex-1 bg-sidebar text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#354080] transition-colors cursor-pointer"
              >
                Volver a reflexión
              </button>
              <button
                onClick={() => {
                  setShowEmptyConfirm(false);
                  handleSubmit();
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Omitir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
