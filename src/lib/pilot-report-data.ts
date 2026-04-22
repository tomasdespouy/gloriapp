/**
 * Centralised data-gathering for pilot reports.
 *
 * The DOCX generator and any JSON endpoint should consume this, so the
 * snapshot that lands on disk matches what the dashboard showed when the
 * admin pressed "Generar informe".
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { COMPETENCY_INFO } from "./competency-definitions";

export const COMPETENCY_KEYS = [
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
export type CompetencyKey = (typeof COMPETENCY_KEYS)[number];

type Role = "student" | "instructor";

type RawParticipant = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  user_id: string | null;
  status: string;
  first_login_at: string | null;
  last_active_at: string | null;
  sessions_count: number | null;
};

type RawConversation = {
  id: string;
  student_id: string;
  status: string;
  active_seconds: number | null;
  ended_at: string | null;
};

type RawCompetencyRow = {
  conversation_id: string;
  student_id: string;
  overall_score_v2: number | null;
  ai_commentary: string | null;
  strengths: string[] | null;
  areas_to_improve: string[] | null;
} & Record<CompetencyKey, number | null>;

type RawSurveyResponse = {
  id: string;
  user_id: string;
  created_at: string;
  answers: Record<string, unknown> | null;
};

export type LikertItemStats = {
  label: string;
  low_pct: number; // % of responses at 1-3
  high_pct: number; // % of responses at 4-5
  n: number;
};

export type LikertSectionStats = {
  title: string;
  items: LikertItemStats[];
  low_pct: number;
  high_pct: number;
};

export type Testimonial = {
  text: string;
  university: string;
  country: string | null;
  age: number | null;
  role: string;
};

export type PilotReportData = {
  pilot: {
    id: string;
    name: string;
    institution: string;
    country: string | null;
    scheduled_at: string | null;
    ended_at: string | null;
    status: string;
    logo_url: string | null;
  };
  kpis: {
    total_students: number;
    total_invited: number;
    total_connected: number;
    connection_rate: number;
    total_sessions: number;
    completed_sessions: number;
    avg_seconds_per_session: number;
    total_evaluated_sessions: number;
    pilot_overall_avg: number;
    survey_responses_count: number;
  };
  competency_averages: Record<CompetencyKey, { avg: number; count: number }>;
  competency_info: typeof COMPETENCY_INFO;
  top_strengths: Array<{ text: string; count: number }>;
  top_areas: Array<{ text: string; count: number }>;
  survey: {
    n: number;
    sections: LikertSectionStats[];
    top_positives: Array<{ label: string; pct: number }>;
    top_negatives: Array<{ label: string; pct: number }>;
  };
  testimonials: {
    mas_gusto: Testimonial[];
    menos_gusto: Testimonial[];
    cambio: Testimonial[];
    incomodidad: Testimonial[];
    comentarios: Testimonial[];
  };
  students: Array<{
    id: string;
    full_name: string;
    email: string;
    role: Role;
    status: string;
    first_login_at: string | null;
    last_active_at: string | null;
    total_sessions: number;
    completed_sessions: number;
    evaluated_sessions: number;
    avg_overall: number;
    responded_survey: boolean;
  }>;
  generated_at: string;
};

const V2_LIKERT_DEFS = [
  {
    key: "q7_usabilidad",
    title: "Sección 1 — Usabilidad y navegación",
    items: {
      registro: "El proceso de registro e inicio de sesión fue sencillo.",
      navegacion: "La plataforma es fácil de navegar.",
      inicio_sesion: "Iniciar una sesión de chat fue intuitivo.",
      dialogo: "Mantener el diálogo con el paciente fue simple.",
      general: "En general, considero que GlorIA es fácil de usar.",
    },
  },
  {
    key: "q8_realismo",
    title: "Sección 2 — Realismo clínico",
    items: {
      respuestas: "Las respuestas del paciente simulado se sintieron realistas.",
      personalidad: "La personalidad y motivo de consulta fueron creíbles.",
      comprension: "El paciente virtual entendió mis intervenciones.",
      sesion_real: "La interacción me generó sensación de sesión clínica real.",
      emocional: "Las reacciones emocionales fueron consistentes.",
    },
  },
  {
    key: "q9_pertinencia",
    title: "Sección 3 — Pertinencia cultural y contextual",
    items: {
      lenguaje: "El lenguaje utilizado es pertinente a mi contexto cultural.",
      experiencias: "Las experiencias son coherentes con mi realidad local.",
      tematica: "La temática es pertinente a las problemáticas de mi contexto.",
      estereotipos: "La interacción evita estereotipos ofensivos o poco realistas.",
      sensibilidad: "GlorIA es sensible a las particularidades del contexto.",
    },
  },
  {
    key: "q10_diseno",
    title: "Sección 4 — Diseño, interfaz y funcionamiento técnico",
    items: {
      visual: "El diseño visual es agradable y coherente.",
      informacion: "La información en pantalla está bien organizada.",
      fluidez: "La plataforma funcionó de manera fluida.",
      interactivos: "Los elementos interactivos son claros.",
      adaptacion: "La plataforma se adaptó correctamente al dispositivo.",
    },
  },
  {
    key: "q11_satisfaccion",
    title: "Sección 5 — Satisfacción global e intención de uso futuro",
    items: {
      satisfaccion: "Estoy satisfecho/a con mi experiencia general.",
      volver_usar: "Me gustaría volver a usar GlorIA.",
      recomendar: "Recomendaría GlorIA a otros estudiantes.",
      incorporacion: "Sería valioso que se incorporase formalmente.",
      tiempo_valio: "El tiempo dedicado a GlorIA valió la pena.",
    },
  },
] as const;

// Legacy v1 mapped onto the v2 section system where it overlaps. Items
// outside this map (q9_integracion, q10_comentarios) land in the
// testimonials as open answers only.
const V1_LIKERT_MAP: Record<string, { section: string; item: string }> = {
  // q5_usabilidad (v1 had 4 items)
  "q5_usabilidad.navegacion": { section: "q7_usabilidad", item: "navegacion" },
  "q5_usabilidad.performance": { section: "q10_diseno", item: "fluidez" },
  "q5_usabilidad.claridad": { section: "q7_usabilidad", item: "general" },
  "q5_usabilidad.feedback": { section: "q7_usabilidad", item: "dialogo" },
  // q6_formacion (v1 had 5 items)
  "q6_formacion.aplicacion": { section: "q11_satisfaccion", item: "tiempo_valio" },
  "q6_formacion.habilidades": { section: "q11_satisfaccion", item: "satisfaccion" },
  "q6_formacion.incorporacion": { section: "q11_satisfaccion", item: "incorporacion" },
  "q6_formacion.verosimilitud": { section: "q8_realismo", item: "respuestas" },
  "q6_formacion.atencion": { section: "q8_realismo", item: "sesion_real" },
};

export async function fetchPilotReportData(
  admin: SupabaseClient,
  pilotId: string,
): Promise<PilotReportData> {
  // 1. Pilot metadata + establishment logo
  const { data: pilot, error: pilotError } = await admin
    .from("pilots")
    .select("*")
    .eq("id", pilotId)
    .single();
  if (pilotError || !pilot) throw new Error("Piloto no encontrado");

  let establishmentLogo: string | null = null;
  if (pilot.establishment_id) {
    const { data: est } = await admin
      .from("establishments")
      .select("logo_url")
      .eq("id", pilot.establishment_id)
      .single();
    establishmentLogo = est?.logo_url || null;
  }

  // 2. Participants
  const { data: participantsRaw } = await admin
    .from("pilot_participants")
    .select(
      "id, email, full_name, role, user_id, status, first_login_at, last_active_at, sessions_count",
    )
    .eq("pilot_id", pilotId);
  const participants = (participantsRaw || []) as RawParticipant[];
  const studentParticipants = participants.filter((p) => p.role === "student");
  const studentUserIds = studentParticipants
    .map((p) => p.user_id)
    .filter((v): v is string => !!v);

  // 3. Consents (richer per-user data: age, university override)
  type ConsentRow = { user_id: string | null; full_name: string; age: number | null; university: string | null; role: string | null };
  const consentByUserId = new Map<string, ConsentRow>();
  if (studentUserIds.length > 0) {
    const { data: consents } = await admin
      .from("pilot_consents")
      .select("user_id, full_name, age, university, role")
      .eq("pilot_id", pilotId)
      .in("user_id", studentUserIds);
    for (const c of (consents || []) as ConsentRow[]) {
      if (c.user_id) consentByUserId.set(c.user_id, c);
    }
  }

  // 4. Conversations
  let conversations: RawConversation[] = [];
  if (studentUserIds.length > 0) {
    const { data } = await admin
      .from("conversations")
      .select("id, student_id, status, active_seconds, ended_at")
      .in("student_id", studentUserIds);
    conversations = (data || []) as RawConversation[];
  }
  const sessionsByStudent = new Map<string, number>();
  const completedByStudent = new Map<string, number>();
  for (const c of conversations) {
    sessionsByStudent.set(c.student_id, (sessionsByStudent.get(c.student_id) || 0) + 1);
    if (c.status === "completed") {
      completedByStudent.set(c.student_id, (completedByStudent.get(c.student_id) || 0) + 1);
    }
  }
  const activeSeconds = conversations
    .map((c) => c.active_seconds)
    .filter((v): v is number => typeof v === "number" && v > 0);
  const avgSecondsPerSession =
    activeSeconds.length > 0
      ? activeSeconds.reduce((a, b) => a + b, 0) / activeSeconds.length
      : 0;

  // 5. Session competencies
  let competencyRows: RawCompetencyRow[] = [];
  if (conversations.length > 0) {
    const { data } = await admin
      .from("session_competencies")
      .select(
        "conversation_id, student_id, overall_score_v2, ai_commentary, strengths, areas_to_improve, " +
          COMPETENCY_KEYS.join(", "),
      )
      .in(
        "conversation_id",
        conversations.map((c) => c.id),
      );
    competencyRows = (data || []) as unknown as RawCompetencyRow[];
  }

  const competency_averages = {} as Record<CompetencyKey, { avg: number; count: number }>;
  for (const key of COMPETENCY_KEYS) {
    const values = competencyRows
      .map((r) => r[key])
      .filter((v): v is number => typeof v === "number" && v > 0);
    competency_averages[key] = {
      avg: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
      count: values.length,
    };
  }

  const strengthsCount = new Map<string, number>();
  const areasCount = new Map<string, number>();
  for (const r of competencyRows) {
    for (const s of r.strengths || []) {
      const key = s.trim().toLowerCase();
      if (key) strengthsCount.set(key, (strengthsCount.get(key) || 0) + 1);
    }
    for (const a of r.areas_to_improve || []) {
      const key = a.trim().toLowerCase();
      if (key) areasCount.set(key, (areasCount.get(key) || 0) + 1);
    }
  }
  const top_strengths = Array.from(strengthsCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([text, count]) => ({ text, count }));
  const top_areas = Array.from(areasCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([text, count]) => ({ text, count }));

  // 6. Survey — any status='completed' responses to the pilot's survey
  //    (handles BOTH v1 legacy form_version=NULL rows and v2_pilot rows).
  const { data: surveyRow } = await admin
    .from("surveys")
    .select("id")
    .eq("pilot_id", pilotId)
    .maybeSingle();

  const respondedUserIds = new Set<string>();
  const itemSums: Record<string, Record<string, { low: number; high: number; n: number }>> = {};
  for (const def of V2_LIKERT_DEFS) {
    itemSums[def.key] = {};
    for (const itemKey of Object.keys(def.items)) {
      itemSums[def.key][itemKey] = { low: 0, high: 0, n: 0 };
    }
  }
  const testimonials = {
    mas_gusto: [] as Testimonial[],
    menos_gusto: [] as Testimonial[],
    cambio: [] as Testimonial[],
    incomodidad: [] as Testimonial[],
    comentarios: [] as Testimonial[],
  };

  let surveyN = 0;
  if (surveyRow?.id) {
    const { data: resps } = await admin
      .from("survey_responses")
      .select("id, user_id, created_at, answers")
      .eq("survey_id", surveyRow.id)
      .eq("status", "completed");
    const responses = (resps || []) as RawSurveyResponse[];
    surveyN = responses.length;

    for (const r of responses) {
      respondedUserIds.add(r.user_id);
      const a = (r.answers || {}) as Record<string, unknown>;
      const consent = consentByUserId.get(r.user_id);
      const university = consent?.university || pilot.institution;
      const age = consent?.age ?? null;

      // Likert extraction — v2 shape
      for (const def of V2_LIKERT_DEFS) {
        const section = (a[def.key] || {}) as Record<string, unknown>;
        for (const itemKey of Object.keys(def.items)) {
          const num = Number(section[itemKey]);
          if (Number.isFinite(num) && num >= 1 && num <= 5) {
            const bucket = itemSums[def.key][itemKey];
            if (num <= 3) bucket.low += 1;
            else bucket.high += 1;
            bucket.n += 1;
          }
        }
      }

      // Likert extraction — v1 legacy shape mapped onto v2 slots
      for (const [path, target] of Object.entries(V1_LIKERT_MAP)) {
        const [sec, item] = path.split(".");
        const section = (a[sec] || {}) as Record<string, unknown>;
        const num = Number(section[item]);
        if (Number.isFinite(num) && num >= 1 && num <= 5) {
          const bucket = itemSums[target.section][target.item];
          if (num <= 3) bucket.low += 1;
          else bucket.high += 1;
          bucket.n += 1;
        }
      }

      // Testimonials — both v1 and v2 keys
      const pushTestimonial = (
        list: Testimonial[],
        val: unknown,
      ) => {
        if (typeof val === "string" && val.trim().length > 0) {
          list.push({
            text: val.trim(),
            university,
            country: pilot.country,
            age,
            role: consent?.role || "Estudiante",
          });
        }
      };
      // "Más gustó" = v1.q7_mas_gusto OR v2.q12_mas_gusto
      pushTestimonial(testimonials.mas_gusto, a.q7_mas_gusto);
      pushTestimonial(testimonials.mas_gusto, a.q12_mas_gusto);
      // "Menos gustó / mejoraría" = v1.q8_mejoras OR v2.q13_menos_gusto
      pushTestimonial(testimonials.menos_gusto, a.q8_mejoras);
      pushTestimonial(testimonials.menos_gusto, a.q13_menos_gusto);
      // "Cambio / integración" = v1.q9_integracion OR v2.q14_cambio
      pushTestimonial(testimonials.cambio, a.q9_integracion);
      pushTestimonial(testimonials.cambio, a.q14_cambio);
      // v2 only
      pushTestimonial(testimonials.incomodidad, a.q15_incomodidad);
      // Comentarios = v1.q10_comentarios OR v2.q16_comentarios
      pushTestimonial(testimonials.comentarios, a.q10_comentarios);
      pushTestimonial(testimonials.comentarios, a.q16_comentarios);
    }
  }

  const sections: LikertSectionStats[] = V2_LIKERT_DEFS.map((def) => {
    const items: LikertItemStats[] = Object.entries(def.items).map(([key, label]) => {
      const b = itemSums[def.key][key];
      const n = b.n;
      return {
        label,
        low_pct: n > 0 ? (b.low / n) * 100 : 0,
        high_pct: n > 0 ? (b.high / n) * 100 : 0,
        n,
      };
    });
    const totals = items.reduce(
      (acc, it) => ({ low: acc.low + it.low_pct, high: acc.high + it.high_pct, count: acc.count + (it.n > 0 ? 1 : 0) }),
      { low: 0, high: 0, count: 0 },
    );
    return {
      title: def.title,
      items,
      low_pct: totals.count > 0 ? totals.low / totals.count : 0,
      high_pct: totals.count > 0 ? totals.high / totals.count : 0,
    };
  });

  // Top positives (>=90% high) and top negatives (<=90% high) for the
  // resumen section.
  type RankedItem = { label: string; pct: number; section: string };
  const ranked: RankedItem[] = [];
  for (const s of sections) {
    for (const it of s.items) {
      if (it.n > 0) ranked.push({ label: it.label, pct: it.high_pct, section: s.title });
    }
  }
  const top_positives = ranked
    .filter((r) => r.pct >= 90)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6)
    .map((r) => ({ label: r.label, pct: r.pct }));
  const top_negatives = ranked
    .filter((r) => r.pct < 90 && r.pct > 0)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5)
    .map((r) => ({ label: r.label, pct: r.pct }));

  // 7. Per-student summary
  const students = participants.map((p) => {
    const rows = p.user_id ? competencyRows.filter((r) => r.student_id === p.user_id) : [];
    const overallScores = rows
      .map((r) => r.overall_score_v2)
      .filter((v): v is number => typeof v === "number" && v > 0);
    const avg_overall =
      overallScores.length > 0
        ? overallScores.reduce((a, b) => a + b, 0) / overallScores.length
        : 0;
    const preferredName = p.user_id ? consentByUserId.get(p.user_id)?.full_name : undefined;
    return {
      id: p.id,
      full_name: preferredName || p.full_name,
      email: p.email,
      role: p.role,
      status: p.status,
      first_login_at: p.first_login_at,
      last_active_at: p.last_active_at,
      total_sessions: p.user_id ? sessionsByStudent.get(p.user_id) || 0 : 0,
      completed_sessions: p.user_id ? completedByStudent.get(p.user_id) || 0 : 0,
      evaluated_sessions: rows.length,
      avg_overall,
      responded_survey: !!p.user_id && respondedUserIds.has(p.user_id),
    };
  });

  // 8. KPIs
  const totalInvited = participants.filter((p) => p.status !== "pendiente").length;
  const totalConnected = participants.filter((p) => !!p.first_login_at).length;
  const totalSessions = conversations.length;
  const completedSessions = conversations.filter((c) => c.status === "completed").length;
  const overallScoresAll = competencyRows
    .map((r) => r.overall_score_v2)
    .filter((v): v is number => typeof v === "number" && v > 0);
  const pilot_overall_avg =
    overallScoresAll.length > 0
      ? overallScoresAll.reduce((a, b) => a + b, 0) / overallScoresAll.length
      : 0;

  return {
    pilot: {
      id: pilot.id,
      name: pilot.name,
      institution: pilot.institution,
      country: pilot.country,
      scheduled_at: pilot.scheduled_at,
      ended_at: pilot.ended_at,
      status: pilot.status,
      logo_url: pilot.logo_url || establishmentLogo,
    },
    kpis: {
      total_students: studentParticipants.length,
      total_invited: totalInvited,
      total_connected: totalConnected,
      connection_rate: totalInvited > 0 ? totalConnected / totalInvited : 0,
      total_sessions: totalSessions,
      completed_sessions: completedSessions,
      avg_seconds_per_session: avgSecondsPerSession,
      total_evaluated_sessions: competencyRows.length,
      pilot_overall_avg,
      survey_responses_count: surveyN,
    },
    competency_averages,
    competency_info: COMPETENCY_INFO,
    top_strengths,
    top_areas,
    survey: {
      n: surveyN,
      sections,
      top_positives,
      top_negatives,
    },
    testimonials,
    students,
    generated_at: new Date().toISOString(),
  };
}

// ─── Formatters for the DOCX generator ────────────────────────────────

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function formatDateShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Santiago",
  });
}

export function formatDateLong(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  });
}

export function formatMonthYear(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  });
}

export function testimonialAttribution(t: Testimonial): string {
  const role = t.role === "instructor" ? "Docente" : "Estudiante";
  const parts: string[] = [role];
  if (t.age) parts.push(`${t.age} años`);
  const univ = t.country ? `${t.university} (${t.country})` : t.university;
  parts.push(univ);
  return parts.join(", ");
}
