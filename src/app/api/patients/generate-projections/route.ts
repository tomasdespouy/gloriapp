import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";
import { NextResponse } from "next/server";

export const maxDuration = 90;

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
      [{ role: "user", content: `Genera 3 proyecciones terapéuticas (8 sesiones cada una) para este paciente simulado, según el nivel del terapeuta.

PACIENTE: ${form.name}, ${form.age} años, ${form.occupation}
MOTIVO: ${form.motivo}
ARQUETIPO: ${form.archetype}
DIFICULTAD: ${form.difficulty}

RELATO CORTO:
${JSON.stringify(shortNarrative)}

RELATO EXTENSO (resumen):
${JSON.stringify(Object.fromEntries(Object.entries(extendedNarrative || {}).map(([k, v]) => [k, String(v).substring(0, 200)])))}

Genera 3 niveles de terapeuta, cada uno con 8 sesiones que muestran cómo evolucionaría la terapia:

- PRINCIPIANTE: Terapeuta novato, comete errores comunes, la alianza es frágil
- INTERMEDIO: Terapeuta competente, maneja bien pero pierde oportunidades
- EXPERTO: Terapeuta avanzado, intervenciones precisas, alianza sólida

Para cada sesión incluye las VARIABLES ADAPTATIVAS del motor clínico (escala 0-100):
- resistencia: Nivel de resistencia del paciente
- alianza: Nivel de alianza terapéutica
- apertura_emocional: Qué tan abierto está emocionalmente
- sintomatologia: Nivel de síntomas activos
- disposicion_cambio: Disposición al cambio

Responde SOLO con JSON:
{
  "levels": [
    {
      "level": "principiante",
      "description": "Descripción del escenario con terapeuta principiante",
      "sessions": [
        {
          "session_number": 1,
          "focus": "Tema principal de la sesión",
          "patient_state": "Estado emocional/conductual del paciente",
          "expected_intervention": "Qué debería hacer el terapeuta",
          "key_moment": "Momento clave o turning point de la sesión",
          "adaptive_state": {
            "resistencia": 70,
            "alianza": 20,
            "apertura_emocional": 15,
            "sintomatologia": 80,
            "disposicion_cambio": 10
          }
        }
      ]
    }
  ]
}

Todo en español con tildes. 8 sesiones por nivel. Clínicamente realista. Las variables deben mostrar progresión coherente sesión a sesión.` }],
      "Eres un supervisor clínico experto en formación de psicólogos. Diseñas trayectorias terapéuticas realistas para entrenamiento. Responde SOLO con JSON válido."
    );

    let cleaned = response.trim();
    if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    cleaned = escapeJsonControlChars(cleaned);
    const projections = JSON.parse(cleaned);

    return NextResponse.json(projections);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error generando proyecciones" }, { status: 500 });
  }
}
