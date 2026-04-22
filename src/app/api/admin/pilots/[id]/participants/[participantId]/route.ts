import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Fully remove a pilot participant (used when a verification/test user was
// created inside a real pilot and we want it out of analysis + reports).
//
// Unlike POST .../reset (which keeps the participant row at status='pendiente'
// for re-enrollment), DELETE wipes the participant and every trace that would
// otherwise orphan and contaminate aggregate metrics:
//
//   1. Delete conversations where student_id = participant.user_id
//      (cascades to messages/feedback/etc. per existing FKs).
//   2. Delete session_competencies for that user (the reset endpoint's
//      comment confirms these do NOT cascade from auth.users deletion).
//   3. Delete pilot_consents rows for this email in this pilot.
//   4. Delete the auth user (cascades to profile via the FK).
//   5. Delete the pilot_participants row itself.
//
// Superadmin-only. Irreversible.

export async function DELETE(
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

  // Confirm participant belongs to this pilot
  const { data: participant, error: pErr } = await admin
    .from("pilot_participants")
    .select("id, user_id, email, pilot_id")
    .eq("id", participantId)
    .eq("pilot_id", pilotId)
    .maybeSingle();

  if (pErr || !participant) {
    return NextResponse.json({ error: "Participante no encontrado" }, { status: 404 });
  }

  // 1. Conversations + 2. session_competencies (best-effort; log but continue)
  if (participant.user_id) {
    const { error: convErr } = await admin
      .from("conversations")
      .delete()
      .eq("student_id", participant.user_id);
    if (convErr) console.warn("[pilot/participant DELETE] conversations:", convErr.message);

    const { error: compErr } = await admin
      .from("session_competencies")
      .delete()
      .eq("student_id", participant.user_id);
    if (compErr) console.warn("[pilot/participant DELETE] session_competencies:", compErr.message);
  }

  // 3. Consent rows for this email within this pilot
  const { error: conErr } = await admin
    .from("pilot_consents")
    .delete()
    .eq("pilot_id", pilotId)
    .eq("email", participant.email);
  if (conErr) console.warn("[pilot/participant DELETE] pilot_consents:", conErr.message);

  // 4. Auth user (cascades to profile via auth.users FK)
  if (participant.user_id) {
    const { error: delErr } = await admin.auth.admin.deleteUser(participant.user_id);
    if (delErr) console.warn("[pilot/participant DELETE] auth.admin.deleteUser:", delErr.message);
  }

  // 5. Participant row — the real goal; block on this one
  const { error: rowErr } = await admin
    .from("pilot_participants")
    .delete()
    .eq("id", participantId);

  if (rowErr) {
    return NextResponse.json({ error: rowErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
