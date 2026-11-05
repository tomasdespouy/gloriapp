import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeFeedbackAccess } from "@/lib/feedback-auth";
import { buildCompetencyUpsert } from "@/lib/evaluation-prompt";
import { LLM_OUTAGE_END_REASON } from "@/lib/llm-outage";
import { runEvaluator } from "@/lib/session-evaluation";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;

  // Mismo alcance que el resto del flujo docente: esta ruta escribe con el
  // cliente admin, así que RLS no protege a la sesión de otro estudiante.
  const auth = await authorizeFeedbackAccess({ conversationId });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createAdminClient();

  const { data: conversation } = await admin
    .from("conversations")
    .select("id, student_id, status, session_number, end_reason")
    .eq("id", conversationId)
    .single();

  if (!conversation || conversation.status !== "completed") {
    return NextResponse.json({ error: "Sesión no completada" }, { status: 400 });
  }

  // Sesión cortada por falta de saldo: el paciente no respondió, así que no hay
  // conversación que evaluar. Sin esto, una nota ya retirada volvía a generarse.
  if (conversation.end_reason === LLM_OUTAGE_END_REASON) {
    return NextResponse.json({ error: "Sesión cortada por una falla técnica: no se evalúa" }, { status: 409 });
  }

  const { data: existing } = await admin
    .from("session_competencies")
    .select("id")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "La evaluación ya existe" }, { status: 409 });
  }

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
    const { evaluation, model: evalModelLabel } = await runEvaluator(transcript, conversation.session_number);

    await admin.from("session_competencies").upsert(
      buildCompetencyUpsert(evaluation, {
        conversationId,
        studentId: conversation.student_id,
        model: evalModelLabel,
      }),
      { onConflict: "conversation_id" },
    );

    return NextResponse.json({ success: true, evaluation });
  } catch {
    return NextResponse.json({ error: "Error al evaluar la sesión" }, { status: 500 });
  }
}
