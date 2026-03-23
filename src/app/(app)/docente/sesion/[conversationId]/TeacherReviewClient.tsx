"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Brain, BookOpen, GraduationCap, Send, CheckCircle,
  MessageSquare, Clock, User as UserIcon, Sparkles, Loader2, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import CompetencyTooltip from "@/components/CompetencyTooltip";

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

interface Competencies {
  // V2 Valdés & Gómez (2023) — 10 competencies, 0-4 scale
  setting_terapeutico: number;
  motivo_consulta: number;
  datos_contextuales: number;
  objetivos: number;
  escucha_activa: number;
  actitud_no_valorativa: number;
  optimismo: number;
  presencia: number;
  conducta_no_verbal: number;
  contencion_afectos: number;
  overall_score_v2: number;
  // Legacy V1 (backward compat)
  empathy: number;
  active_listening: number;
  open_questions: number;
  reformulation: number;
  confrontation: number;
  silence_management: number;
  rapport: number;
  overall_score: number;
  eval_version?: number;
  ai_commentary?: string;
  strengths?: string[];
  areas_to_improve?: string[];
  evidence?: Record<string, { quote: string; observation: string }>;
}

interface Feedback {
  discomfort_moment?: string;
  would_redo?: string;
  clinical_note?: string;
  teacher_comment?: string;
  teacher_score?: number;
}

interface Props {
  conversationId: string;
  student: { id: string; full_name: string; email: string };
  patient: { name: string; age: number; occupation: string; difficulty_level: string };
  sessionNumber: number;
  createdAt: string;
  messages: Message[];
  competencies: Competencies | null;
  feedback: Feedback | null;
  feedbackStatus: "pending" | "approved";
}

const COMP_V2_LABELS: { key: string; label: string; domain: string }[] = [
  { key: "setting_terapeutico", label: "Setting terapéutico", domain: "Estructura" },
  { key: "motivo_consulta", label: "Motivo de consulta", domain: "Estructura" },
  { key: "datos_contextuales", label: "Datos contextuales", domain: "Estructura" },
  { key: "objetivos", label: "Objetivos terapéuticos", domain: "Estructura" },
  { key: "escucha_activa", label: "Escucha activa", domain: "Actitudes" },
  { key: "actitud_no_valorativa", label: "Actitud no valorativa", domain: "Actitudes" },
  { key: "optimismo", label: "Optimismo terapéutico", domain: "Actitudes" },
  { key: "presencia", label: "Presencia", domain: "Actitudes" },
  { key: "conducta_no_verbal", label: "Conducta no verbal", domain: "Actitudes" },
  { key: "contencion_afectos", label: "Contención de afectos", domain: "Actitudes" },
];

export default function TeacherReviewClient({
  conversationId,
  student,
  patient,
  sessionNumber,
  createdAt,
  messages,
  competencies,
  feedback,
  feedbackStatus,
}: Props) {
  const router = useRouter();
  const [comment, setComment] = useState(feedback?.teacher_comment || "");
  const [isApproved, setIsApproved] = useState(feedbackStatus === "approved");
  const [approving, setApproving] = useState(false);
  const [score, setScore] = useState<string>(
    feedback?.teacher_score != null ? String(feedback.teacher_score) : ""
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!feedback?.teacher_comment || !!feedback?.teacher_score);
  const [editingAI, setEditingAI] = useState(false);
  const [aiCommentary, setAiCommentary] = useState(competencies?.ai_commentary || "");
  const [editedScores, setEditedScores] = useState<Record<string, number>>({});
  const [editedStrengths, setEditedStrengths] = useState<string[]>(competencies?.strengths || []);
  const [editedAreas, setEditedAreas] = useState<string[]>(competencies?.areas_to_improve || []);
  const [savingEdits, setSavingEdits] = useState(false);
  const [generatingComment, setGeneratingComment] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<string | null>(null);
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);

  const saveAIEdits = async () => {
    setSavingEdits(true);
    try {
      const updates: Record<string, unknown> = {
        ai_commentary: aiCommentary,
        strengths: editedStrengths,
        areas_to_improve: editedAreas,
      };
      Object.entries(editedScores).forEach(([k, v]) => { updates[k] = v; });
      const res = await fetch("/api/docente/update-competencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId, updates }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Error al guardar");
      toast.success("Cambios guardados");
      setEditingAI(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar los cambios de la IA");
    } finally {
      setSavingEdits(false);
    }
  };

  const generateSupervisorComment = async () => {
    setGeneratingComment(true);
    try {
      const summary = competencies
        ? `Puntaje general: ${(competencies.overall_score_v2 || competencies.overall_score || 0).toFixed(1)}. Comentario IA: ${aiCommentary || "N/A"}. Fortalezas: ${editedStrengths.join(", ") || "N/A"}. Áreas: ${editedAreas.join(", ") || "N/A"}.`
        : "";
      const res = await fetch("/api/docente/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "suggest_comment",
          conversation_id: conversationId,
          student_name: student.full_name,
          evaluation_summary: summary,
        }),
      });
      const data = await res.json();
      if (data.comment) {
        setComment(data.comment);
        setSaved(false);
      }
    } catch {
      toast.error("No se pudo generar el comentario. Intenta de nuevo.");
    }
    setGeneratingComment(false);
  };

  const handleSubmit = async () => {
    const numScore = score ? parseFloat(score) : null;
    if (numScore != null && (numScore < 0 || numScore > 10)) return;
    if (!comment.trim() && numScore == null) return;

    setSaving(true);
    try {
      const res = await fetch("/api/docente/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          teacher_comment: comment.trim() || null,
          teacher_score: numScore,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Error al guardar");
      setSaved(true);
      toast.success("Evaluación guardada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar la evaluación");
    } finally {
      setSaving(false);
    }
  };

  const date = new Date(createdAt).toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Filter out system messages
  const chatMessages = messages.filter((m) => m.role !== "system");

  const difficultyLabel: Record<string, string> = {
    beginner: "Principiante",
    intermediate: "Intermedio",
    advanced: "Avanzado",
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="px-4 sm:px-8 py-5 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <Link
            href={`/docente/alumno/${student.id}`}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={18} className="text-gray-500" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900">
                {student.full_name}
              </h1>
              <span className="text-xs text-gray-400">Sesión #{sessionNumber} &middot; {date}</span>
            </div>
            <p className="text-xs text-gray-500">
              Paciente: {patient.name} ({patient.age} años, {patient.occupation}) &middot;{" "}
              <span className={
                patient.difficulty_level === "beginner" ? "text-green-600" :
                patient.difficulty_level === "intermediate" ? "text-amber-600" : "text-red-600"
              }>
                {difficultyLabel[patient.difficulty_level] || patient.difficulty_level}
              </span>
            </p>
          </div>
          {!isApproved && (
            <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full flex items-center gap-1">
              <Clock size={10} />
              Pendiente de aprobación
            </span>
          )}
          {isApproved && (
            <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full flex items-center gap-1">
              <CheckCircle size={10} />
              Aprobada
            </span>
          )}
        </div>
      </header>

      <div className="px-4 sm:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* Left: Chat transcript */}
          <div className="space-y-6">
            {/* Patient info bar */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
              {(() => {
                const patientSlug = patient.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
                const imgUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/${patientSlug}.png`;
                return (
                  <div className="w-10 h-10 rounded-full bg-sidebar flex items-center justify-center overflow-hidden flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgUrl}
                      alt={patient.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const el = e.currentTarget;
                        el.style.display = "none";
                        if (el.parentElement) {
                          const span = document.createElement("span");
                          span.className = "text-white text-sm font-bold";
                          span.textContent = patient.name.split(" ").map(n => n[0]).join("").slice(0, 2);
                          el.parentElement.appendChild(span);
                        }
                      }}
                    />
                  </div>
                );
              })()}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {patient.name}, {patient.age} años
                </p>
                <p className="text-xs text-gray-500">
                  {patient.occupation} &middot; {difficultyLabel[patient.difficulty_level] || patient.difficulty_level}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <MessageSquare size={12} />
                  {chatMessages.length} msgs
                </span>
              </div>
            </div>

            {/* Chat transcript */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Transcripción del chat
                </p>
              </div>
              <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
                {chatMessages.map((msg) => {
                  const isStudent = msg.role === "user";
                  return (
                    <div key={msg.id} className={`flex ${isStudent ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                        isStudent
                          ? "bg-sidebar text-white rounded-br-md"
                          : "bg-gray-100 text-gray-800 rounded-bl-md"
                      }`}>
                        <p className={`text-[10px] font-medium mb-1 ${
                          isStudent ? "text-white/60" : "text-gray-400"
                        }`}>
                          {isStudent ? "Alumno" : patient.name}
                        </p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        <p className={`text-[9px] mt-1 ${
                          isStudent ? "text-white/40" : "text-gray-300"
                        }`}>
                          {(() => {
                            const d = new Date(msg.created_at);
                            return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
                          })()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Student reflection — visible in main area */}
            {feedback && (feedback.discomfort_moment || feedback.would_redo || feedback.clinical_note) && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen size={16} className="text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-900">Reflexión del alumno</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {feedback.discomfort_moment && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] text-gray-400 font-medium mb-1">Momento incómodo</p>
                      <p className="text-xs text-gray-700 leading-relaxed">{feedback.discomfort_moment}</p>
                    </div>
                  )}
                  {feedback.would_redo && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] text-gray-400 font-medium mb-1">Qué haría distinto</p>
                      <p className="text-xs text-gray-700 leading-relaxed">{feedback.would_redo}</p>
                    </div>
                  )}
                  {feedback.clinical_note && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] text-gray-400 font-medium mb-1">Nota clínica</p>
                      <p className="text-xs text-gray-700 leading-relaxed">{feedback.clinical_note}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Evaluation panel */}
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            {/* AI Evaluation */}
            {competencies && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Brain size={16} className="text-sidebar" />
                  <h3 className="text-sm font-semibold text-gray-900">Evaluación IA</h3>
                  <span className="ml-auto text-lg font-bold text-sidebar">
                    {(Number(competencies.overall_score_v2) || Number(competencies.overall_score) || 0).toFixed(1)}
                    <span className="text-[10px] font-normal text-gray-400 ml-0.5">/4</span>
                  </span>
                </div>

                {/* V2 Competency bars — 10 competencies (Valdés & Gómez, 2023), 0-4 scale */}
                {["Estructura", "Actitudes"].map((domain) => (
                  <div key={domain} className="mb-3">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{domain}</p>
                    <div className="space-y-1.5">
                      {COMP_V2_LABELS.filter(c => c.domain === domain).map(({ key, label }) => {
                        const origVal = Number(competencies[key as keyof Competencies]) || 0;
                        const val = editedScores[key] !== undefined ? editedScores[key] : origVal;
                        const isEdited = editedScores[key] !== undefined && editedScores[key] !== origVal;
                        return (
                          <div key={key} className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedEvidence(selectedEvidence === key ? null : key)}
                              className={`text-[10px] w-32 truncate text-left flex items-center gap-1 cursor-pointer ${
                                selectedEvidence === key ? "text-sidebar font-bold" : "text-gray-500 hover:text-sidebar"
                              }`}
                            >
                              {label}
                              <CompetencyTooltip compKey={key} />
                            </button>
                            {editingAI ? (
                              <input
                                type="range" min="0" max="4" step="0.5" value={val}
                                onChange={(e) => setEditedScores((prev) => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                                className="flex-1 h-1.5 accent-sidebar"
                              />
                            ) : (
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${(val / 4) * 100}%`,
                                    backgroundColor: val >= 3 ? "#22c55e" : val >= 2 ? "#eab308" : val > 0 ? "#ef4444" : "#d1d5db",
                                  }}
                                />
                              </div>
                            )}
                            <span className={`text-[10px] font-medium w-5 text-right ${isEdited ? "text-sidebar" : "text-gray-700"}`}>
                              {val.toFixed(1)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Show all evidence toggle */}
                {competencies.evidence && (
                  <button
                    onClick={() => { setShowAllEvidence(!showAllEvidence); setSelectedEvidence(null); }}
                    className="flex items-center gap-1 text-[10px] text-sidebar font-medium hover:underline mb-2 cursor-pointer"
                  >
                    <Eye size={11} />
                    {showAllEvidence ? "Ocultar evidencia" : "Ver toda la evidencia"}
                  </button>
                )}

                {/* All evidence expanded */}
                {showAllEvidence && competencies.evidence && (
                  <div className="mb-3 space-y-2 max-h-[300px] overflow-y-auto">
                    {COMP_V2_LABELS.map(({ key, label }) => {
                      const ev = (competencies.evidence as Record<string, { quote: string; observation: string }>)[key];
                      if (!ev?.quote) return null;
                      return (
                        <div key={key} className="bg-sidebar/5 rounded-lg p-2.5 border border-sidebar/10">
                          <p className="text-[9px] font-bold text-sidebar uppercase mb-1">{label}</p>
                          <p className="text-[11px] text-gray-700 italic">&ldquo;{ev.quote}&rdquo;</p>
                          {ev.observation && <p className="text-[10px] text-gray-500 mt-0.5">{ev.observation}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Evidence panel (single — click to show) */}
                {!showAllEvidence && selectedEvidence && competencies.evidence && (
                  <div className="mb-3 bg-sidebar/5 rounded-lg p-3 border border-sidebar/10 animate-fade-in">
                    <p className="text-[10px] font-bold text-sidebar uppercase mb-1.5">Evidencia textual</p>
                    {(() => {
                      const ev = (competencies.evidence as Record<string, { quote: string; observation: string }>)[selectedEvidence];
                      if (!ev?.quote) return <p className="text-[11px] text-gray-400 italic">Sin evidencia registrada para esta competencia.</p>;
                      return (
                        <>
                          <p className="text-xs text-gray-700 italic mb-1">&ldquo;{ev.quote}&rdquo;</p>
                          {ev.observation && <p className="text-[11px] text-gray-500">{ev.observation}</p>}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* AI commentary — editable */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-medium text-gray-500">Comentario IA</p>
                    {!editingAI ? (
                      <button onClick={() => setEditingAI(true)} className="text-[10px] text-sidebar hover:underline cursor-pointer">Editar</button>
                    ) : (
                      <button onClick={saveAIEdits} disabled={savingEdits} className="text-[10px] text-green-600 font-medium hover:underline cursor-pointer disabled:cursor-not-allowed">
                        {savingEdits ? "Guardando..." : "Guardar cambios"}
                      </button>
                    )}
                  </div>
                  {editingAI ? (
                    <textarea value={aiCommentary} onChange={(e) => setAiCommentary(e.target.value)}
                      rows={4} className="w-full border border-sidebar/30 rounded-lg px-3 py-2 text-xs resize-y focus:outline-none focus:ring-2 focus:ring-sidebar/20" />
                  ) : (
                    <p className="text-xs text-gray-600 leading-relaxed bg-blue-50 rounded-lg px-3 py-2">
                      {aiCommentary || competencies.ai_commentary || "Sin comentario"}
                    </p>
                  )}
                </div>

                {/* Strengths & Areas — editable */}
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] font-medium text-green-700 mb-1">Fortalezas</p>
                    {editingAI ? (
                      <div className="space-y-1">
                        {editedStrengths.map((s, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <input value={s} onChange={(e) => { const u = [...editedStrengths]; u[i] = e.target.value; setEditedStrengths(u); }}
                              className="flex-1 text-[11px] border border-green-200 rounded px-2 py-1" />
                            <button onClick={() => setEditedStrengths(editedStrengths.filter((_, j) => j !== i))} className="text-red-400 text-[10px]">x</button>
                          </div>
                        ))}
                        <button onClick={() => setEditedStrengths([...editedStrengths, ""])} className="text-[10px] text-green-600 hover:underline">+ Agregar</button>
                      </div>
                    ) : (
                      editedStrengths.map((s, i) => <p key={i} className="text-[11px] text-green-600">+ {s}</p>)
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-amber-700 mb-1">Áreas de mejora</p>
                    {editingAI ? (
                      <div className="space-y-1">
                        {editedAreas.map((s, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <input value={s} onChange={(e) => { const u = [...editedAreas]; u[i] = e.target.value; setEditedAreas(u); }}
                              className="flex-1 text-[11px] border border-amber-200 rounded px-2 py-1" />
                            <button onClick={() => setEditedAreas(editedAreas.filter((_, j) => j !== i))} className="text-red-400 text-[10px]">x</button>
                          </div>
                        ))}
                        <button onClick={() => setEditedAreas([...editedAreas, ""])} className="text-[10px] text-amber-600 hover:underline">+ Agregar</button>
                      </div>
                    ) : (
                      editedAreas.map((s, i) => <p key={i} className="text-[11px] text-amber-600">{s}</p>)
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Teacher evaluation form */}
            <div className="bg-white rounded-xl border border-purple-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap size={16} className="text-purple-600" />
                <h3 className="text-sm font-semibold text-gray-900">
                  {saved ? "Tu evaluación" : "Evaluar esta sesión"}
                </h3>
                {saved && (
                  <CheckCircle size={14} className="text-green-500 ml-auto" />
                )}
              </div>

              {/* Score input */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Nota (0 - 10)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={score}
                  onChange={(e) => { setScore(e.target.value); setSaved(false); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  placeholder="7.5"
                />
              </div>

              {/* Comment */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-gray-700">
                    Comentario de supervisión
                  </label>
                  <button
                    onClick={generateSupervisorComment}
                    disabled={generatingComment}
                    className="flex items-center gap-1 text-[11px] text-purple-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {generatingComment ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {generatingComment ? "Generando..." : "Sugerir con IA"}
                  </button>
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => { setComment(e.target.value); setSaved(false); }}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"
                  placeholder="Observaciones sobre la sesión, técnicas utilizadas, sugerencias..."
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={saving || saved || (!comment.trim() && !score)}
                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 hover:shadow-md ${
                  saved
                    ? "bg-green-100 text-green-700 cursor-default"
                    : saving
                    ? "bg-purple-300 text-white cursor-wait"
                    : "bg-purple-600 hover:bg-purple-700 text-white cursor-pointer"
                }`}
              >
                {saved ? (
                  <>
                    <CheckCircle size={16} />
                    Evaluación guardada
                  </>
                ) : saving ? (
                  "Guardando..."
                ) : (
                  <>
                    <Send size={16} />
                    Guardar evaluación
                  </>
                )}
              </button>

              {/* Approve & release feedback button */}
              <div className={`mt-4 p-4 rounded-xl border-2 ${
                isApproved
                  ? "bg-green-50 border-green-200"
                  : "bg-amber-50 border-amber-200"
              }`}>
                {isApproved ? (
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle size={18} />
                    <span className="text-sm font-medium">Retroalimentación aprobada y visible para el estudiante</span>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-amber-700 font-medium mb-2">
                      El estudiante NO puede ver la retroalimentación hasta que la apruebes.
                    </p>
                    <button
                      onClick={() => setShowApproveConfirm(true)}
                      disabled={approving}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 hover:shadow-md"
                    >
                      {approving ? "Aprobando..." : (
                        <>
                          <CheckCircle size={16} />
                          Aprobar y liberar retroalimentación
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-amber-600 mt-2">
                      Se notificará al estudiante por la plataforma y por correo electrónico.
                    </p>

                    {/* Confirmation dialog */}
                    <Dialog open={showApproveConfirm} onOpenChange={setShowApproveConfirm}>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>{"Confirmar aprobaci\u00f3n"}</DialogTitle>
                          <DialogDescription>
                            {"Al aprobar, el estudiante podr\u00e1 ver la retroalimentaci\u00f3n completa (evaluaci\u00f3n IA, tu comentario y nota). Esta acci\u00f3n no se puede deshacer."}
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2 sm:gap-0">
                          <button
                            onClick={() => setShowApproveConfirm(false)}
                            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={async () => {
                              setShowApproveConfirm(false);
                              setApproving(true);
                              try {
                                const res = await fetch("/api/docente/approve", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ conversation_id: conversationId }),
                                });
                                if (!res.ok) throw new Error("Error al aprobar");
                                setIsApproved(true);
                                toast.success("Retroalimentaci\u00f3n aprobada y enviada al estudiante");
                              } catch {
                                toast.error("Error al aprobar. Intenta de nuevo.");
                              }
                              setApproving(false);
                            }}
                            className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors cursor-pointer hover:shadow-md"
                          >
                            Aprobar y liberar
                          </button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </div>
            </div>

            {/* Action Items */}
            <ActionItemsPanel
              conversationId={conversationId}
              studentId={student.id}
              studentName={student.full_name}
              competencies={competencies}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionItemsPanel({ conversationId, studentId, studentName, competencies }: {
  conversationId: string; studentId: string; studentName: string; competencies: Competencies | null;
}) {
  const [items, setItems] = useState<{ id: string; content: string; status: string; resource_link: string | null; student_comment: string | null }[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [prevItems, setPrevItems] = useState<{ content: string; status: string; created_at: string }[]>([]);
  const [showPrev, setShowPrev] = useState(false);

  // Load existing items for this conversation
  useEffect(() => {
    fetch("/api/docente/action-items?conversation_id=" + conversationId)
      .then(r => r.json())
      .then(data => { setItems(data); setLoaded(true); });
    // Load previous action items for this student
    fetch("/api/docente/action-items?student_id=" + studentId)
      .then(r => r.json())
      .then(data => {
        setPrevItems(data.filter((d: { conversation_id: string }) => d.conversation_id !== conversationId));
      });
  }, [conversationId, studentId]);

  const generateSuggestions = async () => {
    setGenerating(true);
    try {
      const evalSummary = competencies
        ? "Puntaje general: " + Number(competencies.overall_score).toFixed(1) + "/10. " +
          "Fortalezas: " + (competencies.strengths || []).join(", ") + ". " +
          "\u00c1reas de mejora: " + (competencies.areas_to_improve || []).join(", ") + ". " +
          "Comentario IA: " + (competencies.ai_commentary || "")
        : "Sin evaluaci\u00f3n disponible.";

      const res = await fetch("/api/docente/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suggest", conversation_id: conversationId, student_name: studentName, evaluation_summary: evalSummary }),
      });
      if (!res.ok) throw new Error("Error al generar sugerencias");
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch {
      toast.error("No se pudieron generar sugerencias. Intenta de nuevo.");
    }
    setGenerating(false);
  };

  const saveItems = async () => {
    setSaving(true);
    try {
      const toSave = suggestions.map(s => ({ content: s }));
      const res = await fetch("/api/docente/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId, student_id: studentId, items: toSave }),
      });
      if (!res.ok) throw new Error("Error al guardar accionables");
      toast.success("Accionables enviados al estudiante");
      setSuggestions([]);
      // Reload
      const r = await fetch("/api/docente/action-items?conversation_id=" + conversationId);
      if (r.ok) setItems(await r.json());
    } catch {
      toast.error("Error al enviar los accionables. Intenta de nuevo.");
    }
    setSaving(false);
  };

  const removeSuggestion = (idx: number) => {
    setSuggestions(prev => prev.filter((_, i) => i !== idx));
  };

  if (!loaded) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className="text-emerald-500" />
          <h3 className="text-sm font-semibold text-gray-900">Accionables</h3>
        </div>
        {items.length === 0 && suggestions.length === 0 && (
          <button onClick={generateSuggestions} disabled={generating}
            className="text-[10px] text-sidebar font-medium hover:underline flex items-center gap-1">
            {generating ? "Generando..." : "Sugerir con IA"}
          </button>
        )}
      </div>

      {/* Existing items */}
      {items.length > 0 && (
        <div className="space-y-2 mb-3">
          {items.map(item => (
            <div key={item.id} className={`text-xs px-3 py-2 rounded-lg border ${
              item.status === "accepted" ? "bg-green-50 border-green-200" :
              item.status === "rejected" ? "bg-red-50 border-red-200" :
              "bg-amber-50 border-amber-200"
            }`}>
              <p className="text-gray-800">{item.content}</p>
              <p className={`text-[10px] mt-1 font-medium ${
                item.status === "accepted" ? "text-green-600" :
                item.status === "rejected" ? "text-red-600" :
                "text-amber-600"
              }`}>
                {item.status === "accepted" ? "✓ Aceptado por estudiante" :
                 item.status === "rejected" ? "✗ No aceptado" :
                 "⏳ Pendiente de validación"}
              </p>
              {item.student_comment && <p className="text-[10px] text-gray-500 mt-0.5">"{item.student_comment}"</p>}
            </div>
          ))}
        </div>
      )}

      {/* AI suggestions (not yet saved) */}
      {suggestions.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-[10px] text-gray-500 font-medium">Sugerencias de la IA (edita o elimina antes de enviar):</p>
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs bg-sidebar/5 px-3 py-2 rounded-lg border border-sidebar/10">
              <p className="flex-1 text-gray-800">{s}</p>
              <button onClick={() => removeSuggestion(i)} className="text-gray-400 hover:text-red-500 text-[10px]">✕</button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <button onClick={saveItems} disabled={saving}
              className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50">
              {saving ? "Enviando..." : "Enviar accionables al estudiante"}
            </button>
            <button onClick={generateSuggestions} disabled={generating}
              className="text-[10px] text-sidebar hover:underline">
              Regenerar
            </button>
          </div>
        </div>
      )}

      {/* No items yet */}
      {items.length === 0 && suggestions.length === 0 && !generating && (
        <p className="text-xs text-gray-400 text-center py-3">Sin accionables. Usa "Sugerir con IA" para generar.</p>
      )}

      {/* Previous agreements */}
      {prevItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <button onClick={() => setShowPrev(!showPrev)} className="text-[10px] text-gray-500 hover:text-sidebar">
            {showPrev ? "Ocultar" : "Ver"} acuerdos previos ({prevItems.length})
          </button>
          {showPrev && (
            <div className="mt-2 space-y-1">
              {prevItems.slice(0, 10).map((p, i) => (
                <div key={i} className="text-[10px] text-gray-500 flex items-center gap-1">
                  <span className={p.status === "accepted" ? "text-green-500" : p.status === "rejected" ? "text-red-400" : "text-amber-400"}>
                    {p.status === "accepted" ? "✓" : p.status === "rejected" ? "✗" : "⏳"}
                  </span>
                  <span className="truncate">{p.content}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
