import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canStartAttempt, logVoiceAudit } from "@/lib/voice-pilot-auth";
import { uuidSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

/**
 * POST /api/voice-pilot/attempts — AR contrato (02-arquitectura.md §9).
 *
 * Etapa 1: resuelve la política completa (AU-01) y reclama el cupo de
 * forma atómica, pero NO abre ninguna conexión real de voz — eso es
 * Etapa 2 (relé). Devuelve attempt_id + deadline para que el flujo de
 * autorización/concurrencia (AC-07, AC-18) sea probable sin gastar nada.
 *
 * Atomicidad: voice_attempts.grant_id es UNIQUE — si dos requests
 * concurrentes intentan reclamar el mismo cupo, el segundo INSERT falla
 * por esa restricción (23505), sin necesidad de un lock explícito.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { patientId } = await request.json().catch(() => ({ patientId: null }));
  if (!uuidSchema.safeParse(patientId).success) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const decision = await canStartAttempt(user.id, patientId);
  if (!decision.ok) {
    // 404 si no hay derecho sobre el recurso, 409 si es un tema de cupo/
    // concurrencia — mismo contrato de status codes que AU-02.
    const status = decision.reason === "attempt_in_progress" || decision.reason === "no_grant_available" ? 409 : 404;
    return NextResponse.json({ error: decision.reason }, { status });
  }

  const { pilot, grantId, attemptNumber } = decision;
  const admin = createAdminClient();
  const deadlineAt = new Date(Date.now() + pilot.maxDurationSeconds * 1000).toISOString();

  const { data: attempt, error: insertError } = await admin
    .from("voice_attempts")
    .insert({
      grant_id: grantId,
      attempt_number: attemptNumber,
      lifecycle: "authorized",
      deadline_at: deadlineAt,
      model_snapshot: pilot.modelSnapshot,
      voice_snapshot: pilot.voiceId,
    })
    .select("id")
    .single();

  if (insertError) {
    // 23505 = unique_violation en grant_id: alguien más ganó la carrera.
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "attempt_in_progress" }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await admin
    .from("voice_attempt_grants")
    .update({ consumed_by: attempt.id })
    .eq("id", grantId)
    .is("consumed_by", null);

  await logVoiceAudit({
    actorId: user.id,
    action: "attempt_start",
    resource: `voice_attempts:${attempt.id}`,
    metadata: { patientId, pilotId: pilot.id },
  });

  return NextResponse.json({
    attemptId: attempt.id,
    deadlineAt,
    maxDurationSeconds: pilot.maxDurationSeconds,
    // Sin ticket de relé todavía — Etapa 2. El front no puede conectar
    // nada real con esta respuesta hoy, solo confirmar autorización.
  }, { status: 201 });
}
