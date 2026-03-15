import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Verify instructor role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "instructor" && profile?.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const { conversation_id, teacher_comment, teacher_score } = body;

  if (!conversation_id) {
    return NextResponse.json({ error: "conversation_id requerido" }, { status: 400 });
  }

  if (teacher_score != null && (teacher_score < 0 || teacher_score > 10)) {
    return NextResponse.json({ error: "teacher_score debe estar entre 0 y 10" }, { status: 400 });
  }

  // Update session_feedback with teacher evaluation
  const { data, error } = await supabase
    .from("session_feedback")
    .update({
      teacher_id: user.id,
      teacher_comment: teacher_comment || null,
      teacher_score: teacher_score != null ? teacher_score : null,
    })
    .eq("conversation_id", conversation_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
