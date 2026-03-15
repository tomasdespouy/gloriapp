import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin-helpers";
// LogoutButton moved to global TopHeader
import KPICard from "@/components/admin/KPICard";
import AdminDashboardClient from "./AdminDashboardClient";
import {
  Users, MessageSquare, TrendingUp, Building2, GraduationCap,
  ChevronRight,
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

  // ── KPIs ──────────────────────────────────────────────────
  // Students scoped by establishment
  const studentsQuery = supabase
    .from("profiles")
    .select("id, full_name, email, establishment_id, created_at")
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

  // Completed sessions
  const { data: allSessions } = await supabase
    .from("conversations")
    .select("id, student_id, created_at, session_competencies(overall_score)")
    .eq("status", "completed")
    .in("student_id", safeIds)
    .order("created_at", { ascending: false });

  const totalSessions = allSessions?.length || 0;

  // Average score
  type CompRow = { overall_score: number };
  const allScores = allSessions?.flatMap((s) => {
    const comp = (s.session_competencies as CompRow[] | null)?.[0];
    return comp?.overall_score != null ? [Number(comp.overall_score)] : [];
  }) || [];
  const avgScore = allScores.length > 0
    ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1)
    : "—";

  // Active establishments
  const { data: establishments } = ctx.isSuperadmin
    ? await supabase.from("establishments").select("id, name, slug, is_active")
    : await supabase
        .from("establishments")
        .select("id, name, slug, is_active")
        .in("id", ctx.establishmentIds.length > 0 ? ctx.establishmentIds : ["00000000-0000-0000-0000-000000000000"]);
  const activeEstablishments = establishments?.filter((e) => e.is_active).length || 0;

  // Instructors scoped
  const instructorsQuery = supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "instructor");
  const { count: instructorCount } = ctx.isSuperadmin
    ? await instructorsQuery
    : await instructorsQuery.in(
        "establishment_id",
        ctx.establishmentIds.length > 0
          ? ctx.establishmentIds
          : ["00000000-0000-0000-0000-000000000000"]
      );

  // ── Chart data: sessions per day (last 30 days) ──────────
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sessionsPerDay: Record<string, number> = {};
  allSessions?.forEach((s) => {
    const day = new Date(s.created_at).toISOString().slice(0, 10);
    if (new Date(s.created_at) >= thirtyDaysAgo) {
      sessionsPerDay[day] = (sessionsPerDay[day] || 0) + 1;
    }
  });

  const chartSessionsPerDay = [];
  for (let d = new Date(thirtyDaysAgo); d <= new Date(); d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    chartSessionsPerDay.push({ date: key, sessions: sessionsPerDay[key] || 0 });
  }

  // ── Chart data: weekly average score (last 12 weeks) ─────
  const weeklyScores: Record<number, number[]> = {};
  allSessions?.forEach((s) => {
    const comp = (s.session_competencies as CompRow[] | null)?.[0];
    if (comp?.overall_score == null) return;
    const created = new Date(s.created_at);
    const weeksAgo = Math.floor((now - created.getTime()) / (7 * 86400000));
    if (weeksAgo < 12) {
      if (!weeklyScores[weeksAgo]) weeklyScores[weeksAgo] = [];
      weeklyScores[weeksAgo].push(Number(comp.overall_score));
    }
  });
  const chartWeeklyScore = Array.from({ length: 12 }, (_, i) => {
    const scores = weeklyScores[11 - i] || [];
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { week: `S-${12 - i}`, score: parseFloat(avg.toFixed(1)) };
  });

  // ── Chart data: student registrations per week ───────────
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

  // ── Chart data: comparison by establishment (superadmin) ──
  const chartByEstablishment = ctx.isSuperadmin
    ? (establishments || []).map((est) => {
        const estStudents = students?.filter((s) => s.establishment_id === est.id) || [];
        const estStudentIds = estStudents.map((s) => s.id);
        const estSessions = allSessions?.filter((s) => estStudentIds.includes(s.student_id)) || [];
        const estScores = estSessions.flatMap((s) => {
          const comp = (s.session_competencies as CompRow[] | null)?.[0];
          return comp?.overall_score != null ? [Number(comp.overall_score)] : [];
        });
        return {
          name: est.name,
          students: estStudents.length,
          sessions: estSessions.length,
          avgScore: estScores.length > 0
            ? parseFloat((estScores.reduce((a, b) => a + b, 0) / estScores.length).toFixed(1))
            : 0,
        };
      })
    : [];

  // ── Activity heatmap (day of week x hour) ─────────────────
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  allSessions?.forEach((s) => {
    const d = new Date(s.created_at);
    heatmap[d.getDay()][d.getHours()]++;
  });

  // ── Top students ──────────────────────────────────────────
  const { data: allProgress } = await supabase
    .from("student_progress")
    .select("student_id, total_xp, sessions_completed, level_name")
    .in("student_id", safeIds)
    .order("total_xp", { ascending: false });

  const topStudents = (allProgress || []).slice(0, 5).map((p) => {
    const student = students?.find((s) => s.id === p.student_id);
    return { name: student?.full_name || student?.email || "—", xp: p.total_xp, level: p.level_name };
  });

  // Struggling students (low score, ≥3 sessions)
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

  // Unreviewed sessions
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
    .slice(0, 5)
    .map((s) => ({
      id: s.id,
      studentName: students?.find((st) => st.id === s.student_id)?.full_name || "—",
      patientName: (s.ai_patients as unknown as { name: string } | null)?.name || "—",
      date: new Date(s.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" }),
    }));

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
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPICard icon={Users} value={students?.length || 0} label="Total alumnos" color="blue" />
          <KPICard icon={MessageSquare} value={totalSessions} label="Sesiones completadas" color="green" />
          <KPICard icon={TrendingUp} value={avgScore} label="Puntaje promedio" color="purple" />
          <KPICard icon={Building2} value={activeEstablishments} label="Establecimientos activos" color="indigo" />
          <KPICard icon={GraduationCap} value={instructorCount || 0} label="Instructores activos" color="amber" />
        </div>

        {/* Charts (client component) */}
        <AdminDashboardClient
          sessionsPerDay={chartSessionsPerDay}
          weeklyScore={chartWeeklyScore}
          registrations={chartRegistrations}
          byEstablishment={chartByEstablishment}
          heatmap={heatmap}
          isSuperadmin={ctx.isSuperadmin}
        />

        {/* Tables */}
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

          {/* Pending review */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Sin revisar por docente</h3>
            {pendingSessions.length > 0 ? (
              <div className="space-y-1">
                {pendingSessions.map((s) => (
                  <Link
                    key={s.id}
                    href={`/docente/sesion/${s.id}`}
                    className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {s.studentName} &rarr; {s.patientName}
                      </p>
                      <p className="text-[10px] text-gray-400">{s.date}</p>
                    </div>
                    <ChevronRight size={12} className="text-gray-300 group-hover:text-sidebar" />
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
