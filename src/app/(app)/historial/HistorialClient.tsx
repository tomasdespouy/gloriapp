"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, ChevronRight, Brain, Clock, CheckCircle2,
  MessageSquare, List, LayoutGrid, TrendingUp, Save, ArrowLeft,
  GraduationCap, Sparkles, Download, Radio,
} from "lucide-react";

interface Session {
  id: string;
  ai_patient_id: string;
  session_number: number;
  status: string;
  created_at: string;
  ended_at: string | null;
  active_seconds: number | null;
  student_notes_v2: string | null;
  ai_patients: unknown;
  session_competencies: unknown;
  session_feedback: unknown;
}

type Comp = { overall_score_v2: number; eval_version: number; ai_commentary: string; strengths: string[]; areas_to_improve: string[]; feedback_status: string } & Record<string, number>;
type Fb = { teacher_comment: string | null; teacher_score: number | null };
type Patient = { name: string; age: number; occupation: string; difficulty_level: string; country: string };
type Msg = { role: string; content: string; created_at: string };

interface ObservationSession {
  id: string;
  title: string;
  status: string;
  total_duration_seconds: number;
  semantic_analysis: Record<string, unknown> | null;
  created_at: string;
  ended_at: string | null;
}

interface Props {
  sessions: Session[];
  summaryMap: Record<string, { summary: string; revelations: string[] }>;
  observations?: ObservationSession[];
}

export default function HistorialClient({ sessions, summaryMap, observations = [] }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "active" | "observations">("all");
  const [filterPatient, setFilterPatient] = useState<string>("all");
  const [view, setView] = useState<"list" | "grouped">("list");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<string | null>(null);
  const [showResumeModal, setShowResumeModal] = useState<Session | null>(null);
  const [messagesMap, setMessagesMap] = useState<Record<string, Msg[]>>({});
  const [loadingMessages, setLoadingMessages] = useState<string | null>(null);

  const loadMessages = async (conversationId: string) => {
    if (messagesMap[conversationId]) return; // already loaded
    setLoadingMessages(conversationId);
    try {
      const res = await fetch(`/api/sessions/${conversationId}/messages`);
      if (res.ok) {
        const msgs: Msg[] = await res.json();
        setMessagesMap(prev => ({ ...prev, [conversationId]: msgs }));
      }
    } finally {
      setLoadingMessages(null);
    }
  };

  const patients = useMemo(() => {
    const map = new Map<string, string>();
    sessions.forEach(s => { const p = s.ai_patients as Patient | null; if (p) map.set(s.ai_patient_id, p.name); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [sessions]);

  const filtered = useMemo(() => {
    if (filterStatus === "observations") return [];
    return sessions.filter(s => {
      const p = s.ai_patients as Patient | null;
      if (search && !(p?.name || "").toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus === "completed" && s.status !== "completed") return false;
      if (filterStatus === "active" && s.status !== "active" && s.status !== "abandoned") return false;
      if (filterPatient !== "all" && s.ai_patient_id !== filterPatient) return false;
      return true;
    });
  }, [sessions, search, filterStatus, filterPatient]);

  const filteredObservations = useMemo(() => {
    if (filterStatus !== "all" && filterStatus !== "observations") return [];
    return observations.filter(o => {
      if (search && !o.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [observations, search, filterStatus]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    filtered.forEach(s => {
      const d = new Date(s.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return Array.from(map.entries());
  }, [filtered]);

  // Group by patient
  const groupedByPatient = useMemo(() => {
    const map = new Map<string, Session[]>();
    filtered.forEach(s => {
      if (!map.has(s.ai_patient_id)) map.set(s.ai_patient_id, []);
      map.get(s.ai_patient_id)!.push(s);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const formatDateLabel = (key: string) => {
    const d = new Date(key + "T12:00:00");
    const today = new Date();
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    if (d.toDateString() === today.toDateString()) return "Hoy";
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Ayer";
    return `${d.getDate()} de ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const formatDuration = (sec: number | null) => {
    if (!sec) return null;
    return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")} min`;
  };

  const saveNote = async (sessionId: string) => {
    setSavingNotes(sessionId);
    await fetch(`/api/sessions/${sessionId}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes[sessionId] || "" }),
    });
    setSavingNotes(null);
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const getSlug = (name: string) => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");

  const handleSessionClick = (session: Session) => {
    if (session.status === "active" || session.status === "abandoned") {
      setShowResumeModal(session);
    } else {
      setDetailId(session.id);
      loadMessages(session.id);
    }
  };

  // ══════════════════════════════════════
  // DETAIL VIEW — 2 columns: transcript left, summary+notes right
  // ══════════════════════════════════════
  if (detailId) {
    const session = sessions.find(s => s.id === detailId);
    if (!session) { setDetailId(null); return null; }
    const patient = session.ai_patients as Patient | null;
    const comp = ((session.session_competencies as Comp[] | null)?.[0]) ?? null;
    const fb = ((session.session_feedback as Fb[] | null)?.[0]) ?? null;
    const summary = summaryMap[session.id];
    const msgs = messagesMap[session.id] || [];
    const slug = getSlug(patient?.name || "");
    const currentNotes = notes[session.id] ?? session.student_notes_v2 ?? "";

    return (
      <div className="animate-fade-in">
        <button onClick={() => setDetailId(null)} className="flex items-center gap-1.5 text-xs text-sidebar hover:underline mb-4">
          <ArrowLeft size={14} /> Volver al historial
        </button>

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-sidebar overflow-hidden flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${supabaseUrl}/storage/v1/object/public/patients/${slug}.png`} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-gray-900">Sesión #{session.session_number} con {patient?.name}</p>
            <p className="text-xs text-gray-500">
              {formatDateLabel(session.created_at.substring(0, 10))} {formatTime(session.created_at)}
              {session.active_seconds ? ` · ${formatDuration(session.active_seconds)}` : ""}
            </p>
          </div>
          {comp && Number(comp.eval_version) === 2 && (
            <div className="flex items-center gap-1">
              <Brain size={14} className="text-sidebar" />
              <span className="text-lg font-bold text-sidebar">{Number(comp.overall_score_v2).toFixed(1)}</span>
              <span className="text-xs text-gray-400">/4</span>
            </div>
          )}
        </div>

        {/* 2 column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
          {/* Left: Transcript */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Transcripci&oacute;n</p>
              {msgs.length > 0 && (
                <button
                  onClick={() => {
                    const patientName = patient?.name || "Paciente";
                    const date = new Date(session.created_at).toLocaleDateString("es-CL");
                    const header = `Sesi\u00f3n #${session.session_number} con ${patientName}\nFecha: ${date}\nDuraci\u00f3n: ${session.active_seconds ? formatDuration(session.active_seconds) : "N/A"}\n${"═".repeat(50)}\n\n`;
                    const body = msgs.map((m) => {
                      const author = m.role === "user" ? "T\u00fa" : patientName;
                      const time = m.created_at ? new Date(m.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "";
                      return `[${time}] ${author}:\n${m.content}\n`;
                    }).join("\n");
                    const blob = new Blob([header + body], { type: "text/plain;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `sesion-${session.session_number}-${getSlug(patientName)}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1 text-[10px] text-sidebar hover:underline font-medium"
                >
                  <Download size={12} />
                  Descargar
                </button>
              )}
            </div>
            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {loadingMessages === session.id ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin w-5 h-5 text-sidebar mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm text-gray-400">Cargando transcripción...</span>
                </div>
              ) : msgs.length > 0 ? msgs.map((msg, i) => {
                const isStudent = msg.role === "user";
                return (
                  <div key={i} className={`flex ${isStudent ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      isStudent ? "bg-sidebar text-white rounded-br-md" : "bg-gray-100 text-gray-800 rounded-bl-md"
                    }`}>
                      <p className={`text-[10px] font-medium mb-0.5 ${isStudent ? "text-white/60" : "text-gray-400"}`}>
                        {isStudent ? "Tú" : patient?.name}
                      </p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-[9px] mt-1 ${isStudent ? "text-white/40" : "text-gray-300"}`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              }) : (
                <p className="text-sm text-gray-400 text-center py-8">Sin mensajes disponibles</p>
              )}
            </div>
          </div>

          {/* Right: Summary + Notes */}
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-sidebar" />
                <p className="text-xs font-semibold text-gray-500 uppercase">Resumen de la sesión</p>
              </div>
              {summary ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-700 leading-relaxed">{summary.summary}</p>
                  {summary.revelations.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Temas abordados</p>
                      {summary.revelations.map((r, i) => (
                        <p key={i} className="text-xs text-gray-600 mb-0.5">&#8226; {r}</p>
                      ))}
                    </div>
                  )}
                  {fb?.teacher_comment && (
                    <div className="bg-purple-50 rounded-lg p-3 mt-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <GraduationCap size={11} className="text-purple-600" />
                        <p className="text-[10px] font-semibold text-purple-700">
                          Docente{fb.teacher_score != null ? ` · ${Number(fb.teacher_score).toFixed(0)}/10` : ""}
                        </p>
                      </div>
                      <p className="text-xs text-purple-700 leading-relaxed">{fb.teacher_comment}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">
                  {session.status === "completed" ? "Resumen no disponible" : "Se genera al completar la sesión"}
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Mis apuntes</p>
              <textarea
                value={currentNotes}
                onChange={(e) => setNotes(prev => ({ ...prev, [session.id]: e.target.value }))}
                placeholder="Preguntas para la próxima sesión, observaciones, ideas..."
                rows={6}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-sidebar/30"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-gray-300">Solo tú puedes ver estos apuntes</p>
                <button
                  onClick={() => saveNote(session.id)}
                  disabled={savingNotes === session.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-sidebar text-white text-xs font-medium rounded-lg hover:bg-[#354080] disabled:opacity-50"
                >
                  <Save size={11} />
                  {savingNotes === session.id ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════
  // LIST / GROUPED VIEW
  // ══════════════════════════════════════

  const renderSessionCard = (session: Session) => {
    const patient = session.ai_patients as Patient | null;
    const comp = ((session.session_competencies as Comp[] | null)?.[0]) ?? null;
    const fb = ((session.session_feedback as Fb[] | null)?.[0]) ?? null;
    const isCompleted = session.status === "completed";
    const isApproved = comp?.feedback_status === "approved";
    const score = comp && Number(comp.eval_version) === 2 ? Number(comp.overall_score_v2) : null;
    const summary = summaryMap[session.id];
    const slug = getSlug(patient?.name || "");

    return (
      <button
        key={session.id}
        onClick={() => handleSessionClick(session)}
        className={`w-full text-left bg-white rounded-xl border overflow-hidden hover:shadow-md transition-all ${
          !isCompleted ? "border-gray-100" : isApproved ? "border-gray-200" : "border-amber-200"
        }`}
      >
        <div className="flex items-start gap-3 p-4">
          <div className="w-10 h-10 rounded-full bg-sidebar overflow-hidden flex-shrink-0 mt-0.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${supabaseUrl}/storage/v1/object/public/patients/${slug}.png`} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">Sesión #{session.session_number} &middot; {patient?.name}</p>
            <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
              <Clock size={10} /> {formatTime(session.created_at)}
              {session.active_seconds ? ` · ${formatDuration(session.active_seconds)}` : ""}
            </p>
            {summary && (
              <p className="text-[11px] text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{summary.summary}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            {score != null && score > 0 && (
              <div className="flex items-center gap-1">
                <Brain size={12} className="text-sidebar" />
                <span className="text-sm font-bold text-sidebar">{score.toFixed(1)}</span>
              </div>
            )}
            {isApproved ? (
              <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 size={9} /> Revisada
              </span>
            ) : isCompleted ? (
              <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Pendiente</span>
            ) : session.status === "abandoned" ? (
              <span className="text-[10px] text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Abandonada</span>
            ) : (
              <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">En curso</span>
            )}
            <ChevronRight size={14} className="text-gray-300" />
          </div>
        </div>
      </button>
    );
  };

  const renderObservationCard = (obs: ObservationSession) => {
    const formatObsDuration = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${s.toString().padStart(2, "0")} min`;
    };

    return (
      <button
        key={`obs-${obs.id}`}
        onClick={() => router.push(`/observacion/review/${obs.id}`)}
        className="w-full text-left bg-white rounded-xl border border-indigo-100 overflow-hidden hover:shadow-md transition-all"
      >
        <div className="flex items-start gap-3 p-4">
          <div className="w-10 h-10 rounded-full bg-sidebar/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Radio size={18} className="text-sidebar" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">{obs.title}</p>
            <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
              <Clock size={10} /> {formatTime(obs.created_at)}
              {obs.total_duration_seconds > 0 ? ` \u00b7 ${formatObsDuration(obs.total_duration_seconds)}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
              Observación
            </span>
            {obs.status === "completed" ? (
              <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 size={9} /> Completada
              </span>
            ) : obs.status === "abandoned" ? (
              <span className="text-[10px] text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Abandonada</span>
            ) : (
              <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">En curso</span>
            )}
            <ChevronRight size={14} className="text-gray-300" />
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Resume modal */}
      {showResumeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowResumeModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="text-base font-bold text-gray-900 mb-2">Retomar sesión</p>
            <p className="text-sm text-gray-600 mb-4">
              ¿Quieres retomar la conversación con <strong>{(showResumeModal.ai_patients as Patient)?.name}</strong>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowResumeModal(null)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (showResumeModal.status === "abandoned") {
                    await fetch(`/api/sessions/${showResumeModal.id}/resume`, { method: "POST" });
                  }
                  router.push(`/chat/${showResumeModal.ai_patient_id}?conversationId=${showResumeModal.id}`);
                }}
                className="flex-1 px-4 py-2.5 bg-sidebar text-white rounded-lg text-sm font-medium hover:bg-[#354080]"
              >
                Retomar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar paciente..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as "all" | "completed" | "active" | "observations")}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">
          <option value="all">Todos</option>
          <option value="completed">Completadas</option>
          <option value="active">En curso</option>
          <option value="observations">Observaciones</option>
        </select>
        <select value={filterPatient} onChange={(e) => setFilterPatient(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">
          <option value="all">Todos los pacientes</option>
          {patients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          <button onClick={() => setView("list")} className={`px-3 py-2 ${view === "list" ? "bg-sidebar text-white" : "text-gray-500 hover:bg-gray-50"}`}><List size={14} /></button>
          <button onClick={() => setView("grouped")} className={`px-3 py-2 ${view === "grouped" ? "bg-sidebar text-white" : "text-gray-500 hover:bg-gray-50"}`}><LayoutGrid size={14} /></button>
        </div>
      </div>

      {filtered.length === 0 && filteredObservations.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Sin sesiones encontradas</p>
          <Link href="/pacientes" className="inline-block mt-4 bg-sidebar text-white py-2 px-6 rounded-lg text-sm font-medium">Ir a pacientes</Link>
        </div>
      ) : view === "list" ? (
        /* LIST — grouped by date with subtitles */
        <div className="space-y-6">
          {/* Observation sessions */}
          {filteredObservations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-sidebar uppercase tracking-wide mb-2 px-1 flex items-center gap-1.5">
                <Radio size={12} /> Observaciones en vivo
              </p>
              <div className="space-y-2">
                {filteredObservations.map(o => renderObservationCard(o))}
              </div>
            </div>
          )}

          {/* Regular sessions grouped by date */}
          {groupedByDate.map(([dateKey, dateSessions]) => (
            <div key={dateKey}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                {formatDateLabel(dateKey)}
              </p>
              <div className="space-y-2">
                {dateSessions.map(s => renderSessionCard(s))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* GROUPED by patient */
        <div className="space-y-4">
          {groupedByPatient.map(([patientId, patientSessions]) => {
            const patient = patientSessions[0].ai_patients as Patient | null;
            const slug = getSlug(patient?.name || "");
            const scores = patientSessions.map(s => ((s.session_competencies as Comp[] | null)?.[0])).filter(c => c && Number(c.eval_version) === 2).map(c => Number(c!.overall_score_v2)).filter(v => v > 0);
            const trend = scores.length >= 2 ? ((scores[0] - scores[scores.length - 1]) / scores[scores.length - 1] * 100) : null;

            return (
              <div key={patientId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-4 p-4 border-b border-gray-100">
                  <div className="w-10 h-10 rounded-full bg-sidebar overflow-hidden flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${supabaseUrl}/storage/v1/object/public/patients/${slug}.png`} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">{patient?.name}</p>
                    <p className="text-[11px] text-gray-400">{patientSessions.length} sesiones</p>
                  </div>
                  {trend !== null && (
                    <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? "text-green-600" : "text-red-500"}`}>
                      <TrendingUp size={12} /> {trend >= 0 ? "+" : ""}{trend.toFixed(0)}%
                    </div>
                  )}
                </div>
                <div className="divide-y divide-gray-50">
                  {patientSessions.map(s => {
                    const comp = ((s.session_competencies as Comp[] | null)?.[0]) ?? null;
                    const score = comp && Number(comp.eval_version) === 2 ? Number(comp.overall_score_v2) : null;
                    const isApproved = comp?.feedback_status === "approved";
                    return (
                      <button key={s.id} onClick={() => handleSessionClick(s)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                        <span className="text-xs text-gray-600 w-20">Sesión #{s.session_number}</span>
                        <span className="text-[11px] text-gray-400 flex-1">{formatTime(s.created_at)} {formatDuration(s.active_seconds) ? `· ${formatDuration(s.active_seconds)}` : ""}</span>
                        <span className="text-xs font-medium text-sidebar w-10">{score && score > 0 ? score.toFixed(1) : "—"}</span>
                        {isApproved ? (
                          <span className="text-[10px] text-green-600">Revisada</span>
                        ) : s.status === "completed" ? (
                          <span className="text-[10px] text-amber-600">Pendiente</span>
                        ) : (
                          <span className="text-[10px] text-gray-400">En curso</span>
                        )}
                        <ChevronRight size={12} className="text-gray-300" />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
