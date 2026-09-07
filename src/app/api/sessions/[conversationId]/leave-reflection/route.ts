import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Marca la conversación como `completed` SIN disparar la evaluación LLM.
 *
 * Dos usos, los dos con la misma idea: el chat con el paciente ya terminó,
 * pero la reflexión todavía no se envía.
 *
 *  1. Al apretar "Finalizar sesión" en el chat, antes de llevar al
 *     formulario. Si no se cerrara acá, la conversación quedaría "activa"
 *     mientras el estudiante responde y el cron de limpieza la marcaría
 *     "abandonada" por debajo — y una sesión abandonada, en el historial,
 *     abre "Retomar conversación" en vez del formulario.
 *  2. Al salir de /review/[id] por el navigation-guard ("Salir igual") sin
 *     enviar la reflexión.
 *
 * En ambos casos queda sin session_competencies: la reflexión sigue
 * pendiente y se retoma desde el historial, que para una sesión completada
 * y sin evaluar lleva directo al formulario.
 *
 * Idempotente: si ya está completed, el filtro de status no matchea y el
 * update es un no-op.
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
