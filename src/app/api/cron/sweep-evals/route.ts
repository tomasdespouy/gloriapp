/**
 * CRON: barrido de recuperación de evaluaciones IA.
 *
 * Red de seguridad para el hueco de robustez: si el evaluador LLM falla al
 * enviar la autorreflexión, la sesión queda `completed` (con o sin reflexión)
 * pero SIN evaluación ni resumen, y hasta ahora nada la recuperaba. Este
 * barrido busca sesiones completadas recientes que quedaron sin evaluar y las
 * evalúa + resume + avisa al docente, reusando el mismo motor central
 * (`evaluateConversation`). Idempotente: solo toca sesiones sin eval.
 *
 * Auth: Bearer CRON_SECRET. Se dispara con un cron EXTERNO (cron-job.org)
 * pegándole a GET /api/cron/sweep-evals con el header
 * `Authorization: Bearer <CRON_SECRET>` — mismo patrón que cleanup-sessions.
 * No usa el cron de Vercel (el cupo del plan está tomado por otro proyecto).
 * Recomendado cada ~1-3 h para recuperación rápida; con 1×/día también sirve.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { evaluateConversation } from "@/lib/session-evaluation";

export const maxDuration = 300;

const LOOKBACK_DAYS = 7;
const MAX_PER_RUN = 8; // cada eval es una llamada LLM ~20-30s; entra en 300s.

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();

  // Sesiones completadas recientes.
  const { data: convs } = await admin
    .from("conversations")
    .select("id, active_seconds, created_at, ended_at")
    .eq("status", "completed")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (!convs || convs.length === 0) {
    return NextResponse.json({ swept: 0, message: "Sin sesiones completadas recientes" });
  }

  // Cuáles YA tienen eval (para no re-evaluar ni pisar revisiones del docente).
  const ids = convs.map((c) => c.id);
  const evaluated = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin
      .from("session_competencies")
      .select("conversation_id")
      .in("conversation_id", ids.slice(i, i + 200));
    (data || []).forEach((e) => evaluated.add(e.conversation_id));
  }

  // Candidatas SIN eval. Elegibles = no "tooShort": >=5 min de tiempo activo O
  // >=6 mensajes (mismo criterio que la página de review para saltear la eval).
  // Cutoff de "asentamiento": NO tocar sesiones que terminaron hace <15 min. En
  // esa ventana /complete puede seguir corriendo su evaluación (o su after()) y
  // el cron pisaría/duplicaría (doble aviso al docente, doble trabajo LLM). El
  // barrido es red de seguridad para fallos YA consumados, no para sesiones en
  // vuelo. ended_at lo fija /complete al inicio; si faltara, cae a created_at.
  const settleCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const noEval = convs.filter((c) => !evaluated.has(c.id));
  const eligible: string[] = [];
  for (const c of noEval) {
    const settledAt = c.ended_at || c.created_at;
    if (settledAt >= settleCutoff) continue; // recién terminada — dale tiempo a /complete
    if ((c.active_seconds || 0) >= 300) { eligible.push(c.id); continue; }
    const { count } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", c.id);
    if ((count || 0) >= 6) eligible.push(c.id);
  }

  const batch = eligible.slice(0, MAX_PER_RUN);
  let ok = 0, errors = 0, skipped = 0;
  for (const id of batch) {
    const r = await evaluateConversation(admin, id, { notify: true });
    if (r.status === "ok") ok++;
    else if (r.status === "error") errors++;
    else skipped++;
  }

  return NextResponse.json({
    found_missing: eligible.length,
    processed: batch.length,
    ok,
    errors,
    skipped,
    remaining: Math.max(0, eligible.length - batch.length),
  });
}
