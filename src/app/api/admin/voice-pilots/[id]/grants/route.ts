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
 * Conceder otro intento (R-01/P-04): siempre crea un cupo NUEVO, nunca
 * borra ni reinicia el anterior — los intentos previos quedan para
 * auditoría/consulta.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: pilotId } = await params;
  const { userId, reason } = await request.json();
  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

  const admin = createAdminClient();

  const { data: hasAccess } = await admin
    .from("voice_pilot_access")
    .select("id")
    .eq("pilot_id", pilotId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!hasAccess) {
    return NextResponse.json({ error: "El usuario no tiene acceso a este piloto todavía" }, { status: 404 });
  }

  const { data: existing } = await admin
    .from("voice_attempt_grants")
    .select("attempt_number")
    .eq("pilot_id", pilotId)
    .eq("user_id", userId)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = (existing?.attempt_number || 0) + 1;

  const { data, error } = await admin
    .from("voice_attempt_grants")
    .insert({ pilot_id: pilotId, user_id: userId, attempt_number: nextNumber, granted_by: auth.user.id, reason: reason || null })
    .select("id, attempt_number")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logVoiceAudit({
    actorId: auth.user.id,
    action: "attempt_grant",
    resource: `voice_pilots:${pilotId}`,
    reason,
    metadata: { userId, attemptNumber: nextNumber },
  });

  return NextResponse.json({ success: true, grantId: data.id, attemptNumber: data.attempt_number }, { status: 201 });
}
