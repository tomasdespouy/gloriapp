import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireSuperadmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "superadmin") return { error: "No autorizado", status: 403 };
  return { user, supabase };
}

export async function GET() {
  const auth = await requireSuperadmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await auth.supabase
    .from("research_insights")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();

  // If body.action === "generate", run auto-analysis
  if (body.action === "generate") {
    return generateInsights();
  }

  const { data, error } = await auth.supabase
    .from("research_insights")
    .insert(body)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

async function generateInsights() {
  const admin = createAdminClient();
  const insights = [];

  // 1. Competency variance analysis
  const { data: comps } = await admin
    .from("session_competencies")
    .select("setting_terapeutico, motivo_consulta, datos_contextuales, objetivos, escucha_activa, actitud_no_valorativa, optimismo, presencia, conducta_no_verbal, contencion_afectos, overall_score_v2")
    .gt("overall_score_v2", 0);

  if (comps && comps.length > 20) {
    const keys = ["setting_terapeutico", "motivo_consulta", "datos_contextuales", "objetivos", "escucha_activa", "actitud_no_valorativa", "optimismo", "presencia", "conducta_no_verbal", "contencion_afectos"];

    // Find highest and lowest competencies
    const avgs: Record<string, number> = {};
    keys.forEach(k => {
      const vals = comps.map(c => (c as Record<string, number>)[k]).filter(v => v > 0);
      avgs[k] = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    });

    const sorted = Object.entries(avgs).sort((a, b) => b[1] - a[1]);
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];

    insights.push({
      title: `Brecha de competencias: ${lowest[0].replace(/_/g, " ")} como área crítica`,
      category: "competencias",
      hypothesis: `La competencia "${lowest[0].replace(/_/g, " ")}" muestra consistentemente los puntajes más bajos (M=${lowest[1].toFixed(2)}), sugiriendo una brecha formativa que podría abordarse con intervenciones pedagógicas específicas.`,
      findings: `Análisis de ${comps.length} evaluaciones. Competencia más alta: ${highest[0].replace(/_/g, " ")} (M=${highest[1].toFixed(2)}). Competencia más baja: ${lowest[0].replace(/_/g, " ")} (M=${lowest[1].toFixed(2)}). Diferencia: ${(highest[1] - lowest[1]).toFixed(2)} puntos.`,
      data_source: "session_competencies",
      sample_size: comps.length,
      statistical_sig: "Descriptivo",
      suggested_venues: ["CLEI 2026", "EDUTEC 2026", "Educación Médica"],
      suggested_paper_type: "artículo",
    });

    // 2. Correlation: overall score vs session number
    const { data: convComp } = await admin
      .from("conversations")
      .select("session_number, session_competencies(overall_score_v2)")
      .eq("status", "completed")
      .not("session_competencies", "is", null);

    if (convComp && convComp.length > 50) {
      const bySession: Record<number, number[]> = {};
      convComp.forEach((c) => {
        const sc = c.session_competencies as unknown as { overall_score_v2: number }[];
        if (sc && sc.length > 0 && sc[0].overall_score_v2 > 0) {
          const sn = c.session_number;
          if (!bySession[sn]) bySession[sn] = [];
          bySession[sn].push(sc[0].overall_score_v2);
        }
      });

      const sessionAvgs = Object.entries(bySession).map(([sn, vals]) => ({
        session: parseInt(sn),
        avg: vals.reduce((s, v) => s + v, 0) / vals.length,
        n: vals.length,
      })).sort((a, b) => a.session - b.session);

      if (sessionAvgs.length >= 2) {
        const first = sessionAvgs[0];
        const last = sessionAvgs[sessionAvgs.length - 1];
        const improvement = last.avg - first.avg;

        insights.push({
          title: `Progresión clínica: mejora de ${improvement.toFixed(2)} puntos entre sesión ${first.session} y ${last.session}`,
          category: "tendencia",
          hypothesis: `Los estudiantes muestran una mejora progresiva en competencias clínicas a medida que acumulan sesiones con pacientes simulados, sugiriendo un efecto de práctica deliberada.`,
          findings: `Sesión ${first.session}: M=${first.avg.toFixed(2)} (n=${first.n}). Sesión ${last.session}: M=${last.avg.toFixed(2)} (n=${last.n}). Mejora: +${improvement.toFixed(2)} puntos (${((improvement / first.avg) * 100).toFixed(1)}%).`,
          data_source: "conversations + session_competencies",
          sample_size: convComp.length,
          statistical_sig: "Descriptivo, requiere prueba t pareada",
          suggested_venues: ["CR-SIP 2026", "BMC Medical Education", "RIED"],
          suggested_paper_type: "artículo",
        });
      }
    }
  }

  // 3. Platform usage patterns
  const { data: convStats } = await admin
    .from("conversations")
    .select("active_seconds, status")
    .eq("status", "completed");

  if (convStats && convStats.length > 20) {
    const durations = convStats.map(c => (c.active_seconds || 0) / 60);
    const avgDuration = durations.reduce((s, v) => s + v, 0) / durations.length;
    const totalSessions = convStats.length;

    insights.push({
      title: `Patrones de uso: ${avgDuration.toFixed(0)} minutos promedio por sesión (n=${totalSessions})`,
      category: "uso_plataforma",
      hypothesis: `La duración promedio de sesión sugiere un nivel de engagement sostenido comparable con sesiones terapéuticas reales (típicamente 45-50 minutos).`,
      findings: `${totalSessions} sesiones completadas. Duración promedio: ${avgDuration.toFixed(1)} min. La distribución indica que los estudiantes mantienen engagement durante la interacción.`,
      data_source: "conversations",
      sample_size: totalSessions,
      statistical_sig: "Descriptivo",
      suggested_venues: ["LACLO 2026", "Computers & Education: AI"],
      suggested_paper_type: "comunicación breve",
    });
  }

  // 4. Cross-institutional comparison
  const { data: estData } = await admin
    .from("establishments")
    .select("id, name, country");

  if (estData && estData.length >= 2) {
    const estResults = [];
    for (const est of estData) {
      const { data: students } = await admin
        .from("profiles")
        .select("id")
        .eq("establishment_id", est.id)
        .eq("role", "student");

      if (students && students.length > 0) {
        const sids = students.map(s => s.id);
        const { data: scores } = await admin
          .from("session_competencies")
          .select("overall_score_v2")
          .in("student_id", sids)
          .gt("overall_score_v2", 0);

        if (scores && scores.length > 0) {
          const avg = scores.reduce((s, c) => s + (c.overall_score_v2 || 0), 0) / scores.length;
          estResults.push({ name: est.name, country: est.country, avg, n: scores.length, students: students.length });
        }
      }
    }

    if (estResults.length >= 2) {
      const best = estResults.sort((a, b) => b.avg - a.avg)[0];
      const worst = estResults[estResults.length - 1];

      insights.push({
        title: `Comparación interinstitucional: diferencia de ${(best.avg - worst.avg).toFixed(2)} puntos entre ${estResults.length} universidades`,
        category: "comparación",
        hypothesis: `Las diferencias en competencias clínicas entre instituciones podrían estar asociadas a factores curriculares, metodológicos o culturales específicos de cada país.`,
        findings: `${estResults.map(e => `${e.name} (${e.country}): M=${e.avg.toFixed(2)}, n=${e.n}`).join(". ")}. Mayor puntaje: ${best.name}. Menor: ${worst.name}.`,
        data_source: "session_competencies + profiles + establishments",
        sample_size: estResults.reduce((s, e) => s + e.n, 0),
        statistical_sig: "Descriptivo, requiere ANOVA",
        suggested_venues: ["AIED 2027", "IJAIED", "Rev. Interamericana de Psicología"],
        suggested_paper_type: "artículo",
      });
    }
  }

  // 5. Teacher feedback impact
  const { data: fbData } = await admin
    .from("session_feedback")
    .select("teacher_score, ai_feedback, teacher_comment")
    .not("teacher_score", "is", null);

  if (fbData && fbData.length > 20) {
    const withComment = fbData.filter(f => f.teacher_comment);
    const withoutComment = fbData.filter(f => !f.teacher_comment);

    insights.push({
      title: `Impacto de la retroalimentación docente: ${withComment.length} sesiones con feedback directo`,
      category: "causalidad",
      hypothesis: `La retroalimentación docente personalizada podría potenciar el efecto de la práctica simulada, generando mayor mejora en sesiones posteriores.`,
      findings: `${fbData.length} sesiones evaluadas por docentes. ${withComment.length} con comentarios escritos (${((withComment.length / fbData.length) * 100).toFixed(0)}%). ${withoutComment.length} solo con puntuación numérica.`,
      data_source: "session_feedback",
      sample_size: fbData.length,
      statistical_sig: "Descriptivo, requiere diseño cuasi-experimental",
      suggested_venues: ["EDUTEC 2026", "Educación Médica", "BMC Medical Education"],
      suggested_paper_type: "artículo",
    });
  }

  // Insert all insights
  if (insights.length > 0) {
    const { data, error } = await admin
      .from("research_insights")
      .insert(insights)
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  return NextResponse.json([], { status: 200 });
}
