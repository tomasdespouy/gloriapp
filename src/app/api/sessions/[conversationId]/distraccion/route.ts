import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation/schemas";

/**
 * Registra una distracción detectada durante la sesión.
 *
 * El chat ya las detectaba, pero el conteo vivía solo en el navegador y se
 * perdía al cerrar la pestaña — justo el momento en que más interesa saberlo.
 *
 * Incrementa en el servidor (nunca recibe un total del cliente): así dos
 * pestañas abiertas o un reintento no pisan el conteo con un número viejo.
 * Es best-effort: si falla, el chat sigue. Nadie debería quedarse sin poder
 * conversar porque no se pudo anotar que cambió de pestaña.
 *
 * Con `cut: true` el chat avisa que esta distracción alcanzó el umbral de la
 * asignatura y bloqueó la sesión. Antes ese cierre vivía solo en el navegador:
 * la conversación seguía "activa", sin motivo, y el docente no podía saber por
 * qué el alumno dejó de escribir. Acá queda cerrada y con su motivo
 * (end_reason = "distraction:<kind>").
 */

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { conversationId } = await params;
  if (!uuidSchema.safeParse(conversationId).success) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const { kind, cut } = await request.json().catch(() => ({ kind: null, cut: false }));
  if (kind !== "paste" && kind !== "tab_switch") {
    return NextResponse.json({ error: "kind debe ser 'paste' o 'tab_switch'" }, { status: 400 });
  }

  const admin = createAdminClient();

  // La conversación tiene que ser suya. Se lee con el cliente de servicio pero
  // se compara contra la sesión autenticada.
  const { data: convo } = await admin
    .from("conversations")
    .select("student_id, paste_count, tab_switch_count")
    .eq("id", conversationId)
    .maybeSingle();

  if (!convo || convo.student_id !== user.id) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  const columna = kind === "paste" ? "paste_count" : "tab_switch_count";
  const actual = (convo as Record<string, unknown>)[columna];
  const siguiente = (typeof actual === "number" ? actual : 0) + 1;

  const { error } = await admin
    .from("conversations")
    .update({ [columna]: siguiente })
    .eq("id", conversationId);

  // Si la columna todavía no existe (código desplegado antes que su migración),
  // se responde ok igual: el chat no debe romperse por un contador.
  if (error) return NextResponse.json({ ok: false, motivo: error.message });

  if (cut === true) {
    // Solo cierra una sesión viva; si ya estaba cerrada, no pisa su motivo.
    const { data: cerrada, error: errorCierre } = await admin
      .from("conversations")
      .update({ status: "completed", ended_at: new Date().toISOString(), end_reason: `distraction:${kind}` })
      .eq("id", conversationId)
      .in("status", ["active", "abandoned"])
      .select("ai_patient_id")
      .maybeSingle();
    if (errorCierre) console.error("[distraccion] no se pudo registrar el cierre", conversationId, errorCierre.message);

    // Programa de certificación: el cupo agendado se marca cumplido, igual que
    // en leave-reflection (que ya no lo hará porque la sesión llega cerrada).
    if (cerrada?.ai_patient_id) {
      await admin
        .from("patient_schedules")
        .update({ status: "completada", conversation_id: conversationId })
        .eq("student_id", user.id)
        .eq("ai_patient_id", cerrada.ai_patient_id)
        .eq("status", "pendiente")
        .then(undefined, () => {});
    }
  }

  return NextResponse.json({ ok: true, [columna]: siguiente });
}
