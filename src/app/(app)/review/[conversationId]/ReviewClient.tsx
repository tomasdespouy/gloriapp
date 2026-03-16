"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Send, ArrowRight, Flame, Clock } from "lucide-react";
import Confetti from "@/components/Confetti";
import CountUp from "@/components/CountUp";
import CompetencyRadar from "@/components/CompetencyRadar";
import { useToast } from "@/components/Toast";
import type { CompetencyScores } from "@/lib/gamification";
import ClinicalStateChart from "@/components/ClinicalStateChart";

interface Props {
  conversationId: string;
  patient: { name: string; age: number; occupation: string; difficulty_level: string };
  sessionNumber: number;
  messageCount: number;
  existingEvaluation: Record<string, unknown> | null;
  feedbackStatus: "pending" | "approved" | null;
  tooShort: boolean;
  durationMinutes: number;
}

export default function ReviewClient({
  conversationId,
  patient,
  sessionNumber,
  messageCount,
  existingEvaluation,
  feedbackStatus,
  tooShort,
  durationMinutes,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const canSeeResults = feedbackStatus === "approved";
  const [step, setStep] = useState<"reflect" | "loading" | "results" | "pending">(
    existingEvaluation
      ? canSeeResults ? "results" : "pending"
      : "reflect"
  );
  // Restore drafts from localStorage
  const draftKey = `gloria_draft_${conversationId}`;
  const [discomfortMoment, setDiscomfortMoment] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return JSON.parse(localStorage.getItem(draftKey) || "{}").discomfortMoment || ""; } catch { return ""; }
  });
  const [wouldRedo, setWouldRedo] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return JSON.parse(localStorage.getItem(draftKey) || "{}").wouldRedo || ""; } catch { return ""; }
  });
  const [clinicalNote, setClinicalNote] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return JSON.parse(localStorage.getItem(draftKey) || "{}").clinicalNote || ""; } catch { return ""; }
  });

  // Auto-save drafts to localStorage
  useEffect(() => {
    if (step !== "reflect") return;
    if (!discomfortMoment && !wouldRedo && !clinicalNote) return;
    const timeout = setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify({ discomfortMoment, wouldRedo, clinicalNote }));
    }, 500);
    return () => clearTimeout(timeout);
  }, [discomfortMoment, wouldRedo, clinicalNote, draftKey, step]);
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
      localStorage.removeItem(draftKey);
      setStep("pending"); // Student must wait for teacher approval
    } catch {
      toast("Error al enviar tu reflexión. Intenta de nuevo.", "error");
      setStep("reflect");
    }
  };

  const evaluation = (results?.evaluation || existingEvaluation) as Record<string, unknown> | null;

  const scores: CompetencyScores = evaluation
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
            <div className="w-12 h-12 rounded-full bg-sidebar flex items-center justify-center">
              <span className="text-white font-bold">
                {patient.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                Sesión #{sessionNumber} con {patient.name}
              </h1>
              <p className="text-sm text-gray-500">
                {patient.age} años &middot; {patient.occupation} &middot;{" "}
                <span className="inline-flex items-center gap-1">
                  <MessageSquare size={12} />
                  {messageCount} mensajes
                </span>
                {durationMinutes > 0 && (
                  <span className="inline-flex items-center gap-1 ml-2">
                    <Clock size={12} />
                    {durationMinutes} min
                  </span>
                )}
              </p>
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
              Esta sesión duro menos de 5 minutos, por lo que no es posible generar una evaluación de competencias clínicas significativa.
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
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Que harías diferente
                  </label>
                  <textarea
                    value={wouldRedo}
                    onChange={(e) => setWouldRedo(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sidebar"
                    rows={3}
                    placeholder="Si pudieras repetir esta sesión, ¿qué cambiarías?"
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
                  />
                </div>

                {(discomfortMoment || wouldRedo || clinicalNote) && (
                  <p className="text-[10px] text-gray-400 text-right">Borrador guardado automáticamente</p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSubmit}
                    className="flex-1 bg-sidebar hover:bg-[#354080] text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
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
                    className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
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
                  La IA esta analizando tus competencias clínicas.
                </p>
              </div>
            )}

            {/* Step: Pending teacher approval */}
            {step === "pending" && (
              <div className="text-center py-12 animate-fade-in">
                <div className="w-20 h-20 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-5">
                  <Clock size={36} className="text-amber-500" />
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Competencias clínicas
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Puntaje general: {Number(evaluation.overall_score).toFixed(1)}/10
                  </p>
                  <CompetencyRadar scores={scores} />
                </div>

                {/* Clinical State Evolution */}
                <ClinicalStateChart conversationId={conversationId} canView={canSeeResults} />

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
                      <p className="text-sm font-medium text-amber-800 mb-2">Areas de mejora</p>
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
