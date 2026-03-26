import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Users, ClipboardCheck, TrendingUp, AlertTriangle,
  ChevronRight, MessageSquare, Clock, Calendar,
} from "lucide-react";
import { getUserProfile } from "@/lib/supabase/user-profile";
import DocenteStudentList, { type StudentData } from "./DocenteStudentList";

export default async function DocenteDashboard({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const userProfile = await getUserProfile();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, establishment_id")
    .eq("id", user.id)
    .single();

  // Use the impersonated establishment_id for proper scoping
  const establishmentId = userProfile?.establishmentId || profile?.establishment_id;

  // Students scoped to establishment
  let studentsQuery = supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .eq("role", "student")
    .order("full_name");

  if (establishmentId) {
    studentsQuery = studentsQuery.eq("establishment_id", establishmentId);
  }

  const { data: students } = await studentsQuery;

  const studentIds = students?.map((s) => s.id) || [];

  // All progress rows + ALL sessions (not just completed) in parallel
  const noStudents = ["00000000-0000-0000-0000-000000000000"];
  const [{ data: allProgress }, { data: allConversations }] = await Promise.all([
    supabase
      .from("student_progress")
      .select("student_id, level, level_name, total_xp, sessions_completed, current_streak, last_session_date")
      .in("student_id", studentIds.length > 0 ? studentIds : noStudents),
    supabase
      .from("conversations")
      .select(`
        id, student_id, ai_patient_id, session_number, status, created_at,
        ai_patients(name, tags),
        session_feedback(teacher_comment, teacher_score),
        session_competencies(overall_score, overall_score_v2, feedback_status)
      `)
      .in("student_id", studentIds.length > 0 ? studentIds : noStudents)
      .order("created_at", { ascending: false }),
  ]);

  const allSessions = allConversations?.filter(s => s.status === "completed") || [];
  const allSessionsIncludingActive = allConversations || [];

  // Build progress map
  const progressMap = new Map<string, typeof allProgress extends (infer T)[] | null ? T : never>();
  allProgress?.forEach((p) => progressMap.set(p.student_id, p));

  // Compute metrics
  const totalStudents = students?.length || 0;
  const totalSessions = allSessionsIncludingActive.length;

  type CompRow = { overall_score: number; overall_score_v2: number; feedback_status: string };

  const pendingSessions = allSessions.filter((s) => {
    const comp = (s.session_competencies as CompRow[] | null)?.[0];
    const status = comp?.feedback_status || "pending";
    return status === "pending";
  });

  const reviewedSessions = allSessions.filter((s) => {
    const comp = (s.session_competencies as CompRow[] | null)?.[0];
    const status = comp?.feedback_status;
    return status === "approved" || status === "evaluated";
  });

  const allScores = allSessions.flatMap((s) => {
    const comp = (s.session_competencies as CompRow[] | null)?.[0];
    const score = comp?.overall_score_v2 ?? comp?.overall_score;
    return score != null && Number(score) > 0 ? [Number(score)] : [];
  });
  const avgScore = allScores.length > 0
    ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1)
    : "\u2014";

  // Count sessions and pending per student from actual conversations
  const sessionsByStudent = new Map<string, number>();
  const pendingByStudent = new Map<string, number>();
  allSessionsIncludingActive.forEach((s) => {
    sessionsByStudent.set(s.student_id, (sessionsByStudent.get(s.student_id) || 0) + 1);
  });
  pendingSessions.forEach((s) => {
    pendingByStudent.set(s.student_id, (pendingByStudent.get(s.student_id) || 0) + 1);
  });

  // Serialize student data for client component
  const studentData: StudentData[] = (students || []).map((s) => {
    const prog = progressMap.get(s.id);
    return {
      id: s.id,
      full_name: s.full_name,
      email: s.email,
      sessions_completed: sessionsByStudent.get(s.id) || 0,
      last_session_date: prog?.last_session_date || null,
      pending_count: pendingByStudent.get(s.id) || 0,
    };
  });

  // Workload metrics (item 12)
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const reviewedThisWeek = reviewedSessions.filter(
    (s) => new Date(s.created_at) >= weekStart
  ).length;

  // Oldest pending review age
  const oldestPending = pendingSessions.length > 0
    ? Math.round((now.getTime() - new Date(pendingSessions[pendingSessions.length - 1].created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Sessions needing review (for right column)
  const sessionsToReview = pendingSessions.slice(0, 20);

  // Inactive students
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const inactiveStudents = students?.filter((s) => {
    const prog = progressMap.get(s.id);
    if (!prog?.last_session_date) return true;
    return new Date(prog.last_session_date) < sevenDaysAgo;
  }) || [];

  const firstName = profile?.full_name?.split(" ")[0] || "Docente";

  return (
    <div className="min-h-screen">
      <header className="flex justify-between items-center px-4 sm:px-8 py-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {"Panel de supervisi\u00f3n"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Bienvenido, {firstName}
          </p>
        </div>
      </header>

      <div className="px-4 sm:px-8 pb-8 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Users size={20} className="text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
              <p className="text-xs text-gray-500">Alumnos</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <MessageSquare size={20} className="text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalSessions}</p>
              <p className="text-xs text-gray-500">Sesiones</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
              <ClipboardCheck size={20} className="text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pendingSessions.length}</p>
              <p className="text-xs text-gray-500">Pendientes</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
              <TrendingUp size={20} className="text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{avgScore}</p>
              <p className="text-xs text-gray-500">Promedio</p>
            </div>
          </div>

          {/* Workload metrics (item 12) */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <Calendar size={20} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{reviewedThisWeek}</p>
              <p className="text-xs text-gray-500">Revisadas (7d)</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <Clock size={20} className="text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{oldestPending > 0 ? `${oldestPending}d` : "\u2014"}</p>
              <p className="text-xs text-gray-500">Mayor atraso</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Students list — now with search + filters */}
          <DocenteStudentList students={studentData} defaultFilter={params.filter || null} />

          {/* Right column */}
          <div className="space-y-6">
            {/* Pending reviews */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ClipboardCheck size={16} className="text-amber-500" />
                  <h3 className="text-sm font-semibold text-gray-900">Por revisar</h3>
                </div>
                {pendingSessions.length > 8 && (
                  <Link href="/docente/revisiones" className="text-[10px] text-sidebar hover:underline">
                    Ver todas
                  </Link>
                )}
              </div>

              {sessionsToReview.length > 0 ? (
                <div className="space-y-1">
                  {sessionsToReview.slice(0, 8).map((session) => {
                    const patient = session.ai_patients as unknown as { name: string; tags: string[] | null } | null;
                    const studentName = students?.find((s) => s.id === session.student_id)?.full_name || "Alumno";
                    const comp = (session.session_competencies as CompRow[] | null)?.[0];
                    const date = new Date(session.created_at).toLocaleDateString("es-CL", {
                      day: "numeric", month: "short",
                    });
                    const riskTags = ["ideacion", "suicida", "autolesion", "crisis", "riesgo"];
                    const hasRisk = (patient?.tags || []).some(t => riskTags.some(r => t.toLowerCase().includes(r)));

                    return (
                      <Link
                        key={session.id}
                        href={`/docente/sesion/${session.id}`}
                        className={`flex items-center gap-3 py-2 px-2 -mx-1 rounded-lg hover:bg-gray-50 transition-colors group ${
                          hasRisk ? "bg-red-50/50 border border-red-200 rounded-lg" : ""
                        }`}
                      >
                        {hasRisk && (
                          <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {studentName.split(" ")[0]} → {patient?.name}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {date}
                            {comp?.overall_score != null && (
                              <span> &middot; IA: {Number(comp.overall_score).toFixed(1)}</span>
                            )}
                          </p>
                        </div>
                        <ChevronRight size={12} className="text-gray-300 group-hover:text-sidebar" />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">Todo revisado</p>
              )}
            </div>

            {/* Inactive students alert — item 6: show all + link to filtered view */}
            {inactiveStudents.length > 0 && (
              <div className="bg-white rounded-xl border border-amber-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500" />
                    <h3 className="text-sm font-semibold text-gray-900">Alumnos inactivos</h3>
                  </div>
                  <span className="text-xs text-amber-500 font-medium">{inactiveStudents.length}</span>
                </div>
                <p className="text-xs text-gray-500 mb-3">{"Sin pr\u00e1ctica en los \u00faltimos 7 d\u00edas"}</p>
                <div className="space-y-1.5">
                  {inactiveStudents.slice(0, 10).map((s) => (
                    <Link
                      key={s.id}
                      href={`/docente/alumno/${s.id}`}
                      className="flex items-center gap-2 text-xs text-gray-700 hover:text-sidebar transition-colors"
                    >
                      <Clock size={12} className="text-amber-400" />
                      <span className="truncate">{s.full_name || s.email}</span>
                    </Link>
                  ))}
                  {inactiveStudents.length > 10 && (
                    <Link
                      href="/docente/dashboard?filter=inactive"
                      className="text-[10px] text-sidebar hover:underline mt-1 inline-block"
                    >
                      Ver todos ({inactiveStudents.length})
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
