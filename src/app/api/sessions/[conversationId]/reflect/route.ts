import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

/**
 * Guarda SOLO la autorreflexión del alumno, sin re-evaluar ni notificar.
 *
 * Caso de uso: la sesión YA tiene evaluación IA (p. ej. una re-evaluación por
 * lote, o el alumno cerró el navegador sin reflexionar y luego retoma desde su
 * historial). El flujo normal `/complete` volvería a correr el LLM y duplicaría
 * XP, logros, notificaciones y correos al docente. Este endpoint es additivo e
 * idempotente: solo escribe los campos de reflexión en `session_feedback`
 * (upsert por conversation_id) y deja intactos la evaluación, el estado de la
 * conversación y los campos del docente (teacher_comment/teacher_score).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Defensa en profundidad sobre RLS: el alumno solo reflexiona sobre su sesión.
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, student_id")
    .eq("id", conversationId)
    .eq("student_id", user.id)
    .single();
  if (!conv) return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const {
    discomfort_moment, would_redo, clinical_note,
    alliance_framing, rupture_moment, nonverbal_cues,
    intervention_types, clinical_hypothesis,
  } = body;

  const admin = createAdminClient();
  // Upsert: solo toca las columnas de reflexión. Si ya existe la fila (con
  // teacher_comment/score), esos campos no van en el payload y se conservan.
  const { error } = await admin.from("session_feedback").upsert({
    conversation_id: conversationId,
    student_id: user.id,
    discomfort_moment, would_redo, clinical_note,
    alliance_framing, rupture_moment, nonverbal_cues,
    intervention_types, clinical_hypothesis,
  }, { onConflict: "conversation_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
