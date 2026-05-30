import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Marca la conversación como `completed` SIN disparar la evaluación LLM.
 *
 * Caso de uso: el estudiante está en /review/[id], decidió salir vía el
 * navigation-guard ("Salir igual") sin enviar la reflexión. El chat ya
 * terminó (no se puede retomar la conversación con el paciente), pero
 * tampoco hay session_competencies — la reflexión queda pendiente y se
 * retoma desde historial.
 *
 * Idempotente: si ya está completed, no hace nada.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { conversationId } = await params;

  // Solo transiciona active/abandoned → completed. Si ya está completed,
  // el filtro de status no matchea y el update es no-op (success vacío).
  const { error } = await supabase
    .from("conversations")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("student_id", user.id)
    .in("status", ["active", "abandoned"]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
