import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
// LogoutButton moved to global TopHeader
import {
  Users, ClipboardCheck, TrendingUp, AlertTriangle,
  ChevronRight, GraduationCap, MessageSquare, Clock,
} from "lucide-react";

export default async function DocenteDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  // All students
  const { data: students } = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .eq("role", "student")
    .order("full_name");

  const studentIds = students?.map((s) => s.id) || [];

  // All progress rows for students
  const { data: allProgress } = await supabase
    .from("student_progress")
    .select("student_id, level, level_name, total_xp, sessions_completed, current_streak, last_session_date")
    .in("student_id", studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"]);

  // All completed sessions (with feedback info)
  const { data: allSessions } = await supabase
    .from("conversations")
    .select(`
      id, student_id, ai_patient_id, session_number, status, created_at,
      ai_patients(name, tags),
      session_feedback(teacher_comment, teacher_score),
      session_competencies(overall_score)
    `)
    .eq("status", "completed")
    .in("student_id", studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false });

  // Build progress map
  const progressMap = new Map<string, typeof allProgress extends (infer T)[] | null ? T : never>();
  allProgress?.forEach((p) => progressMap.set(p.student_id, p));

  // Compute metrics
  const totalStudents = students?.length || 0;
  const totalSessions = allSessions?.length || 0;

  type FbRow = { teacher_comment: string | null; teacher_score: number | null };
  type CompRow = { overall_score: number };

  const pendingReview = allSessions?.filter((s) => {
    const fb = (s.session_feedback as FbRow[] | null)?.[0];
    return !fb?.teacher_comment && !fb?.teacher_score;
  }).length || 0;

  const allScores = allSessions?.flatMap((s) => {
    const comp = (s.session_competencies as CompRow[] | null)?.[0];
    return comp?.overall_score != null ? [Number(comp.overall_score)] : [];
  }) || [];
  const avgScore = allScores.length > 0
    ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1)
    : "—";

  // Inactive students (no session in last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const inactiveStudents = students?.filter((s) => {
    const prog = progressMap.get(s.id);
    if (!prog?.last_session_date) return true;
    return new Date(prog.last_session_date) < sevenDaysAgo;
  }) || [];

  // Recent sessions needing review (last 20)
  const sessionsToReview = allSessions?.filter((s) => {
    const fb = (s.session_feedback as FbRow[] | null)?.[0];
    return !fb?.teacher_comment && !fb?.teacher_score;
  }).slice(0, 20) || [];

  const firstName = profile?.full_name?.split(" ")[0] || "Docente";

  return (
    <div className="min-h-screen">
      <header className="flex justify-between items-center px-4 sm:px-8 py-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Panel de supervisión
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Bienvenido, {firstName}
          </p>
        </div>
      </header>

      <div className="px-4 sm:px-8 pb-8 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Users size={20} className="text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
              <p className="text-xs text-gray-500">Alumnos activos</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <MessageSquare size={20} className="text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalSessions}</p>
              <p className="text-xs text-gray-500">Sesiones completadas</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
              <ClipboardCheck size={20} className="text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pendingReview}</p>
              <p className="text-xs text-gray-500">Pendientes de revisión</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
              <TrendingUp size={20} className="text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{avgScore}</p>
              <p className="text-xs text-gray-500">Puntaje promedio</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Students list */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Alumnos</h3>
              <span className="text-xs text-gray-400">{totalStudents} total</span>
            </div>

            {students && students.length > 0 ? (
              <div className="space-y-1">
                {students.map((student) => {
                  const prog = progressMap.get(student.id);
                  const sessCount = prog?.sessions_completed || 0;
                  const level = prog?.level_name || "Sin actividad";
                  const streak = prog?.current_streak || 0;
                  const initials = student.full_name
                    ?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

                  return (
                    <Link
                      key={student.id}
                      href={`/docente/alumno/${student.id}`}
                      className="flex items-center gap-3 py-2.5 px-3 -mx-1 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-full bg-sidebar flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{initials}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {student.full_name || student.email}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {level} &middot; {sessCount} {sessCount === 1 ? "sesión" : "sesiones"}
                          {streak > 0 && <span> &middot; {streak}d racha</span>}
                        </p>
                      </div>
                      <ChevronRight size={14} className="text-gray-300 group-hover:text-sidebar transition-colors" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">Sin alumnos registrados</p>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Pending reviews */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardCheck size={16} className="text-amber-500" />
                <h3 className="text-sm font-semibold text-gray-900">Por revisar</h3>
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

            {/* Inactive students alert */}
            {inactiveStudents.length > 0 && (
              <div className="bg-white rounded-xl border border-amber-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <h3 className="text-sm font-semibold text-gray-900">Alumnos inactivos</h3>
                </div>
                <p className="text-xs text-gray-500 mb-3">Sin práctica en los últimos 7 días</p>
                <div className="space-y-1.5">
                  {inactiveStudents.slice(0, 5).map((s) => (
                    <Link
                      key={s.id}
                      href={`/docente/alumno/${s.id}`}
                      className="flex items-center gap-2 text-xs text-gray-700 hover:text-sidebar transition-colors"
                    >
                      <Clock size={12} className="text-amber-400" />
                      <span className="truncate">{s.full_name || s.email}</span>
                    </Link>
                  ))}
                  {inactiveStudents.length > 5 && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      y {inactiveStudents.length - 5} más
                    </p>
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
