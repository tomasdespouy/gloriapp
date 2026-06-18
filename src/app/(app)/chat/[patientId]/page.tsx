import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { ChatInterface } from "@/components/ChatInterface";
import { getUserProfile } from "@/lib/supabase/user-profile";

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ conversationId?: string }>;
}) {
  const { patientId } = await params;
  const { conversationId } = await searchParams;

  const supabase = await createClient();

  // Use admin client to bypass RLS (students may not have direct ai_patients read access)
  const { data: patient, error: patientError } = await createAdminClient()
    .from("ai_patients")
    .select("id, name, age, occupation, presenting_problem, difficulty_level, voice_id")
    .eq("id", patientId)
    .single();

  console.log("[ChatPage] patientId:", patientId, "patient:", patient?.name, "error:", patientError?.message);

  if (!patient) notFound();

  const userProfile = await getUserProfile();

  // Bloqueo suave: si en la última sesión con este paciente quedó acordada
  // una próxima cita (capturada en commitments), la mostramos como aviso al
  // re-entrar. Es informativo: siempre se puede comenzar igual.
  let nextAppointment: string | null = null;
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (authUser && !conversationId) {
    const { data: lastSummary } = await supabase
      .from("session_summaries")
      .select("commitments")
      .eq("student_id", authUser.id)
      .eq("ai_patient_id", patientId)
      .order("session_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const APPOINTMENT_RE = /cita|nos vemos|pr[oó]xima sesi[oó]n|\bel\s+\d{1,2}\b|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|a las\s*\d/i;
    const appt = (lastSummary?.commitments as string[] | null | undefined)?.find((c) => APPOINTMENT_RE.test(c));
    if (appt) nextAppointment = appt;
  }

  let initialMessages: { role: string; content: string; created_at?: string }[] = [];
  let initialActiveSeconds = 0;

  if (conversationId) {
    const { data } = await supabase
      .from("messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    initialMessages = data || [];

    const { data: conv } = await supabase
      .from("conversations")
      .select("active_seconds")
      .eq("id", conversationId)
      .single();
    initialActiveSeconds = conv?.active_seconds || 0;
  }

  return (
    <div className="h-full overflow-hidden flex flex-col bg-[#FAFAFA]" style={{ height: "calc(100dvh - 48px)" }}>
      <ChatInterface
        patient={patient}
        conversationId={conversationId}
        initialMessages={initialMessages}
        initialActiveSeconds={initialActiveSeconds}
        userAvatarUrl={userProfile?.avatarUrl || null}
        userName={userProfile?.fullName || ""}
        nextAppointment={nextAppointment}
        userRole={userProfile?.realRole || null}
      />
    </div>
  );
}
