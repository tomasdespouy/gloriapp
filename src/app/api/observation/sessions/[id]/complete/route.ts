import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chat } from "@/lib/ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { total_duration } = await request.json();

  // Mark session as completed
  const { error } = await supabase
    .from("observation_sessions")
    .update({
      status: "completed",
      total_duration_seconds: total_duration || 0,
      ended_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("student_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Generate semantic analysis synchronously before responding
  await generateSemanticAnalysis(id);

  return NextResponse.json({ ok: true });
}

async function generateSemanticAnalysis(sessionId: string) {
  const admin = createAdminClient();

  const { data: segments } = await admin
    .from("observation_segments")
    .select("speaker, transcript, segment_order")
    .eq("session_id", sessionId)
    .order("segment_order", { ascending: true });

  if (!segments || segments.length === 0) return;

  const transcriptLines = segments
    .filter((s) => s.transcript)
    .map((s) => `[${s.speaker === "observer" ? "Observador" : "Paciente"}]: ${s.transcript}`);

  if (transcriptLines.length < 2) return;

  const transcript = transcriptLines.join("\n");

  const systemPrompt = `Eres un analista de sesiones terapéuticas. Analiza la siguiente transcripción de una sesión de observación entre un estudiante de psicología (Observador) y un paciente.

Responde SOLO con un JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "summary": "Resumen breve de la sesión en 2-3 oraciones",
  "themes": ["Tema 1", "Tema 2", ...],
  "tone": {
    "observer": "Descripción del tono del observador (ej: empático, directivo, cálido, distante)",
    "patient": "Descripción del tono del paciente (ej: ansioso, cooperativo, resistente, abierto)"
  },
  "keywords": ["palabra1", "palabra2", ...],
  "strengths": ["Aspecto positivo 1", ...],
  "improvements": ["Sugerencia de mejora 1", ...]
}

Responde en español. Sé conciso y clínico.`;

  try {
    const response = await chat(
      [{ role: "user", content: transcript }],
      systemPrompt
    );

    const cleaned = response.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
    let analysis;
    try {
      analysis = JSON.parse(cleaned);
    } catch {
      analysis = { summary: response, themes: [], tone: null, keywords: [], strengths: [], improvements: [] };
    }

    await admin
      .from("observation_sessions")
      .update({ semantic_analysis: analysis })
      .eq("id", sessionId);
  } catch (err) {
    console.error("Semantic analysis failed:", err);
  }
}
