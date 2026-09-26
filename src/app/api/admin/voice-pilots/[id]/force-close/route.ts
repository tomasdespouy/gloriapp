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
 * Corta una sesión de voz EN CURSO (AU-08: revocación/apagado/presupuesto
 * deben cortar dentro de ~5s). A diferencia de "revocar acceso" (que solo
 * impide FUTUROS intentos), esto llama al relé para cerrar una conexión
 * activa ahora mismo — solo es efectivo porque el relé (Etapa 2) es dueño
 * de la conexión real a OpenAI, no un observador secundario.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: pilotId } = await params;
  const { attemptId, reason } = await request.json().catch(() => ({ attemptId: null, reason: null }));
  if (!attemptId) return NextResponse.json({ error: "attemptId requerido" }, { status: 400 });

  const relayUrl = process.env.VOICE_RELAY_URL;
  const sharedSecret = process.env.VOICE_RELAY_SHARED_SECRET;
  if (!relayUrl || !sharedSecret) {
    return NextResponse.json({ error: "El relé no está configurado (VOICE_RELAY_URL/VOICE_RELAY_SHARED_SECRET)" }, { status: 500 });
  }

  let relayStatus: number;
  try {
    const res = await fetch(`${relayUrl.replace(/\/$/, "")}/internal/sessions/${attemptId}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sharedSecret}` },
      body: JSON.stringify({ reason: reason || "Cierre forzoso desde admin" }),
    });
    relayStatus = res.status;
  } catch (err) {
    return NextResponse.json({ error: `No se pudo contactar al relé: ${err instanceof Error ? err.message : String(err)}` }, { status: 502 });
  }

  // 404 del relé = la sesión ya no estaba activa ahí (ya terminó sola,
  // p.ej. por deadline) — no es un error real para efectos de esta acción.
  if (relayStatus !== 200 && relayStatus !== 404) {
    return NextResponse.json({ error: `El relé respondió ${relayStatus}` }, { status: 502 });
  }

  const admin = createAdminClient();
  await admin
    .from("voice_attempts")
    .update({ lifecycle: "technical_end", ended_at: new Date().toISOString(), end_reason: reason || "revoked_by_admin" })
    .eq("id", attemptId)
    .in("lifecycle", ["authorized", "active"]);

  await logVoiceAudit({
    actorId: auth.user.id,
    action: "attempt_force_close",
    resource: `voice_attempts:${attemptId}`,
    reason,
    metadata: { pilotId, relayStatus },
  });

  return NextResponse.json({ success: true, relayStatus });
}
