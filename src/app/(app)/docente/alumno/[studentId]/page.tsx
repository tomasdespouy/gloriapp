import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ChevronRight, Brain, GraduationCap,
  Target, Clock, CheckCircle2, AlertTriangle,
} from "lucide-react";
import DownloadReportButton from "@/components/DownloadReportButton";

interface Props {
  params: Promise<{ studentId: string }>;
}

// V2 competency labels (10 items, 0-4 scale)
const V2_COMP_KEYS = [
  { key: "setting_terapeutico", label: "Setting terapéutico", domain: "Estructura" },
  { key: "motivo_consulta", label: "Motivo de consulta", domain: "Estructura" },
  { key: "datos_contextuales", label: "Datos contextuales", domain: "Estructura" },
  { key: "objetivos", label: "Objetivos", domain: "Estructura" },
  { key: "escucha_activa", label: "Escucha activa", domain: "Actitudes" },
  { key: "actitud_no_valorativa", label: "Actitud no valorativa", domain: "Actitudes" },
  { key: "optimismo", label: "Optimismo", domain: "Actitudes" },
  { key: "presencia", label: "Presencia", domain: "Actitudes" },
  { key: "conducta_no_verbal", label: "Conducta no verbal", domain: "Actitudes" },
  { key: "contencion_afectos", label: "Contención de afectos", domain: "Actitudes" },
];

type CompRow = Record<string, number | string | string[] | null>;
const getComp = (s: { session_competencies: unknown }): CompRow | null => {
  const raw = s.session_competencies;
  if (!raw) return null;
  if (Array.isArray(raw)) return (raw as CompRow[])[0] ?? null;
  return raw as CompRow;
};
type FbRow = { teacher_comment: string | null; teacher_score: number | null };

export default async function DocenteAlumnoPage({ params }: Props) {
  const { studentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: student } = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .eq("id", studentId)
    .single();

  if (!student) redirect("/docente/dashboard");

  const admin = createAdminClient();

  const { data: progress } = await supabase
    .from("student_progress")
    .select("*")
    .eq("student_id", studentId)
    .single();

  // All sessions with V2 evaluations + feedback + strengths/areas
  // Use admin client — page is auth-gated and scoped by studentId
  const { data: sessions } = await admin
    .from("conversations")
    .select(`
      id, ai_patient_id, session_number, status, created_at, ended_at, active_seconds,
      messages(count),
      ai_patients(name, difficulty_level, tags),
      session_competencies(
        setting_terapeutico, motivo_consulta, datos_contextuales, objetivos,
        escucha_activa, actitud_no_valorativa, optimismo, presencia, conducta_no_verbal, contencion_afectos,
        overall_score_v2, eval_version, ai_commentary, strengths, areas_to_improve, feedback_status
      ),
      session_feedback(teacher_comment, teacher_score)
    `)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  // Session summaries for AI-generated recap
  const { data: summaries } = await admin
    .from("session_summaries")
    .select("conversation_id, summary")
    .eq("student_id", studentId);

  const summaryMap = new Map<string, string>();
  summaries?.forEach(s => summaryMap.set(s.conversation_id, s.summary));

  const allSessions = sessions || [];
  const completedSessions = allSessions.filter((s) => s.status === "completed");
  const totalSessions = allSessions.length;
  const totalActiveMinutes = Math.round(allSessions.reduce((sum, s) => sum + ((s as Record<string, unknown>).active_seconds as number || 0), 0) / 60);

  // Compute average V2 competencies
  const allComps = completedSessions.flatMap((s) => {
    const comp = getComp(s);
    return comp && Number(comp.eval_version) === 2 ? [comp] : [];
  });

  const avgComp = (key: string) => {
    const vals = allComps.map((c) => Number(c[key])).filter((v) => !isNaN(v) && v > 0);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  const overallAvg = allComps.length > 0
    ? allComps.map(c => Number(c.overall_score_v2)).filter(v => !isNaN(v)).reduce((a, b) => a + b, 0) / allComps.length
    : 0;

  const pendingCount = completedSessions.filter((s) => {
    const comp = getComp(s);
    const status = comp ? String(comp.feedback_status) : "pending";
    return status === "pending" || !comp;
  }).length;

  const reviewedCount = completedSessions.filter((s) => {
    const comp = getComp(s);
    const st = comp ? String(comp.feedback_status) : "";
    return st === "approved" || st === "evaluated";
  }).length;

  const closedCount = completedSessions.filter((s) => {
    const comp = getComp(s);
    return comp && String(comp.feedback_status) === "evaluated";
  }).length;

  const initials = student.full_name
    ?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

  const TZ = "America/Santiago";

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: TZ }).format(new Date(iso));

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    const date = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: TZ }).format(d);
    const time = new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(d);
    return `${date} ${time}`;
  };

  const getChileDateKey = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ }).format(new Date(iso));

  const formatDateLabel = (dateKey: string) => {
    const todayKey = getChileDateKey(new Date().toISOString());
    const yd = new Date(); yd.setDate(yd.getDate() - 1);
    const yesterdayKey = getChileDateKey(yd.toISOString());
    const [y, m, d] = dateKey.split("-").map(Number);
    const date = new Date(y, m - 1, d, 12);
    const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const label = `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`;
    if (dateKey === todayKey) return `Hoy — ${label}`;
    if (dateKey === yesterdayKey) return `Ayer — ${label}`;
    return label;
  };

  // Group sessions by Chile date
  const groupedSessions: Map<string, typeof allSessions> = new Map();
  allSessions.forEach(s => {
    const key = getChileDateKey(s.created_at);
    if (!groupedSessions.has(key)) groupedSessions.set(key, []);
    groupedSessions.get(key)!.push(s);
  });
  const dateGroups = Array.from(groupedSessions.entries());

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="px-4 sm:px-8 py-5 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <Link href="/docente/dashboard" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={18} className="text-gray-500" />
          </Link>
          <div className="w-10 h-10 rounded-full bg-sidebar flex items-center justify-center">
            <span className="text-white text-sm font-bold">{initials}</span>
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">
              {student.full_name || student.email}
            </h1>
            <p className="text-xs text-gray-500">
              {totalSessions} sesiones &middot; {totalActiveMinutes} min &middot; {student.email}
            </p>
          </div>
          <DownloadReportButton studentId={studentId} />
        </div>
      </header>

      <div className="px-4 sm:px-8 py-6 space-y-6">
        {/* Competency snapshot bars (header card) */}
        {allComps.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-sidebar" />
                <h3 className="text-sm font-semibold text-gray-900">Competencias promedio</h3>
              </div>
              <span className="text-sm font-bold text-sidebar">{overallAvg.toFixed(1)}/4</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-3">
              {V2_COMP_KEYS.map(({ key, label }) => {
                const val = avgComp(key);
                const pct = (val / 4) * 100;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-gray-500 truncate">{label}</span>
                      <span className="text-[10px] font-bold text-gray-700">{val.toFixed(1)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: val >= 3 ? "#22c55e" : val >= 2 ? "#eab308" : "#ef4444",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stats row (compact) */}
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{totalSessions}</p>
            <p className="text-[10px] text-gray-400">Sesiones</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-amber-500">{pendingCount}</p>
            <p className="text-[10px] text-gray-400">Por revisar</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-blue-500">{reviewedCount}</p>
            <p className="text-[10px] text-gray-400">{"Retroalimentaci\u00f3n enviada"}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{closedCount}</p>
            <p className="text-[10px] text-gray-400">Cerradas</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{totalActiveMinutes}</p>
            <p className="text-[10px] text-gray-400">{"Min en sesi\u00f3n"}</p>
          </div>
        </div>

        {/* Session history — 3 column grid */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Historial de sesiones</h3>

          {dateGroups.length > 0 ? (
            <div className="space-y-6">
              {dateGroups.map(([dateKey, dateSessions]) => (
                <div key={dateKey}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-xs font-medium text-gray-500 whitespace-nowrap">{formatDateLabel(dateKey)}</span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {dateSessions.map((session) => {
                const patient = session.ai_patients as unknown as { name: string; difficulty_level: string; tags: string[] | null } | null;
                const comp = getComp(session);
                const rawFb = session.session_feedback;
                const fb = !rawFb ? null : Array.isArray(rawFb) ? (rawFb as FbRow[])[0] ?? null : rawFb as FbRow;
                const isCompleted = session.status === "completed";
                const fbStatus = comp ? String(comp.feedback_status) : null;
                const isEvaluated = fbStatus === "evaluated";
                const isApproved = fbStatus === "approved" || isEvaluated;
                const isV2 = comp && Number(comp.eval_version) === 2;
                const score = isV2 ? Number(comp.overall_score_v2) : null;

                const riskTags = ["ideacion", "suicida", "autolesion", "crisis", "riesgo"];
                const patientTags = patient?.tags || [];
                const hasRisk = patientTags.some(t => riskTags.some(r => t.toLowerCase().includes(r)));

                const activeSeconds = (session as Record<string, unknown>).active_seconds as number | null;
                const endedAt = (session as Record<string, unknown>).ended_at as string | null;
                const durationMin = activeSeconds ? Math.floor(activeSeconds / 60) : null;
                const durationSec = activeSeconds ? (activeSeconds % 60).toString().padStart(2, "0") : null;

                const patientSlug = patient?.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-") || "";
                const sessionSummary = summaryMap.get(session.id);
                const msgArr = (session as Record<string, unknown>).messages as unknown as { count: number }[] | null;
                const messageCount = msgArr?.[0]?.count ?? 0;

                return (
                  <Link
                    key={session.id}
                    href={isCompleted ? `/docente/sesion/${session.id}` : "#"}
                    className={`block bg-white rounded-xl border overflow-hidden transition-all ${
                      isCompleted ? "hover:shadow-md cursor-pointer" : "opacity-50 border-gray-100 pointer-events-none"
                    } ${
                      hasRisk && !isApproved ? "border-red-300 ring-1 ring-red-200" :
                      isEvaluated ? "border-green-200" :
                      isApproved ? "border-blue-200" :
                      isCompleted ? "border-amber-200" : "border-gray-100"
                    }`}
                  >
                    {/* Header with patient photo */}
                    <div className="flex items-center gap-3 p-4 pb-2">
                      <div className="w-9 h-9 rounded-full bg-sidebar overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/${patientSlug}.png`}
                          alt={patient?.name || ""}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {hasRisk && !isApproved && (
                            <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />
                          )}
                          <p className="text-sm font-bold text-gray-900 truncate">
                            {patient?.name} - Sesión #{session.session_number}
                          </p>
                        </div>
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                          patient?.difficulty_level === "beginner" ? "bg-green-50 text-green-600" :
                          patient?.difficulty_level === "intermediate" ? "bg-amber-50 text-amber-600" :
                          "bg-red-50 text-red-600"
                        }`}>
                          {patient?.difficulty_level === "beginner" ? "Principiante" :
                           patient?.difficulty_level === "intermediate" ? "Intermedio" : "Avanzado"}
                        </span>
                      </div>
                      {/* Score badge */}
                      {score != null && score > 0 && (
                        <div className="text-right flex-shrink-0">
                          <span className="text-sm font-bold text-sidebar">{score.toFixed(1)}</span>
                          <span className="text-[9px] text-gray-400">/4</span>
                        </div>
                      )}
                    </div>

                    {/* Time info */}
                    <div className="px-4 pb-2">
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-400">
                        <span>Inicio: {formatDateTime(session.created_at)}</span>
                        {endedAt && <span>Cierre: {formatDateTime(endedAt)}</span>}
                        {durationMin != null && (
                          <span className="text-gray-500 font-medium">Efectivo: {durationMin}:{durationSec} minutos</span>
                        )}
                        {messageCount > 0 && <span>{messageCount} mensajes</span>}
                      </div>
                    </div>

                    {/* AI Summary */}
                    {sessionSummary && (
                      <div className="px-4 pb-3">
                        <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-3">
                          {sessionSummary}
                        </p>
                      </div>
                    )}

                    {/* Footer: status */}
                    <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                      {fbStatus === "evaluated" ? (
                        <span className="flex items-center gap-1 text-[10px] text-green-600">
                          <CheckCircle2 size={11} /> Cerrada{fb?.teacher_score != null ? ` · ${Number(fb.teacher_score).toFixed(0)}/10` : ""}
                        </span>
                      ) : fbStatus === "approved" ? (
                        <span className="flex items-center gap-1 text-[10px] text-blue-600">
                          <CheckCircle2 size={11} /> Retroalimentación enviada{fb?.teacher_score != null ? ` · ${Number(fb.teacher_score).toFixed(0)}/10` : ""}
                        </span>
                      ) : isCompleted ? (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600">
                          Pendiente de revisión
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">En curso</span>
                      )}
                      {isCompleted && (
                        <ChevronRight size={14} className="text-gray-300" />
                      )}
                    </div>
                  </Link>
                );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-sm text-gray-400">Sin sesiones registradas</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
