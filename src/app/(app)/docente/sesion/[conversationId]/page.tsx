import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import TeacherReviewClient from "./TeacherReviewClient";

interface Props {
  params: Promise<{ conversationId: string }>;
}

export default async function DocenteSesionPage({ params }: Props) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Defense-in-depth: the /docente layout already enforces role, but we
  // also scope the specific conversation to the instructor's establishment.
  // Admin and superadmin bypass this check (their RLS already scopes them
  // via admin_establishments).
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role, establishment_id")
    .eq("id", user.id)
    .single();

  const callerRole = callerProfile?.role as string | undefined;
  if (callerRole !== "instructor" && callerRole !== "admin" && callerRole !== "superadmin") {
    redirect("/dashboard");
  }

  // Get conversation with patient info
  const { data: conversation } = await supabase
    .from("conversations")
    .select(`
      id, student_id, ai_patient_id, session_number, status, created_at, ended_at,
      ai_patients(name, age, occupation, difficulty_level)
    `)
    .eq("id", conversationId)
    .single();

  if (!conversation || conversation.status !== "completed") {
    redirect("/docente/dashboard");
  }

  // Get student profile (include establishment_id for scope check)
  const { data: student } = await supabase
    .from("profiles")
    .select("id, full_name, email, establishment_id")
    .eq("id", conversation.student_id)
    .single();

  // Instructor scope: student must belong to the same establishment.
  // Instructors without an establishment cannot see any session.
  if (callerRole === "instructor") {
    if (
      !callerProfile?.establishment_id ||
      !student?.establishment_id ||
      callerProfile.establishment_id !== student.establishment_id
    ) {
      redirect("/docente/dashboard");
    }
  }

  // Get messages
  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  // Get AI evaluation
  const { data: competencies } = await supabase
    .from("session_competencies")
    .select("*")
    .eq("conversation_id", conversationId)
    .single();

  // Get feedback + summary in parallel
  const admin = createAdminClient();
  const [{ data: feedback }, { data: summaryRow }] = await Promise.all([
    supabase
      .from("session_feedback")
      .select("*")
      .eq("conversation_id", conversationId)
      .single(),
    admin
      .from("session_summaries")
      .select("summary")
      .eq("conversation_id", conversationId)
      .maybeSingle(),
  ]);

  const patient = conversation.ai_patients as unknown as {
    name: string; age: number; occupation: string; difficulty_level: string;
  };

  return (
    <TeacherReviewClient
      conversationId={conversationId}
      student={student ? { id: student.id, full_name: student.full_name, email: student.email } : { id: "", full_name: "Alumno", email: "" }}
      patient={patient}
      sessionNumber={conversation.session_number}
      createdAt={conversation.created_at}
      messages={messages || []}
      competencies={competencies}
      feedback={feedback}
      feedbackStatus={(competencies?.feedback_status as "pending" | "approved" | "evaluated") || "pending"}
      summary={summaryRow?.summary || null}
      messageCount={messages?.length || 0}
    />
  );
}
