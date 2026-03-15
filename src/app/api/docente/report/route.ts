import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Check role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || !["instructor", "admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const url = new URL(request.url);
  const studentId = url.searchParams.get("student_id");
  if (!studentId) {
    return NextResponse.json({ error: "student_id requerido" }, { status: 400 });
  }

  // Fetch all data in parallel
  const [
    { data: student },
    { data: progress },
    { data: sessions },
    { data: actionItems },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, created_at")
      .eq("id", studentId)
      .single(),
    supabase
      .from("student_progress")
      .select("level, level_name, total_xp, sessions_completed, current_streak, longest_streak")
      .eq("student_id", studentId)
      .single(),
    supabase
      .from("conversations")
      .select(`
        id, session_number, status, created_at,
        ai_patients(name, difficulty_level),
        session_competencies(empathy, active_listening, open_questions, reformulation, confrontation, silence_management, rapport, overall_score, ai_commentary, strengths, areas_to_improve, feedback_status),
        session_feedback(teacher_comment, teacher_score)
      `)
      .eq("student_id", studentId)
      .eq("status", "completed")
      .order("created_at", { ascending: true }),
    supabase
      .from("action_items")
      .select("content, status, student_comment, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: true }),
  ]);

  if (!student) {
    return NextResponse.json({ error: "Estudiante no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    student,
    progress,
    sessions: sessions || [],
    actionItems: actionItems || [],
    teacherName: profile.full_name || "Docente",
    generatedAt: new Date().toISOString(),
  });
}
