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

  const { form, shortNarrative } = await request.json();

  try {
    const response = await chat(
      [{ role: "user", content: `Expande el siguiente relato clínico corto en una historia de vida detallada para un paciente simulado.

DATOS DEL PACIENTE:
- Nombre: ${form.name}, ${form.age} años, ${form.gender}, ${form.occupation}
- País: ${form.countries?.join(", ")}
- Contexto: ${form.context}
- Arquetipo: ${form.archetype}
- Mecanismos de defensa: ${form.defenseMechanisms?.join(", ")}
- Dificultad: ${form.difficulty}

RELATO CORTO:
${JSON.stringify(shortNarrative)}

Genera un relato extenso (~2 páginas) con 8 secciones detalladas. Cada sección debe ser un párrafo largo (5-8 oraciones mínimo).
Responde SOLO con JSON válido:
{
  "infancia_y_apego": "Detalles de la infancia, figuras de apego, eventos formativos...",
  "familia_de_origen": "Estructura familiar, dinámicas, secretos, roles asignados...",
  "desarrollo_adolescente": "Adolescencia, identidad, primeras relaciones, conflictos...",
  "relaciones_significativas": "Parejas, amistades, patrones de apego en relaciones adultas...",
  "historia_laboral_academica": "Trayectoria profesional/académica, logros, frustraciones...",
  "evento_precipitante": "Qué detonó la crisis actual, cuándo y cómo empeoró...",
  "estado_actual": "Cómo se presenta hoy: síntomas, funcionamiento, relaciones actuales...",
  "recursos_y_fortalezas": "Qué tiene a su favor: red de apoyo, habilidades, motivación..."
}

Todo en español. Clínicamente realista, coherente con el DSM-5 y el relato corto.` }],
      "Eres un psicólogo clínico experto con 20 años de experiencia en evaluación y formulación de casos. Genera historias de vida realistas y clínicamente coherentes. Responde SOLO con JSON válido."
    );

    let cleaned = response.trim();
    if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    cleaned = escapeJsonControlChars(cleaned);
    const narrative = JSON.parse(cleaned);

    return NextResponse.json(narrative);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error generando relato extenso" }, { status: 500 });
  }
}
