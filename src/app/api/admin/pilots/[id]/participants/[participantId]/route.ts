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

  // 4. Participant row — MUST be deleted BEFORE the auth user.
  // pilot_participants.user_id REFERENCES auth.users(id) with no ON DELETE
  // rule (defaults to NO ACTION), so deleting the auth user while this row
  // still points at it raises a foreign-key violation. This used to run
  // AFTER auth.admin.deleteUser with the FK error swallowed by a console
  // warning, which left a "ghost" account: gone from the dashboard but still
  // able to log in and run sessions. Drop the referencing row first.
  const { error: rowErr } = await admin
    .from("pilot_participants")
    .delete()
    .eq("id", participantId);

  if (rowErr) {
    return NextResponse.json({ error: rowErr.message }, { status: 500 });
  }

  // 5. Auth user LAST (cascades to the profile via the auth.users FK). With
  // the participant + consent rows already gone the FK no longer blocks. We
  // BLOCK on this error instead of swallowing it — a failure here means the
  // person can still log in, so we surface it rather than report a false
  // success.
  if (participant.user_id) {
    const { error: delErr } = await admin.auth.admin.deleteUser(participant.user_id);
    if (delErr) {
      return NextResponse.json(
        {
          error:
            "El participante se quitó del piloto, pero su cuenta de acceso no se pudo eliminar: " +
            delErr.message,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
