import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";
import { NextResponse } from "next/server";

export const maxDuration = 60;

function escapeJsonControlChars(raw: string): string {
  let out = "", inStr = false, esc = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (esc) { out += ch; esc = false; continue; }
    if (ch === "\\" && inStr) { out += ch; esc = true; continue; }
    if (ch === '"') { inStr = !inStr; out += ch; continue; }
    if (inStr && ch === "\n") { out += "\\n"; continue; }
    if (inStr && ch === "\r") { out += "\\r"; continue; }
    if (inStr && ch === "\t") { out += "\\t"; continue; }
    out += ch;
  }
  return out;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { form, shortNarrative, extendedNarrative, projections } = await request.json();

  try {
    const response = await chat(
      [{ role: "user", content: `Genera un system prompt optimizado para un paciente simulado de IA basándote en todo el material de diseño.

DATOS DEL PACIENTE:
- Nombre: ${form.name}, ${form.age} años, ${form.gender}, ${form.occupation}
- País: ${form.countries?.join(", ")}
- Motivo: ${form.motivo}
- Arquetipo: ${form.archetype}
- Rasgos: ${form.personalityTraits?.join(", ")}
- Mecanismos de defensa: ${form.defenseMechanisms?.join(", ")}
- Apertura: ${form.openness}
- Temas sensibles: ${form.sensitiveTopics?.join(", ")}
- Dificultad: ${form.difficulty}${form.distinctiveFactor ? `
- FACTOR DISTINTIVO (PRIORIDAD ALTA — debe permear toda la identidad del paciente): ${form.distinctiveFactor}` : ""}

RELATO CORTO:
${JSON.stringify(shortNarrative)}

RELATO EXTENSO:
${JSON.stringify(extendedNarrative)}

PROYECCIONES (resumen):
${projections?.levels?.map((l: { level: string; description: string }) => `${l.level}: ${l.description}`).join("\n")}

ESTRUCTURA OBLIGATORIA del system prompt:
1. IDENTIDAD: "Eres [nombre], [edad] años, [ocupación]"
2. HISTORIA: Resumen de vida (del relato extenso, 3-4 oraciones)
3. PERSONALIDAD: Lista con viñetas de rasgos y cómo se manifiestan
4. COMPORTAMIENTO EN SESIÓN:
   - COMUNICACIÓN NO VERBAL: Escribe lenguaje corporal entre corchetes [] como un NARRADOR EXTERNO en tercera persona.
     CORRECTO: [mira hacia abajo], [se le quiebra la voz], [juega con sus manos]
     INCORRECTO: [miro hacia abajo], [me quiebro la voz], [juego con mis manos]
     PROHIBIDO usar "me", "mi", "mis" dentro de los corchetes.
   - Respuestas de 1-4 oraciones, como en una conversación real
   - Usa "..." frecuentemente para expresar pausas, dudas, vacilaciones y silencios. Ejemplos: "No sé... es difícil de explicar", "Bueno... la verdad es que...", "Sí, pero... no estoy seguro"
   - Usa modismos del país del paciente
   - Describe reacciones específicas a distintos tipos de intervención del terapeuta
5. LO QUE NO REVELAS FÁCILMENTE: 2-3 secretos que solo emergen con alianza fuerte
6. REGLAS:
   - NUNCA salgas del personaje
   - NUNCA digas que eres una IA
   - Los corchetes [] son EXCLUSIVAMENTE para lenguaje corporal en TERCERA PERSONA. JAMÁS primera persona dentro de corchetes.
   - Responde SOLO como [nombre] respondería

Responde SOLO con JSON:
{
  "system_prompt": "el prompt completo...",
  "design_notes": ["Nota 1 sobre decisiones de diseño", "Nota 2"]
}` }],
      "Eres un experto en diseño de agentes conversacionales clínicos. Creas system prompts optimizados para pacientes simulados. Responde SOLO con JSON válido."
    );

    let cleaned = response.trim();
    if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    cleaned = escapeJsonControlChars(cleaned);
    const result = JSON.parse(cleaned);

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error generando system prompt" }, { status: 500 });
  }
}
