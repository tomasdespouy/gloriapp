import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const COMPETENCY_KEYS = [
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

type CompetencyKey = (typeof COMPETENCY_KEYS)[number];

type CompetencyRow = {
  conversation_id: string;
  student_id: string;
  overall_score_v2: number | null;
  ai_commentary: string | null;
  strengths: string[] | null;
  areas_to_improve: string[] | null;
} & Record<CompetencyKey, number | null>;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  // Pilot info
  const { data: pilot, error: pilotError } = await admin
    .from("pilots")
    .select("*")
    .eq("id", id)
    .single();

  if (pilotError || !pilot) {
    return NextResponse.json({ error: "Piloto no encontrado" }, { status: 404 });
  }

  // Participants
  const { data: participants } = await admin
    .from("pilot_participants")
    .select("id, email, full_name, role, user_id, status, first_login_at, last_active_at, sessions_count")
    .eq("pilot_id", id);

  const studentParticipants = (participants || []).filter((p) => p.role === "student");
  const studentUserIds = studentParticipants
    .map((p) => p.user_id)
    .filter((id): id is string => !!id);

  // Conversations of those students
  let conversationCount = 0;
  let competencyRows: CompetencyRow[] = [];
  const sessionsByStudent = new Map<string, number>();
  const completedByStudent = new Map<string, number>();

  if (studentUserIds.length > 0) {
    const { data: conversations } = await admin
      .from("conversations")
      .select("id, student_id, status")
      .in("student_id", studentUserIds);

    conversationCount = conversations?.length || 0;
    for (const c of conversations || []) {
      sessionsByStudent.set(c.student_id, (sessionsByStudent.get(c.student_id) || 0) + 1);
      if (c.status === "completed") {
        completedByStudent.set(c.student_id, (completedByStudent.get(c.student_id) || 0) + 1);
      }
    }

    const conversationIds = (conversations || []).map((c) => c.id);
    if (conversationIds.length > 0) {
      const { data: comps } = await admin
        .from("session_competencies")
        .select(
          "conversation_id, student_id, overall_score_v2, ai_commentary, strengths, areas_to_improve, " +
            COMPETENCY_KEYS.join(", ")
        )
        .in("conversation_id", conversationIds);
      competencyRows = (comps || []) as unknown as CompetencyRow[];
    }
  }

  // Aggregate competency averages (only counting scores > 0, per evaluation rubric)
  const competencyAverages: Record<CompetencyKey, { avg: number; count: number }> = {} as Record<
    CompetencyKey,
    { avg: number; count: number }
  >;
  for (const key of COMPETENCY_KEYS) {
    const values = competencyRows
      .map((r) => r[key])
      .filter((v): v is number => typeof v === "number" && v > 0);
    competencyAverages[key] = {
      avg: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
      count: values.length,
    };
  }

  // Aggregate strengths and areas_to_improve (top frequency)
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

  const topStrengths = Array.from(strengthsCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([text, count]) => ({ text, count }));

  const topAreas = Array.from(areasCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([text, count]) => ({ text, count }));

  // Per-student summary
  const studentSummaries = studentParticipants.map((p) => {
    const rows = p.user_id ? competencyRows.filter((r) => r.student_id === p.user_id) : [];
    const overallScores = rows
      .map((r) => r.overall_score_v2)
      .filter((v): v is number => typeof v === "number" && v > 0);
    const avgOverall =
      overallScores.length > 0
        ? overallScores.reduce((a, b) => a + b, 0) / overallScores.length
        : 0;
    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      status: p.status,
      first_login_at: p.first_login_at,
      last_active_at: p.last_active_at,
      total_sessions: p.user_id ? sessionsByStudent.get(p.user_id) || 0 : 0,
      completed_sessions: p.user_id ? completedByStudent.get(p.user_id) || 0 : 0,
      evaluated_sessions: rows.length,
      avg_overall: avgOverall,
    };
  });

  // KPIs
  const totalInvited = (participants || []).filter((p) => p.status !== "pendiente").length;
  const totalConnected = (participants || []).filter((p) => !!p.first_login_at).length;
  const totalEvaluatedSessions = competencyRows.length;
  const totalSessions = conversationCount;

  // Aggregate overall_score_v2 across all sessions
  const overallScores = competencyRows
    .map((r) => r.overall_score_v2)
    .filter((v): v is number => typeof v === "number" && v > 0);
  const pilotOverallAvg =
    overallScores.length > 0
      ? overallScores.reduce((a, b) => a + b, 0) / overallScores.length
      : 0;

  return NextResponse.json({
    pilot: {
      id: pilot.id,
      name: pilot.name,
      institution: pilot.institution,
      country: pilot.country,
      scheduled_at: pilot.scheduled_at,
      ended_at: pilot.ended_at,
      status: pilot.status,
      created_at: pilot.created_at,
    },
    kpis: {
      total_participants: (participants || []).length,
      total_students: studentParticipants.length,
      total_invited: totalInvited,
      total_connected: totalConnected,
      connection_rate: totalInvited > 0 ? totalConnected / totalInvited : 0,
      total_sessions: totalSessions,
      total_evaluated_sessions: totalEvaluatedSessions,
      avg_sessions_per_student:
        studentParticipants.length > 0 ? totalSessions / studentParticipants.length : 0,
      pilot_overall_avg: pilotOverallAvg,
    },
    competency_averages: competencyAverages,
    top_strengths: topStrengths,
    top_areas: topAreas,
    students: studentSummaries,
    generated_at: new Date().toISOString(),
  });
}
