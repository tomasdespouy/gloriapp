import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// Only these fields can be edited by instructors
const ALLOWED_FIELDS = new Set([
  "ai_commentary", "strengths", "areas_to_improve",
  "setting_terapeutico", "motivo_consulta", "alianza_terapeutica",
  "escucha_activa", "empatia_validacion", "preguntas_exploracion",
  "conceptualizacion_clinica", "tecnicas_intervenciones",
  "manejo_silencio_ritmo", "cierre_sintesis", "autoconciencia_limites",
  "overall_score",
]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "instructor" && profile?.role !== "admin" && profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { conversation_id, updates } = await request.json();
  if (!conversation_id || !updates) {
    return NextResponse.json({ error: "conversation_id y updates requeridos" }, { status: 400 });
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
