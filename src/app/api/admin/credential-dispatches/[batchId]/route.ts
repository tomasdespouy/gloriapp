/**
 * Un envío programado: ver detalle, reprogramar y cancelar.
 *
 * GET    → el lote + sus filas, con el motivo de cada omisión. Es el reporte
 *          que antes vivía solo en el estado de React y se perdía al recargar.
 * PATCH  → mover la fecha de inicio. Preserva el escalonado: cada fila conserva
 *          su nº de tanda y se recalcula sobre la nueva base.
 * DELETE → cancelar. Detiene incluso lo que el worker ya tenía reclamado,
 *          porque relee cancel_requested_at antes de tocar cada contraseña.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slotForBatchIndex, validatePace } from "@/lib/dispatch-schedule";
import { skipReasonLabel, type SkipReason } from "@/lib/credentials/eligibility";
import { logAdminAction } from "@/lib/audit";

const VIDA_HORAS = 48;

async function resolveAccess(batchId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role;
  if (role !== "admin" && role !== "superadmin") {
    return { error: NextResponse.json({ error: "Sin permisos" }, { status: 403 }) };
  }

  const admin = createAdminClient();
  const { data: batch } = await admin
    .from("credential_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) return { error: NextResponse.json({ error: "Envío no encontrado" }, { status: 404 }) };

  // Un admin solo toca los envíos que él programó; el superadmin, cualquiera.
  if (role === "admin" && batch.scheduled_by !== user.id) {
    return { error: NextResponse.json({ error: "Este envío no es tuyo" }, { status: 403 }) };
  }

  return { admin, batch, userId: user.id, role };
}

export async function GET(_request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const acc = await resolveAccess(batchId);
  if ("error" in acc) return acc.error;
  const { admin, batch } = acc;

  const { data: filas } = await admin
    .from("credential_dispatches")
    .select("id, kind, user_id, email_snapshot, name_snapshot, batch_index, send_after, status, skip_reason, sent_at, attempts, last_error, provider_message_id")
    .eq("batch_id", batchId)
    .order("send_after", { ascending: true })
    .order("name_snapshot", { ascending: true });

  const { data: stats } = await admin
    .from("credential_batch_stats")
    .select("*")
    .eq("batch_id", batchId)
    .maybeSingle();

  return NextResponse.json({
    batch,
    stats,
    filas: (filas ?? []).map((f) => ({
      ...f,
      skip_label: f.skip_reason ? skipReasonLabel(f.skip_reason as SkipReason) : null,
    })),
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const acc = await resolveAccess(batchId);
  if ("error" in acc) return acc.error;
  const { admin, batch, userId } = acc;

  if (batch.cancel_requested_at) {
    return NextResponse.json({ error: "Este envío ya fue cancelado" }, { status: 409 });
  }

  let body: { startsAt?: string; perBatch?: number; everyMinutes?: number; label?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const pace = {
    perBatch: body.perBatch ?? batch.per_batch,
    everyMinutes: body.everyMinutes ?? batch.every_minutes,
  };
  const paceError = validatePace(pace);
  if (paceError) return NextResponse.json({ error: paceError }, { status: 400 });

  const startsAt = body.startsAt ?? batch.starts_at;
  const startsMs = new Date(startsAt).getTime();
  if (Number.isNaN(startsMs)) {
    return NextResponse.json({ error: "Fecha de envío inválida" }, { status: 400 });
  }

  await admin
    .from("credential_batches")
    .update({
      starts_at: new Date(startsMs).toISOString(),
      per_batch: pace.perBatch,
      every_minutes: pace.everyMinutes,
      label: body.label?.trim() ?? batch.label,
    })
    .eq("id", batchId);

  // Solo se mueven las filas que todavía no salieron. Lo enviado es historia.
  const { data: pendientes } = await admin
    .from("credential_dispatches")
    .select("id, batch_index")
    .eq("batch_id", batchId)
    .eq("status", "pendiente");

  let movidas = 0;
  for (const f of pendientes ?? []) {
    const cuando = slotForBatchIndex(new Date(startsMs).toISOString(), f.batch_index, pace);
    await admin
      .from("credential_dispatches")
      .update({
        send_after: cuando,
        next_attempt_at: cuando,
        expires_at: new Date(new Date(cuando).getTime() + VIDA_HORAS * 3600_000).toISOString(),
      })
      .eq("id", f.id);
    movidas++;
  }

  await logAdminAction({
    adminId: userId,
    action: "reschedule_credentials",
    entityType: "credential_batch",
    entityId: batchId,
    details: { startsAt: new Date(startsMs).toISOString(), movidas, perBatch: pace.perBatch, everyMinutes: pace.everyMinutes },
  });

  return NextResponse.json({ ok: true, movidas });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const acc = await resolveAccess(batchId);
  if ("error" in acc) return acc.error;
  const { admin, batch, userId } = acc;

  const ahora = new Date().toISOString();

  // Marcar el lote primero: el worker lo relee antes de tocar cada contraseña,
  // así que a partir de este instante ya no sale ningún correo más, incluso de
  // las filas que tenía reclamadas en 'procesando'.
  await admin
    .from("credential_batches")
    .update({ cancel_requested_at: ahora, cancel_requested_by: userId })
    .eq("id", batchId);

  const { data: canceladas } = await admin
    .from("credential_dispatches")
    .update({ status: "cancelado", skip_reason: "cancelado_por_admin", pending_password: null })
    .eq("batch_id", batchId)
    .in("status", ["pendiente", "procesando"])
    .select("id");

  await logAdminAction({
    adminId: userId,
    action: "cancel_credentials_batch",
    entityType: "credential_batch",
    entityId: batchId,
    details: { canceladas: canceladas?.length ?? 0, label: batch.label },
  });

  return NextResponse.json({ ok: true, canceladas: canceladas?.length ?? 0 });
}
