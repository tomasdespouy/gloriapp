import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Returns the message transcript of a conversation scoped to a pilot
// participant. Superadmin only. Used by the participant drawer in the
// Pilot Dashboard for inline review.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; participantId: string; conversationId: string }> },
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

  const { id: pilotId, participantId, conversationId } = await params;
  const admin = createAdminClient();

  // Make sure the participant actually belongs to the pilot and the
  // conversation belongs to that participant's user_id.
  const { data: participant } = await admin
    .from("pilot_participants")
    .select("user_id")
    .eq("id", participantId)
    .eq("pilot_id", pilotId)
    .maybeSingle();

  if (!participant?.user_id) {
    return NextResponse.json({ error: "Participante no pertenece al piloto" }, { status: 404 });
  }

  const { data: convo } = await admin
    .from("conversations")
    .select("id, student_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!convo || convo.student_id !== participant.user_id) {
    return NextResponse.json({ error: "Conversación no pertenece al participante" }, { status: 404 });
  }

  const { data: messages } = await admin
    .from("messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ messages: messages || [] });
}
