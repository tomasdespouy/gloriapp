import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import RevisionesClient from "./RevisionesClient";

export default async function RevisionesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch all completed sessions needing review
  const { data: sessions } = await supabase
    .from("conversations")
    .select(`
      id, student_id, ai_patient_id, session_number, status, created_at,
      ai_patients(name, tags, difficulty_level),
      session_feedback(teacher_comment, teacher_score),
      session_competencies(overall_score, overall_score_v2, feedback_status, eval_version)
    `)
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  // Get student names (include all roles so impersonating superadmins are visible too)
  const studentIds = [...new Set((sessions || []).map((s) => s.student_id))];
  const { data: students } = studentIds.length > 0
    ? await supabase.from("profiles").select("id, full_name").in("id", studentIds)
    : { data: [] as { id: string; full_name: string | null }[] };

  // Build student name map
  const studentMap: Record<string, string> = {};
  students?.forEach((s) => {
    studentMap[s.id] = s.full_name || "Sin nombre";
  });

  return (
    <div className="min-h-screen">
      <header className="px-4 sm:px-8 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Revisiones</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Revisa y evalúa las sesiones completadas por tus alumnos
        </p>
      </header>
      <div className="px-4 sm:px-8 pb-8">
        <RevisionesClient sessions={sessions || []} studentMap={studentMap} />
      </div>
    </div>
  );
}
