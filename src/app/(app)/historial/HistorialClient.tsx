"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ChevronDown, ChevronRight, ChevronLeft, ArrowRight, MessageSquare,
  BookOpen, GraduationCap, Brain, Clock, CheckCircle, XCircle, ListChecks,
  ExternalLink,
} from "lucide-react";

interface Session {
  id: string;
  ai_patient_id: string;
  session_number: number;
  status: string;
  created_at: string;
  ai_patients: unknown;
  session_competencies: unknown;
  session_feedback: unknown;
}

interface ActionItem {
  id: string;
  conversation_id: string;
  content: string;
  resource_link: string | null;
  status: "pending" | "accepted" | "rejected";
  student_comment: string | null;
  created_at: string;
  responded_at: string | null;
  profiles: { full_name: string }[] | { full_name: string } | null;
}

const DAYS_ES = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function HistorialClient({ sessions, actionItems }: { sessions: Session[]; actionItems: ActionItem[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [items, setItems] = useState<ActionItem[]>(actionItems);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  // Group action items by conversation
  const itemsByConversation = useMemo(() => {
    const map: Record<string, ActionItem[]> = {};
    for (const item of items) {
      if (!map[item.conversation_id]) map[item.conversation_id] = [];
      map[item.conversation_id].push(item);
    }
    return map;
  }, [items]);

  const handleRespond = useCallback(async (itemId: string, status: "accepted" | "rejected") => {
    setRespondingId(itemId);
    try {
      const res = await fetch("/api/action-items/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemId, status, comment: commentText || undefined }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === itemId
              ? { ...i, status, student_comment: commentText || null, responded_at: new Date().toISOString() }
              : i
          )
        );
        setCommentText("");
      }
    } finally {
      setRespondingId(null);
    }
  }, [commentText]);

  // Calendar state
  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());

  // Map of date strings to session count
  const sessionDates = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sessions) {
      const d = new Date(s.created_at).toLocaleDateString("en-CA"); // YYYY-MM-DD
      map[d] = (map[d] || 0) + 1;
    }
    return map;
  }, [sessions]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    let startDow = firstDay.getDay() - 1; // Mon=0
    if (startDow < 0) startDow = 6;

    const days: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
    return days;
  }, [calMonth, calYear]);

  // Filtered sessions
  const filteredSessions = selectedDate
    ? sessions.filter((s) => new Date(s.created_at).toLocaleDateString("en-CA") === selectedDate)
    : sessions;

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  };

  const todayStr = now.toLocaleDateString("en-CA");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      {/* Calendar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 h-fit lg:sticky lg:top-4">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded">
            <ChevronLeft size={16} className="text-gray-500" />
          </button>
          <p className="text-sm font-semibold text-gray-900">
            {MONTHS_ES[calMonth]} {calYear}
          </p>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded">
            <ChevronRight size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {DAYS_ES.map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {calendarDays.map((day, i) => {
            if (day === null) return <div key={i} />;
            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const count = sessionDates[dateStr] || 0;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;

            return (
              <button
                key={i}
                onClick={() => {
                  if (count > 0) setSelectedDate(isSelected ? null : dateStr);
                }}
                className={`relative flex flex-col items-center justify-center py-1.5 rounded text-xs transition-colors ${
                  isSelected
                    ? "bg-sidebar text-white"
                    : isToday
                    ? "bg-blue-50 text-sidebar font-bold"
                    : count > 0
                    ? "hover:bg-gray-100 text-gray-900 cursor-pointer font-medium"
                    : "text-gray-400"
                }`}
              >
                {day}
                {count > 0 && !isSelected && (
                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-sidebar" />
                )}
                {count > 0 && isSelected && (
                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-white" />
                )}
              </button>
            );
          })}
        </div>

        {/* Filter indicator */}
        {selectedDate && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("es-CL", {
                weekday: "long", day: "numeric", month: "long",
              })}
            </p>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-xs text-sidebar hover:underline"
            >
              Ver todo
            </button>
          </div>
        )}
      </div>

      {/* Session list */}
      <div>
        {filteredSessions.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">
              {selectedDate ? "Sin sesiones este día" : "Sin sesiones aún"}
            </p>
            {!selectedDate && (
              <>
                <p className="text-gray-400 text-sm mt-1">Inicia una conversación con un paciente.</p>
                <Link href="/pacientes" className="inline-block mt-4 bg-sidebar hover:bg-[#354080] text-white py-2 px-6 rounded-lg text-sm font-medium transition-colors">
                  Ver pacientes
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredSessions.map((session) => {
              const patient = session.ai_patients as { name: string; age: number; occupation: string } | null;
              type Comp = { empathy: number; active_listening: number; open_questions: number; reformulation: number; confrontation: number; silence_management: number; rapport: number; overall_score: number; ai_commentary?: string; strengths?: string[]; areas_to_improve?: string[]; feedback_status?: string };
              type Fb = { discomfort_moment?: string; would_redo?: string; clinical_note?: string; teacher_comment?: string; teacher_score?: number };
              const rawComp: Comp | null = ((session.session_competencies as Comp[] | null)?.[0]) ?? null;
              const isApproved = rawComp?.feedback_status === "approved";
              const comp = isApproved ? rawComp : null; // Only show if approved
              const feedback: Fb | null = ((session.session_feedback as Fb[] | null)?.[0]) ?? null;
              const score = isApproved && rawComp?.overall_score != null ? Number(rawComp.overall_score) : null;
              const isCompleted = session.status === "completed";
              const isExpanded = expandedId === session.id;
              const isPending = isCompleted && rawComp && !isApproved;
              const hasActionItems = (itemsByConversation[session.id]?.length || 0) > 0;
              const hasDetail = isCompleted && (comp !== null || feedback !== null || isPending || hasActionItems);

              const initials = patient?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2) || "?";
              const date = new Date(session.created_at).toLocaleDateString("es-CL", {
                day: "numeric", month: "short",
              });
              const time = new Date(session.created_at).toLocaleTimeString("es-CL", {
                hour: "2-digit", minute: "2-digit",
              });

              return (
                <div key={session.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  {/* Row */}
                  <div
                    className={`flex items-center gap-3 px-4 py-3 ${hasDetail ? "cursor-pointer hover:bg-gray-50" : ""}`}
                    onClick={() => hasDetail && setExpandedId(isExpanded ? null : session.id)}
                  >
                    <div className="w-4 flex-shrink-0">
                      {hasDetail && (
                        isExpanded
                          ? <ChevronDown size={14} className="text-gray-400" />
                          : <ChevronRight size={14} className="text-gray-400" />
                      )}
                    </div>

                    <div className="w-8 h-8 rounded-full bg-sidebar flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">{initials}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {patient?.name} <span className="text-gray-400 font-normal">#{session.session_number}</span>
                      </p>
                      <p className="text-[11px] text-gray-400">{date} &middot; {time}</p>
                    </div>

                    {score != null && (
                      <div className="text-center px-2">
                        <p className="text-sm font-bold text-sidebar">{score.toFixed(1)}</p>
                      </div>
                    )}

                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${
                      !isCompleted
                        ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                        : isApproved
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}>
                      {!isCompleted
                        ? "En curso"
                        : isApproved
                        ? "Evaluada"
                        : "Pendiente revisión"}
                    </span>

                    <Link
                      href={isCompleted ? `/review/${session.id}` : `/chat/${session.ai_patient_id}?conversationId=${session.id}`}
                      className="text-gray-400 hover:text-sidebar transition-colors flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ArrowRight size={16} />
                    </Link>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && hasDetail ? (
                    <div className="border-t border-gray-100 animate-fade-in">
                      {/* Pending approval notice */}
                      {isPending && (
                        <div className="px-4 py-4 border-b border-gray-100 bg-amber-50">
                          <div className="flex items-center gap-2 text-amber-700">
                            <Clock size={14} />
                            <span className="text-xs font-medium">Retroalimentación pendiente de aprobación docente</span>
                          </div>
                          <p className="text-[11px] text-amber-600 mt-1">
                            Recibirás una notificación cuando tu docente haya revisado y aprobado tus resultados.
                          </p>
                        </div>
                      )}
                      {/* AI Evaluation (only shown if approved) */}
                      {comp != null ? (
                        <div className="px-4 py-3 border-b border-gray-100">
                          <div className="flex items-center gap-2 mb-2">
                            <Brain size={14} className="text-sidebar" />
                            <p className="text-[11px] font-semibold text-sidebar uppercase tracking-wide">
                              Evaluación IA
                            </p>
                          </div>

                          {/* Score bars */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
                            {[
                              ["Empatía", comp.empathy],
                              ["Escucha activa", comp.active_listening],
                              ["Preguntas abiertas", comp.open_questions],
                              ["Reformulación", comp.reformulation],
                              ["Confrontación", comp.confrontation],
                              ["Silencios", comp.silence_management],
                              ["Rapport", comp.rapport],
                            ].map(([label, val]) => (
                              <div key={String(label)} className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 w-24 truncate">{String(label)}</span>
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-sidebar rounded-full"
                                    style={{ width: `${(Number(val) / 10) * 100}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-medium text-gray-700 w-6 text-right">
                                  {Number(val).toFixed(1)}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Commentary */}
                          {comp.ai_commentary && (
                            <p className="text-xs text-gray-600 leading-relaxed bg-blue-50 rounded-lg px-3 py-2">
                              {String(comp.ai_commentary)}
                            </p>
                          )}

                          {/* Strengths & Areas */}
                          <div className="grid grid-cols-2 gap-3 mt-2">
                            {(comp.strengths)?.length ? (
                              <div>
                                <p className="text-[10px] font-medium text-green-700 mb-1">Fortalezas</p>
                                {(comp.strengths!).map((s, i) => (
                                  <p key={i} className="text-[11px] text-green-600">+ {s}</p>
                                ))}
                              </div>
                            ) : null}
                            {(comp.areas_to_improve)?.length ? (
                              <div>
                                <p className="text-[10px] font-medium text-amber-700 mb-1">Áreas de mejora</p>
                                {(comp.areas_to_improve!).map((s, i) => (
                                  <p key={i} className="text-[11px] text-amber-600">→ {s}</p>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {/* Student reflection */}
                      {feedback && (feedback.discomfort_moment || feedback.would_redo || feedback.clinical_note) && (
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                          <div className="flex items-center gap-2 mb-2">
                            <BookOpen size={14} className="text-gray-500" />
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                              Mi autorreflexión
                            </p>
                          </div>
                          <div className="space-y-2">
                            {feedback.discomfort_moment && (
                              <div>
                                <p className="text-[10px] text-gray-400 font-medium">Momento de incomodidad</p>
                                <p className="text-xs text-gray-700">{String(feedback.discomfort_moment)}</p>
                              </div>
                            )}
                            {feedback.would_redo && (
                              <div>
                                <p className="text-[10px] text-gray-400 font-medium">Qué haría diferente</p>
                                <p className="text-xs text-gray-700">{String(feedback.would_redo)}</p>
                              </div>
                            )}
                            {feedback.clinical_note && (
                              <div>
                                <p className="text-[10px] text-gray-400 font-medium">Nota clínica</p>
                                <p className="text-xs text-gray-700">{String(feedback.clinical_note)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Teacher evaluation */}
                      {feedback && (feedback.teacher_comment || feedback.teacher_score != null) ? (
                        <div className="px-4 py-3 bg-purple-50/50">
                          <div className="flex items-center gap-2 mb-2">
                            <GraduationCap size={14} className="text-purple-600" />
                            <p className="text-[11px] font-semibold text-purple-600 uppercase tracking-wide">
                              Evaluación del docente
                            </p>
                          </div>
                          <div className="space-y-2">
                            {feedback.teacher_score != null && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-purple-700 font-medium">Nota:</span>
                                <span className="text-sm font-bold text-purple-800">
                                  {Number(feedback.teacher_score).toFixed(1)}/10
                                </span>
                              </div>
                            )}
                            {feedback.teacher_comment && (
                              <p className="text-xs text-purple-800 leading-relaxed bg-purple-100/50 rounded-lg px-3 py-2">
                                {String(feedback.teacher_comment)}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : isCompleted ? (
                        <div className="px-4 py-3 bg-gray-50/30">
                          <div className="flex items-center gap-2">
                            <GraduationCap size={14} className="text-gray-300" />
                            <p className="text-[11px] text-gray-400">
                              Sin evaluación del docente aún
                            </p>
                          </div>
                        </div>
                      ) : null}

                      {/* Action Items / Accionables */}
                      {(() => {
                        const sessionItems = itemsByConversation[session.id];
                        if (!sessionItems || sessionItems.length === 0) return null;
                        const prof = sessionItems[0]?.profiles;
                        const teacherName = (Array.isArray(prof) ? prof[0]?.full_name : prof?.full_name) || "Docente";
                        return (
                          <div className="px-4 py-3 border-t border-gray-100 bg-indigo-50/30">
                            <div className="flex items-center gap-2 mb-3">
                              <ListChecks size={14} className="text-indigo-600" />
                              <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide">
                                Acuerdos con {teacherName}
                              </p>
                            </div>
                            <div className="space-y-2">
                              {sessionItems.map((item) => (
                                <div
                                  key={item.id}
                                  className={`rounded-lg border px-3 py-2.5 ${
                                    item.status === "accepted"
                                      ? "bg-green-50 border-green-200"
                                      : item.status === "rejected"
                                      ? "bg-red-50 border-red-200"
                                      : "bg-white border-gray-200"
                                  }`}
                                >
                                  <p className="text-xs text-gray-800 leading-relaxed">{item.content}</p>

                                  {item.resource_link && (
                                    <a
                                      href={item.resource_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:underline mt-1"
                                    >
                                      <ExternalLink size={10} /> Recurso sugerido
                                    </a>
                                  )}

                                  {item.status === "pending" ? (
                                    <div className="mt-2">
                                      <textarea
                                        placeholder="Comentario opcional..."
                                        value={respondingId === item.id ? commentText : ""}
                                        onChange={(e) => {
                                          setRespondingId(item.id);
                                          setCommentText(e.target.value);
                                        }}
                                        onFocus={() => setRespondingId(item.id)}
                                        className="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300 mb-2"
                                        rows={2}
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleRespond(item.id, "accepted")}
                                          disabled={respondingId === item.id && respondingId !== item.id}
                                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[11px] font-medium rounded-md transition-colors disabled:opacity-50"
                                        >
                                          <CheckCircle size={12} /> Aceptar
                                        </button>
                                        <button
                                          onClick={() => handleRespond(item.id, "rejected")}
                                          disabled={respondingId === item.id && respondingId !== item.id}
                                          className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-[11px] font-medium rounded-md transition-colors disabled:opacity-50"
                                        >
                                          <XCircle size={12} /> Rechazar
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="mt-1.5 flex items-center gap-2">
                                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                                        item.status === "accepted" ? "text-green-700" : "text-red-600"
                                      }`}>
                                        {item.status === "accepted" ? (
                                          <><CheckCircle size={10} /> Aceptado</>
                                        ) : (
                                          <><XCircle size={10} /> Rechazado</>
                                        )}
                                      </span>
                                      {item.student_comment && (
                                        <span className="text-[10px] text-gray-500 italic">
                                          &mdash; {item.student_comment}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
