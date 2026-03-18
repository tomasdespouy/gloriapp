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

  const { form, shortNarrative, extendedNarrative } = await request.json();

  try {
    const response = await chat(
      [{ role: "user", content: `Revisa la coherencia clínica de este perfil de paciente simulado.

DATOS:
- ${form.name}, ${form.age} años, ${form.gender}, ${form.occupation}
- Motivo: ${form.motivo}
- Arquetipo: ${form.archetype}
- Mecanismos de defensa: ${form.defenseMechanisms?.join(", ")}
- Dificultad: ${form.difficulty}

RELATO CORTO:
${JSON.stringify(shortNarrative)}

RELATO EXTENSO:
${JSON.stringify(extendedNarrative)}

Evalúa la coherencia del perfil según:
1. Consistencia interna (¿la historia calza consigo misma?)
2. Alineamiento con DSM-5 (¿los síntomas son realistas para el cuadro?)
3. Alineamiento con PDM-2 (¿la estructura de personalidad es coherente?)
4. Brechas narrativas (¿falta algo importante?)

Responde SOLO con JSON:
{
  "score": 85,
  "clinical_consistency": ["Punto positivo 1", "Punto positivo 2"],
  "narrative_gaps": ["Gap 1 que debería completarse", "Gap 2"],
  "dsm5_alignment": "Análisis breve de alineación con DSM-5...",
  "pdm2_alignment": "Análisis breve de alineación con PDM-2...",
  "suggestions": ["Sugerencia concreta 1", "Sugerencia concreta 2"],
  "approved": true
}

Score de 0-100. approved=true si score >= 70. Todo en español.` }],
      "Eres un supervisor clínico experto en evaluación diagnóstica (DSM-5 y PDM-2). Evalúa perfiles de pacientes simulados con rigor académico. Responde SOLO con JSON válido."
    );

    let cleaned = response.trim();
    if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    cleaned = escapeJsonControlChars(cleaned);
    const review = JSON.parse(cleaned);

    return NextResponse.json(review);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error en revisión" }, { status: 500 });
  }
}
