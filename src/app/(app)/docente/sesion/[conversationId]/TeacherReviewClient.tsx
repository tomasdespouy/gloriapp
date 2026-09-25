"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft, Brain, GraduationCap, Send, CheckCircle, Save,
  MessageSquare, Clock, Sparkles, Loader2,
  Search, ChevronUp, ChevronDown, ChevronRight, RefreshCw, X, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { getPatientImageUrl } from "@/lib/patient-assets";
import CompetencyTooltip from "@/components/CompetencyTooltip";
import ConversationDocxButton from "@/components/ConversationDocxButton";
import { getEvidenceList } from "@/lib/evaluation-prompt";
import { COMPETENCY_INFO } from "@/lib/competency-definitions";

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
  feedbackStatus: "pending" | "approved" | "evaluated";
  summary?: string | null;
  messageCount?: number;
  /** Pegó texto largo Y cambió de pestaña en la misma sesión (ver conversations.paste_count/tab_switch_count). */
  mixedDistraction?: boolean;
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

const MODULE_KEYS = ["chat", "reflect", "feedback"] as const;
type ModuleKey = typeof MODULE_KEYS[number];
const MODULE_LABELS: Record<ModuleKey, string> = { chat: "Conversación", reflect: "Reflexión", feedback: "Retroalimentación" };

// Búsqueda en la transcripción. `foldText` quita acentos y mayúsculas SIN
// cambiar el largo (1 carácter → 1 carácter), para poder resaltar sobre el
// texto ORIGINAL por posición, manteniendo la búsqueda insensible a tildes.
function foldText(s: string): string {
  return s.toLowerCase()
    .replace(/[áàäâã]/g, "a").replace(/[éèëê]/g, "e").replace(/[íìïî]/g, "i")
    .replace(/[óòöôõ]/g, "o").replace(/[úùüû]/g, "u").replace(/ñ/g, "n");
}
function countMatches(text: string, q: string): number {
  if (!q) return 0;
  const h = foldText(text);
  let n = 0, i = 0, idx;
  while ((idx = h.indexOf(q, i)) !== -1) { n++; i = idx + q.length; }
  return n;
}
function highlightMatches(text: string, q: string): ReactNode {
  if (!q) return text;
  const h = foldText(text);
  const out: ReactNode[] = [];
  let i = 0, k = 0, idx;
  while ((idx = h.indexOf(q, i)) !== -1) {
    if (idx > i) out.push(text.slice(i, idx));
    out.push(<mark key={k++} className="bg-yellow-200 text-inherit rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>);
    i = idx + q.length;
  }
  if (i < text.length) out.push(text.slice(i));
  return out;
}

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
  summary,
  messageCount,
  mixedDistraction = false,
}: Props) {
  const [comment, setComment] = useState(feedback?.teacher_comment || "");
  const isEvaluated = feedbackStatus === "evaluated";
  const wasAlreadyApproved = feedbackStatus === "approved" || feedbackStatus === "evaluated";
  const [isApproved, setIsApproved] = useState(wasAlreadyApproved);
  const [score, setScore] = useState<string>(
    feedback?.teacher_score != null ? String(feedback.teacher_score) : ""
  );
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [saved, setSaved] = useState(!!feedback?.teacher_comment || !!feedback?.teacher_score);
  const [regeneratingEval, setRegeneratingEval] = useState(false);
  const [feedbackStyle, setFeedbackStyle] = useState<"executive" | "descriptive">("executive");
  // Buscador de la transcripción
  const [search, setSearch] = useState("");
  const [activeMatch, setActiveMatch] = useState(0);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => { setActiveMatch(0); }, [search]);
  const [aiCommentary, setAiCommentary] = useState(competencies?.ai_commentary || "");
  const [editedScores, setEditedScores] = useState<Record<string, number>>({});
  const [editedStrengths, setEditedStrengths] = useState<string[]>(competencies?.strengths || []);
  const [editedAreas, setEditedAreas] = useState<string[]>(competencies?.areas_to_improve || []);
  const [generatingComment, setGeneratingComment] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<string | null>(null);
  const [actionItemsSent, setActionItemsSent] = useState(false);

  // Módulos visibles (Conversación / Reflexión / Retroalimentación). Al menos
  // uno queda siempre visible.
  const [activeModules, setActiveModules] = useState<Record<ModuleKey, boolean>>({ chat: true, reflect: true, feedback: true });
  const toggleModule = (key: ModuleKey) => {
    setActiveModules((prev) => {
      const activeCount = MODULE_KEYS.filter((k) => prev[k]).length;
      if (prev[key] && activeCount === 1) return prev;
      return { ...prev, [key]: !prev[key] };
    });
  };
  const activeModuleCount = MODULE_KEYS.filter((k) => activeModules[k]).length;

  // Secciones tipo acordeón dentro de Retroalimentación.
  const [compOpen, setCompOpen] = useState(true);
  const [actionablesOpen, setActionablesOpen] = useState(true);
  const [focusOpen, setFocusOpen] = useState(false);

  // Fortalezas/áreas quedan ocultas hasta que el docente confirma la
  // calibración (un solo llamado a IA, no uno por cada nota que mueve). Una
  // evaluación ya cerrada muestra directamente lo que se envió.
  const [calibrationConfirmed, setCalibrationConfirmed] = useState(wasAlreadyApproved);
  const [confirmingCalibration, setConfirmingCalibration] = useState(false);
  const [scoresChangedSinceCalibration, setScoresChangedSinceCalibration] = useState(false);

  // Autoguardado de la calibración (notas, comentario IA, fortalezas/áreas):
  // se guarda solo, sin necesidad de un botón "Guardar" aparte.
  const [autosaveStatus, setAutosaveStatus] = useState<"saved" | "saving">("saved");
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMounted = useRef(false);

  const liveOverall = competencies
    ? COMP_V2_LABELS.reduce((sum, { key }) => {
        const orig = Number(competencies[key as keyof Competencies]) || 0;
        return sum + (editedScores[key] !== undefined ? editedScores[key] : orig);
      }, 0) / COMP_V2_LABELS.length
    : 0;

  const persistCompetencyEdits = useCallback(async () => {
    if (!competencies) return;
    const updates: Record<string, unknown> = {
      ai_commentary: aiCommentary,
      strengths: editedStrengths,
      areas_to_improve: editedAreas,
      overall_score_v2: Math.round(liveOverall * 100) / 100,
    };
    Object.entries(editedScores).forEach(([k, v]) => { updates[k] = v; });
    try {
      await fetch("/api/docente/update-competencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId, updates }),
      });
    } catch {
      // Silencioso: el próximo cambio vuelve a intentar guardar.
    }
  }, [conversationId, competencies, aiCommentary, editedStrengths, editedAreas, editedScores, liveOverall]);

  useEffect(() => {
    if (!hasMounted.current) { hasMounted.current = true; return; }
    if (wasAlreadyApproved) return; // no se autoguarda sobre una evaluación ya cerrada
    setAutosaveStatus("saving");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      persistCompetencyEdits().then(() => setAutosaveStatus("saved"));
    }, 900);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedScores, aiCommentary, editedStrengths, editedAreas]);

  const handleScoreChange = (key: string, val: number) => {
    setEditedScores((prev) => ({ ...prev, [key]: val }));
    if (calibrationConfirmed) setScoresChangedSinceCalibration(true);
  };

  const buildCalibrationSummary = () => {
    if (!competencies) return "";
    return COMP_V2_LABELS.map(({ key, label }) => {
      const orig = Number(competencies[key as keyof Competencies]) || 0;
      const val = editedScores[key] !== undefined ? editedScores[key] : orig;
      const evList = getEvidenceList((competencies.evidence as Record<string, unknown> | undefined)?.[key]);
      const evText = evList.slice(0, 2).map((e) => `"${e.quote}"`).join(" / ");
      return `${label}: ${val.toFixed(1)}/4${evText ? " — evidencia: " + evText : ""}`;
    }).join("\n");
  };

  const confirmCalibration = async () => {
    setConfirmingCalibration(true);
    try {
      const res = await fetch("/api/docente/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "suggest_strengths_areas",
          conversation_id: conversationId,
          student_name: student.full_name,
          evaluation_summary: buildCalibrationSummary(),
        }),
      });
      if (!res.ok) throw new Error("Error al generar fortalezas y áreas");
      const data = await res.json();
      setEditedStrengths(data.strengths || []);
      setEditedAreas(data.areas_to_improve || []);
      setCalibrationConfirmed(true);
      setScoresChangedSinceCalibration(false);
    } catch {
      toast.error("No se pudieron generar fortalezas y áreas. Intenta de nuevo.");
    }
    setConfirmingCalibration(false);
  };

  const generateSupervisorComment = async () => {
    setGeneratingComment(true);
    try {
      const summaryText = competencies
        ? `Puntaje general: ${liveOverall.toFixed(1)}. Comentario IA: ${aiCommentary || "N/A"}. Fortalezas: ${editedStrengths.join(", ") || "N/A"}. Áreas: ${editedAreas.join(", ") || "N/A"}.`
        : "";
      const res = await fetch("/api/docente/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "suggest_comment",
          conversation_id: conversationId,
          student_name: student.full_name,
          evaluation_summary: summaryText,
          style: feedbackStyle,
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
    if (numScore != null && (numScore < 0 || numScore > 10)) {
      toast.error("La nota debe estar entre 0 y 10");
      return;
    }
    if (!comment.trim() && numScore == null) {
      toast.error("Escribe un comentario o asigna una nota antes de enviar");
      return;
    }

    setSaving(true);
    try {
      // Single call: saves comment + approves + notifies student
      const res = await fetch("/api/docente/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          teacher_comment: comment.trim() || null,
          teacher_score: numScore,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Error al enviar");
      setSaved(true);
      setIsApproved(true);
      toast.success("Retroalimentación enviada al estudiante");
      setFocusOpen(false);
      setTimeout(() => {
        window.location.href = "/docente/revisiones";
      }, 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar la retroalimentación");
    } finally {
      setSaving(false);
    }
  };

  // Save a draft (comment + score) without approving or notifying the student.
  const handleSaveDraft = async () => {
    const numScore = score ? parseFloat(score) : null;
    if (numScore != null && (numScore < 0 || numScore > 10)) {
      toast.error("La nota debe estar entre 0 y 10");
      return;
    }
    setSavingDraft(true);
    try {
      const res = await fetch("/api/docente/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          teacher_comment: comment.trim() || null,
          teacher_score: numScore,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Error al guardar el borrador");
      setSaved(true);
      toast.success("Borrador guardado. Podrás retomarlo cuando quieras.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el borrador");
    } finally {
      setSavingDraft(false);
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

  // Estado derivado del buscador (busca en toda la transcripción)
  const q = foldText(search.trim());
  const matchIds = q ? chatMessages.filter((m) => countMatches(m.content, q) > 0).map((m) => m.id) : [];
  const activeMatchId: string | null = matchIds[activeMatch] ?? null;
  const goToMatch = (dir: 1 | -1) => {
    if (matchIds.length === 0) return;
    const next = (activeMatch + dir + matchIds.length) % matchIds.length;
    setActiveMatch(next);
    msgRefs.current[matchIds[next]]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const patientSlug = patient.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
  const patientImgUrl = getPatientImageUrl(patientSlug);

  const hasReflection = !!feedback && (feedback.discomfort_moment || feedback.would_redo || feedback.clinical_note);

  // ── Accionables: estado vivido en el padre (no en el hijo) para que la
  // misma sección se muestre tanto en la columna Retroalimentación como en
  // Vista completa sin duplicar el fetch ni perder lo ya cargado. ──
  const actionItems = useActionItems({ conversationId, studentId: student.id, studentName: student.full_name, competencies, wasAlreadyApproved, onItemsChange: (count) => setActionItemsSent(count > 0) });

  // ── Bloques de contenido reutilizados en la vista dividida y en Vista completa ──

  const renderCompetencyRows = (alwaysShowEvidence: boolean) => (
    <>
      {["Estructura", "Actitudes"].map((domain) => (
        <div key={domain} className="mb-3">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{domain}</p>
          <div className="space-y-1.5">
            {COMP_V2_LABELS.filter((c) => c.domain === domain).map(({ key, label }) => {
              const origVal = Number(competencies?.[key as keyof Competencies]) || 0;
              const val = editedScores[key] !== undefined ? editedScores[key] : origVal;
              const isEdited = editedScores[key] !== undefined && editedScores[key] !== origVal;
              const row = (
                <div key={key} className="flex items-center gap-2">
                  <button
                    onClick={() => !alwaysShowEvidence && setSelectedEvidence(selectedEvidence === key ? null : key)}
                    className={`text-[10px] w-32 truncate text-left flex items-center gap-1 ${alwaysShowEvidence ? "cursor-default" : "cursor-pointer"} ${
                      !alwaysShowEvidence && selectedEvidence === key ? "text-sidebar font-bold" : "text-gray-500 hover:text-sidebar"
                    }`}
                  >
                    {label}
                    <CompetencyTooltip compKey={key} />
                  </button>
                  {!wasAlreadyApproved ? (
                    <input
                      type="range" min="0" max="4" step="0.5" value={val}
                      onChange={(e) => handleScoreChange(key, parseFloat(e.target.value))}
                      className="flex-1 h-1.5 accent-sidebar cursor-pointer"
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
              if (!alwaysShowEvidence) return row;
              // Vista completa: la definición y toda la evidencia quedan siempre visibles debajo.
              const evList = getEvidenceList((competencies?.evidence as Record<string, unknown> | undefined)?.[key]);
              return (
                <div key={key} className="pb-2 mb-2 border-b border-gray-100 last:border-none last:pb-0 last:mb-0">
                  {row}
                  <div className="mt-1.5 bg-sidebar/5 rounded-lg p-2.5 border border-sidebar/10 space-y-1.5">
                    {COMPETENCY_INFO[key] && (
                      <p className="text-[10px] text-gray-500 italic pb-1 border-b border-dashed border-sidebar/15">
                        Qué mide: {COMPETENCY_INFO[key].definition}
                      </p>
                    )}
                    {evList.length === 0 ? (
                      <p className="text-[11px] text-gray-400 italic">Sin evidencia registrada para esta competencia.</p>
                    ) : evList.map((ev, i) => (
                      <div key={i} className="border-l-2 pl-2" style={{ borderLeftColor: ev.polarity === "fortaleza" ? "#22c55e" : "#ef4444" }}>
                        <p className="text-[11px] text-gray-700 italic">&ldquo;{ev.quote}&rdquo;</p>
                        {ev.observation && <p className="text-[10px] text-gray-500 mt-0.5">{ev.observation}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );

  const renderStrengthsAreas = () => {
    if (!calibrationConfirmed) {
      return (
        <div className="bg-sidebar/5 border border-sidebar/15 rounded-lg p-3">
          <p className="text-[11px] text-gray-600 mb-2">
            Las fortalezas y áreas de mejora aparecen cuando confirmas la calibración de las notas de arriba.
          </p>
          <button
            onClick={confirmCalibration}
            disabled={confirmingCalibration || !competencies}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-sidebar hover:bg-[#3D4890] px-3 py-1.5 rounded-lg disabled:opacity-50 cursor-pointer"
          >
            {confirmingCalibration ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
            {confirmingCalibration ? "Generando..." : "Confirmar calibración"}
          </button>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {scoresChangedSinceCalibration && !wasAlreadyApproved && (
          <button onClick={confirmCalibration} disabled={confirmingCalibration}
            className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 hover:bg-amber-100 cursor-pointer disabled:opacity-50">
            {confirmingCalibration ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            Ajustaste notas después de calibrar — volver a calibrar
          </button>
        )}
        <div>
          <p className="text-[10px] font-medium text-green-700 mb-1">Fortalezas</p>
          {!wasAlreadyApproved ? (
            <div className="space-y-1">
              {editedStrengths.map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input value={s} onChange={(e) => { const u = [...editedStrengths]; u[i] = e.target.value; setEditedStrengths(u); }}
                    className="flex-1 text-[11px] border border-green-200 rounded px-2 py-1" />
                  <button onClick={() => setEditedStrengths(editedStrengths.filter((_, j) => j !== i))} className="text-red-400 text-[10px] cursor-pointer">x</button>
                </div>
              ))}
              <button onClick={() => setEditedStrengths([...editedStrengths, ""])} className="text-[10px] text-green-600 hover:underline cursor-pointer">+ Agregar</button>
            </div>
          ) : (
            editedStrengths.map((s, i) => <p key={i} className="text-[11px] text-green-600">+ {s}</p>)
          )}
        </div>
        <div>
          <p className="text-[10px] font-medium text-amber-700 mb-1">Áreas de mejora</p>
          {!wasAlreadyApproved ? (
            <div className="space-y-1">
              {editedAreas.map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input value={s} onChange={(e) => { const u = [...editedAreas]; u[i] = e.target.value; setEditedAreas(u); }}
                    className="flex-1 text-[11px] border border-amber-200 rounded px-2 py-1" />
                  <button onClick={() => setEditedAreas(editedAreas.filter((_, j) => j !== i))} className="text-red-400 text-[10px] cursor-pointer">x</button>
                </div>
              ))}
              <button onClick={() => setEditedAreas([...editedAreas, ""])} className="text-[10px] text-amber-600 hover:underline cursor-pointer">+ Agregar</button>
            </div>
          ) : (
            editedAreas.map((s, i) => <p key={i} className="text-[11px] text-amber-600">{s}</p>)
          )}
        </div>
      </div>
    );
  };

  const renderComposeForm = (compact: boolean) => (
    <div>
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Nota (0 - 10)</label>
        <input
          type="number" min="0" max="10" step="0.5" value={score}
          onChange={(e) => { setScore(e.target.value); setSaved(false); }}
          disabled={wasAlreadyApproved || (!actionItemsSent && !wasAlreadyApproved)}
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 ${wasAlreadyApproved || !actionItemsSent ? "bg-gray-50 text-gray-500" : ""}`}
        />
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-medium text-gray-700">Comentario de supervisión</label>
          {!wasAlreadyApproved && (
            <div className="flex items-center gap-2">
              <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                <button onClick={() => setFeedbackStyle("executive")}
                  className={`text-[9px] px-2 py-1 cursor-pointer ${feedbackStyle === "executive" ? "bg-purple-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                  Ejecutivo
                </button>
                <button onClick={() => setFeedbackStyle("descriptive")}
                  className={`text-[9px] px-2 py-1 cursor-pointer ${feedbackStyle === "descriptive" ? "bg-purple-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                  Descriptivo
                </button>
              </div>
              <button onClick={generateSupervisorComment} disabled={generatingComment}
                className="flex items-center gap-1 text-[11px] text-purple-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                {generatingComment ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {generatingComment ? "Generando..." : "Sugerir con IA"}
              </button>
            </div>
          )}
        </div>
        <textarea value={comment}
          onChange={(e) => { setComment(e.target.value); setSaved(false); }}
          disabled={wasAlreadyApproved || (!actionItemsSent && !wasAlreadyApproved)}
          rows={compact ? 8 : 16}
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-purple-400 ${wasAlreadyApproved || !actionItemsSent ? "bg-gray-50 text-gray-500" : ""}`}
          placeholder={"Puntos fuertes:\n1. \n2. \n\nOportunidades de mejora:\n1. \n2. \n\nCitas textuales relevantes:\n- \n\nAccionables para la próxima sesión:\n- "}
        />
      </div>

      {isApproved ? (
        <div className="p-4 rounded-xl border-2 bg-green-50 border-green-200">
          <div className="flex items-center gap-2 text-green-700 animate-fade-in">
            <CheckCircle size={18} />
            <span className="text-sm font-medium">Retroalimentación enviada y visible para el estudiante</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleSubmit} disabled={saving || savingDraft || (!comment.trim() && !score) || !actionItemsSent}
              className={`py-2 px-4 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 hover:shadow-md ${
                saving ? "bg-green-400 text-white cursor-wait"
                  : "bg-green-600 hover:bg-green-700 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              }`}>
              {saving ? "Enviando..." : (<><Send size={15} /> Enviar retroalimentación</>)}
            </button>
            <button onClick={handleSaveDraft} disabled={savingDraft || saving || (!comment.trim() && !score) || !actionItemsSent}
              className="py-2 px-4 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 transition-colors flex items-center justify-center gap-2 hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              {savingDraft ? (<><Loader2 size={14} className="animate-spin" /> Guardando...</>) : (<><Save size={14} /> Guardar borrador</>)}
            </button>
          </div>
          {!actionItemsSent && (
            <p className="text-[10px] text-amber-600 flex items-center gap-1"><Clock size={11} /> Primero completa los accionables para avanzar con el mensaje.</p>
          )}
          <p className="text-[10px] text-gray-400">El borrador queda guardado solo para ti. El estudiante no lo ve hasta que envíes la retroalimentación.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Header comprimido: nombre/sesión + paciente/mensajes/resumen en la misma fila */}
      <header className="px-4 sm:px-8 py-4 border-b border-gray-100">
        <div className="flex items-start gap-4">
          <Link
            href={`/docente/alumno/${student.id}`}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors mt-0.5"
          >
            <ArrowLeft size={18} className="text-gray-500" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-gray-900">{student.full_name}</h1>
              <span className="text-xs text-gray-400">Sesión #{sessionNumber} &middot; {date}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 min-w-0">
              <div className="w-5 h-5 rounded-full bg-sidebar flex items-center justify-center overflow-hidden flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={patientImgUrl} alt={patient.name} className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
              </div>
              <span className="text-xs text-gray-500 flex-shrink-0">{patient.name}, {patient.age} &middot; {patient.occupation}</span>
              <span className="text-[11px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                <MessageSquare size={11} /> {messageCount || chatMessages.length} mensajes
              </span>
              {mixedDistraction && (
                <span
                  className="text-[10px] font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0"
                  title="El alumno pegó texto de otra parte y también cambió de pestaña durante esta sesión."
                >
                  <AlertTriangle size={10} /> Posible distracción mixta
                </span>
              )}
            </div>
          </div>
          {!isApproved && (
            <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0">
              <Clock size={10} /> Por revisar
            </span>
          )}
          {isApproved && !isEvaluated && (
            <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0">
              <CheckCircle size={10} /> Retroalimentación enviada
            </span>
          )}
          {isEvaluated && (
            <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0">
              <CheckCircle size={10} /> Cerrada
            </span>
          )}
        </div>
      </header>

      <div className="px-4 sm:px-8 py-6">
        {/* Píldoras: qué módulos mostrar. Color propio (naranjo) y tamaño más
            grande para distinguirlas de los botones de acción, que usan el
            indigo de la marca. */}
        <div className="flex gap-2 mb-4">
          {MODULE_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => toggleModule(key)}
              className={`text-sm font-bold px-5 py-2.5 rounded-full border-2 transition-colors cursor-pointer ${
                activeModules[key] ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-500 border-gray-200 hover:border-orange-300"
              }`}
            >
              {MODULE_LABELS[key]}
            </button>
          ))}
        </div>

        <div
          className="grid gap-4 max-lg:!grid-cols-1"
          style={{ gridTemplateColumns: `repeat(${activeModuleCount}, 1fr)` }}
        >
          {/* ═══ Columna: Conversación ═══ */}
          {activeModules.chat && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden lg:sticky lg:top-6 lg:max-h-[72vh] flex flex-col min-h-0">
              <div className="bg-sidebar px-4 py-3 flex items-center justify-between gap-2 flex-shrink-0">
                <p className="text-sm font-semibold text-white">Conversación</p>
                <ConversationDocxButton conversationId={conversationId} variant="inverse" />
              </div>
              <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 max-w-[240px]">
                    <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar en la transcripción…"
                      className="pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-lg w-full focus:outline-none focus:ring-1 focus:ring-sidebar/40"
                    />
                  </div>
                  {search.trim() && (
                    <div className="flex items-center gap-1 text-[11px] text-gray-500 whitespace-nowrap">
                      <span>{matchIds.length === 0 ? "Sin coincidencias" : `${activeMatch + 1}/${matchIds.length}`}</span>
                      <button onClick={() => goToMatch(-1)} disabled={matchIds.length === 0} className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-30 cursor-pointer" title="Anterior">
                        <ChevronUp size={14} />
                      </button>
                      <button onClick={() => goToMatch(1)} disabled={matchIds.length === 0} className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-30 cursor-pointer" title="Siguiente">
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {summary && (
                <div className="mx-4 mt-3 bg-sidebar/5 border border-sidebar/10 rounded-lg px-3 py-2.5 flex-shrink-0">
                  <p className="text-[10px] font-bold text-sidebar uppercase tracking-wide mb-1">Resumen IA</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{summary}</p>
                </div>
              )}
              <div className="flex p-4 flex-1 min-h-0">
                <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
                  {chatMessages.map((msg) => {
                    const isStudent = msg.role === "user";
                    const isActive = msg.id === activeMatchId;
                    return (
                      <div key={msg.id} ref={(el) => { msgRefs.current[msg.id] = el; }} className={`flex ${isStudent ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                          isStudent ? "bg-sidebar text-white rounded-br-md" : "bg-gray-100 text-gray-800 rounded-bl-md"
                        } ${isActive ? "ring-2 ring-yellow-400" : ""}`}>
                          <p className={`text-[10px] font-medium mb-1 ${isStudent ? "text-white/60" : "text-gray-400"}`}>
                            {isStudent ? "Alumno" : patient.name}
                          </p>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{q ? highlightMatches(msg.content, q) : msg.content}</p>
                          <p className={`text-[9px] mt-1 ${isStudent ? "text-white/40" : "text-gray-300"}`}>
                            {(() => { const d = new Date(msg.created_at); return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`; })()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ═══ Columna: Reflexión ═══ */}
          {activeModules.reflect && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden lg:sticky lg:top-6 lg:max-h-[72vh] flex flex-col min-h-0">
              <div className="bg-sidebar px-4 py-3 flex items-center justify-between gap-2 flex-shrink-0">
                <p className="text-sm font-semibold text-white">Reflexión</p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3">
                <p className="text-[11px] text-gray-400">Se completa cuando el alumno cierra la sesión.</p>
                {!hasReflection && <p className="text-xs text-gray-400 italic">El alumno todavía no completó su autorreflexión.</p>}
                {feedback?.discomfort_moment && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 font-medium mb-1">Momento incómodo</p>
                    <p className="text-xs text-gray-700 leading-relaxed">{feedback.discomfort_moment}</p>
                  </div>
                )}
                {feedback?.would_redo && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 font-medium mb-1">Qué haría distinto</p>
                    <p className="text-xs text-gray-700 leading-relaxed">{feedback.would_redo}</p>
                  </div>
                )}
                {feedback?.clinical_note && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 font-medium mb-1">Nota clínica</p>
                    <p className="text-xs text-gray-700 leading-relaxed">{feedback.clinical_note}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ Columna: Retroalimentación ═══ */}
          {activeModules.feedback && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden lg:sticky lg:top-6 lg:max-h-[72vh] flex flex-col min-h-0">
              <div className="bg-sidebar px-4 py-3 flex items-center justify-between gap-2 flex-shrink-0">
                <p className="text-sm font-semibold text-white">Retroalimentación</p>
                <button onClick={() => setFocusOpen(true)}
                  className="text-xs font-semibold text-sidebar bg-white hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex-shrink-0">
                  Vista completa
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-1">
                <p className="text-[11px] text-gray-400 mb-3">Abre o cierra cada sección, o usa Vista completa.</p>
                {competencies ? (
                  <>
                    {/* Sección: Competencias */}
                    <button onClick={() => setCompOpen((v) => !v)} className="w-full flex items-center gap-2 py-1.5 cursor-pointer">
                      <Brain size={15} className="text-sidebar flex-shrink-0" />
                      <h4 className="text-[13px] font-semibold text-gray-900">Competencias</h4>
                      <span className="ml-auto text-base font-bold text-sidebar">
                        {liveOverall.toFixed(1)}<span className="text-[10px] font-normal text-gray-400 ml-0.5">/4</span>
                      </span>
                      <ChevronRight size={15} className={`text-gray-400 transition-transform flex-shrink-0 ${compOpen ? "rotate-90" : ""}`} />
                    </button>
                    {compOpen && (
                      <div className="pb-3 pt-1">
                        <p className="text-[10px] text-gray-400 mb-2">Haz clic en una competencia para ver su definición y evidencia.</p>
                        {renderCompetencyRows(false)}

                        {selectedEvidence && competencies.evidence && (
                          <div className="mb-3 bg-sidebar/5 rounded-lg p-3 border border-sidebar/10">
                            <p className="text-[10px] font-bold text-sidebar uppercase mb-1">Evidencia — {COMP_V2_LABELS.find((c) => c.key === selectedEvidence)?.label}</p>
                            {COMPETENCY_INFO[selectedEvidence] && (
                              <p className="text-[10px] text-gray-500 italic mb-1.5 pb-1.5 border-b border-dashed border-sidebar/15">
                                Qué mide: {COMPETENCY_INFO[selectedEvidence].definition}
                              </p>
                            )}
                            {(() => {
                              const evList = getEvidenceList((competencies.evidence as Record<string, unknown>)[selectedEvidence]);
                              if (evList.length === 0) return <p className="text-[11px] text-gray-400 italic">Sin evidencia registrada para esta competencia.</p>;
                              return (
                                <div className="space-y-2">
                                  {evList.map((ev, i) => (
                                    <div key={i} className="border-l-2 pl-2" style={{ borderLeftColor: ev.polarity === "fortaleza" ? "#22c55e" : "#ef4444" }}>
                                      <p className="text-xs text-gray-700 italic mb-1">&ldquo;{ev.quote}&rdquo;</p>
                                      {ev.observation && <p className="text-[11px] text-gray-500">{ev.observation}</p>}
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        <div className="mb-3">
                          <p className="text-[10px] font-medium text-gray-500 mb-1">Comentario IA</p>
                          {!wasAlreadyApproved ? (
                            <textarea value={aiCommentary} onChange={(e) => setAiCommentary(e.target.value)}
                              rows={4} className="w-full border border-sidebar/30 rounded-lg px-3 py-2 text-xs resize-y focus:outline-none focus:ring-2 focus:ring-sidebar/20" />
                          ) : (
                            <p className="text-xs text-gray-600 leading-relaxed bg-blue-50 rounded-lg px-3 py-2">{aiCommentary || "Sin comentario"}</p>
                          )}
                        </div>

                        {renderStrengthsAreas()}
                      </div>
                    )}

                    <div className="border-t border-gray-100" />

                    {/* Sección: Accionables */}
                    <button onClick={() => setActionablesOpen((v) => !v)} className="w-full flex items-center gap-2 py-1.5 cursor-pointer">
                      <CheckCircle size={15} className="text-emerald-500 flex-shrink-0" />
                      <h4 className="text-[13px] font-semibold text-gray-900">Accionables</h4>
                      <ChevronRight size={15} className={`text-gray-400 transition-transform ml-auto flex-shrink-0 ${actionablesOpen ? "rotate-90" : ""}`} />
                    </button>
                    {actionablesOpen && <div className="pb-2 pt-1"><ActionItemsBody state={actionItems} /></div>}
                  </>
                ) : (
                  <div className="text-center py-4">
                    <Brain size={24} className="mx-auto text-amber-400 mb-2" />
                    <p className="text-sm font-medium text-gray-700 mb-1">Evaluación de competencias no disponible</p>
                    <p className="text-xs text-gray-400 mb-3">La evaluación IA no se generó al completar la sesión.</p>
                    <button
                      onClick={async () => {
                        setRegeneratingEval(true);
                        try {
                          const res = await fetch(`/api/sessions/${conversationId}/evaluate`, { method: "POST" });
                          if (res.ok) { toast.success("Evaluación generada. Recargando..."); setTimeout(() => window.location.reload(), 1000); }
                          else toast.error("Error al generar la evaluación.");
                        } catch { toast.error("Error de conexión."); }
                        setRegeneratingEval(false);
                      }}
                      disabled={regeneratingEval}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-sidebar text-white text-sm font-medium rounded-lg hover:bg-[#354080] disabled:opacity-50 cursor-pointer"
                    >
                      {regeneratingEval ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
                      {regeneratingEval ? "Generando..." : "Generar análisis de competencias"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ═══ Mensaje al estudiante: fuera de las columnas fijas, en el scroll de la página ═══ */}
        <div className={`mt-4 bg-white rounded-xl border p-5 ${!actionItemsSent && !wasAlreadyApproved ? "border-gray-200 opacity-60" : "border-purple-200"}`}>
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap size={16} className={actionItemsSent || wasAlreadyApproved ? "text-purple-600" : "text-gray-400"} />
            <h3 className="text-sm font-semibold text-gray-900">Mensaje al estudiante</h3>
            {saved && <CheckCircle size={14} className="text-green-500" />}
          </div>
          {renderComposeForm(true)}
        </div>
      </div>

      {/* ═══ Vista completa ═══ */}
      {focusOpen && (
        <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
          <div className="flex items-center gap-4 bg-gray-900 text-white px-5 py-3 flex-shrink-0">
            <button onClick={() => setFocusOpen(false)} className="flex items-center gap-1.5 text-gray-300 hover:text-white text-sm cursor-pointer">
              <X size={16} /> Cerrar y volver
            </button>
            <span className="ml-auto text-[11px] text-gray-400 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${autosaveStatus === "saving" ? "bg-amber-400" : "bg-green-400"}`} />
              {autosaveStatus === "saving" ? "Guardando…" : "Guardado"}
            </span>
            {!wasAlreadyApproved && (
              <button onClick={handleSubmit} disabled={saving || !comment.trim() && !score || !actionItemsSent}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer">
                <Send size={13} /> Enviar retroalimentación
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-6">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5 items-start">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Brain size={16} className="text-sidebar" />
                  <h3 className="text-sm font-semibold text-gray-900">Competencias — calibración</h3>
                  <span className="ml-auto text-lg font-bold text-sidebar">{liveOverall.toFixed(1)}<span className="text-[10px] font-normal text-gray-400 ml-0.5">/4</span></span>
                </div>
                <p className="text-[11px] text-gray-400 mb-3">Ajusta cada nota si corresponde. La definición y toda la evidencia quedan siempre a la vista.</p>
                {competencies && renderCompetencyRows(true)}
                <div className="mt-3 mb-3">
                  <p className="text-[10px] font-medium text-gray-500 mb-1">Comentario IA</p>
                  {!wasAlreadyApproved ? (
                    <textarea value={aiCommentary} onChange={(e) => setAiCommentary(e.target.value)}
                      rows={4} className="w-full border border-sidebar/30 rounded-lg px-3 py-2 text-xs resize-y focus:outline-none focus:ring-2 focus:ring-sidebar/20" />
                  ) : (
                    <p className="text-xs text-gray-600 leading-relaxed bg-blue-50 rounded-lg px-3 py-2">{aiCommentary || "Sin comentario"}</p>
                  )}
                </div>
                {renderStrengthsAreas()}
              </div>
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Accionables</h3>
                  <ActionItemsBody state={actionItems} />
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Redactar el correo</h3>
                  {renderComposeForm(false)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Accionables: estado en un hook (no en un componente propio) para que la
// misma sección se pueda pintar en la columna Retroalimentación Y en Vista
// completa sin duplicar el fetch ni perder lo cargado al cambiar de vista.
// ═══════════════════════════════════════════════════════════
function useActionItems({ conversationId, studentId, studentName, competencies, wasAlreadyApproved, onItemsChange }: {
  conversationId: string; studentId: string; studentName: string; competencies: Competencies | null; wasAlreadyApproved: boolean; onItemsChange?: (count: number) => void;
}) {
  const [items, setItems] = useState<{ id: string; content: string; status: string; resource_link: string | null; student_comment: string | null }[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [prevItems, setPrevItems] = useState<{ content: string; status: string; created_at: string }[]>([]);
  const [manualItems, setManualItems] = useState<string[]>(["", "", ""]);
  const [showPrev, setShowPrev] = useState(false);
  const [selectedDims, setSelectedDims] = useState<string[]>(() => {
    if (!competencies) return [];
    return COMP_V2_LABELS
      .map((c) => ({ key: c.key, val: Number(competencies[c.key as keyof Competencies]) }))
      .filter((c) => Number.isFinite(c.val))
      .sort((a, b) => a.val - b.val)
      .slice(0, 2)
      .map((c) => c.key);
  });
  const toggleDim = (key: string) =>
    setSelectedDims((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  useEffect(() => {
    fetch("/api/docente/action-items?conversation_id=" + conversationId)
      .then((r) => r.json())
      .then((data) => { setItems(data); setLoaded(true); onItemsChange?.(data.length); });
    fetch("/api/docente/action-items?student_id=" + studentId)
      .then((r) => r.json())
      .then((data) => { setPrevItems(data.filter((d: { conversation_id: string }) => d.conversation_id !== conversationId)); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, studentId]);

  const generateSuggestions = async () => {
    setGenerating(true);
    try {
      const evalSummary = competencies
        ? "Puntaje general: " + Number(competencies.overall_score_v2 || competencies.overall_score).toFixed(1) + "/4. " +
          "Fortalezas: " + (competencies.strengths || []).join(", ") + ". " +
          "Áreas de mejora: " + (competencies.areas_to_improve || []).join(", ") + ". " +
          "Comentario IA: " + (competencies.ai_commentary || "")
        : "Sin evaluación disponible.";

      const res = await fetch("/api/docente/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suggest", conversation_id: conversationId, student_name: studentName, evaluation_summary: evalSummary, dimensions: selectedDims }),
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
      const allItems = [
        ...suggestions.map((s) => ({ content: s })),
        ...manualItems.filter((m) => m.trim()).map((m) => ({ content: m.trim() })),
      ];
      const res = await fetch("/api/docente/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId, student_id: studentId, items: allItems }),
      });
      if (!res.ok) throw new Error("Error al guardar accionables");
      toast.success("Accionables guardados");
      setSuggestions([]);
      setManualItems(["", "", ""]);
      const r = await fetch("/api/docente/action-items?conversation_id=" + conversationId);
      if (r.ok) {
        const updated = await r.json();
        setItems(updated);
        onItemsChange?.(updated.length);
      }
    } catch {
      toast.error("Error al enviar los accionables. Intenta de nuevo.");
    }
    setSaving(false);
  };

  const removeSuggestion = (idx: number) => setSuggestions((prev) => prev.filter((_, i) => i !== idx));

  return {
    items, suggestions, generating, saving, loaded, prevItems, manualItems, setManualItems, showPrev, setShowPrev,
    selectedDims, toggleDim, generateSuggestions, saveItems, removeSuggestion, locked: wasAlreadyApproved,
  };
}
type ActionItemsState = ReturnType<typeof useActionItems>;

function ActionItemsBody({ state }: { state: ActionItemsState }) {
  const { items, suggestions, generating, saving, loaded, prevItems, manualItems, setManualItems, showPrev, setShowPrev, selectedDims, toggleDim, generateSuggestions, saveItems, removeSuggestion, locked } = state;

  if (!loaded) return null;

  return (
    <div>
      {!locked && items.length === 0 && suggestions.length === 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-gray-500 font-medium mb-1.5">Enfocar accionables en:</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {COMP_V2_LABELS.map(({ key, label }) => (
              <button key={key} type="button" onClick={() => toggleDim(key)}
                className={`text-[10px] px-2 py-1 rounded-full border transition-colors cursor-pointer ${
                  selectedDims.includes(key) ? "bg-sidebar text-white border-sidebar" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={generateSuggestions} disabled={generating}
            className="text-[10px] text-sidebar font-medium hover:underline flex items-center gap-1 cursor-pointer">
            {generating ? "Generando..." : "Sugerir con IA"}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2 mb-3">
          {items.map((item) => (
            <div key={item.id} className={`text-xs px-3 py-2 rounded-lg border ${
              item.status === "accepted" ? "bg-green-50 border-green-200" :
              item.status === "rejected" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
            }`}>
              <p className="text-gray-800">{item.content}</p>
              <p className={`text-[10px] mt-1 font-medium ${
                item.status === "accepted" ? "text-green-600" : item.status === "rejected" ? "text-red-600" : "text-amber-600"
              }`}>
                {item.status === "accepted" ? "✓ Aceptado por estudiante" : item.status === "rejected" ? "✗ No aceptado" : "⏳ Pendiente de validación"}
              </p>
              {item.student_comment && <p className="text-[10px] text-gray-500 mt-0.5">&quot;{item.student_comment}&quot;</p>}
            </div>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-[10px] text-gray-500 font-medium">Sugerencias de la IA (edita o elimina antes de enviar):</p>
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs bg-sidebar/5 px-3 py-2 rounded-lg border border-sidebar/10">
              <p className="flex-1 text-gray-800">{s}</p>
              <button onClick={() => removeSuggestion(i)} className="text-gray-400 hover:text-red-500 text-[10px] cursor-pointer">✕</button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <button onClick={saveItems} disabled={saving}
              className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 cursor-pointer">
              {saving ? "Enviando..." : "Guardar accionables"}
            </button>
            <button onClick={generateSuggestions} disabled={generating} className="text-[10px] text-sidebar hover:underline cursor-pointer">Regenerar</button>
          </div>
        </div>
      )}

      {!locked && items.length === 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-[10px] text-gray-500 font-medium">Accionables manuales:</p>
          {manualItems.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400 w-4 text-right">{i + 1}.</span>
              <input value={item} onChange={(e) => setManualItems((prev) => { const u = [...prev]; u[i] = e.target.value; return u; })}
                placeholder="Escribe un accionable..." className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sidebar/30" />
              {i >= 3 && (
                <button onClick={() => setManualItems((prev) => prev.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400 text-xs cursor-pointer">x</button>
              )}
            </div>
          ))}
          <button onClick={() => setManualItems((prev) => [...prev, ""])} className="text-[10px] text-sidebar hover:underline cursor-pointer">+ Agregar otro</button>
          {(manualItems.some((m) => m.trim()) || suggestions.length > 0) && (
            <button onClick={saveItems} disabled={saving}
              className="w-full text-xs bg-emerald-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 cursor-pointer mt-1">
              {saving ? "Enviando..." : "Guardar accionables"}
            </button>
          )}
        </div>
      )}

      {prevItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <button onClick={() => setShowPrev(!showPrev)} className="text-[10px] text-gray-500 hover:text-sidebar cursor-pointer">
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
