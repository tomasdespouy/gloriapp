import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";
import type { PatientFormData } from "@/lib/patient-options";

function buildNarrativePrompt(data: PatientFormData): string {
  const origin = (data.countries || [])[0] || "Chile";

  return `Genera un relato estructurado CORTO de un paciente ficticio para un simulador de entrevistas clinicas.

DATOS DEL PACIENTE:
- Nombre: ${data.name}
- Edad: ${data.age}
- Genero: ${data.gender}
- Ocupacion: ${data.occupation}
- Pais de origen: ${origin}
- Contexto: ${data.context}
- Motivo de consulta: ${data.motivo}
- Arquetipo: ${data.archetype}
- Rasgos de personalidad: ${data.personalityTraits.join(", ")}
- Mecanismos de defensa: ${data.defenseMechanisms.join(", ")}
- Apertura inicial: ${data.openness}
- Temas sensibles: ${data.sensitiveTopics.join(", ")}
- Variabilidad emocional: ${data.variability}
- Dificultad: ${data.difficulty}

INSTRUCCIONES:
Genera un relato estructurado por secciones. Cada seccion debe ser un parrafo de 3-5 oraciones, claro y concreto. Usa datos demograficos y culturales reales de ${origin}.

Responde UNICAMENTE con JSON valido (sin markdown, sin backticks):
{
  "datos_basicos": "Parrafo describiendo quien es el paciente: nombre, edad, ocupacion, donde vive, con quien vive, nivel socioeconomico, rutina diaria basica.",
  "motivo_consulta": "Parrafo describiendo por que viene a consulta: que le pasa, hace cuanto, que lo motivo a buscar ayuda, que espera de la terapia.",
  "contexto_familiar": "Parrafo describiendo su familia: con quien crecio, como es la relacion con padres/hermanos, si tiene pareja/hijos, dinamicas familiares relevantes.",
  "personalidad": "Parrafo describiendo como es: rasgos dominantes, como se relaciona, como maneja el estres, que mecanismos de defensa usa, como se ve a si mismo.",
  "dinamica_relacional": "Parrafo describiendo como se vincula con otros: estilo de apego predominante, patrones en relaciones, como reacciona ante conflictos, que temas evita."
}

IMPORTANTE:
- Cada seccion es un PARRAFO narrativo, no bullets
- Debe ser coherente entre secciones
- Usa nombres y lugares reales de ${origin}
- El relato debe reflejar la patologia y el arquetipo seleccionado
- NO inventes datos que contradigan las variables ingresadas`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const formData: PatientFormData = await request.json();
    const prompt = buildNarrativePrompt(formData);
    const response = await chat(
      [{ role: "user", content: prompt }],
      "Eres un experto en psicologia clinica y construccion de casos clinicos ficticios. Respondes UNICAMENTE con JSON valido, sin markdown ni texto adicional."
    );

    let cleaned = response.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const narrative = JSON.parse(cleaned);
    return NextResponse.json(narrative);
  } catch (error) {
    console.error("Error generating narrative:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Error al generar el relato: ${message}` }, { status: 500 });
  }
}
