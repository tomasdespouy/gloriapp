import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import HistorialClient from "./HistorialClient";

export default async function HistorialPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: sessions }, { data: summaries }] = await Promise.all([
    supabase
      .from("conversations")
      .select(`
        id, ai_patient_id, session_number, status, created_at, ended_at, active_seconds, student_notes_v2,
        ai_patients(name, age, occupation, difficulty_level, country),
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

  const summaryMap: Record<string, { summary: string; revelations: string[] }> = {};
  summaries?.forEach(s => {
    summaryMap[s.conversation_id] = { summary: s.summary, revelations: s.key_revelations || [] };
  });

  const completedCount = sessions?.filter((s) => s.status === "completed").length || 0;
  const patientCount = new Set(sessions?.map(s => s.ai_patient_id)).size;

  // Get all messages for completed sessions (for transcript view)
  const completedIds = sessions?.filter(s => s.status === "completed").map(s => s.id) || [];
  let messagesMap: Record<string, { role: string; content: string; created_at: string }[]> = {};
  if (completedIds.length > 0) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id, role, content, created_at")
      .in("conversation_id", completedIds)
      .neq("role", "system")
      .order("created_at", { ascending: true });
    msgs?.forEach(m => {
      if (!messagesMap[m.conversation_id]) messagesMap[m.conversation_id] = [];
      messagesMap[m.conversation_id].push({ role: m.role, content: m.content, created_at: m.created_at });
    });
  }

  return (
    <div className="min-h-screen">
      <header className="px-8 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Mi historial</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {completedCount} sesiones completadas &middot; {patientCount} pacientes
        </p>
      </header>
      <div className="px-8 pb-8">
        <HistorialClient sessions={sessions || []} summaryMap={summaryMap} messagesMap={messagesMap} />
      </div>
    </div>
  );
}
