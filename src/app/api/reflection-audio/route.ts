import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { chat } from "@/lib/ai";

const ORGANIZE_PROMPT = `Eres un asistente que ayuda a estudiantes de psicolog\u00eda a organizar sus reflexiones post-sesi\u00f3n de pr\u00e1ctica terap\u00e9utica.

El estudiante grab\u00f3 un audio describiendo libremente su experiencia. Tu trabajo es organizar lo que dijo en 5 campos cl\u00ednicos espec\u00edficos.

Responde \u00daNICAMENTE con JSON v\u00e1lido (sin markdown, sin backticks):
{
  "alliance_framing": "Lo que mencion\u00f3 sobre c\u00f3mo estableci\u00f3 el encuadre terap\u00e9utico (confidencialidad, roles, objetivos) y la respuesta del paciente. Si no mencion\u00f3 nada, dejar vac\u00edo.",
  "rupture_moment": "Momentos de incomodidad, silencio tenso, cambio emocional del paciente o rupturas del v\u00ednculo que detect\u00f3 (o no detect\u00f3). Si no mencion\u00f3 nada, dejar vac\u00edo.",
  "nonverbal_cues": "Lo que mencion\u00f3 sobre se\u00f1ales no verbales del paciente (suspiros, postura, mirada, gestos) y si las integr\u00f3 en su intervenci\u00f3n. Si no mencion\u00f3 nada, dejar vac\u00edo.",
  "intervention_types": "Reflexiones sobre el tipo de intervenciones que us\u00f3 (preguntas, reflejos, s\u00edntesis, validaciones, consejos prematuros). Si no mencion\u00f3 nada, dejar vac\u00edo.",
  "clinical_hypothesis": "Hip\u00f3tesis cl\u00ednica sobre el motivo de consulta del paciente o lo que explorar\u00eda en una segunda sesi\u00f3n. Si no mencion\u00f3 nada, dejar vac\u00edo."
}

Reglas:
- Usa las propias palabras del estudiante tanto como sea posible
- No inventes contenido que el estudiante no haya mencionado
- Si el estudiante mencion\u00f3 algo que aplica a m\u00e1s de un campo, ponlo en el m\u00e1s relevante
- Los campos vac\u00edos deben ser string vac\u00edo ""
- Responde siempre en espa\u00f1ol`;

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
      alliance_framing: organized.alliance_framing || "",
      rupture_moment: organized.rupture_moment || "",
      nonverbal_cues: organized.nonverbal_cues || "",
      intervention_types: organized.intervention_types || "",
      clinical_hypothesis: organized.clinical_hypothesis || "",
    });
  } catch {
    // If organization fails, put transcript in first field
    return NextResponse.json({
      transcript,
      alliance_framing: transcript,
      rupture_moment: "",
      nonverbal_cues: "",
      intervention_types: "",
      clinical_hypothesis: "",
    });
  }
}
