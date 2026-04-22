import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import HistorialClient from "./HistorialClient";
import { isPilotActive } from "@/lib/pilot-helpers";

export default async function HistorialPage() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Pilot gate: non-pilot students must not see AI scores until the
  // docente has approved them. Pilot students see the score with a
  // "(preliminar)" tag next to it — same data, explicit labelling.
  let isPilot = false;
  const { data: pp } = await admin
    .from("pilot_participants")
    .select("pilot_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (pp?.pilot_id) {
    const { data: pilotRow } = await admin
      .from("pilots")
      .select("status, scheduled_at, ended_at")
      .eq("id", pp.pilot_id)
      .single();
    if (isPilotActive(pilotRow)) isPilot = true;
  }

  const [{ data: rawSessions }, { data: summaries }, { data: rawObservations }] = await Promise.all([
    supabase
      .from("conversations")
      .select(`
        id, ai_patient_id, session_number, status, created_at, ended_at, active_seconds, student_notes_v2,
        messages(count),
        session_competencies(overall_score_v2, eval_version, ai_commentary, strengths, areas_to_improve, feedback_status,
          setting_terapeutico, motivo_consulta, datos_contextuales, objetivos,
          escucha_activa, actitud_no_valorativa, optimismo, presencia, conducta_no_verbal, contencion_afectos),
        session_feedback(teacher_comment, teacher_score)
      `)
      .eq("student_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("session_summaries")
      .select("conversation_id, summary, key_revelations")
      .eq("student_id", user.id),
    supabase
      .from("observation_sessions")
      .select("id, title, status, total_duration_seconds, semantic_analysis, created_at, ended_at")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  // Fetch patient data separately (admin bypasses RLS on ai_patients)
  const patientIds = [...new Set((rawSessions || []).map((s) => s.ai_patient_id))];
  const { data: patientsData } = patientIds.length > 0
    ? await admin.from("ai_patients").select("id, name, age, occupation, difficulty_level, country").in("id", patientIds)
    : { data: [] };

  const patientMap = new Map((patientsData || []).map((p) => [p.id, p]));
  const sessions = (rawSessions || []).map((s) => {
    const msgArr = s.messages as unknown as { count: number }[] | null;
    return {
      ...s,
      ai_patients: patientMap.get(s.ai_patient_id) || null,
      message_count: msgArr?.[0]?.count ?? 0,
    };
  });

  const summaryMap: Record<string, { summary: string; revelations: string[] }> = {};
  summaries?.forEach(s => {
    summaryMap[s.conversation_id] = { summary: s.summary, revelations: s.key_revelations || [] };
  });

  const observations = (rawObservations || []).map((o) => ({
    id: o.id,
    title: o.title,
    status: o.status,
    total_duration_seconds: o.total_duration_seconds,
    semantic_analysis: o.semantic_analysis,
    created_at: o.created_at,
    ended_at: o.ended_at,
  }));

  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const patientCount = new Set(sessions.map(s => s.ai_patient_id)).size;
  const observationCount = observations.length;

  return (
    <div className="min-h-screen">
      <header className="px-4 sm:px-8 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Mi historial</h1>
        <div className="flex items-center gap-3 mt-3">
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-2.5 flex items-center gap-2">
            <span className="text-lg font-bold text-sidebar">{completedCount}</span>
            <span className="text-xs text-gray-500">sesiones</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-2.5 flex items-center gap-2">
            <span className="text-lg font-bold text-sidebar">{patientCount}</span>
            <span className="text-xs text-gray-500">pacientes</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-2.5 flex items-center gap-2">
            <span className="text-lg font-bold text-sidebar">{observationCount}</span>
            <span className="text-xs text-gray-500">grabaciones</span>
          </div>
        </div>
      </header>
      <div className="px-4 sm:px-8 pb-8">
        <HistorialClient sessions={sessions || []} summaryMap={summaryMap} observations={observations} isPilot={isPilot} />
      </div>
    </div>
  );
}
