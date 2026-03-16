import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin-helpers";
import AdminDashboardClient from "./AdminDashboardClient";
import {
  Users, UserCheck, Radio, CheckCircle2,
  Building2, GraduationCap, ChevronRight,
} from "lucide-react";
import Link from "next/link";

export default async function AdminDashboard() {
  const ctx = await getAdminContext();
  const supabase = await createClient();
  const now = Date.now(); // eslint-disable-line react-hooks/purity

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", ctx.userId)
    .single();

  // ── Students scoped by establishment ─────────────────────
  const studentsQuery = supabase
    .from("profiles")
    .select("id, full_name, email, establishment_id, section_id, created_at")
    .eq("role", "student");
  const { data: students } = ctx.isSuperadmin
    ? await studentsQuery
    : await studentsQuery.in(
        "establishment_id",
        ctx.establishmentIds.length > 0
          ? ctx.establishmentIds
          : ["00000000-0000-0000-0000-000000000000"]
      );

  const studentIds = students?.map((s) => s.id) || [];
  const safeIds = studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"];

  // ── All completed sessions with competencies ─────────────
  const { data: allSessions } = await supabase
    .from("conversations")
    .select("id, student_id, created_at, session_competencies(overall_score, empathy, active_listening, open_questions, reformulation, confrontation, silence_management, rapport)")
    .eq("status", "completed")
    .in("student_id", safeIds)
    .order("created_at", { ascending: false });

  const totalSessions = allSessions?.length || 0;

  // ── Active sessions right now ────────────────────────────
  const { count: activeSessions } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .in("student_id", safeIds);

  // ── Active students (had a conversation in last 7 days) ──
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { data: recentConvos } = await supabase
    .from("conversations")
    .select("student_id")
    .in("student_id", safeIds)
    .gte("created_at", sevenDaysAgo.toISOString());
  const activeStudentIds = new Set(recentConvos?.map((c) => c.student_id) || []);
  const activeStudentCount = activeStudentIds.size;

  // ── Completed today ──────────────────────────────────────
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const completedToday = allSessions?.filter(
    (s) => new Date(s.created_at) >= todayStart
  ).length || 0;

  // ── Establishments ───────────────────────────────────────
  const { data: establishments } = ctx.isSuperadmin
    ? await supabase.from("establishments").select("id, name, slug, country, is_active")
    : await supabase
        .from("establishments")
        .select("id, name, slug, country, is_active")
        .in("id", ctx.establishmentIds.length > 0 ? ctx.establishmentIds : ["00000000-0000-0000-0000-000000000000"]);
  const activeEstablishments = establishments?.filter((e) => e.is_active).length || 0;

  // ── Instructors ──────────────────────────────────────────
  const instructorsQuery = supabase
    .from("profiles")
    .select("id, full_name, section_id, establishment_id")
    .eq("role", "instructor");
  const { data: instructors } = ctx.isSuperadmin
    ? await instructorsQuery
    : await instructorsQuery.in(
        "establishment_id",
        ctx.establishmentIds.length > 0
          ? ctx.establishmentIds
          : ["00000000-0000-0000-0000-000000000000"]
      );

  // ── Radar: average competencies across all sessions ──────
  type CompRow = {
    overall_score: number;
    empathy: number;
    active_listening: number;
    open_questions: number;
    reformulation: number;
    confrontation: number;
    silence_management: number;
    rapport: number;
  };

  const compTotals = { empathy: 0, active_listening: 0, open_questions: 0, reformulation: 0, confrontation: 0, silence_management: 0, rapport: 0 };
  let compCount = 0;
  allSessions?.forEach((s) => {
    const comp = (s.session_competencies as CompRow[] | null)?.[0];
    if (!comp || comp.overall_score == null) return;
    compCount++;
    compTotals.empathy += Number(comp.empathy);
    compTotals.active_listening += Number(comp.active_listening);
    compTotals.open_questions += Number(comp.open_questions);
    compTotals.reformulation += Number(comp.reformulation);
    compTotals.confrontation += Number(comp.confrontation);
    compTotals.silence_management += Number(comp.silence_management);
    compTotals.rapport += Number(comp.rapport);
  });

  const radarData = compCount > 0
    ? [
        { competency: "Empatía", value: parseFloat((compTotals.empathy / compCount).toFixed(1)) },
        { competency: "Escucha activa", value: parseFloat((compTotals.active_listening / compCount).toFixed(1)) },
        { competency: "Preg. abiertas", value: parseFloat((compTotals.open_questions / compCount).toFixed(1)) },
        { competency: "Reformulación", value: parseFloat((compTotals.reformulation / compCount).toFixed(1)) },
        { competency: "Confrontación", value: parseFloat((compTotals.confrontation / compCount).toFixed(1)) },
        { competency: "Manejo silencio", value: parseFloat((compTotals.silence_management / compCount).toFixed(1)) },
        { competency: "Rapport", value: parseFloat((compTotals.rapport / compCount).toFixed(1)) },
      ]
    : [];

  // ── Chart: sessions per week (12 weeks) ──────────────────
  const weeklySessionCounts: Record<number, number> = {};
  allSessions?.forEach((s) => {
    const weeksAgo = Math.floor((now - new Date(s.created_at).getTime()) / (7 * 86400000));
    if (weeksAgo < 12) {
      weeklySessionCounts[weeksAgo] = (weeklySessionCounts[weeksAgo] || 0) + 1;
    }
  });
  const chartSessionsPerWeek = Array.from({ length: 12 }, (_, i) => ({
    week: `S-${12 - i}`,
    sessions: weeklySessionCounts[11 - i] || 0,
  }));

  // ── Chart: student registrations per week ────────────────
  const registrationsByWeek: Record<number, number> = {};
  students?.forEach((s) => {
    const weeksAgo = Math.floor((now - new Date(s.created_at).getTime()) / (7 * 86400000));
    if (weeksAgo < 12) {
      registrationsByWeek[weeksAgo] = (registrationsByWeek[weeksAgo] || 0) + 1;
    }
  });
  const chartRegistrations = Array.from({ length: 12 }, (_, i) => ({
    week: `S-${12 - i}`,
    registrations: registrationsByWeek[11 - i] || 0,
  }));

  // ── Table: establishments comparison ─────────────────────
  const establishmentTable = (establishments || [])
    .filter((e) => e.is_active)
    .map((est) => {
      const estStudents = students?.filter((s) => s.establishment_id === est.id) || [];
      const estStudentIds = estStudents.map((s) => s.id);
      const estSessions = allSessions?.filter((s) => estStudentIds.includes(s.student_id)) || [];
      const estActiveCount = estStudentIds.filter((id) => activeStudentIds.has(id)).length;
      const estScores = estSessions.flatMap((s) => {
        const comp = (s.session_competencies as CompRow[] | null)?.[0];
        return comp?.overall_score != null ? [Number(comp.overall_score)] : [];
      });
      const avgScore = estScores.length > 0
        ? parseFloat((estScores.reduce((a, b) => a + b, 0) / estScores.length).toFixed(1))
        : 0;
      const sessionsPerStudent = estStudents.length > 0
        ? parseFloat((estSessions.length / estStudents.length).toFixed(1))
        : 0;

      return {
        id: est.id,
        name: est.name,
        country: est.country || "—",
        students: estStudents.length,
        activeStudents: estActiveCount,
        sessions: estSessions.length,
        sessionsPerStudent,
        avgScore,
      };
    })
    .sort((a, b) => b.sessions - a.sessions);

  // ── Activity heatmap (day of week x hour) ────────────────
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  allSessions?.forEach((s) => {
    const d = new Date(s.created_at);
    heatmap[d.getDay()][d.getHours()]++;
  });

  // ── Top students ─────────────────────────────────────────
  const { data: allProgress } = await supabase
    .from("student_progress")
    .select("student_id, total_xp, sessions_completed, level_name")
    .in("student_id", safeIds)
    .order("total_xp", { ascending: false });

  const topStudents = (allProgress || []).slice(0, 5).map((p) => {
    const student = students?.find((s) => s.id === p.student_id);
    return { name: student?.full_name || student?.email || "—", xp: p.total_xp, level: p.level_name };
  });

  // ── Struggling students ──────────────────────────────────
  const studentScoreMap: Record<string, { total: number; count: number }> = {};
  allSessions?.forEach((s) => {
    const comp = (s.session_competencies as CompRow[] | null)?.[0];
    if (comp?.overall_score == null) return;
    if (!studentScoreMap[s.student_id]) studentScoreMap[s.student_id] = { total: 0, count: 0 };
    studentScoreMap[s.student_id].total += Number(comp.overall_score);
    studentScoreMap[s.student_id].count++;
  });

  const strugglingStudents = Object.entries(studentScoreMap)
    .filter(([, v]) => v.count >= 3)
    .map(([id, v]) => ({
      id,
      name: students?.find((s) => s.id === id)?.full_name || "—",
      avgScore: parseFloat((v.total / v.count).toFixed(1)),
      sessions: v.count,
    }))
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 5);

  // ── Sections for instructor lookup ───────────────────────
  const { data: sections } = await supabase
    .from("sections")
    .select("id, name, instructor_id");

  // ── Unreviewed sessions (with hierarchy) ─────────────────
  const { data: unreviewedSessions } = await supabase
    .from("conversations")
    .select(`
      id, student_id, created_at,
      ai_patients(name),
      session_feedback(teacher_comment, teacher_score)
    `)
    .eq("status", "completed")
    .in("student_id", safeIds)
    .order("created_at", { ascending: false })
    .limit(50);

  type FbRow = { teacher_comment: string | null; teacher_score: number | null };
  const pendingSessions = (unreviewedSessions || [])
    .filter((s) => {
      const fb = (s.session_feedback as FbRow[] | null)?.[0];
      return !fb?.teacher_comment && !fb?.teacher_score;
    })
    .slice(0, 8)
    .map((s) => {
      const student = students?.find((st) => st.id === s.student_id);
      const est = establishments?.find((e) => e.id === student?.establishment_id);
      // Find instructor via section
      const section = sections?.find((sec) => sec.id === student?.section_id);
      const instructor = instructors?.find((i) => i.id === section?.instructor_id);

      return {
        id: s.id,
        country: est?.country || "—",
        establishment: est?.name || "—",
        instructorName: instructor?.full_name || "Sin asignar",
        studentName: student?.full_name || student?.email || "—",
        patientName: (s.ai_patients as unknown as { name: string } | null)?.name || "—",
        date: new Date(s.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" }),
      };
    });

  const firstName = profile?.full_name?.split(" ")[0] || "Admin";

  return (
    <div className="min-h-screen">
      <header className="flex justify-between items-center px-8 py-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel de administración</h1>
          <p className="text-sm text-gray-500 mt-0.5">Bienvenido, {firstName}</p>
        </div>
      </header>

      <div className="px-8 pb-8 space-y-6">
        {/* ── Funnel KPIs ──────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FunnelCard
            icon={Users}
            value={students?.length || 0}
            label="Inscritos"
            color="blue"
          />
          <FunnelCard
            icon={UserCheck}
            value={activeStudentCount}
            label="Activos (7d)"
            color="green"
            rate={students?.length ? Math.round((activeStudentCount / students.length) * 100) : undefined}
          />
          <FunnelCard
            icon={Radio}
            value={activeSessions || 0}
            label="En sesión ahora"
            color="amber"
            rate={activeStudentCount ? Math.round(((activeSessions || 0) / activeStudentCount) * 100) : undefined}
          />
          <FunnelCard
            icon={CheckCircle2}
            value={completedToday}
            label="Completadas hoy"
            color="purple"
          />
        </div>

        {/* ── Secondary KPIs ───────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-3">
            <Building2 size={16} className="text-indigo-500" />
            <div>
              <span className="text-lg font-bold text-gray-900">{activeEstablishments}</span>
              <span className="text-xs text-gray-500 ml-2">Establecimientos</span>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-3">
            <GraduationCap size={16} className="text-amber-500" />
            <div>
              <span className="text-lg font-bold text-gray-900">{instructors?.length || 0}</span>
              <span className="text-xs text-gray-500 ml-2">Instructores</span>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-3">
            <CheckCircle2 size={16} className="text-green-500" />
            <div>
              <span className="text-lg font-bold text-gray-900">{totalSessions}</span>
              <span className="text-xs text-gray-500 ml-2">Sesiones totales</span>
            </div>
          </div>
        </div>

        {/* ── Charts (client) ──────────────────────────────── */}
        <AdminDashboardClient
          sessionsPerWeek={chartSessionsPerWeek}
          registrations={chartRegistrations}
          radarData={radarData}
          heatmap={heatmap}
          establishmentTable={establishmentTable}
          isSuperadmin={ctx.isSuperadmin}
        />

        {/* ── Tables row ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top 5 students */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Top 5 alumnos</h3>
            {topStudents.length > 0 ? (
              <div className="space-y-2">
                {topStudents.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5">
                    <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                      <p className="text-[10px] text-gray-400">{s.level} - {s.xp} XP</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">Sin datos</p>
            )}
          </div>

          {/* Struggling students */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Alumnos con dificultades</h3>
            {strugglingStudents.length > 0 ? (
              <div className="space-y-2">
                {strugglingStudents.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                      <p className="text-[10px] text-gray-400">
                        Promedio: {s.avgScore} - {s.sessions} sesiones
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">Sin datos</p>
            )}
          </div>

          {/* Pending review — with hierarchy */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Sin revisar por docente</h3>
            {pendingSessions.length > 0 ? (
              <div className="space-y-1">
                {pendingSessions.map((s) => (
                  <Link
                    key={s.id}
                    href={`/docente/sesion/${s.id}`}
                    className="block py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {s.studentName} &rarr; {s.patientName}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">
                          {s.country} &middot; {s.establishment} &middot; {s.instructorName}
                        </p>
                        <p className="text-[10px] text-gray-300">{s.date}</p>
                      </div>
                      <ChevronRight size={12} className="text-gray-300 group-hover:text-sidebar shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">Todo revisado</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Funnel KPI Card ─────────────────────────────────────── */
function FunnelCard({
  icon: Icon,
  value,
  label,
  color,
  rate,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  value: number;
  label: string;
  color: string;
  rate?: number;
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: "bg-blue-50", text: "text-blue-500" },
    green: { bg: "bg-green-50", text: "text-green-500" },
    amber: { bg: "bg-amber-50", text: "text-amber-500" },
    purple: { bg: "bg-purple-50", text: "text-purple-500" },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-full ${c.bg} flex items-center justify-center shrink-0`}>
        <Icon size={18} className={c.text} />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {rate !== undefined && (
            <span className="text-[10px] text-gray-400">{rate}%</span>
          )}
        </div>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}
