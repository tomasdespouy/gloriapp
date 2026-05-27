/**
 * CRON: cierre automático de sesiones inactivas.
 *
 * Marca como "abandoned" (el Paciente IA cierra) las conversaciones activas
 * cuyo alumno lleva >5 min sin presencia. Usamos `profiles.last_seen_at` (el
 * latido cada 60s mientras la pestaña está visible): si el alumno sigue en la
 * sesión leyendo, late y NO se cierra; si cerró/cambió de pestaña, deja de
 * latir y a los 5 min se abandona. Da gracia desde `created_at` para sesiones
 * recién creadas.
 *
 * Pensado para correr cada ~5 min. En Vercel Hobby el cron interno solo corre
 * 1 vez al día (sirve de respaldo); el disparo frecuente se hace con un cron
 * externo (p. ej. cron-job.org) pegando a este endpoint con el header
 * `Authorization: Bearer <CRON_SECRET>`.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const INACTIVITY_MS = 5 * 60 * 1000;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: active, error: fetchError } = await admin
    .from("conversations")
    .select("id, student_id, created_at")
    .eq("status", "active");

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!active || active.length === 0) {
    return NextResponse.json({ abandoned: 0, message: "Sin sesiones activas" });
  }

  // Presencia de los alumnos con sesión activa (lista chica → .in seguro).
  const studentIds = [...new Set(active.map((c) => c.student_id).filter(Boolean))];
  const { data: profs } = await admin
    .from("profiles")
    .select("id, last_seen_at")
    .in("id", studentIds);
  const lastSeen = new Map((profs || []).map((p) => [p.id, p.last_seen_at as string | null]));

  const cutoff = Date.now() - INACTIVITY_MS;
  const staleIds = active
    .filter((c) => {
      const ls = lastSeen.get(c.student_id);
      const seenTs = ls ? Date.parse(ls) : 0;
      const createdTs = Date.parse(c.created_at);
      // Última señal de vida = lo más reciente entre presencia y creación.
      return Math.max(seenTs, createdTs) < cutoff;
    })
    .map((c) => c.id);

  if (staleIds.length === 0) {
    return NextResponse.json({ abandoned: 0, message: "Ninguna inactiva >5 min" });
  }

  const { error: updateError } = await admin
    .from("conversations")
    .update({ status: "abandoned", ended_at: new Date().toISOString() })
    .in("id", staleIds);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    abandoned: staleIds.length,
    message: `Abandonadas ${staleIds.length} sesiones inactivas (>5 min sin presencia)`,
  });
}
