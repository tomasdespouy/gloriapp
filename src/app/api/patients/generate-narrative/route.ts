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

  const form = await request.json();

  try {
    const response = await chat(
      [{ role: "user", content: `Genera un relato clínico corto para un paciente simulado de psicología.

DATOS DEL PACIENTE:
- Nombre: ${form.name}
- Edad: ${form.age} años
- Género: ${form.gender}
- Ocupación: ${form.occupation}
- País: ${form.countries?.join(", ") || "Chile"}
- Contexto socioeconómico: ${form.context}
- Motivo de consulta: ${form.motivo}
- Arquetipo: ${form.archetype}
- Rasgos de personalidad: ${form.personalityTraits?.join(", ")}
- Mecanismos de defensa: ${form.defenseMechanisms?.join(", ")}
- Apertura: ${form.openness}
- Temas sensibles: ${form.sensitiveTopics?.join(", ")}
- Dificultad: ${form.difficulty}${form.distinctiveFactor ? `
- FACTOR DISTINTIVO (debe ser central en la narrativa): ${form.distinctiveFactor}` : ""}

IMPORTANTE: Inventa datos MUY ESPECÍFICOS y concretos. Nombres propios reales, edades, lugares, instituciones. Esto ancla al personaje en una historia robusta.

Responde SOLO con JSON válido:
{
  "historia_personal": "Historia de vida (3-5 oraciones con datos concretos: ciudad, barrio, colegio, universidad)...",
  "dinamica_familiar": "Relaciones familiares en texto narrativo (3-5 oraciones)...",
  "familia": [
    {"nombre": "Nombre real", "edad": 58, "parentesco": "Madre", "ocupacion": "Profesora jubilada", "relacion": "Cercana pero crítica"},
    {"nombre": "Nombre real", "edad": 62, "parentesco": "Padre", "ocupacion": "Ingeniero", "relacion": "Distante"},
    {"nombre": "Nombre real", "edad": 35, "parentesco": "Hermana", "ocupacion": "Abogada", "relacion": "Competitiva"},
    {"nombre": "Nombre real", "edad": 8, "parentesco": "Hijo/a", "ocupacion": "Estudiante", "relacion": "Buena"}
  ],
  "datos_anclaje": {
    "ciudad": "Santiago",
    "comuna": "Providencia",
    "barrio": "Nombre del barrio",
    "colegio": "Nombre del colegio",
    "universidad": "Nombre de la universidad (si aplica)",
    "lugar_trabajo": "Nombre de la empresa o institución",
    "pareja": "Nombre, edad, ocupación (o null si no tiene)"
  },
  "motivo_consulta": "Por qué viene a terapia, qué lo trae ahora (3-5 oraciones)...",
  "patron_relacional": "Cómo se relaciona con otros, patrones repetitivos (3-5 oraciones)...",
  "momento_vital": "En qué momento de su vida está, qué crisis o transición enfrenta (3-5 oraciones)..."
}

Todo en español con tildes correctas. Nombres y lugares realistas para el país del paciente. Clínicamente coherente.` }],
      "Eres un psicólogo clínico experto en crear perfiles de pacientes simulados para entrenamiento. Responde SOLO con JSON válido."
    );

    let cleaned = response.trim();
    if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    cleaned = escapeJsonControlChars(cleaned);
    const narrative = JSON.parse(cleaned);

    return NextResponse.json(narrative);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error generando relato" }, { status: 500 });
  }
}
