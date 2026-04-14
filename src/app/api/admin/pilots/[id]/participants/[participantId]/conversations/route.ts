import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Returns the conversations of a pilot participant, enriched with
// patient name and basic metadata so the admin can inspect usage
// without hitting the DB by hand. Reused by the drawer in the
// Pilot Dashboard and (eventually) by the closure report.
//
// Superadmin only. Conversations contain transcript data accessible
// through /docente/sesion/[conversationId] for the detail view.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; participantId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: pilotId, participantId } = await params;
  const admin = createAdminClient();

  // Ensure the participant belongs to this pilot.
  const { data: participant } = await admin
    .from("pilot_participants")
    .select("id, user_id, full_name, email, role")
    .eq("id", participantId)
    .eq("pilot_id", pilotId)
    .maybeSingle();

  if (!participant) {
    return NextResponse.json({ error: "Participante no pertenece al piloto" }, { status: 404 });
  }

  if (!participant.user_id) {
    // Never logged in → no conversations.
    return NextResponse.json({
      participant,
      conversations: [],
    });
  }

  // Pull conversations + patient name + eval score + message count in
  // one go. We keep it light (no transcript here) — the detail view is
  // /docente/sesion/[id] or /review/[id].
  const { data: conversations } = await admin
    .from("conversations")
    .select(`
      id,
      ai_patient_id,
      status,
      session_number,
      started_at,
      ended_at,
      created_at,
      active_seconds,
      ai_patients ( name )
    `)
    .eq("student_id", participant.user_id)
    .order("created_at", { ascending: false });

  const convoList = (conversations || []) as unknown as Array<{
    id: string;
    ai_patient_id: string;
    status: string;
    session_number: number | null;
    started_at: string | null;
    ended_at: string | null;
    created_at: string;
    active_seconds: number | null;
    ai_patients: { name: string } | { name: string }[] | null;
  }>;

  if (convoList.length === 0) {
    return NextResponse.json({ participant, conversations: [] });
  }

  // Fetch message counts and competency scores in parallel.
  const conversationIds = convoList.map((c) => c.id);
  const [{ data: msgCounts }, { data: comps }] = await Promise.all([
    admin
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", conversationIds),
    admin
      .from("session_competencies")
      .select("conversation_id, overall_score_v2, ai_commentary")
      .in("conversation_id", conversationIds),
  ]);

  const messageCountMap = new Map<string, number>();
  for (const m of msgCounts || []) {
    messageCountMap.set(m.conversation_id, (messageCountMap.get(m.conversation_id) || 0) + 1);
  }
  const compMap = new Map<string, { score: number | null; commentary: string | null }>();
  for (const c of comps || []) {
    compMap.set(c.conversation_id, {
      score: typeof c.overall_score_v2 === "number" ? c.overall_score_v2 : null,
      commentary: c.ai_commentary || null,
    });
  }

  const enriched = convoList.map((c) => {
    const patientObj = Array.isArray(c.ai_patients) ? c.ai_patients[0] : c.ai_patients;
    const comp = compMap.get(c.id);
    return {
      id: c.id,
      patient_name: patientObj?.name || "(paciente desconocido)",
      status: c.status,
      session_number: c.session_number,
      started_at: c.started_at,
      ended_at: c.ended_at,
      created_at: c.created_at,
      active_seconds: c.active_seconds || 0,
      message_count: messageCountMap.get(c.id) || 0,
      overall_score: comp?.score ?? null,
      ai_commentary: comp?.commentary ?? null,
    };
  });

  return NextResponse.json({
    participant,
    conversations: enriched,
  });
}
