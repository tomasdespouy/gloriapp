import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin-helpers";
import MetricsClient from "./MetricsClient";
import MetricsTabs from "./MetricsTabs";

export default async function MetricasPage() {
  const ctx = await getAdminContext();
  const supabase = await createClient();

  // Fetch establishments
  const { data: establishments } = ctx.isSuperadmin
    ? await supabase.from("establishments").select("id, name").order("name")
    : await supabase
        .from("establishments")
        .select("id, name")
        .in("id", ctx.establishmentIds.length > 0 ? ctx.establishmentIds : ["00000000-0000-0000-0000-000000000000"])
        .order("name");

  // All students scoped
  const studentsQuery = supabase
    .from("profiles")
    .select("id, full_name, email, establishment_id")
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

  // All completed sessions with competencies
  const { data: sessions } = await supabase
    .from("conversations")
    .select(`
      id, student_id, created_at,
      session_competencies(
        empathy, active_listening, open_questions, reformulation,
        confrontation, silence_management, rapport, overall_score
      )
    `)
    .eq("status", "completed")
    .in("student_id", safeIds);

  const COMPETENCIES = [
    "empathy",
    "active_listening",
    "open_questions",
    "reformulation",
    "confrontation",
    "silence_management",
    "rapport",
  ] as const;

  const COMPETENCY_LABELS: Record<string, string> = {
    empathy: "Empatia",
    active_listening: "Escucha activa",
    open_questions: "Preguntas abiertas",
    reformulation: "Reformulacion",
    confrontation: "Confrontacion",
    silence_management: "Manejo del silencio",
    rapport: "Rapport",
  };

  // ── Competency heatmap: students x competencies ───────
  type CompRow = Record<string, number>;
  const heatmapData = (students || []).map((student) => {
    const studentSessions = sessions?.filter((s) => s.student_id === student.id) || [];
    const avgCompetencies: Record<string, number> = {};

    COMPETENCIES.forEach((comp) => {
      const values = studentSessions.flatMap((s) => {
        const sc = (s.session_competencies as CompRow[] | null)?.[0];
        return sc?.[comp] != null ? [Number(sc[comp])] : [];
      });
      avgCompetencies[comp] = values.length > 0
        ? parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1))
        : 0;
    });

    return {
      name: student.full_name || student.email || "—",
      id: student.id,
      establishmentId: student.establishment_id,
      ...avgCompetencies,
    };
  }).filter((row) => {
    // Only include students with at least one session
    return Object.values(row).some((v) => typeof v === "number" && v > 0);
  });

  // ── Score distribution (histogram) ────────────────────
  const scoreBuckets = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // 0-1, 1-2, ..., 9-10
  sessions?.forEach((s) => {
    const comp = (s.session_competencies as CompRow[] | null)?.[0];
    if (comp?.overall_score != null) {
      const idx = Math.min(Math.floor(Number(comp.overall_score)), 9);
      scoreBuckets[idx]++;
    }
  });
  const scoreDistribution = scoreBuckets.map((count, i) => ({
    range: `${i}-${i + 1}`,
    count,
  }));

  // ── By establishment comparison ───────────────────────
  const byEstablishment = (establishments || []).map((est) => {
    const estStudentIds = students?.filter((s) => s.establishment_id === est.id).map((s) => s.id) || [];
    const estSessions = sessions?.filter((s) => estStudentIds.includes(s.student_id)) || [];
    const estScores = estSessions.flatMap((s) => {
      const comp = (s.session_competencies as CompRow[] | null)?.[0];
      return comp?.overall_score != null ? [Number(comp.overall_score)] : [];
    });
    return {
      name: est.name,
      id: est.id,
      sessions: estSessions.length,
      avgScore: estScores.length > 0
        ? parseFloat((estScores.reduce((a, b) => a + b, 0) / estScores.length).toFixed(1))
        : 0,
    };
  });

  // ── Time trend (weekly, last 12 weeks) ────────────────
  const weeklyData: Record<number, number[]> = {};
  sessions?.forEach((s) => {
    const comp = (s.session_competencies as CompRow[] | null)?.[0];
    if (comp?.overall_score == null) return;
    const weeksAgo = Math.floor((Date.now() - new Date(s.created_at).getTime()) / (7 * 86400000));
    if (weeksAgo < 12) {
      if (!weeklyData[weeksAgo]) weeklyData[weeksAgo] = [];
      weeklyData[weeksAgo].push(Number(comp.overall_score));
    }
  });
  const timeTrend = Array.from({ length: 12 }, (_, i) => {
    const scores = weeklyData[11 - i] || [];
    return {
      week: `S-${12 - i}`,
      score: scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0,
      sessions: scores.length,
    };
  });

  return (
    <div className="min-h-screen">
      <header className="px-4 sm:px-8 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Métricas</h1>
        <p className="text-sm text-gray-500 mt-0.5">Monitoreo en vivo y análisis histórico</p>
      </header>

      <MetricsTabs>
        <MetricsClient
          competencies={COMPETENCIES.map((c) => ({ key: c, label: COMPETENCY_LABELS[c] }))}
          heatmapData={heatmapData}
          scoreDistribution={scoreDistribution}
          byEstablishment={byEstablishment}
          timeTrend={timeTrend}
          establishments={establishments || []}
          isSuperadmin={ctx.isSuperadmin}
        />
      </MetricsTabs>
    </div>
  );
}
