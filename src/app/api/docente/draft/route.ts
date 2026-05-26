import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeFeedbackAccess } from "@/lib/feedback-auth";
import { NextResponse } from "next/server";

// Save a DRAFT of the teacher's comment + score without approving or notifying.
// Lets the instructor start the analysis and come back later. The draft is NOT
// visible to the student: feedback_status stays as-is (pending), and the review
// page only ships the teacher comment/score once status is approved/evaluated.
export async function POST(request: Request) {
  const { conversation_id, teacher_comment, teacher_score } = await request.json();

  if (!conversation_id) {
    return NextResponse.json(
      { error: "conversation_id requerido" },
      { status: 400 }
    );
  }

  // Role + establishment scope: an instructor may only draft feedback for
  // sessions of students in their own establishment.
  const auth = await authorizeFeedbackAccess({ conversationId: conversation_id });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const user = { id: auth.userId };

  if (teacher_score != null && (teacher_score < 0 || teacher_score > 10)) {
    return NextResponse.json(
      { error: "teacher_score debe estar entre 0 y 10" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: conversation } = await admin
    .from("conversations")
    .select("student_id")
    .eq("id", conversation_id)
    .single();

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 }
    );
  }

  // Upsert the draft into session_feedback. Crucially, we do NOT touch
  // session_competencies.feedback_status, so the cycle stays in "pending"
  // and the student sees nothing until the teacher presses "Enviar".
  const { data: existingFb } = await admin
    .from("session_feedback")
    .select("id")
    .eq("conversation_id", conversation_id)
    .maybeSingle();

  const fbPayload = {
    teacher_id: user.id,
    teacher_comment: teacher_comment || null,
    teacher_score: teacher_score != null ? teacher_score : null,
  };

  const { error: fbError } = existingFb
    ? await admin
        .from("session_feedback")
        .update(fbPayload)
        .eq("conversation_id", conversation_id)
    : await admin.from("session_feedback").insert({
        ...fbPayload,
        conversation_id,
        student_id: conversation.student_id,
      });

  if (fbError) {
    return NextResponse.json({ error: fbError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
