import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chat } from "@/lib/ai";

const EVALUATION_PROMPT = `Eres un supervisor clínico experto evaluando la sesión de un estudiante de psicología.
Usa la Pauta para la Evaluación de Competencias Psicoterapéuticas para el trabajo con Adultos (Valdés & Gómez, 2023), del libro "Supervisión clínica para estudiantes de Psicología" (Ediciones Universidad Santo Tomás).

Evalúa la conversación en estas 10 competencias, escala de 0 a 4:
- 0: No aplicaba (la situación no requería esta competencia)
- 1: Deficiente (no cumplió cuando era necesario)
- 2: Básico/parcial (cumplió parcialmente)
- 3: Adecuado (cumplió satisfactoriamente)
- 4: Excelente/integrado (excepcional e integrado con otras intervenciones)

DOMINIO 1 — ESTRUCTURA DE LA SESIÓN:
- setting_terapeutico, motivo_consulta, datos_contextuales, objetivos

DOMINIO 2 — ACTITUDES TERAPÉUTICAS:
- escucha_activa, actitud_no_valorativa, optimismo, presencia, conducta_no_verbal, contencion_afectos

El promedio general (overall_score_v2) se calcula SOLO con competencias que obtienen > 0.

Para CADA competencia con puntaje > 0, incluye una cita textual del estudiante que justifique el puntaje.

Responde ÚNICAMENTE con JSON válido (sin markdown, sin backticks):
{
  "setting_terapeutico": 0.0, "motivo_consulta": 0.0, "datos_contextuales": 0.0, "objetivos": 0.0,
  "escucha_activa": 0.0, "actitud_no_valorativa": 0.0, "optimismo": 0.0, "presencia": 0.0,
  "conducta_no_verbal": 0.0, "contencion_afectos": 0.0, "overall_score_v2": 0.0,
  "commentary": "Retroalimentación constructiva en 2-3 oraciones",
  "strengths": ["fortaleza 1", "fortaleza 2"],
  "areas_to_improve": ["área 1", "área 2"],
  "evidence": {
    "setting_terapeutico": {"quote": "cita", "observation": "observación"},
    "motivo_consulta": {"quote": "...", "observation": "..."},
    "datos_contextuales": {"quote": "...", "observation": "..."},
    "objetivos": {"quote": "...", "observation": "..."},
    "escucha_activa": {"quote": "...", "observation": "..."},
    "actitud_no_valorativa": {"quote": "...", "observation": "..."},
    "optimismo": {"quote": "...", "observation": "..."},
    "presencia": {"quote": "...", "observation": "..."},
    "conducta_no_verbal": {"quote": "...", "observation": "..."},
    "contencion_afectos": {"quote": "...", "observation": "..."}
  }
}`;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Verify conversation exists and is completed
  const { data: conversation } = await admin
    .from("conversations")
    .select("id, student_id, status")
    .eq("id", conversationId)
    .single();

  if (!conversation || conversation.status !== "completed") {
    return NextResponse.json({ error: "Sesión no completada" }, { status: 400 });
  }

  // Check if evaluation already exists
  const { data: existing } = await admin
    .from("session_competencies")
    .select("id")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "La evaluación ya existe" }, { status: 409 });
  }

  // Fetch messages
  const { data: messages } = await admin
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at");

  if (!messages || messages.length < 2) {
    return NextResponse.json({ error: "Sesión muy corta para evaluar" }, { status: 400 });
  }

  const transcript = messages
    .map((m) => `${m.role === "user" ? "TERAPEUTA" : "PACIENTE"}: ${m.content}`)
    .join("\n\n");

  try {
    const response = await chat(
      [{ role: "user", content: `Conversación a evaluar:\n\n${transcript}` }],
      EVALUATION_PROMPT
    );

    const jsonStr = response.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const evaluation = JSON.parse(jsonStr);

    const overallV2 = evaluation.overall_score_v2 || 0;

    await admin.from("session_competencies").upsert({
      conversation_id: conversationId,
      student_id: conversation.student_id,
      setting_terapeutico: evaluation.setting_terapeutico || 0,
      motivo_consulta: evaluation.motivo_consulta || 0,
      datos_contextuales: evaluation.datos_contextuales || 0,
      objetivos: evaluation.objetivos || 0,
      escucha_activa: evaluation.escucha_activa || 0,
      actitud_no_valorativa: evaluation.actitud_no_valorativa || 0,
      optimismo: evaluation.optimismo || 0,
      presencia: evaluation.presencia || 0,
      conducta_no_verbal: evaluation.conducta_no_verbal || 0,
      contencion_afectos: evaluation.contencion_afectos || 0,
      overall_score_v2: overallV2,
      overall_score: overallV2,
      eval_version: 2,
      ai_commentary: evaluation.commentary,
      strengths: evaluation.strengths || [],
      areas_to_improve: evaluation.areas_to_improve || [],
      evidence: evaluation.evidence || null,
      feedback_status: "pending",
    }, { onConflict: "conversation_id" });

    return NextResponse.json({ success: true, evaluation });
  } catch {
    return NextResponse.json({ error: "Error al evaluar la sesión" }, { status: 500 });
  }
}
