import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";
import type { PatientFormData, ShortNarrative, ExtendedNarrative } from "@/lib/patient-options";

function buildProjectionsPrompt(
  data: PatientFormData,
  shortNarrative: ShortNarrative,
  extendedNarrative: ExtendedNarrative
): string {
  const narrativeSummary = Object.entries(extendedNarrative)
    .map(([key, value]) => `### ${key}\n${typeof value === "string" ? value.slice(0, 500) : value}...`)
    .join("\n\n");

  return `Eres un supervisor clinico experto. Genera 3 proyecciones paralelas de como seria el proceso terapeutico de este paciente con estudiantes de distinto nivel.

PACIENTE:
- Nombre: ${data.name}, ${data.age} anos, ${data.gender}
- Ocupacion: ${data.occupation}
- Motivo: ${data.motivo}
- Arquetipo: ${data.archetype}
- Rasgos: ${data.personalityTraits.join(", ")}
- Defensas: ${data.defenseMechanisms.join(", ")}
- Apertura: ${data.openness}
- Temas sensibles: ${data.sensitiveTopics.join(", ")}

RELATO CORTO:
- ${shortNarrative.datos_basicos}
- ${shortNarrative.motivo_consulta}

RELATO EXTENSO (resumen):
${narrativeSummary}

INSTRUCCIONES:
Para cada nivel de estudiante (principiante, intermedio, experto), simula un proceso terapeutico de 8 sesiones de 60 minutos.

Para cada sesion incluye:
- Resumen de lo que ocurre en la sesion (2-3 oraciones)
- Nivel de alianza terapeutica (1-10)
- Nivel de sintomas (1-10, donde 10 = peor)
- Nivel de resistencia (1-10, donde 10 = maxima resistencia)
- Momento clave de la sesion (1 oracion)

DIFERENCIAS POR NIVEL:
- PRINCIPIANTE: Comete errores tipicos (preguntas cerradas, dar consejos, no tolerar silencios, interpretar prematuramente). El paciente se cierra o no evoluciona mucho. Alianza fragil.
- INTERMEDIO: Usa tecnicas correctas pero con timing imperfecto. El paciente muestra apertura gradual con retrocesos. Alianza se construye con altibajos.
- EXPERTO: Intervenciones precisas y bien temporizadas. El paciente se abre progresivamente, trabaja sus defensas. Alianza solida. Hay evolucion significativa.

Responde UNICAMENTE con JSON valido (sin markdown, sin backticks):
{
  "principiante": {
    "level": "principiante",
    "sessions": [
      { "session_number": 1, "summary": "...", "alliance": 3, "symptoms": 7, "resistance": 8, "key_moment": "..." },
      { "session_number": 2, "summary": "...", "alliance": 3, "symptoms": 7, "resistance": 7, "key_moment": "..." }
    ],
    "overall_assessment": "Evaluacion general del proceso con principiante (2-3 oraciones)",
    "coherence_score": 8,
    "evolution_score": 4
  },
  "intermedio": {
    "level": "intermedio",
    "sessions": [ ... 8 sesiones ... ],
    "overall_assessment": "...",
    "coherence_score": 8,
    "evolution_score": 6
  },
  "experto": {
    "level": "experto",
    "sessions": [ ... 8 sesiones ... ],
    "overall_assessment": "...",
    "coherence_score": 9,
    "evolution_score": 8
  }
}

REGLAS:
- Cada nivel DEBE tener exactamente 8 sesiones
- Los valores deben ser coherentes entre sesiones (no saltos bruscos sin justificacion)
- El paciente debe mantener su personalidad y patologia a lo largo de las 8 sesiones
- Con principiante: sintomas se mantienen o empeoran levemente, resistencia alta
- Con intermedio: sintomas mejoran levemente, resistencia baja gradualmente
- Con experto: sintomas mejoran notablemente, resistencia baja significativamente
- coherence_score y evolution_score son de 1-10`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { form, shortNarrative, extendedNarrative }: {
      form: PatientFormData;
      shortNarrative: ShortNarrative;
      extendedNarrative: ExtendedNarrative;
    } = await request.json();

    const prompt = buildProjectionsPrompt(form, shortNarrative, extendedNarrative);
    const response = await chat(
      [{ role: "user", content: prompt }],
      "Eres un supervisor clinico experto en formacion de terapeutas. Respondes UNICAMENTE con JSON valido, sin markdown ni texto adicional."
    );

    let cleaned = response.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const projections = JSON.parse(cleaned);
    return NextResponse.json(projections);
  } catch (error) {
    console.error("Error generating projections:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Error al generar proyecciones: ${message}` }, { status: 500 });
  }
}
