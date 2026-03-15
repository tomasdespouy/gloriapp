import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "instructor" && profile?.role !== "admin" && profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { conversation_id, updates } = await request.json();
  if (!conversation_id || !updates) {
    return NextResponse.json({ error: "conversation_id y updates requeridos" }, { status: 400 });
  }

  // Verify instructor has scope over this conversation's student
  if (profile.role === "instructor") {
    const { data: instructorProfile } = await supabase
      .from("profiles")
      .select("establishment_id")
      .eq("id", user.id)
      .single();

    const admin2 = createAdminClient();
    const { data: conversation } = await admin2
      .from("conversations")
      .select("student_id")
      .eq("id", conversation_id)
      .single();

    if (conversation) {
      const { data: studentProfile } = await admin2
        .from("profiles")
        .select("establishment_id")
        .eq("id", conversation.student_id)
        .single();

      if (instructorProfile?.establishment_id && studentProfile?.establishment_id
        && instructorProfile.establishment_id !== studentProfile.establishment_id) {
        return NextResponse.json({ error: "No tienes acceso a este estudiante" }, { status: 403 });
      }
    }
  }

  // Whitelist allowed fields
  const allowedFields = [
    "empathy_score", "active_listening_score", "open_questions_score",
    "therapeutic_bond_score", "clinical_reasoning_score", "overall_score",
    "teacher_comment", "feedback_status",
  ];
  const sanitizedUpdates: Record<string, unknown> = {};
  for (const key of Object.keys(updates)) {
    if (allowedFields.includes(key)) {
      sanitizedUpdates[key] = updates[key];
    }
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("session_competencies")
    .update(sanitizedUpdates)
    .eq("conversation_id", conversation_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
