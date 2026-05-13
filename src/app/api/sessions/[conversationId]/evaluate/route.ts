import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chat } from "@/lib/ai";
import {
  EVALUATION_PROMPT,
  activeModelLabel,
  buildCompetencyUpsert,
  buildUserMessage,
  normalizeEvaluation,
} from "@/lib/evaluation-prompt";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: conversation } = await admin
    .from("conversations")
    .select("id, student_id, status, session_number")
    .eq("id", conversationId)
    .single();

  if (!conversation || conversation.status !== "completed") {
    return NextResponse.json({ error: "Sesión no completada" }, { status: 400 });
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
    const response = await chat(
      [{ role: "user", content: buildUserMessage(transcript, { sessionNumber: conversation.session_number }) }],
      EVALUATION_PROMPT
    );

    const jsonStr = response.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const evaluation = normalizeEvaluation(JSON.parse(jsonStr));

    await admin.from("session_competencies").upsert(
      buildCompetencyUpsert(evaluation, {
        conversationId,
        studentId: conversation.student_id,
        model: activeModelLabel(),
      }),
      { onConflict: "conversation_id" },
    );

    return NextResponse.json({ success: true, evaluation });
  } catch {
    return NextResponse.json({ error: "Error al evaluar la sesión" }, { status: 500 });
  }
}
