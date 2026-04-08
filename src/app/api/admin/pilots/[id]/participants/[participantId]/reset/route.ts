import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Reset a single pilot participant so the enrollment flow can be re-run
// against the same email. Used by test_mode pilots to dry-run end to end
// without consuming new email aliases.
//
// Effects:
//   1. Delete the auth.user (auth.admin.deleteUser).
//   2. Delete the pilot_consents row(s) for this participant.
//   3. Reset pilot_participants row to status='pendiente', clear user_id,
//      invite_sent_at, first_login_at, sessions_count, last_active_at.
//
// Conversations and session_competencies are NOT deleted. They become
// orphaned (student_id no longer matches a profile), which is fine for a
// test pilot — the next iteration will create a new user with new
// conversations and the orphans will simply not appear in any UI.

export async function POST(
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

  // 1. Delete consent rows
  await admin
    .from("pilot_consents")
    .delete()
    .eq("pilot_id", pilotId)
    .eq("email", participant.email);

  // 2. Delete the auth user (cascade deletes profile via FK if configured)
  if (participant.user_id) {
    const { error: delErr } = await admin.auth.admin.deleteUser(participant.user_id);
    if (delErr) {
      // Log but continue — the auth user may already be gone, in which
      // case we still want to reset the participant row below.
      console.warn("auth.admin.deleteUser error:", delErr.message);
    }
  }

  // 3. Reset the participant row
  const { error: updErr } = await admin
    .from("pilot_participants")
    .update({
      user_id: null,
      status: "pendiente",
      invite_sent_at: null,
      first_login_at: null,
      sessions_count: 0,
      last_active_at: null,
    })
    .eq("id", participantId);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
