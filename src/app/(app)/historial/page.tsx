import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import HistorialClient from "./HistorialClient";

export default async function HistorialPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: sessions }, { data: actionItems }] = await Promise.all([
    supabase
      .from("conversations")
      .select(`
        id,
        ai_patient_id,
        session_number,
        status,
        created_at,
        ai_patients(name, age, occupation, difficulty_level),
        session_competencies(empathy, active_listening, open_questions, reformulation, confrontation, silence_management, rapport, overall_score, ai_commentary, strengths, areas_to_improve, feedback_status),
        session_feedback(discomfort_moment, would_redo, clinical_note, teacher_comment, teacher_score)
      `)
      .eq("student_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("action_items")
      .select("id, conversation_id, content, resource_link, status, student_comment, created_at, responded_at, profiles!action_items_teacher_id_fkey(full_name)")
      .eq("student_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  const completedCount = sessions?.filter((s) => s.status === "completed").length || 0;

  return (
    <div className="min-h-screen">
      <header className="px-8 py-5">
        <h1 className="text-2xl font-bold text-gray-900">📋 Mi historial</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {completedCount} {completedCount === 1 ? "sesión completada" : "sesiones completadas"}
        </p>
      </header>

      <div className="px-8 pb-8">
        <HistorialClient sessions={sessions || []} actionItems={actionItems || []} />
      </div>
    </div>
  );
}
