import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OpenAI from "openai";

export const maxDuration = 120;

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

type InsightDraft = {
  title: string;
  category: string;
  hypothesis: string;
  findings: string;
  data_source: string;
  sample_size: number;
  statistical_sig: string;
  suggested_venues: string[];
  suggested_paper_type: string;
  reference_title?: string;
  reference_authors?: string;
  reference_year?: number;
  reference_url?: string;
};

function getPerplexity() {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key, baseURL: "https://api.perplexity.ai" });
}

function escapeJsonControlChars(raw: string): string {
  let out = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (esc) { out += ch; esc = false; continue; }
    if (ch === "\\" && inStr) { out += ch; esc = true; continue; }
    if (ch === '"') { inStr = !inStr; out += ch; continue; }
    if (inStr) {
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
    }
    out += ch;
  }
  return out;
}

const COMP_KEYS = ["setting_terapeutico", "motivo_consulta", "datos_contextuales", "objetivos", "escucha_activa", "actitud_no_valorativa", "optimismo", "presencia", "conducta_no_verbal", "contencion_afectos"] as const;

const COMP_LABELS: Record<string, string> = {
  setting_terapeutico: "setting terapéutico",
  motivo_consulta: "motivo de consulta",
  datos_contextuales: "datos contextuales",
  objetivos: "objetivos terapéuticos",
  escucha_activa: "escucha activa",
  actitud_no_valorativa: "actitud no valorativa",
  optimismo: "optimismo terapéutico",
  presencia: "presencia terapéutica",
  conducta_no_verbal: "conducta no verbal",
  contencion_afectos: "contención de afectos",
};

function label(key: string) {
  return COMP_LABELS[key] || key.replace(/_/g, " ");
}

function stddev(vals: number[], mean: number): number {
  if (vals.length < 2) return 0;
  return Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1));
}

async function generateInsights() {
  const admin = createAdminClient();
  const insights: InsightDraft[] = [];

  // ── Delete previous auto-generated insights to avoid duplicates ──
  await admin
    .from("research_insights")
    .delete()
    .eq("status", "nuevo");

  // ══════════════════════════════════════════════════════════════════
  // FETCH ALL DATA UPFRONT
  // ══════════════════════════════════════════════════════════════════

  const [
    { data: comps },
    { data: convAll },
    { data: convCompleted },
    { data: estData },
    { data: fbData },
    { data: patients },
  ] = await Promise.all([
    admin.from("session_competencies")
      .select("student_id, conversation_id, setting_terapeutico, motivo_consulta, datos_contextuales, objetivos, escucha_activa, actitud_no_valorativa, optimismo, presencia, conducta_no_verbal, contencion_afectos, overall_score_v2, created_at")
      .gt("overall_score_v2", 0),
    admin.from("conversations")
      .select("id, student_id, ai_patient_id, session_number, status, active_seconds, started_at, created_at")
      .eq("status", "completed"),
    admin.from("conversations")
      .select("id, student_id, active_seconds, status, session_number, created_at, session_competencies(overall_score_v2)")
      .eq("status", "completed")
      .not("session_competencies", "is", null),
    admin.from("establishments")
      .select("id, name, country"),
    admin.from("session_feedback")
      .select("conversation_id, teacher_score, ai_feedback, teacher_comment")
      .not("teacher_score", "is", null),
    admin.from("ai_patients")
      .select("id, name, difficulty_level")
      .eq("is_active", true),
  ]);

  // Precompute competency averages
  const compAvgs: Record<string, number> = {};
  if (comps && comps.length > 20) {
    COMP_KEYS.forEach(k => {
      const vals = comps.map(c => (c as Record<string, number>)[k]).filter(v => v > 0);
      compAvgs[k] = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    });
  }
  const compSorted = Object.entries(compAvgs).sort((a, b) => b[1] - a[1]);

  // ══════════════════════════════════════════════════════════════════
  // 1. COMPETENCY GAP ANALYSIS (highest vs lowest)
  // ══════════════════════════════════════════════════════════════════
  if (comps && comps.length > 20 && compSorted.length >= 2) {
    const highest = compSorted[0];
    const lowest = compSorted[compSorted.length - 1];

    insights.push({
      title: `Brecha de competencias: ${label(lowest[0])} como área crítica`,
      category: "competencias",
      hypothesis: `La competencia "${label(lowest[0])}" muestra consistentemente los puntajes más bajos (M=${lowest[1].toFixed(2)}), sugiriendo una brecha formativa que podría abordarse con intervenciones pedagógicas específicas.`,
      findings: `Análisis de ${comps.length} evaluaciones. Competencia más alta: ${label(highest[0])} (M=${highest[1].toFixed(2)}). Competencia más baja: ${label(lowest[0])} (M=${lowest[1].toFixed(2)}). Diferencia: ${(highest[1] - lowest[1]).toFixed(2)} puntos.`,
      data_source: "session_competencies",
      sample_size: comps.length,
      statistical_sig: "Descriptivo",
      suggested_venues: ["CLEI 2026", "EDUTEC 2026", "Educación Médica"],
      suggested_paper_type: "artículo",
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // 2. STRUCTURAL vs ATTITUDINAL COMPETENCIES
  // ══════════════════════════════════════════════════════════════════
  if (comps && comps.length > 20) {
    const structural = ["setting_terapeutico", "motivo_consulta", "datos_contextuales", "objetivos"];
    const attitudinal = ["escucha_activa", "actitud_no_valorativa", "optimismo", "presencia", "conducta_no_verbal", "contencion_afectos"];

    const structAvg = structural.reduce((s, k) => s + (compAvgs[k] || 0), 0) / structural.length;
    const attAvg = attitudinal.reduce((s, k) => s + (compAvgs[k] || 0), 0) / attitudinal.length;
    const diff = Math.abs(structAvg - attAvg);
    const higher = structAvg > attAvg ? "estructurales" : "actitudinales";
    const lower = structAvg > attAvg ? "actitudinales" : "estructurales";

    insights.push({
      title: `Dominio ${higher} supera al ${lower} por ${diff.toFixed(2)} puntos`,
      category: "competencias",
      hypothesis: `Las competencias ${higher} (${structAvg > attAvg ? "estructura de sesión" : "actitudes terapéuticas"}) obtienen puntajes sistemáticamente superiores, lo que sugiere que el currículo actual enfatiza más los aspectos ${higher === "estructurales" ? "procedimentales" : "relacionales"} de la entrevista clínica.`,
      findings: `Dominio estructural (4 competencias): M=${structAvg.toFixed(2)}. Dominio actitudinal (6 competencias): M=${attAvg.toFixed(2)}. Diferencia: ${diff.toFixed(2)} puntos (n=${comps.length}).`,
      data_source: "session_competencies",
      sample_size: comps.length,
      statistical_sig: "Descriptivo, requiere prueba t para muestras independientes",
      suggested_venues: ["Educación Médica", "Rev. Latinoamericana de Psicología"],
      suggested_paper_type: "artículo",
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // 3. CLINICAL PROGRESSION (score vs session number)
  // ══════════════════════════════════════════════════════════════════
  if (convCompleted && convCompleted.length > 50) {
    const bySession: Record<number, number[]> = {};
    convCompleted.forEach((c) => {
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
        title: `Progresión clínica: ${improvement >= 0 ? "mejora" : "descenso"} de ${Math.abs(improvement).toFixed(2)} puntos entre sesión ${first.session} y ${last.session}`,
        category: "tendencia",
        hypothesis: `Los estudiantes muestran una ${improvement >= 0 ? "mejora progresiva" : "tendencia descendente"} en competencias clínicas a medida que acumulan sesiones con pacientes simulados, ${improvement >= 0 ? "sugiriendo un efecto de práctica deliberada" : "lo que podría indicar fatiga, aumento de dificultad o necesidad de intervención pedagógica"}.`,
        findings: `Sesión ${first.session}: M=${first.avg.toFixed(2)} (n=${first.n}). Sesión ${last.session}: M=${last.avg.toFixed(2)} (n=${last.n}). ${improvement >= 0 ? "Mejora" : "Cambio"}: ${improvement >= 0 ? "+" : ""}${improvement.toFixed(2)} puntos (${((improvement / first.avg) * 100).toFixed(1)}%).`,
        data_source: "conversations + session_competencies",
        sample_size: convCompleted.length,
        statistical_sig: "Descriptivo, requiere prueba t pareada",
        suggested_venues: ["CR-SIP 2026", "BMC Medical Education", "RIED"],
        suggested_paper_type: "artículo",
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 4. PLATFORM USAGE PATTERNS
  // ══════════════════════════════════════════════════════════════════
  if (convAll && convAll.length > 20) {
    const durations = convAll.map(c => (c.active_seconds || 0) / 60).filter(d => d > 0);
    if (durations.length > 10) {
      const avgDuration = durations.reduce((s, v) => s + v, 0) / durations.length;
      const sd = stddev(durations, avgDuration);
      const median = [...durations].sort((a, b) => a - b)[Math.floor(durations.length / 2)];

      insights.push({
        title: `Patrones de uso: ${avgDuration.toFixed(0)} min promedio por sesión (n=${convAll.length})`,
        category: "uso_plataforma",
        hypothesis: `La duración promedio de sesión sugiere un nivel de engagement sostenido comparable con sesiones terapéuticas reales (típicamente 45-50 minutos).`,
        findings: `${convAll.length} sesiones completadas. Duración promedio: ${avgDuration.toFixed(1)} min (DE=${sd.toFixed(1)}). Mediana: ${median.toFixed(1)} min. Rango: ${Math.min(...durations).toFixed(0)}-${Math.max(...durations).toFixed(0)} min.`,
        data_source: "conversations",
        sample_size: convAll.length,
        statistical_sig: "Descriptivo",
        suggested_venues: ["LACLO 2026", "Computers & Education: AI"],
        suggested_paper_type: "comunicación breve",
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 5. CROSS-INSTITUTIONAL COMPARISON
  // ══════════════════════════════════════════════════════════════════
  if (estData && estData.length >= 2 && comps && comps.length > 0) {
    const estResults: { name: string; country: string; avg: number; n: number; students: number }[] = [];
    for (const est of estData) {
      const { data: students } = await admin
        .from("profiles")
        .select("id")
        .eq("establishment_id", est.id)
        .eq("role", "student");

      if (students && students.length > 0) {
        const sids = new Set(students.map(s => s.id));
        const estComps = comps.filter(c => sids.has(c.student_id));

        if (estComps.length > 0) {
          const avg = estComps.reduce((s, c) => s + (c.overall_score_v2 as number || 0), 0) / estComps.length;
          estResults.push({ name: est.name, country: est.country || "", avg, n: estComps.length, students: students.length });
        }
      }
    }

    if (estResults.length >= 2) {
      estResults.sort((a, b) => b.avg - a.avg);
      const best = estResults[0];
      const worst = estResults[estResults.length - 1];

      insights.push({
        title: `Comparación interinstitucional: diferencia de ${(best.avg - worst.avg).toFixed(2)} puntos entre ${estResults.length} universidades`,
        category: "comparación",
        hypothesis: `Las diferencias en competencias clínicas entre instituciones podrían estar asociadas a factores curriculares, metodológicos o culturales específicos de cada programa formativo.`,
        findings: `${estResults.map(e => `${e.name} (${e.country}): M=${e.avg.toFixed(2)}, n=${e.n}, ${e.students} estudiantes`).join(". ")}. Mayor puntaje: ${best.name}. Menor: ${worst.name}.`,
        data_source: "session_competencies + profiles + establishments",
        sample_size: estResults.reduce((s, e) => s + e.n, 0),
        statistical_sig: "Descriptivo, requiere ANOVA",
        suggested_venues: ["AIED 2027", "IJAIED", "Rev. Interamericana de Psicología"],
        suggested_paper_type: "artículo",
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 6. TEACHER FEEDBACK IMPACT
  // ══════════════════════════════════════════════════════════════════
  if (fbData && fbData.length > 20) {
    const withComment = fbData.filter(f => f.teacher_comment);
    const withoutComment = fbData.filter(f => !f.teacher_comment);
    const scores = fbData.map(f => f.teacher_score as number).filter(s => s > 0);
    const avgScore = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;

    insights.push({
      title: `Impacto de la retroalimentación docente: ${withComment.length} sesiones con feedback directo`,
      category: "causalidad",
      hypothesis: `La retroalimentación docente personalizada podría potenciar el efecto de la práctica simulada, generando mayor mejora en sesiones posteriores.`,
      findings: `${fbData.length} sesiones evaluadas por docentes (puntuación promedio: ${avgScore.toFixed(2)}). ${withComment.length} con comentarios escritos (${((withComment.length / fbData.length) * 100).toFixed(0)}%). ${withoutComment.length} solo con puntuación numérica.`,
      data_source: "session_feedback",
      sample_size: fbData.length,
      statistical_sig: "Descriptivo, requiere diseño cuasi-experimental",
      suggested_venues: ["EDUTEC 2026", "Educación Médica", "BMC Medical Education"],
      suggested_paper_type: "artículo",
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // 7. PER-PATIENT DIFFICULTY ANALYSIS
  // ══════════════════════════════════════════════════════════════════
  if (convAll && comps && patients && patients.length > 1) {
    const patientMap = new Map(patients.map(p => [p.id, p]));
    const scoresByPatient: Record<string, { name: string; difficulty: string; scores: number[] }> = {};

    for (const conv of convAll) {
      const sc = comps.find(c => c.conversation_id === conv.id);
      if (sc && sc.overall_score_v2 > 0) {
        const patient = patientMap.get(conv.ai_patient_id);
        if (patient) {
          if (!scoresByPatient[conv.ai_patient_id]) {
            scoresByPatient[conv.ai_patient_id] = { name: patient.name, difficulty: patient.difficulty_level, scores: [] };
          }
          scoresByPatient[conv.ai_patient_id].scores.push(sc.overall_score_v2 as number);
        }
      }
    }

    const patientResults = Object.entries(scoresByPatient)
      .filter(([, v]) => v.scores.length >= 3)
      .map(([id, v]) => ({
        id,
        name: v.name,
        difficulty: v.difficulty,
        avg: v.scores.reduce((s, x) => s + x, 0) / v.scores.length,
        n: v.scores.length,
      }))
      .sort((a, b) => a.avg - b.avg);

    if (patientResults.length >= 2) {
      const hardest = patientResults[0];
      const easiest = patientResults[patientResults.length - 1];

      insights.push({
        title: `Dificultad por paciente: ${hardest.name} es el caso más desafiante (M=${hardest.avg.toFixed(2)})`,
        category: "comparación",
        hypothesis: `Los pacientes simulados presentan niveles de dificultad real que difieren de su clasificación nominal. "${hardest.name}" (${hardest.difficulty}) genera los puntajes más bajos, lo que podría asociarse a la complejidad de su perfil clínico o a brechas específicas del currículo.`,
        findings: `Paciente más difícil: ${hardest.name} (M=${hardest.avg.toFixed(2)}, n=${hardest.n}). Paciente más accesible: ${easiest.name} (M=${easiest.avg.toFixed(2)}, n=${easiest.n}). Diferencia: ${(easiest.avg - hardest.avg).toFixed(2)} puntos entre ${patientResults.length} pacientes analizados.`,
        data_source: "conversations + session_competencies + ai_patients",
        sample_size: patientResults.reduce((s, p) => s + p.n, 0),
        statistical_sig: "Descriptivo, requiere ANOVA de un factor",
        suggested_venues: ["Simulation in Healthcare", "CLEI 2026", "Medical Teacher"],
        suggested_paper_type: "artículo",
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 8. SESSION DURATION vs SCORE CORRELATION
  // ══════════════════════════════════════════════════════════════════
  if (convAll && comps && convAll.length > 30) {
    const pairs: { duration: number; score: number }[] = [];
    for (const conv of convAll) {
      if (conv.active_seconds && conv.active_seconds > 0) {
        const sc = comps.find(c => c.conversation_id === conv.id);
        if (sc && sc.overall_score_v2 > 0) {
          pairs.push({ duration: conv.active_seconds / 60, score: sc.overall_score_v2 as number });
        }
      }
    }

    if (pairs.length >= 20) {
      const avgDur = pairs.reduce((s, p) => s + p.duration, 0) / pairs.length;
      const avgScore = pairs.reduce((s, p) => s + p.score, 0) / pairs.length;

      // Pearson correlation
      const num = pairs.reduce((s, p) => s + (p.duration - avgDur) * (p.score - avgScore), 0);
      const den1 = Math.sqrt(pairs.reduce((s, p) => s + (p.duration - avgDur) ** 2, 0));
      const den2 = Math.sqrt(pairs.reduce((s, p) => s + (p.score - avgScore) ** 2, 0));
      const r = den1 > 0 && den2 > 0 ? num / (den1 * den2) : 0;

      const direction = r > 0.1 ? "positiva" : r < -0.1 ? "negativa" : "débil/nula";

      insights.push({
        title: `Duración y desempeño: correlación ${direction} (r=${r.toFixed(3)}, n=${pairs.length})`,
        category: "correlación",
        hypothesis: `La relación entre duración de sesión y puntaje de competencias es ${direction}, ${r > 0.1 ? "sugiriendo que sesiones más largas se asocian a mayor profundidad clínica" : r < -0.1 ? "lo que podría indicar que sesiones extensas reflejan dificultad en lugar de profundidad" : "indicando que el tiempo dedicado no predice linealmente el desempeño"}.`,
        findings: `Correlación de Pearson: r=${r.toFixed(3)} (n=${pairs.length}). Duración promedio: ${avgDur.toFixed(1)} min. Puntaje promedio: ${avgScore.toFixed(2)}/4.0.`,
        data_source: "conversations + session_competencies",
        sample_size: pairs.length,
        statistical_sig: `r=${r.toFixed(3)}, requiere test de significancia (p-value)`,
        suggested_venues: ["Computers & Education: AI", "LACLO 2026", "BMC Medical Education"],
        suggested_paper_type: "artículo",
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 9. STUDENT CONSISTENCY (within-student score variance)
  // ══════════════════════════════════════════════════════════════════
  if (comps && comps.length > 30) {
    const byStudent: Record<string, number[]> = {};
    comps.forEach(c => {
      const sid = c.student_id as string;
      if (!byStudent[sid]) byStudent[sid] = [];
      byStudent[sid].push(c.overall_score_v2 as number);
    });

    const multiSession = Object.entries(byStudent).filter(([, v]) => v.length >= 3);
    if (multiSession.length >= 5) {
      const variances = multiSession.map(([, vals]) => {
        const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
        return { mean, sd: stddev(vals, mean), n: vals.length };
      });

      const avgSD = variances.reduce((s, v) => s + v.sd, 0) / variances.length;
      const highVar = variances.filter(v => v.sd > avgSD * 1.5).length;
      const lowVar = variances.filter(v => v.sd < avgSD * 0.5).length;

      insights.push({
        title: `Consistencia estudiantil: DE intra-sujeto promedio de ${avgSD.toFixed(2)} puntos`,
        category: "varianza",
        hypothesis: `La variabilidad intra-sujeto revela patrones de aprendizaje diferenciados. Estudiantes con alta varianza (${highVar}) podrían beneficiarse de mayor andamiaje, mientras que los consistentes (${lowVar}) podrían estar en plateau.`,
        findings: `${multiSession.length} estudiantes con 3+ sesiones. DE promedio intra-sujeto: ${avgSD.toFixed(2)}. Alta varianza (>1.5x promedio): ${highVar} estudiantes. Baja varianza (<0.5x promedio): ${lowVar} estudiantes.`,
        data_source: "session_competencies",
        sample_size: multiSession.reduce((s, [, v]) => s + v.length, 0),
        statistical_sig: "Descriptivo, requiere análisis multinivel (HLM)",
        suggested_venues: ["AIED 2027", "Learning Analytics & Knowledge", "RIED"],
        suggested_paper_type: "artículo",
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 10. FIRST SESSION EFFECT
  // ══════════════════════════════════════════════════════════════════
  if (convCompleted && convCompleted.length > 30) {
    const firstScores: number[] = [];
    const laterScores: number[] = [];

    convCompleted.forEach(c => {
      const sc = c.session_competencies as unknown as { overall_score_v2: number }[];
      if (sc && sc.length > 0 && sc[0].overall_score_v2 > 0) {
        if (c.session_number === 1) firstScores.push(sc[0].overall_score_v2);
        else laterScores.push(sc[0].overall_score_v2);
      }
    });

    if (firstScores.length >= 10 && laterScores.length >= 10) {
      const avgFirst = firstScores.reduce((s, v) => s + v, 0) / firstScores.length;
      const avgLater = laterScores.reduce((s, v) => s + v, 0) / laterScores.length;
      const diff = avgLater - avgFirst;

      insights.push({
        title: `Efecto primera sesión: ${diff >= 0 ? "+" : ""}${diff.toFixed(2)} puntos de mejora en sesiones posteriores`,
        category: "tendencia",
        hypothesis: `La primera sesión con un paciente simulado actúa como línea base. La diferencia de ${Math.abs(diff).toFixed(2)} puntos con sesiones posteriores ${diff >= 0 ? "evidencia un efecto de aprendizaje significativo tras la exposición inicial" : "sugiere que factores como dificultad creciente compensan la ganancia por experiencia"}.`,
        findings: `Primera sesión: M=${avgFirst.toFixed(2)} (n=${firstScores.length}). Sesiones 2+: M=${avgLater.toFixed(2)} (n=${laterScores.length}). Diferencia: ${diff >= 0 ? "+" : ""}${diff.toFixed(2)} puntos (${((diff / avgFirst) * 100).toFixed(1)}%).`,
        data_source: "conversations + session_competencies",
        sample_size: firstScores.length + laterScores.length,
        statistical_sig: "Descriptivo, requiere prueba t para muestras independientes",
        suggested_venues: ["Simulation in Healthcare", "Medical Teacher", "CLEI 2026"],
        suggested_paper_type: "comunicación breve",
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 11. COMPETENCY CORRELATION PAIRS
  // ══════════════════════════════════════════════════════════════════
  if (comps && comps.length > 30) {
    let bestR = 0;
    let bestPair: [string, string] = ["", ""];
    let worstR = 1;
    let worstPair: [string, string] = ["", ""];

    for (let i = 0; i < COMP_KEYS.length; i++) {
      for (let j = i + 1; j < COMP_KEYS.length; j++) {
        const pairs = comps
          .map(c => ({ a: (c as Record<string, number>)[COMP_KEYS[i]], b: (c as Record<string, number>)[COMP_KEYS[j]] }))
          .filter(p => p.a > 0 && p.b > 0);

        if (pairs.length < 20) continue;

        const avgA = pairs.reduce((s, p) => s + p.a, 0) / pairs.length;
        const avgB = pairs.reduce((s, p) => s + p.b, 0) / pairs.length;
        const num = pairs.reduce((s, p) => s + (p.a - avgA) * (p.b - avgB), 0);
        const d1 = Math.sqrt(pairs.reduce((s, p) => s + (p.a - avgA) ** 2, 0));
        const d2 = Math.sqrt(pairs.reduce((s, p) => s + (p.b - avgB) ** 2, 0));
        const r = d1 > 0 && d2 > 0 ? num / (d1 * d2) : 0;

        if (r > bestR) { bestR = r; bestPair = [COMP_KEYS[i], COMP_KEYS[j]]; }
        if (r < worstR) { worstR = r; worstPair = [COMP_KEYS[i], COMP_KEYS[j]]; }
      }
    }

    if (bestPair[0] && worstPair[0]) {
      insights.push({
        title: `Clúster de competencias: ${label(bestPair[0])} y ${label(bestPair[1])} se correlacionan fuertemente (r=${bestR.toFixed(2)})`,
        category: "correlación",
        hypothesis: `Las competencias "${label(bestPair[0])}" y "${label(bestPair[1])}" muestran la correlación más alta (r=${bestR.toFixed(2)}), sugiriendo que comparten procesos cognitivos subyacentes o se desarrollan conjuntamente. En contraste, "${label(worstPair[0])}" y "${label(worstPair[1])}" son las más independientes (r=${worstR.toFixed(2)}).`,
        findings: `Par más correlacionado: ${label(bestPair[0])} - ${label(bestPair[1])} (r=${bestR.toFixed(2)}). Par menos correlacionado: ${label(worstPair[0])} - ${label(worstPair[1])} (r=${worstR.toFixed(2)}). Análisis de 45 pares de competencias.`,
        data_source: "session_competencies",
        sample_size: comps.length,
        statistical_sig: "Correlación de Pearson, requiere análisis factorial confirmatorio",
        suggested_venues: ["AIED 2027", "Rev. Latinoamericana de Psicología", "Learning Analytics & Knowledge"],
        suggested_paper_type: "artículo",
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 12. TEMPORAL ENGAGEMENT PATTERNS (day of week)
  // ══════════════════════════════════════════════════════════════════
  if (convAll && convAll.length > 50) {
    const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const byDay: Record<number, number> = {};
    convAll.forEach(c => {
      const d = new Date(c.created_at).getDay();
      byDay[d] = (byDay[d] || 0) + 1;
    });

    const dayEntries = Object.entries(byDay).map(([d, n]) => ({ day: parseInt(d), name: dayNames[parseInt(d)], n })).sort((a, b) => b.n - a.n);

    if (dayEntries.length >= 3) {
      const peakDay = dayEntries[0];
      const lowDay = dayEntries[dayEntries.length - 1];
      const weekdaySessions = dayEntries.filter(d => d.day >= 1 && d.day <= 5).reduce((s, d) => s + d.n, 0);
      const weekendSessions = dayEntries.filter(d => d.day === 0 || d.day === 6).reduce((s, d) => s + d.n, 0);

      insights.push({
        title: `Patrones temporales: ${peakDay.name} es el día con más sesiones (${peakDay.n})`,
        category: "uso_plataforma",
        hypothesis: `La distribución temporal del uso revela que los estudiantes prefieren practicar los ${peakDay.name}, con ${((weekendSessions / (weekdaySessions + weekendSessions)) * 100).toFixed(0)}% de sesiones en fin de semana. Esto tiene implicancias para la disponibilidad de soporte docente y la planificación de intervenciones.`,
        findings: `Día peak: ${peakDay.name} (${peakDay.n} sesiones). Día mínimo: ${lowDay.name} (${lowDay.n} sesiones). Semana: ${weekdaySessions} sesiones (${((weekdaySessions / convAll.length) * 100).toFixed(0)}%). Fin de semana: ${weekendSessions} sesiones (${((weekendSessions / convAll.length) * 100).toFixed(0)}%).`,
        data_source: "conversations",
        sample_size: convAll.length,
        statistical_sig: "Descriptivo, chi-cuadrado de bondad de ajuste",
        suggested_venues: ["LACLO 2026", "Computers & Education: AI", "RIED"],
        suggested_paper_type: "comunicación breve",
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 13. SYSTEMATIC REVIEW OPPORTUNITY
  // ══════════════════════════════════════════════════════════════════
  {
    const totalStudents = comps ? new Set(comps.map(c => c.student_id)).size : 0;
    const totalPatients = patients?.length || 0;
    const totalSessions = convAll?.length || 0;
    const totalEvals = comps?.length || 0;

    insights.push({
      title: "Oportunidad: revisión sistemática sobre IA en formación de competencias terapéuticas",
      category: "revisión_sistemática",
      hypothesis: `Existe una brecha en la literatura sobre el uso de LLMs como pacientes simulados para el entrenamiento de competencias psicoterapéuticas. Una revisión sistemática que mapee las plataformas existentes, sus marcos de evaluación y resultados de aprendizaje posicionaría a GlorIA como referente en el campo.`,
      findings: `GlorIA cuenta con datos de ${totalStudents} estudiantes, ${totalPatients} pacientes simulados, ${totalSessions} sesiones y ${totalEvals} evaluaciones de competencias. Este volumen de datos permite no solo una revisión teórica sino una contribución empírica sustantiva al campo.`,
      data_source: "plataforma completa",
      sample_size: totalEvals,
      statistical_sig: "Revisión sistemática (PRISMA 2020)",
      suggested_venues: ["Computers & Education", "JMIR Medical Education", "BMC Medical Education", "Frontiers in Psychology"],
      suggested_paper_type: "artículo",
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // 14. PRODUCT DEVELOPMENT & EVOLUTION PAPER
  // ══════════════════════════════════════════════════════════════════
  {
    const totalPatients = patients?.length || 0;
    const totalSessions = convAll?.length || 0;
    const nEstablishments = estData?.length || 0;
    const countries = estData ? [...new Set(estData.map(e => e.country).filter(Boolean))].length : 0;

    insights.push({
      title: "Paper de diseño: arquitectura y evolución de GlorIA como plataforma de simulación clínica con IA",
      category: "desarrollo_producto",
      hypothesis: `Un artículo de diseño y desarrollo (design-based research) que documente la arquitectura técnica de GlorIA — motor de estado adaptativo, MCP, RAG clínico, evaluación por competencias, y la estrategia dual de modelos — contribuiría al campo emergente de simulación clínica con LLMs, especialmente desde una perspectiva latinoamericana.`,
      findings: `GlorIA integra: motor adaptativo (5 variables, 14 reglas), memoria inter-sesión (MCP), RAG semántico con pgvector, clasificador NLP de 11 intervenciones terapéuticas, evaluación en 10 competencias (Valdés & Gómez, 2023), ${totalPatients} pacientes con diversidad cultural, desplegado en ${nEstablishments} instituciones de ${countries} países, con ${totalSessions} sesiones completadas.`,
      data_source: "arquitectura técnica + métricas de plataforma",
      sample_size: totalSessions,
      statistical_sig: "Design-Based Research (DBR)",
      suggested_venues: ["LAK 2027", "AIED 2027", "Simulation in Healthcare", "JMIR Formative Research"],
      suggested_paper_type: "artículo",
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // 15. METHODOLOGY: COMPETENCY EVALUATION FRAMEWORK
  // ══════════════════════════════════════════════════════════════════
  if (comps && comps.length > 50) {
    const evalVersions = comps.length;
    const uniqueStudents = new Set(comps.map(c => c.student_id)).size;

    insights.push({
      title: "Paper metodológico: validación del marco de evaluación por competencias con IA",
      category: "metodología",
      hypothesis: `El marco de evaluación automatizada de 10 competencias psicoterapéuticas implementado en GlorIA (basado en Valdés & Gómez, 2023) requiere validación empírica. Un estudio que compare evaluaciones de IA vs. docentes usando el mismo marco permitiría establecer la confiabilidad inter-evaluador y la validez concurrente del sistema.`,
      findings: `${evalVersions} evaluaciones automatizadas realizadas a ${uniqueStudents} estudiantes. El sistema evalúa 10 competencias en escala 0-4: 4 estructurales (setting, motivo, datos contextuales, objetivos) y 6 actitudinales (escucha activa, actitud no valorativa, optimismo, presencia, conducta no verbal, contención de afectos).`,
      data_source: "session_competencies + session_feedback",
      sample_size: evalVersions,
      statistical_sig: "Requiere ICC (Coeficiente de Correlación Intraclase) y Bland-Altman",
      suggested_venues: ["Medical Teacher", "Assessment & Evaluation in Higher Education", "CLEI 2026"],
      suggested_paper_type: "artículo",
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // ENRICH WITH PERPLEXITY: find similar published papers
  // ══════════════════════════════════════════════════════════════════
  const pplx = getPerplexity();
  if (pplx && insights.length > 0) {
    try {
      const insightList = insights.map((ins, i) =>
        `${i + 1}. [${ins.category}] ${ins.title}`
      ).join("\n");

      const response = await pplx.chat.completions.create({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: `Eres un investigador académico experto en simulación clínica, IA en educación y formación terapéutica. Responde ÚNICAMENTE con un JSON array válido. Sin markdown, sin texto adicional.`,
          },
          {
            role: "user",
            content: `Para cada uno de los siguientes insights de investigación, encuentra UN paper académico REAL ya publicado que sea similar o relevante (sobre simulación de pacientes, IA en formación clínica/terapéutica, evaluación de competencias, o tecnología educativa en salud mental).

INSIGHTS:
${insightList}

Para cada insight (en el mismo orden), devuelve:
- index: número del insight (1-based)
- title: título EXACTO del paper encontrado
- authors: autores principales (formato "Apellido et al." o "Apellido & Apellido")
- year: año de publicación
- url: URL REAL al paper (DOI preferido, PubMed, o repositorio)

Responde SOLO con JSON array. Ejemplo: [{"index":1,"title":"...","authors":"...","year":2024,"url":"https://doi.org/..."}]`,
          },
        ],
      });

      const raw = response.choices?.[0]?.message?.content || "[]";
      let cleaned = raw.trim();
      if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      cleaned = escapeJsonControlChars(cleaned);

      let refs: { index: number; title: string; authors: string; year: number; url: string }[];
      try {
        refs = JSON.parse(cleaned);
      } catch {
        const match = cleaned.match(/\[[\s\S]*\]/);
        refs = match ? JSON.parse(escapeJsonControlChars(match[0])) : [];
      }

      if (Array.isArray(refs)) {
        for (const ref of refs) {
          const idx = ref.index - 1;
          if (idx >= 0 && idx < insights.length && ref.url?.startsWith("http")) {
            insights[idx].reference_title = ref.title;
            insights[idx].reference_authors = ref.authors;
            insights[idx].reference_year = ref.year;
            insights[idx].reference_url = ref.url;
          }
        }
      }
    } catch (e) {
      console.error("Perplexity enrichment failed:", e);
      // Continue without references — not critical
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // INSERT ALL INSIGHTS (with fallback if migration not yet applied)
  // ══════════════════════════════════════════════════════════════════
  if (insights.length > 0) {
    // Try full insert first (with reference fields + new categories)
    const { data, error } = await admin
      .from("research_insights")
      .insert(insights)
      .select();

    if (!error) return NextResponse.json(data, { status: 201 });

    // Fallback: migration not applied yet — strip reference fields and map new categories
    const CATEGORY_FALLBACK: Record<string, string> = {
      "revisión_sistemática": "correlación",
      "desarrollo_producto": "tendencia",
      "metodología": "varianza",
    };

    const fallbackInsights = insights.map(ins => ({
      title: ins.title,
      category: CATEGORY_FALLBACK[ins.category] || ins.category,
      hypothesis: ins.hypothesis,
      findings: ins.findings,
      data_source: ins.data_source,
      sample_size: ins.sample_size,
      statistical_sig: ins.statistical_sig,
      suggested_venues: ins.suggested_venues,
      suggested_paper_type: ins.suggested_paper_type,
    }));

    const { data: fbData, error: fbError } = await admin
      .from("research_insights")
      .insert(fallbackInsights)
      .select();

    if (fbError) return NextResponse.json({ error: fbError.message }, { status: 500 });
    return NextResponse.json(fbData, { status: 201 });
  }

  return NextResponse.json([], { status: 200 });
}
