import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import HistorialClient from "./HistorialClient";

export default async function HistorialPage() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: rawSessions }, { data: summaries }] = await Promise.all([
    supabase
      .from("conversations")
      .select(`
        id, ai_patient_id, session_number, status, created_at, ended_at, active_seconds, student_notes_v2,
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
  ]);

  // Fetch patient data separately (admin bypasses RLS on ai_patients)
  const patientIds = [...new Set((rawSessions || []).map((s) => s.ai_patient_id))];
  const { data: patientsData } = patientIds.length > 0
    ? await admin.from("ai_patients").select("id, name, age, occupation, difficulty_level, country").in("id", patientIds)
    : { data: [] };

  const patientMap = new Map((patientsData || []).map((p) => [p.id, p]));
  const sessions = (rawSessions || []).map((s) => ({
    ...s,
    ai_patients: patientMap.get(s.ai_patient_id) || null,
  }));

  const summaryMap: Record<string, { summary: string; revelations: string[] }> = {};
  summaries?.forEach(s => {
    summaryMap[s.conversation_id] = { summary: s.summary, revelations: s.key_revelations || [] };
  });

  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const patientCount = new Set(sessions.map(s => s.ai_patient_id)).size;

  return (
    <div className="min-h-screen">
      <header className="px-4 sm:px-8 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Mi historial</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {completedCount} sesiones completadas &middot; {patientCount} pacientes
        </p>
      </header>
      <div className="px-4 sm:px-8 pb-8">
        <HistorialClient sessions={sessions || []} summaryMap={summaryMap} />
      </div>
    </div>
  );
}
