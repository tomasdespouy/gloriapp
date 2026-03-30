import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/supabase/user-profile";
import RevisionesClient from "./RevisionesClient";

export const dynamic = "force-dynamic";

export default async function RevisionesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const userProfile = await getUserProfile();
  const establishmentId = userProfile?.establishmentId;

  // Get student IDs scoped to establishment
  const admin = createAdminClient();
  let studentIdsInScope: string[] | null = null;
  if (establishmentId) {
    const { data: scopedStudents } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "student")
      .eq("establishment_id", establishmentId);
    studentIdsInScope = scopedStudents?.map(s => s.id) || [];
  }

  // Fetch completed sessions scoped to establishment students
  // Use admin client to bypass RLS — page is already auth-gated and scoped by establishment
  let sessionsQuery = admin
    .from("conversations")
    .select(`
      id, student_id, ai_patient_id, session_number, status, created_at,
      ai_patients(name, tags, difficulty_level),
      session_feedback(teacher_comment, teacher_score),
      session_competencies(overall_score, overall_score_v2, feedback_status, eval_version, approved_at, evaluated_at)
    `)
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  if (studentIdsInScope && studentIdsInScope.length > 0) {
    sessionsQuery = sessionsQuery.in("student_id", studentIdsInScope);
  } else if (studentIdsInScope && studentIdsInScope.length === 0) {
    // No students in this establishment
    sessionsQuery = sessionsQuery.in("student_id", ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data: sessions } = await sessionsQuery;

  // Get student names
  const studentIds = [...new Set((sessions || []).map((s) => s.student_id))];
  const { data: students } = studentIds.length > 0
    ? await admin.from("profiles").select("id, full_name").in("id", studentIds)
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
