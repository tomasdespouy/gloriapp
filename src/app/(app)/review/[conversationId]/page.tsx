import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import ReviewClient from "./ReviewClient";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get conversation (user client) + patient info (admin, bypasses RLS)
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, session_number, ai_patient_id, active_seconds, started_at, ended_at, student_notes_v2")
    .eq("id", conversationId)
    .single();

  if (!conversation) redirect("/dashboard");

  // Fetch patient separately with admin client (RLS blocks student access to ai_patients)
  const { data: patientData } = await admin
    .from("ai_patients")
    .select("name, age, occupation, difficulty_level")
    .eq("id", conversation.ai_patient_id)
    .single();

  // Get message count
  const { count } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", conversationId);

  // Use active_seconds from client tracking (accurate) for duration
  const activeSeconds = conversation.active_seconds || 0;
  const durationMinutes = Math.round(activeSeconds / 60);
  // Too short = less than 5 minutes of tracked active time, AND less than 4 user messages
  const userMsgCount = count || 0;
  const tooShort = activeSeconds < 5 * 60 && userMsgCount < 6;

  // If too short, mark conversation as completed immediately (no evaluation)
  if (tooShort) {
    await supabase
      .from("conversations")
      .update({ status: "completed" })
      .eq("id", conversationId);
  }

  // Check if already evaluated
  const { data: existingEval } = await supabase
    .from("session_competencies")
    .select("*")
    .eq("conversation_id", conversationId)
    .single();

  const patient = patientData as {
    name: string;
    age: number;
    occupation: string;
    difficulty_level: string;
  };

  const feedbackStatus = (existingEval?.feedback_status as "pending" | "approved") || null;

  // Get teacher feedback (comment + score)
  const { data: teacherFeedback } = await supabase
    .from("session_feedback")
    .select("teacher_comment, teacher_score")
    .eq("conversation_id", conversationId)
    .single();

  // Get action items for this conversation
  const { data: actionItems } = await supabase
    .from("action_items")
    .select("id, content, resource_link, status, student_comment, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return (
    <ReviewClient
      conversationId={conversationId}
      patient={{ ...patient, id: conversation.ai_patient_id }}
      sessionNumber={conversation.session_number}
      messageCount={count || 0}
      existingEvaluation={existingEval}
      feedbackStatus={feedbackStatus}
      tooShort={tooShort}
      durationMinutes={durationMinutes}
      activeSeconds={activeSeconds}
      teacherComment={teacherFeedback?.teacher_comment || null}
      teacherScore={teacherFeedback?.teacher_score || null}
      startedAt={conversation.started_at || null}
      endedAt={conversation.ended_at || null}
      actionItems={actionItems || []}
      initialSessionNotes={conversation.student_notes_v2 || ""}
    />
  );
}
