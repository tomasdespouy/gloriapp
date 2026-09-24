import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeFeedbackAccess } from "@/lib/feedback-auth";
import { NextResponse } from "next/server";

// Only these fields can be edited by instructors.
// OJO: hasta aquí este set traía nombres de una rúbrica anterior
// (alianza_terapeutica, empatia_validacion, etc.) que ya no son columnas de
// session_competencies — de las 10 competencias V2 (Valdés & Gómez, 2023)
// solo 3 coincidían por casualidad (setting_terapeutico, motivo_consulta,
// escucha_activa); los ajustes del docente a las otras 7 (datos_contextuales,
// objetivos, actitud_no_valorativa, optimismo, presencia, conducta_no_verbal,
// contencion_afectos) y al overall_score_v2 se filtraban en silencio y nunca
// llegaban a guardarse.
const ALLOWED_FIELDS = new Set([
  "ai_commentary", "strengths", "areas_to_improve",
  "setting_terapeutico", "motivo_consulta", "datos_contextuales", "objetivos",
  "escucha_activa", "actitud_no_valorativa", "optimismo", "presencia",
  "conducta_no_verbal", "contencion_afectos",
  "overall_score_v2", "overall_score",
]);

export async function POST(request: Request) {
  const { conversation_id, updates } = await request.json();
  if (!conversation_id || !updates) {
    return NextResponse.json({ error: "conversation_id y updates requeridos" }, { status: 400 });
  }

  // Role + establishment scope: an instructor may only edit the AI evaluation
  // of sessions of students in their own establishment.
  const auth = await authorizeFeedbackAccess({ conversationId: conversation_id });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Filter to only allowed fields
  const safeUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (ALLOWED_FIELDS.has(key)) safeUpdates[key] = value;
  }

  if (Object.keys(safeUpdates).length === 0) {
    return NextResponse.json({ error: "No hay campos válidos para actualizar" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("session_competencies")
    .update(safeUpdates)
    .eq("conversation_id", conversation_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
