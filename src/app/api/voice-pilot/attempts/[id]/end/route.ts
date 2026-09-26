import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logVoiceAudit } from "@/lib/voice-pilot-auth";

/**
 * POST /api/voice-pilot/attempts/:id/end — cierre NORMAL de un intento
 * (colgar, deadline alcanzado, o el WS se cae). Distinto del cierre
 * forzoso de admin (`/api/admin/voice-pilots/[id]/force-close`): acá no se
 * llama al relé (el navegador ya cerró su lado, y eso solo ya termina la
 * sesión ahí) — esto es puro bookkeeping para no dejar el intento marcado
 * "authorized"/"active" para siempre, lo cual bloqueaba cualquier
 * reintento (`canStartAttempt` lo lee como "attempt_in_progress").
 *
 * Idempotente: el UPDATE solo pega si el intento sigue en
 * authorized/active, así que llamarlo más de una vez (o después de un
 * cierre forzoso de admin) no rompe nada.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id: attemptId } = await params;
  const { reason } = await request.json().catch(() => ({ reason: null }));

  const admin = createAdminClient();

  const { data: attempt } = await admin
    .from("voice_attempts")
    .select("id, lifecycle, grant_id")
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: grant } = await admin
    .from("voice_attempt_grants")
    .select("user_id")
    .eq("id", attempt.grant_id)
    .maybeSingle();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isOwner = grant?.user_id === user.id;
  const isSuperadmin = profile?.role === "superadmin";
  if (!isOwner && !isSuperadmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await admin
    .from("voice_attempts")
    .update({ lifecycle: "closed", ended_at: new Date().toISOString(), end_reason: reason || "client_end" })
    .eq("id", attemptId)
    .in("lifecycle", ["authorized", "active"]);

  await logVoiceAudit({
    actorId: user.id,
    action: "attempt_end",
    resource: `voice_attempts:${attemptId}`,
    reason: reason || "client_end",
  });

  return NextResponse.json({ success: true });
}
