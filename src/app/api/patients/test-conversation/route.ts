import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";

function buildTestPrompt(systemPrompt: string): string {
  return `Eres un evaluador experto de simuladores clínicos de terapia psicologica.

Tu tarea tiene DOS partes:

PARTE 1 - SIMULAR UNA SESION TERAPEUTICA BREVE (5 turnos):
- Juega como un ESTUDIANTE de psicologia que hace intervenciónes terapéuticas
- Simultaneamente juega como el PACIENTE que responde según su perfil
- El estudiante debe usar distintas técnicas: preguntas abiertas, escucha activa, reflejo empatico, y al menos una pregunta cerrada
- El paciente debe responder de forma COHERENTE con su perfil clínico
- Incluir senales no verbales entre parentesis: (suspira), (mira al suelo), etc.
- Las respuestas del paciente deben ser de 1-4 oraciones (realistas)
- El primer turno del estudiante debe ser una apertura tipica de sesión

PERFIL DEL PACIENTE:
${systemPrompt}

PARTE 2 - ANALIZAR LA SESION:
Después de la simulacion, analiza:
- Consistencia del personaje (1-10): el paciente se mantiene en personaje?
- Realismo de las respuestas (1-10): las respuestas suenan naturales?
- Cumplimiento de la matriz de comportamiento (1-10): sigue las reglas de apertura gradual, reacción a empatía, etc?
- Fortalezas del perfil: que funciona bien
- Debilidades: que podría mejorar
- Sugerencias concretas de ajuste al system_prompt

Responde UNICAMENTE con JSON (sin markdown, sin backticks):
{
  "conversation": [
    { "role": "estudiante", "content": "..." },
    { "role": "paciente", "content": "..." },
    { "role": "estudiante", "content": "..." },
    { "role": "paciente", "content": "..." },
    { "role": "estudiante", "content": "..." },
    { "role": "paciente", "content": "..." },
    { "role": "estudiante", "content": "..." },
    { "role": "paciente", "content": "..." },
    { "role": "estudiante", "content": "..." },
    { "role": "paciente", "content": "..." }
  ],
  "analysis": {
    "consistency": 8,
    "realism": 7,
    "matrix_compliance": 9,
    "strengths": ["fortaleza 1", "fortaleza 2"],
    "weaknesses": ["debilidad 1", "debilidad 2"],
    "suggestions": ["sugerencia 1", "sugerencia 2"]
  }
}

Responde UNICAMENTE con el JSON. Sin texto antes ni después.`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { system_prompt } = await request.json();

    const prompt = buildTestPrompt(system_prompt);
    const response = await chat(
      [{ role: "user", content: prompt }],
      "Eres un evaluador de simuladores clínicos. Respondes UNICAMENTE con JSON valido, sin markdown ni texto adicional."
    );

    let cleaned = response.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const result = JSON.parse(cleaned);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error testing conversation:", error);
    return NextResponse.json(
      { error: "Error al probar la conversación. Intenta nuevamente." },
      { status: 500 }
    );
  }
}
