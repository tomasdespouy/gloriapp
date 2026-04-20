/**
 * Centralised data-gathering for pilot reports.
 *
 * Both the DOCX generator and the legacy JSON endpoint should consume
 * this, so the snapshot that lands on disk matches what the dashboard
 * showed when the admin pressed "Generar informe".
 *
 * Superadmin-only upstream (the endpoints that call this check auth) —
 * this function uses the admin client to bypass RLS on pilot_consents,
 * pilot_participants, and conversations.
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
    total_participants: number;
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
    likert: {
      q7_usabilidad: { overall: number; items: Record<string, number> };
      q8_realismo: { overall: number; items: Record<string, number> };
      q9_pertinencia: { overall: number; items: Record<string, number> };
      q10_diseno: { overall: number; items: Record<string, number> };
      q11_satisfaccion: { overall: number; items: Record<string, number> };
    };
  };
  testimonials: {
    q12_mas_gusto: Array<{ user_id: string; full_name: string; text: string }>;
    q13_menos_gusto: Array<{ user_id: string; full_name: string; text: string }>;
    q14_cambio: Array<{ user_id: string; full_name: string; text: string }>;
    q15_incomodidad: Array<{ user_id: string; full_name: string; text: string }>;
    q16_comentarios: Array<{ user_id: string; full_name: string; text: string }>;
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

export async function fetchPilotReportData(
  admin: SupabaseClient,
  pilotId: string,
): Promise<PilotReportData> {
  // 1. Pilot metadata
  const { data: pilot, error: pilotError } = await admin
    .from("pilots")
    .select("*")
    .eq("id", pilotId)
    .single();
  if (pilotError || !pilot) throw new Error("Piloto no encontrado");

  // 1b. Establishment logo (falls back to pilot.logo_url)
  let establishmentLogo: string | null = null;
  if (pilot.establishment_id) {
    const { data: est } = await admin
      .from("establishments")
      .select("logo_url")
      .eq("id", pilot.establishment_id)
      .single();
    establishmentLogo = est?.logo_url || null;
  }

  // 2. Participants (students + instructor)
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

  // 3. Preferred names: pilot_consents overrides pilot_participants
  const nameByUserId = new Map<string, string>();
  for (const p of participants) {
    if (p.user_id) nameByUserId.set(p.user_id, p.full_name);
  }
  if (studentUserIds.length > 0) {
    const { data: consents } = await admin
      .from("pilot_consents")
      .select("user_id, full_name")
      .eq("pilot_id", pilotId)
      .in("user_id", studentUserIds);
    for (const c of consents || []) {
      if (c.user_id) nameByUserId.set(c.user_id, c.full_name);
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

  // 6. Survey (v2_pilot) — one survey per pilot
  const { data: surveyRow } = await admin
    .from("surveys")
    .select("id, form_version")
    .eq("pilot_id", pilotId)
    .maybeSingle();

  const respondedUserIds = new Set<string>();
  const survey = {
    n: 0,
    likert: {
      q7_usabilidad: { overall: 0, items: {} as Record<string, number> },
      q8_realismo: { overall: 0, items: {} as Record<string, number> },
      q9_pertinencia: { overall: 0, items: {} as Record<string, number> },
      q10_diseno: { overall: 0, items: {} as Record<string, number> },
      q11_satisfaccion: { overall: 0, items: {} as Record<string, number> },
    },
  };
  const testimonials = {
    q12_mas_gusto: [] as Array<{ user_id: string; full_name: string; text: string }>,
    q13_menos_gusto: [] as Array<{ user_id: string; full_name: string; text: string }>,
    q14_cambio: [] as Array<{ user_id: string; full_name: string; text: string }>,
    q15_incomodidad: [] as Array<{ user_id: string; full_name: string; text: string }>,
    q16_comentarios: [] as Array<{ user_id: string; full_name: string; text: string }>,
  };

  if (surveyRow?.id) {
    const { data: resps } = await admin
      .from("survey_responses")
      .select("id, user_id, created_at, answers")
      .eq("survey_id", surveyRow.id)
      .eq("status", "completed");
    const responses = (resps || []) as RawSurveyResponse[];
    survey.n = responses.length;

    const likertKeys = ["q7_usabilidad", "q8_realismo", "q9_pertinencia", "q10_diseno", "q11_satisfaccion"] as const;
    const itemSums: Record<string, Record<string, { sum: number; n: number }>> = {};
    for (const k of likertKeys) itemSums[k] = {};

    for (const r of responses) {
      respondedUserIds.add(r.user_id);
      const a = (r.answers || {}) as Record<string, unknown>;

      for (const k of likertKeys) {
        const section = (a[k] || {}) as Record<string, unknown>;
        for (const [itemKey, val] of Object.entries(section)) {
          const num = Number(val);
          if (Number.isFinite(num) && num > 0) {
            if (!itemSums[k][itemKey]) itemSums[k][itemKey] = { sum: 0, n: 0 };
            itemSums[k][itemKey].sum += num;
            itemSums[k][itemKey].n += 1;
          }
        }
      }

      const name = nameByUserId.get(r.user_id) || "Sin nombre";
      const pushIf = (field: keyof typeof testimonials, val: unknown) => {
        if (typeof val === "string" && val.trim().length > 0) {
          testimonials[field].push({ user_id: r.user_id, full_name: name, text: val.trim() });
        }
      };
      pushIf("q12_mas_gusto", a.q12_mas_gusto);
      pushIf("q13_menos_gusto", a.q13_menos_gusto);
      pushIf("q14_cambio", a.q14_cambio);
      pushIf("q15_incomodidad", a.q15_incomodidad);
      pushIf("q16_comentarios", a.q16_comentarios);
    }

    for (const k of likertKeys) {
      const itemsAvg: Record<string, number> = {};
      const allVals: number[] = [];
      for (const [itemKey, { sum, n }] of Object.entries(itemSums[k])) {
        const v = n > 0 ? sum / n : 0;
        itemsAvg[itemKey] = v;
        if (n > 0) allVals.push(v);
      }
      survey.likert[k] = {
        overall: allVals.length > 0 ? allVals.reduce((a, b) => a + b, 0) / allVals.length : 0,
        items: itemsAvg,
      };
    }
  }

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
    return {
      id: p.id,
      full_name: nameByUserId.get(p.user_id || "") || p.full_name,
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
      total_participants: participants.length,
      total_students: studentParticipants.length,
      total_invited: totalInvited,
      total_connected: totalConnected,
      connection_rate: totalInvited > 0 ? totalConnected / totalInvited : 0,
      total_sessions: totalSessions,
      completed_sessions: completedSessions,
      avg_seconds_per_session: avgSecondsPerSession,
      total_evaluated_sessions: competencyRows.length,
      pilot_overall_avg,
      survey_responses_count: survey.n,
    },
    competency_averages,
    competency_info: COMPETENCY_INFO,
    top_strengths,
    top_areas,
    survey,
    testimonials,
    students,
    generated_at: new Date().toISOString(),
  };
}

// ─── Human-readable formatters for the DOCX generator ─────────────────

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function formatDateShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago",
  });
}

// Localized, reader-friendly labels for the v2 likert sub-items.
// Payload keys stay as-is for analytics (see SurveyModal.tsx).
export const V2_ITEM_LABELS: Record<string, Record<string, string>> = {
  q7_usabilidad: {
    registro: "Registro e inicio de sesión",
    navegacion: "Navegación de la plataforma",
    inicio_sesion: "Iniciar sesión de chat",
    dialogo: "Diálogo con paciente simulado",
    general: "Facilidad general",
  },
  q8_realismo: {
    respuestas: "Respuestas realistas",
    personalidad: "Personalidad creíble",
    comprension: "Comprensión del paciente",
    sesion_real: "Sensación de sesión real",
    emocional: "Reacciones emocionales",
  },
  q9_pertinencia: {
    lenguaje: "Lenguaje pertinente al contexto",
    experiencias: "Experiencias coherentes",
    tematica: "Temática pertinente",
    estereotipos: "Evita estereotipos",
    sensibilidad: "Sensibilidad contextual",
  },
  q10_diseno: {
    visual: "Diseño visual",
    informacion: "Organización de información",
    fluidez: "Fluidez / sin caídas",
    interactivos: "Elementos interactivos claros",
    adaptacion: "Adaptación a dispositivo",
  },
  q11_satisfaccion: {
    satisfaccion: "Satisfacción general",
    volver_usar: "Volvería a usarla",
    recomendar: "Recomendaría a otros",
    incorporacion: "Debería incorporarse formalmente",
    tiempo_valio: "El tiempo valió la pena",
  },
};

export const V2_SECTION_LABELS: Record<string, string> = {
  q7_usabilidad: "1. Usabilidad y navegación",
  q8_realismo: "2. Realismo clínico",
  q9_pertinencia: "3. Pertinencia cultural y contextual",
  q10_diseno: "4. Diseño, interfaz y funcionamiento técnico",
  q11_satisfaccion: "5. Satisfacción global e intención de uso futuro",
};

export const TESTIMONIAL_LABELS: Record<string, string> = {
  q12_mas_gusto: "6. ¿Qué es lo que MÁS te gustó?",
  q13_menos_gusto: "7. ¿Qué es lo que MENOS te gustó?",
  q14_cambio: "8. Si pudieras cambiar UNA cosa, ¿qué sería?",
  q15_incomodidad: "9. ¿Hubo algo que te generó incomodidad emocional?",
  q16_comentarios: "10. [Opcional] Consulta o comentario libre",
};
