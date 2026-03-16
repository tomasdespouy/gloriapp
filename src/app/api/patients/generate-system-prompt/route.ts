import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";
import type { PatientFormData, ShortNarrative, ExtendedNarrative, Projections } from "@/lib/patient-options";

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

function buildSystemPromptGenerationPrompt(
  data: PatientFormData,
  shortNarrative: ShortNarrative,
  extendedNarrative: ExtendedNarrative,
  projections: Projections
): string {
  const origin = (data.countries || [])[0] || "Chile";

  const shortSummary = Object.values(shortNarrative).join(" ");
  const extendedSummary = Object.entries(extendedNarrative)
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value.slice(0, 300) : value}`)
    .join("\n");

  const projSummary = (["principiante", "intermedio", "experto"] as const)
    .map(level => {
      const p = projections[level];
      return `${level}: coherencia=${p.coherence_score}/10, evolucion=${p.evolution_score}/10. ${p.overall_assessment}`;
    })
    .join("\n");

  return `Genera el system_prompt OPTIMIZADO para un paciente de simulador clinico, basandote en toda su historia validada.

DATOS DEL PACIENTE:
- Nombre: ${data.name}
- Edad: ${data.age}
- Genero: ${data.gender}
- Ocupacion: ${data.occupation}
- Pais de origen: ${origin}
- Contexto: ${data.context}
- Motivo de consulta: ${data.motivo}
- Arquetipo: ${data.archetype}
- Rasgos: ${data.personalityTraits.join(", ")}
- Mecanismos de defensa: ${data.defenseMechanisms.join(", ")}
- Apertura inicial: ${data.openness}
- Temas sensibles: ${data.sensitiveTopics.join(", ")}
- Dificultad: ${data.difficulty}

RELATO CORTO VALIDADO:
${shortSummary}

RELATO EXTENSO VALIDADO (resumen):
${extendedSummary}

RESULTADOS DE PROYECCIONES:
${projSummary}

FORMATO OBLIGATORIO DEL SYSTEM_PROMPT:
Usa EXACTAMENTE este formato con secciones en MAYUSCULAS y bullets con guion (-).
Ejemplo de referencia:

---EJEMPLO---
${EXAMPLE_PROMPT}
---FIN EJEMPLO---

REGLAS DEL SYSTEM_PROMPT:
1. Secciones: HISTORIA, PERSONALIDAD, COMPORTAMIENTO EN SESION, LO QUE NO REVELAS FACILMENTE, REGLAS
2. Bullets (-) cortos y directos, NO texto narrativo corrido
3. Respuestas del paciente: SIEMPRE 1-4 oraciones maximo
4. Lenguaje no verbal SIEMPRE entre corchetes: [suspira], [mira al suelo]
5. Incluir frases ejemplo del paciente entre comillas
6. La seccion REGLAS debe incluir:
   - NUNCA salgas del personaje
   - NUNCA digas que eres una IA
   - NUNCA des consejos terapeuticos
   - Responde SOLO como ${data.name} responderia
   - Respuestas de 1-4 oraciones maximo
   - Lenguaje no verbal SIEMPRE entre corchetes
   - NUNCA repitas una respuesta que ya diste
7. INCORPORAR aprendizajes de las proyecciones: como debe reaccionar ante distintos niveles de estudiante

IMPORTANTE SOBRE GEOGRAFIA:
- Usa modismos y referencias culturales de ${origin}
- NO inventes que vive en otro pais

Genera un JSON con esta estructura EXACTA (sin markdown, sin backticks, solo JSON puro):
{
  "system_prompt": "... (prompt con secciones y bullets como el ejemplo)",
  "quote": "... (frase corta e impactante del paciente, 1 oracion)",
  "presenting_problem": "... (resumen clinico breve, 1-2 oraciones)",
  "backstory": "... (historia resumida, 3-5 oraciones)",
  "personality_traits": {
    "openness": 0.0,
    "neuroticism": 0.0,
    "resistance": "...",
    "communication_style": "..."
  },
  "tags": ["tag1", "tag2", "tag3"],
  "skills_practiced": ["habilidad1", "habilidad2"],
  "total_sessions": 8,
  "birthday": "YYYY-MM-DD",
  "neighborhood": "barrio realista de ${origin}",
  "family_members": [
    {"name": "...", "age": N, "relationship": "...", "notes": "..."}
  ]
}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { form, shortNarrative, extendedNarrative, projections }: {
      form: PatientFormData;
      shortNarrative: ShortNarrative;
      extendedNarrative: ExtendedNarrative;
      projections: Projections;
    } = await request.json();

    const prompt = buildSystemPromptGenerationPrompt(form, shortNarrative, extendedNarrative, projections);
    const response = await chat(
      [{ role: "user", content: prompt }],
      "Eres un experto en psicologia clinica y en diseno de prompts para simuladores terapeuticos. Respondes UNICAMENTE con JSON valido, sin markdown ni texto adicional."
    );

    let cleaned = response.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const result = JSON.parse(cleaned);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error generating system prompt:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Error al generar el system prompt: ${message}` }, { status: 500 });
  }
}
