import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chat } from "@/lib/ai";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Verify ownership (explicit student_id filter in addition to RLS).
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, student_id, ai_patient_id, session_number, status")
    .eq("id", conversationId)
    .eq("student_id", user.id)
    .single();

  if (!conversation) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  if (conversation.status !== "completed") return NextResponse.json({ error: "Sesión no completada" }, { status: 400 });

  // Check if summary already exists
  const { data: existing } = await supabase
    .from("session_summaries")
    .select("summary, key_revelations")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (existing?.summary) {
    return NextResponse.json({ summary: existing.summary, key_revelations: existing.key_revelations });
  }

  // Fetch messages
  const { data: messages } = await admin
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at");

  if (!messages || messages.length < 2) {
    return NextResponse.json({ error: "Sesión muy corta" }, { status: 400 });
  }

  const transcript = messages
    .map((m) => `${m.role === "user" ? "TERAPEUTA" : "PACIENTE"}: ${m.content}`)
    .join("\n\n");

  const summaryResponse = await chat(
    [{ role: "user", content: `Resume esta sesión terapéutica de forma neutral y observacional.

TRANSCRIPCIÓN:
${transcript}

Responde SOLO con JSON válido:
{
  "summary": "Resumen narrativo de 80-120 palabras en tercera persona neutral. Qué temas se abordaron, cómo reaccionó el paciente, qué intervenciones realizó el terapeuta. Incluir datos concretos mencionados (nombres, lugares, eventos).",
  "key_revelations": ["Dato o información clínicamente relevante que surgió", "Otro dato relevante"],
  "therapeutic_progress": "Una oración describiendo el estado de la relación terapéutica al final de esta sesión."
}` }],
    "Eres un asistente que genera resúmenes compactos de sesiones terapéuticas desde una perspectiva observacional neutral. Solo JSON."
  );

  try {
    const cleaned = summaryResponse.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    await admin.from("session_summaries").upsert({
      conversation_id: conversationId,
      student_id: conversation.student_id,
      ai_patient_id: conversation.ai_patient_id,
      session_number: conversation.session_number || 1,
      summary: parsed.summary,
      key_revelations: parsed.key_revelations || [],
      therapeutic_progress: parsed.therapeutic_progress || "",
    }, { onConflict: "conversation_id" });

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "Error al generar resumen" }, { status: 500 });
  }
}
