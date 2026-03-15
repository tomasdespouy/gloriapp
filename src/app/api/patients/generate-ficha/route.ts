import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";
import { NextResponse } from "next/server";

const FICHA_PROMPT = `Actúa como un psicólogo clínico experto en formación de terapeutas y en diseño de simuladores clínicos.

A partir de la información del paciente, genera un documento EXTENSO y DETALLADO con estas 12 secciones:

1. IDENTIDAD GENERAL DEL PACIENTE
2. HISTORIA PERSONAL Y FAMILIAR
3. SITUACIÓN ACTUAL
4. MOTIVO EXPLÍCITO E IMPLÍCITO DE CONSULTA
5. RASGOS DE PERSONALIDAD
6. MECANISMOS DE DEFENSA
7. ESTILO CONVERSACIONAL
8. DETONANTES EMOCIONALES
9. SEÑALES DE LENGUAJE NO VERBAL SIMULADO
10. POSIBLES CAMBIOS EMOCIONALES DURANTE LA SESIÓN
11. EJEMPLOS DE FRASES TÍPICAS DEL PACIENTE (10 frases)
12. REGLAS DE COMPORTAMIENTO EN EL SIMULADOR

El paciente NO debe mencionar suicidio, violencia extrema ni abuso sexual explícito.
El texto debe ser realista, clínicamente coherente y útil para entrenar habilidades de entrevista terapéutica.
Escribe en español.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();
  const { name, age, occupation, countries, presenting_problem, backstory, difficulty_level, personality_traits, tags, system_prompt } = body;

  const patientInfo = `
Nombre: ${name}
Edad: ${age}
Ocupación: ${occupation}
Países: ${(countries || []).join(", ")}
Motivo de consulta: ${presenting_problem}
Dificultad: ${difficulty_level}
Rasgos: ${JSON.stringify(personality_traits)}
Tags: ${(tags || []).join(", ")}
Historia: ${backstory}
System prompt: ${(system_prompt || "").slice(0, 500)}
`;

  const content = await chat(
    [{ role: "user", content: `Información del paciente:\n${patientInfo}\n\nGenera la ficha clínica completa con las 12 secciones.` }],
    FICHA_PROMPT
  );

  return NextResponse.json({ content });
}
