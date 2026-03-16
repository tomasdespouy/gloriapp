import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";
import type { PatientFormData, ShortNarrative, ExtendedNarrative } from "@/lib/patient-options";

function buildCoherencePrompt(
  data: PatientFormData,
  shortNarrative: ShortNarrative,
  extendedNarrative: ExtendedNarrative
): string {
  const origin = (data.countries || [])[0] || "Chile";

  const narrativeSections = Object.entries(extendedNarrative)
    .map(([key, value]) => `### ${key}\n${value}`)
    .join("\n\n");

  return `Eres un supervisor clinico experto. Revisa la coherencia de este caso clinico ficticio.

VARIABLES ORIGINALES:
- Nombre: ${data.name}, ${data.age} anos, ${data.gender}
- Ocupacion: ${data.occupation}
- Pais: ${origin}, Contexto: ${data.context}
- Motivo: ${data.motivo}
- Arquetipo: ${data.archetype}
- Rasgos: ${data.personalityTraits.join(", ")}
- Mecanismos de defensa: ${data.defenseMechanisms.join(", ")}
- Apertura: ${data.openness}
- Temas sensibles: ${data.sensitiveTopics.join(", ")}
- Dificultad: ${data.difficulty}

RELATO CORTO:
- Datos basicos: ${shortNarrative.datos_basicos}
- Motivo consulta: ${shortNarrative.motivo_consulta}
- Contexto familiar: ${shortNarrative.contexto_familiar}
- Personalidad: ${shortNarrative.personalidad}
- Dinamica relacional: ${shortNarrative.dinamica_relacional}

RELATO EXTENSO:
${narrativeSections}

INSTRUCCIONES:
Realiza DOS tipos de revision:

1. COHERENCIA INTERNA: Busca contradicciones dentro de la historia.
   - Edades que no cuadran (ej: dice que tiene 30 pero la historia sugiere 40)
   - Fechas o cronologias imposibles
   - Datos contradictorios entre secciones
   - Personajes que aparecen con datos distintos

2. COHERENCIA CLINICA: Evalua si la patologia es consistente con la historia.
   - El motivo de consulta (${data.motivo}) tiene sentido con la historia de vida?
   - Los mecanismos de defensa descritos son coherentes con las experiencias narradas?
   - El arquetipo (${data.archetype}) se refleja en la personalidad descrita?
   - Los temas sensibles son coherentes con los eventos traumaticos?
   - Referencia: DSM-5 y PDM-2 para consistencia diagnostica

Responde UNICAMENTE con JSON valido (sin markdown, sin backticks):
{
  "items": [
    {
      "section": "nombre_de_seccion",
      "severity": "critica|sugerencia|ok",
      "type": "interna|clinica",
      "message": "Descripcion concreta del hallazgo"
    }
  ],
  "summary": "Resumen general de 2-3 oraciones sobre la coherencia del caso"
}

REGLAS:
- Incluir al menos 1 item por seccion del relato extenso
- Ser especifico: citar partes exactas que son problematicas
- "critica" = debe corregirse, "sugerencia" = podria mejorar, "ok" = coherente
- Minimo 8 items, maximo 20
- Si algo esta bien, marcarlo como "ok" con un mensaje positivo`;
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

    const prompt = buildCoherencePrompt(form, shortNarrative, extendedNarrative);
    const response = await chat(
      [{ role: "user", content: prompt }],
      "Eres un supervisor clinico experto con formacion en DSM-5 y PDM-2. Respondes UNICAMENTE con JSON valido, sin markdown ni texto adicional."
    );

    let cleaned = response.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const review = JSON.parse(cleaned);
    return NextResponse.json(review);
  } catch (error) {
    console.error("Error reviewing coherence:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Error en la revision de coherencia: ${message}` }, { status: 500 });
  }
}
