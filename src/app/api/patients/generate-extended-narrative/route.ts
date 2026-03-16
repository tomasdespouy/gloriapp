import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";
import type { PatientFormData, ShortNarrative } from "@/lib/patient-options";

function buildExtendedNarrativePrompt(data: PatientFormData, shortNarrative: ShortNarrative): string {
  const origin = (data.countries || [])[0] || "Chile";

  return `A partir del siguiente relato corto de un paciente ficticio, genera un relato EXTENSO y detallado (~10 paginas) organizado en 8 secciones.

DATOS BASE DEL PACIENTE:
- Nombre: ${data.name}
- Edad: ${data.age}
- Genero: ${data.gender}
- Ocupacion: ${data.occupation}
- Pais: ${origin}
- Contexto: ${data.context}
- Motivo de consulta: ${data.motivo}
- Arquetipo: ${data.archetype}
- Rasgos: ${data.personalityTraits.join(", ")}
- Mecanismos de defensa: ${data.defenseMechanisms.join(", ")}
- Temas sensibles: ${data.sensitiveTopics.join(", ")}

RELATO CORTO VALIDADO:
- Datos basicos: ${shortNarrative.datos_basicos}
- Motivo de consulta: ${shortNarrative.motivo_consulta}
- Contexto familiar: ${shortNarrative.contexto_familiar}
- Personalidad: ${shortNarrative.personalidad}
- Dinamica relacional: ${shortNarrative.dinamica_relacional}

INSTRUCCIONES:
Expande este relato en 8 secciones detalladas. Cada seccion debe tener entre 4 y 8 parrafos ricos en detalle narrativo. Usa datos demograficos, culturales, geograficos y socioeconomicos REALES de ${origin} (nombres de barrios, instituciones, costumbres, etc.).

Responde UNICAMENTE con JSON valido (sin markdown, sin backticks):
{
  "historia_personal": "Historia detallada desde la infancia hasta la adultez. Incluir: nacimiento, primeros recuerdos, eventos de la ninez, adolescencia (amistades, escuela, primeras relaciones), transicion a la adultez. Cada etapa con al menos un evento significativo narrado con detalle.",
  "historia_familiar": "Familia de origen: quienes son los padres, como se conocieron, dinamica del hogar, roles familiares, conflictos, secretos, eventos traumaticos familiares, relacion entre los padres, lugar del paciente entre los hermanos. Si hay familia extendida relevante, incluir.",
  "vinculos_apego": "Estilo de apego predominante con ejemplos concretos. Como se vincula en relaciones intimas, amistades y figuras de autoridad. Patrones repetitivos en relaciones. Momentos de ruptura vincular significativos. Como reacciona ante la separacion, el rechazo y la intimidad.",
  "historia_profesional": "Trayectoria academica y laboral detallada. Que estudio, donde, como le fue. Trabajos que ha tenido, por que los dejo o los mantiene. Relacion con jefes y companeros. Aspiraciones vs realidad. Como impacta su patologia en lo laboral.",
  "eventos_traumaticos": "Eventos traumaticos o significativos (perdidas, abusos, accidentes, enfermedades, mudanzas, etc.). Narrados cronologicamente con detalle sobre el impacto emocional, como los proceso (o no), que consecuencias dejaron. Incluir al menos 2-3 eventos de distinta naturaleza.",
  "mecanismos_defensa": "Como se defiende emocionalmente esta persona. Ejemplos concretos de situaciones donde usa cada mecanismo de defensa. Patrones que se repiten. Que pasa cuando sus defensas fallan. Como estos mecanismos afectan sus relaciones y su bienestar.",
  "contexto_cultural": "Contexto socioeconomico, cultural y geografico detallado. Barrio donde vive, nivel de ingresos, acceso a salud mental, creencias culturales sobre la terapia, religion o espiritualidad, pertenencia a grupos sociales, como su contexto cultural influye en su forma de expresar sufrimiento.",
  "estado_actual": "Situacion presente: como llega a consulta, que lo motivo finalmente, como esta su vida hoy dia a dia, que sintomas tiene, como afectan su funcionamiento, que espera de la terapia, que miedos tiene respecto al proceso terapeutico."
}

REGLAS CRITICAS:
- Cada seccion debe ser un texto NARRATIVO rico (no bullets ni listas)
- Minimo 4 parrafos por seccion, idealmente 6-8
- Mantener COHERENCIA total con el relato corto validado
- No contradecir ninguna variable ingresada
- Usar referencias culturales y geograficas reales de ${origin}
- Incluir dialogos breves cuando sea relevante ("Mi mama siempre decia que...")
- El tono debe ser el de un expediente clinico narrativo`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { form, shortNarrative }: { form: PatientFormData; shortNarrative: ShortNarrative } = await request.json();
    const prompt = buildExtendedNarrativePrompt(form, shortNarrative);
    const response = await chat(
      [{ role: "user", content: prompt }],
      "Eres un experto en psicologia clinica con amplia experiencia en construccion de casos clinicos detallados. Respondes UNICAMENTE con JSON valido, sin markdown ni texto adicional."
    );

    let cleaned = response.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const narrative = JSON.parse(cleaned);
    return NextResponse.json(narrative);
  } catch (error) {
    console.error("Error generating extended narrative:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Error al generar el relato extenso: ${message}` }, { status: 500 });
  }
}
