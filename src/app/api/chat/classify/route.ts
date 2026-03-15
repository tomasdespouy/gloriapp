import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";
import { NextResponse } from "next/server";

/**
 * NLP Classification endpoint — classifies a therapist intervention
 * using LLM for higher accuracy (κ≥0.60 target).
 *
 * Used for post-hoc analysis and validation, not in real-time chat
 * (the real-time classifier uses keyword heuristics for speed).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { text, context } = await request.json();

  const classification = await chat(
    [{ role: "user", content: `Clasifica esta intervención terapéutica en UNA categoría.

Intervención del terapeuta: "${text}"
${context ? `Contexto previo: ${context}` : ""}

Categorías posibles:
- pregunta_abierta: invita a explorar ("¿Cómo se siente?", "Cuénteme más")
- pregunta_cerrada: se responde sí/no ("¿Duerme bien?", "¿Tiene hijos?")
- validacion_empatica: muestra comprensión ("Entiendo lo difícil que es", "Debe ser duro")
- reformulacion: parafrasea ("Si entiendo bien, lo que dice es...")
- confrontacion: señala contradicciones ("Pero antes me dijo que...")
- silencio_terapeutico: pausa, silencio, "[silencio]"
- directividad: da consejos/órdenes ("Debería hacer...", "Tiene que...")
- interpretacion: ofrece una lectura profunda ("Quizás en el fondo...")
- normalizacion: normaliza la experiencia ("Es normal sentir eso")
- resumen: resume lo conversado ("Hasta ahora hemos hablado de...")
- otro: no encaja en ninguna

Responde SOLO con la categoría, sin explicación.` }],
    "Clasifica intervenciones terapéuticas. Responde solo con la categoría."
  );

  return NextResponse.json({
    classification: classification.trim().toLowerCase().replace(/[^a-z_]/g, ""),
    text,
  });
}
