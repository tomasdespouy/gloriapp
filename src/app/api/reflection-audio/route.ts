import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { chat } from "@/lib/ai";

const ORGANIZE_PROMPT = `Eres un asistente que ayuda a estudiantes de psicología a organizar sus reflexiones post-sesión.

El estudiante grabó un audio describiendo libremente su experiencia en una sesión terapéutica simulada. Tu trabajo es organizar lo que dijo en 3 campos específicos.

Responde ÚNICAMENTE con JSON válido (sin markdown, sin backticks):
{
  "discomfort_moment": "Resumen del momento donde sintió mayor incomodidad o no supo cómo responder. Si no mencionó nada, dejar vacío.",
  "would_redo": "Lo que haría diferente si pudiera repetir la sesión. Si no mencionó nada, dejar vacío.",
  "clinical_note": "Observaciones generales sobre la sesión, impresiones clínicas, o cualquier otro comentario relevante. Si no mencionó nada, dejar vacío."
}

Reglas:
- Usa las propias palabras del estudiante tanto como sea posible
- No inventes contenido que el estudiante no haya mencionado
- Si el estudiante mencionó algo que aplica a más de un campo, ponlo en el más relevante
- Los campos vacíos deben ser string vacío ""
- Responde siempre en español`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await request.formData();
  const audioFile = formData.get("audio") as File | null;

  if (!audioFile) {
    return NextResponse.json({ error: "No se recibió audio" }, { status: 400 });
  }

  // Step 1: Transcribe with OpenAI Whisper
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  let transcript: string;
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "es",
    });
    transcript = transcription.text;
  } catch {
    return NextResponse.json({ error: "Error al transcribir el audio" }, { status: 500 });
  }

  if (!transcript.trim()) {
    return NextResponse.json({ error: "No se detectó audio con contenido" }, { status: 400 });
  }

  // Step 2: Organize transcript into 3 fields using LLM
  try {
    const response = await chat(
      [{ role: "user", content: `Transcripción del audio del estudiante:\n\n"${transcript}"` }],
      ORGANIZE_PROMPT
    );

    const jsonStr = response.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const organized = JSON.parse(jsonStr);

    return NextResponse.json({
      transcript,
      discomfort_moment: organized.discomfort_moment || "",
      would_redo: organized.would_redo || "",
      clinical_note: organized.clinical_note || "",
    });
  } catch {
    // If organization fails, return just the transcript
    return NextResponse.json({
      transcript,
      discomfort_moment: transcript,
      would_redo: "",
      clinical_note: "",
    });
  }
}
