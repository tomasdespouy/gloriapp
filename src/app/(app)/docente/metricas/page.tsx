import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DocenteMetricsClient from "./DocenteMetricsClient";

export default async function DocenteMetricsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch all data in parallel
  const [
    { data: competencies },
    { count: studentCount },
    { count: sessionCount },
    { data: feedbackRows },
  ] = await Promise.all([
    supabase
      .from("session_competencies")
      .select("overall_score_v2, setting_terapeutico, motivo_consulta, datos_contextuales, objetivos, escucha_activa, actitud_no_valorativa, optimismo, presencia, conducta_no_verbal, contencion_afectos, created_at, eval_version")
      .eq("eval_version", 2),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student"),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
    supabase
      .from("session_feedback")
      .select("id, teacher_comment"),
  ]);

  const rows = competencies || [];

  // ── 1. Score distribution (histogram) ──
  const scoreDistribution = [
    { range: "0-1", count: 0 },
    { range: "1-2", count: 0 },
    { range: "2-3", count: 0 },
    { range: "3-4", count: 0 },
  ];
  for (const row of rows) {
    const score = Number(row.overall_score_v2 || 0);
    if (score < 1) scoreDistribution[0].count++;
    else if (score < 2) scoreDistribution[1].count++;
    else if (score < 3) scoreDistribution[2].count++;
    else scoreDistribution[3].count++;
  }

  // ── 2. Competency averages ──
  const competencyKeys = [
    "setting_terapeutico",
    "motivo_consulta",
    "datos_contextuales",
    "objetivos",
    "escucha_activa",
    "actitud_no_valorativa",
    "optimismo",
    "presencia",
    "conducta_no_verbal",
    "contencion_afectos",
  ] as const;

  const competencyLabels: Record<string, string> = {
    setting_terapeutico: "Setting terap\u00e9utico",
    motivo_consulta: "Motivo de consulta",
    datos_contextuales: "Datos contextuales",
    objetivos: "Objetivos terap\u00e9uticos",
    escucha_activa: "Escucha activa",
    actitud_no_valorativa: "Actitud no valorativa",
    optimismo: "Optimismo terap\u00e9utico",
    presencia: "Presencia",
    conducta_no_verbal: "Conducta no verbal",
    contencion_afectos: "Contenci\u00f3n de afectos",
  };

  const competencyAverages = competencyKeys.map((key) => {
    const values = rows
      .map((r) => Number((r as Record<string, unknown>)[key] || 0))
      .filter((v) => v > 0);
    const avg = values.length > 0
      ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
      : 0;
    return { key, label: competencyLabels[key], avg };
  });

  // ── 3. Weekly progression (last 8 weeks) ──
  const now = new Date();
  const weeklyMap = new Map<string, { sum: number; count: number }>();

  // Initialize last 8 weeks
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const weekLabel = getWeekLabel(d);
    if (!weeklyMap.has(weekLabel)) {
      weeklyMap.set(weekLabel, { sum: 0, count: 0 });
    }
  }

  for (const row of rows) {
    const created = new Date(row.created_at);
    const diffMs = now.getTime() - created.getTime();
    const diffWeeks = diffMs / (7 * 24 * 60 * 60 * 1000);
    if (diffWeeks <= 8) {
      const weekLabel = getWeekLabel(created);
      const entry = weeklyMap.get(weekLabel);
      if (entry) {
        entry.sum += Number(row.overall_score_v2 || 0);
        entry.count++;
      } else {
        weeklyMap.set(weekLabel, {
          sum: Number(row.overall_score_v2 || 0),
          count: 1,
        });
      }
    }
  }

  const weeklyProgression = Array.from(weeklyMap.entries())
    .map(([week, { sum, count }]) => ({
      week,
      avg: count > 0 ? Number((sum / count).toFixed(2)) : 0,
      sessions: count,
    }))
    .slice(-8);

  // ── 4. Summary stats ──
  const allScores = rows.map((r) => Number(r.overall_score_v2 || 0));
  const avgScore = allScores.length > 0
    ? Number((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2))
    : 0;

  // Review completion rate: feedback rows with a teacher_comment / total sessions
  const reviewedCount = feedbackRows?.filter((f) => f.teacher_comment && f.teacher_comment.trim().length > 0).length || 0;
  const totalSessions = sessionCount || 0;
  const reviewCompletionRate = totalSessions > 0
    ? Number(((reviewedCount / totalSessions) * 100).toFixed(1))
    : 0;

  // Sessions this week
  const startOfWeek = new Date(now);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const sessionsThisWeek = rows.filter(
    (r) => new Date(r.created_at) >= startOfWeek
  ).length;

  return (
    <DocenteMetricsClient
      scoreDistribution={scoreDistribution}
      competencyAverages={competencyAverages}
      weeklyProgression={weeklyProgression}
      summary={{
        totalStudents: studentCount || 0,
        totalSessions,
        avgScore,
        reviewCompletionRate,
        sessionsThisWeek,
      }}
    />
  );
}

function getWeekLabel(date: Date): string {
  const d = new Date(date);
  // Get Monday of that week
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${dd}/${mm}`;
}
