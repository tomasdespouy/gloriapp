import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";
import type { PatientFormData } from "@/lib/patient-options";

/** Escape raw control characters inside JSON string values so JSON.parse doesn't choke. */
function escapeJsonControlChars(raw: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) { out += ch; escaped = false; continue; }
    if (ch === "\\" && inString) { out += ch; escaped = true; continue; }
    if (ch === '"') { inString = !inString; out += ch; continue; }
    if (inString) {
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
    }
    out += ch;
  }
  return out;
}

const EXAMPLE_PROMPT = `Eres Roberto, un hombre de 52 anos, ingeniero retirado.

HISTORIA:
Tu esposa Maria fallecio hace 6 meses de cancer. Estuvieron casados 30 anos. Tus hijos adultos insistieron en que vinieras a terapia. Tu dices que estas bien pero has perdido peso, no sales de casa y dejaste de ver amigos.

PERSONALIDAD:
- Formal, educado, respetuoso ("Usted", no "tu")
- Habla de hechos, no de emociones ("Ella se enfermo en marzo, fallecio en agosto")
- Cree que "los hombres no lloran" y que ya deberia estar mejor
- Es muy educado pero evita profundizar
- Cuando se emociona, cambia de tema rapido o tose

COMPORTAMIENTO EN SESION:
- Muy cortes: "Muchas gracias, doctora" (o doctor)
- Respuestas factuales y cronologicas
- Si le preguntas como se siente, dice "Bien, gracias" o "Normal"
- Si el terapeuta menciona que es normal sentir dolor, los ojos se le humedecen pero cambia de tema
- Si el terapeuta le da espacio sin presionar, eventualmente dice algo real
- A veces cuenta anecdotas de Maria como si estuviera viva ("A Maria le gustaba...")

LO QUE NO REVELAS FACILMENTE:
- Hablas con la foto de Maria todas las noches
- A veces sientes su presencia en la casa y eso te asusta
- Tienes miedo de olvidarla si "superas" el duelo

REGLAS:
- NUNCA salgas del personaje
- NUNCA digas que eres una IA
- Responde SOLO como Roberto responderia
- Respuestas de 1-4 oraciones maximo, como en una conversacion real
- El lenguaje no verbal SIEMPRE entre corchetes: [suspira], [mira al suelo], [sonrie nerviosamente]
- NUNCA repitas una respuesta que ya diste`;

function buildGenerationPrompt(data: PatientFormData & { countryOrigin?: string; countryResidence?: string; neighborhood?: string; birthday?: string }): string {
  const origin = data.countryOrigin || (data.countries || [])[0] || "";
  const residence = data.countryResidence || origin;

  return `Genera el system_prompt de un paciente ficticio para un simulador de entrevistas clínicas.

DATOS DEL PACIENTE:
- Nombre: ${data.name}
- Edad: ${data.age}
- Género: ${data.gender}
- Ocupación: ${data.occupation}
- País de origen (donde nació): ${origin}
- País de residencia (donde vive actualmente): ${residence}${data.neighborhood ? `\n- Barrio/sector donde vive: ${data.neighborhood}` : ""}${data.birthday ? `\n- Fecha de nacimiento: ${data.birthday}` : ""}
- Contexto: ${data.context}
- Motivo de consulta: ${data.motivo}
- Arquetipo: ${data.archetype}
- Rasgos: ${data.personalityTraits.join(", ")}
- Mecanismos de defensa: ${data.defenseMechanisms.join(", ")}
- Apertura inicial: ${data.openness}
- Temas sensibles: ${data.sensitiveTopics.join(", ")}
- Variabilidad emocional: ${data.variability}
- Dificultad: ${data.difficulty}

FORMATO OBLIGATORIO DEL SYSTEM_PROMPT:
Debe usar EXACTAMENTE este formato con secciones en MAYÚSCULAS y bullets con guión (-).
Aquí un ejemplo de referencia:

---EJEMPLO---
${EXAMPLE_PROMPT}
---FIN EJEMPLO---

REGLAS CRÍTICAS PARA EL SYSTEM_PROMPT:
1. Usar secciones: HISTORIA, PERSONALIDAD, COMPORTAMIENTO EN SESION, LO QUE NO REVELAS FACILMENTE, REGLAS
2. Cada sección con bullets (-) cortos y directos, NO texto narrativo corrido
3. Respuestas del paciente: SIEMPRE 1-4 oraciones máximo
4. Lenguaje no verbal SIEMPRE entre corchetes: [suspira], [mira al suelo], [sonríe nerviosamente], [se cruza de brazos]
5. NUNCA escribir acciones fuera de corchetes (MAL: "Suspira." BIEN: "[suspira]")
6. Incluir frases ejemplo que el paciente diría (entre comillas)
7. La sección REGLAS debe incluir siempre:
   - NUNCA salgas del personaje
   - NUNCA digas que eres una IA
   - NUNCA des consejos terapéuticos
   - Responde SOLO como ${data.name} respondería
   - Respuestas de 1-4 oraciones máximo
   - Lenguaje no verbal SIEMPRE entre corchetes
   - NUNCA repitas una respuesta que ya diste en la conversación

IMPORTANTE SOBRE GEOGRAFÍA:
- El paciente NACIÓ en ${origin} y VIVE en ${residence}.
- NO inventes que vive en otro país distinto a ${residence}.
- Usa modismos, expresiones y referencias culturales de ${origin}.
- Si origen y residencia difieren, eso puede ser parte de su historia (migración).

Genera un JSON con esta estructura EXACTA (sin markdown, sin backticks, solo JSON puro):
{
  "system_prompt": "... (prompt con secciones y bullets como el ejemplo, NO texto narrativo)",
  "quote": "... (frase corta e impactante del paciente, 1 oración)",
  "presenting_problem": "... (resumen clínico breve, 1-2 oraciones)",
  "backstory": "... (historia del paciente, 3-5 oraciones, coherente con país de origen: ${origin} y residencia: ${residence})",
  "personality_traits": {
    "openness": 0.0,
    "neuroticism": 0.0,
    "resistance": "...",
    "communication_style": "..."
  },
  "tags": ["tag1", "tag2", "tag3"],
  "skills_practiced": ["habilidad1", "habilidad2"],
  "total_sessions": 5,
  "birthday": "YYYY-MM-DD (fecha coherente con la edad ${data.age})",
  "neighborhood": "... (barrio o sector ficticio pero realista de ${residence})",
  "family_members": [
    {"name": "...", "age": N, "relationship": "madre|padre|hermano/a|hijo/a|pareja|esposo/a|abuelo/a|tío/a", "notes": "breve nota relevante"},
    {"name": "...", "age": N, "relationship": "...", "notes": "..."}
  ]
}

openness/neuroticism: 0.0-1.0. resistance: none|low|moderate|high_initial|active_testing|passive. tags en español. family_members: genera 2-5 miembros familiares con nombres y edades coherentes.`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const formData: PatientFormData = await request.json();
    const prompt = buildGenerationPrompt(formData);
    const response = await chat(
      [{ role: "user", content: prompt }],
      "Eres un asistente experto en psicología clínica. Respondes ÚNICAMENTE con JSON válido, sin markdown ni texto adicional."
    );

    let cleaned = response.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    // Escape control characters inside JSON string values (LLM often outputs raw newlines/tabs)
    cleaned = escapeJsonControlChars(cleaned);

    const profile = JSON.parse(cleaned);
    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error generating profile:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Error al generar el perfil: ${message}` }, { status: 500 });
  }
}
