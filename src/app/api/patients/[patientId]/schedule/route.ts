import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation/schemas";
import { getCertificationPolicy } from "@/lib/certification";

export const runtime = "nodejs";

/**
 * Agenda o reprograma un paciente del programa de certificación. Un solo
 * endpoint que hace upsert (un cupo por paciente por alumno — ver el UNIQUE
 * en patient_schedules): si no existe fila la crea, si existe la reprograma.
 *
 * Esto es la única fuente de verdad al ESCRIBIR el horario; el candado real
 * al iniciar sesión se re-valida en /api/chat (route.ts), no acá — este
 * endpoint valida que la fecha no choque con otros cupos/sesiones al
 * agendar, pero el gate real de "¿puede entrar ahora?" vive en el chat.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { patientId } = await params;
  if (!uuidSchema.safeParse(patientId).success) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const { scheduledAt } = await request.json().catch(() => ({ scheduledAt: null }));
  if (typeof scheduledAt !== "string" || Number.isNaN(new Date(scheduledAt).getTime())) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const policy = await getCertificationPolicy(user.id);
  if (!policy.isCertificationProgram) {
    return NextResponse.json({ error: "not_certification_program" }, { status: 403 });
  }

  const target = new Date(scheduledAt);
  const now = new Date();
  if (target.getTime() <= now.getTime()) {
    return NextResponse.json({ error: "La fecha debe ser futura" }, { status: 400 });
  }

  const admin = createAdminClient();
  const minMs = policy.minHoursBetweenSessions * 60 * 60 * 1000;

  // Choques: la fecha elegida debe quedar a ≥ minHours de CUALQUIER otro
  // cupo agendado (otros pacientes) y de cualquier sesión ya completada —
  // en ambas direcciones, para que el alumno nunca agende algo que después
  // va a chocar con el mínimo entre sesiones.
  const [{ data: otherSchedules }, { data: pastSessions }] = await Promise.all([
    admin
      .from("patient_schedules")
      .select("ai_patient_id, scheduled_at")
      .eq("student_id", user.id)
      .eq("status", "pendiente")
      .neq("ai_patient_id", patientId),
    admin
      .from("conversations")
      .select("ended_at")
      .eq("student_id", user.id)
      .not("ended_at", "is", null),
  ]);

  const otherTimes = [
    ...(otherSchedules || []).map((s) => new Date(s.scheduled_at).getTime()),
    ...(pastSessions || []).map((s) => new Date(s.ended_at as string).getTime()),
  ];
  const collision = otherTimes.find((t) => Math.abs(target.getTime() - t) < minMs);
  if (collision !== undefined) {
    return NextResponse.json(
      { error: "collision", minHours: policy.minHoursBetweenSessions },
      { status: 409 },
    );
  }

  const { data: existing } = await admin
    .from("patient_schedules")
    .select("id, rescheduled_count")
    .eq("student_id", user.id)
    .eq("ai_patient_id", patientId)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("patient_schedules")
      .update({
        scheduled_at: target.toISOString(),
        status: "pendiente",
        rescheduled_count: (existing.rescheduled_count || 0) + 1,
        reminder_sent_at: null,
      })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin.from("patient_schedules").insert({
      student_id: user.id,
      ai_patient_id: patientId,
      scheduled_at: target.toISOString(),
      status: "pendiente",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, scheduledAt: target.toISOString() });
}
