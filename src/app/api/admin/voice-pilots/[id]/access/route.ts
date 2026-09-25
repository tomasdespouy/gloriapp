import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { logVoiceAudit } from "@/lib/voice-pilot-auth";

async function requireSuperadmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 } as const;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "superadmin") return { error: "No autorizado", status: 403 } as const;
  return { user };
}

/**
 * Incorporar/revocar participante (P-04, A-03). El MVP no manda
 * invitaciones por correo: busca una cuenta EXISTENTE por email.
 * Incorporar concede además su primer cupo (R-01) — un segundo intento se
 * concede aparte, vía /grants.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: pilotId } = await params;
  const { email, action, reason, userId } = await request.json();

  if (action === "revoke") {
    if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });
    const admin = createAdminClient();
    const { error } = await admin
      .from("voice_pilot_access")
      .update({ revoked_at: new Date().toISOString() })
      .eq("pilot_id", pilotId)
      .eq("user_id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logVoiceAudit({ actorId: auth.user.id, action: "access_revoke", resource: `voice_pilots:${pilotId}`, reason, metadata: { userId } });
    return NextResponse.json({ success: true });
  }

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email requerido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .ilike("email", email.trim())
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "No existe una cuenta con ese correo (el MVP no crea cuentas nuevas — A-03)" }, { status: 404 });
  }

  const { error: accessError } = await admin
    .from("voice_pilot_access")
    .upsert(
      { pilot_id: pilotId, user_id: profile.id, can_participate: true, can_review_own: true, revoked_at: null, granted_by: auth.user.id },
      { onConflict: "pilot_id,user_id" },
    );
  if (accessError) return NextResponse.json({ error: accessError.message }, { status: 500 });

  // Primer cupo, solo si todavía no tiene ninguno (idempotente: reincorporar
  // a alguien ya revocado no le regala un intento extra).
  const { count } = await admin
    .from("voice_attempt_grants")
    .select("id", { count: "exact", head: true })
    .eq("pilot_id", pilotId)
    .eq("user_id", profile.id);

  if (!count || count === 0) {
    const { error: grantError } = await admin.from("voice_attempt_grants").insert({
      pilot_id: pilotId,
      user_id: profile.id,
      attempt_number: 1,
      granted_by: auth.user.id,
      reason: reason || "Incorporación inicial al piloto",
    });
    if (grantError) return NextResponse.json({ error: grantError.message }, { status: 500 });
  }

  await logVoiceAudit({
    actorId: auth.user.id,
    action: "access_grant",
    resource: `voice_pilots:${pilotId}`,
    reason,
    metadata: { userId: profile.id, email: profile.email },
  });

  return NextResponse.json({ success: true, userId: profile.id, fullName: profile.full_name }, { status: 201 });
}
