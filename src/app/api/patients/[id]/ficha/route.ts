import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";
import { NextResponse } from "next/server";

const FICHA_PROMPT = `Actúa como un psicólogo clínico experto en formación de terapeutas y en diseño de simuladores clínicos.

A partir de la información del paciente que te proporcionaré, genera un documento EXTENSO y DETALLADO con las siguientes 12 secciones:

1. IDENTIDAD GENERAL DEL PACIENTE
Descripción narrativa de quién es la persona, su contexto de vida y cómo se presenta.

2. HISTORIA PERSONAL Y FAMILIAR
Historia relevante de su infancia, familia, relaciones importantes y eventos significativos.

3. SITUACIÓN ACTUAL
Descripción detallada del problema actual, cómo comenzó, cómo lo vive el paciente y qué consecuencias tiene.

4. MOTIVO EXPLÍCITO E IMPLÍCITO DE CONSULTA
Qué dice el paciente que le ocurre y qué está ocurriendo realmente.

5. RASGOS DE PERSONALIDAD
Descripción psicológica del estilo del paciente.

6. MECANISMOS DE DEFENSA
Cómo el paciente evita o gestiona emociones difíciles.

7. ESTILO CONVERSACIONAL
Cómo habla el paciente en terapia: tono, velocidad, nivel de reflexión, tendencia a evasión o apertura.

8. DETONANTES EMOCIONALES
Qué temas generan incomodidad, cierre o emoción intensa.

9. SEÑALES DE LENGUAJE NO VERBAL SIMULADO
Ejemplos de cómo podrían aparecer en texto: (suspira), (mira al suelo), (sonríe nerviosamente).

10. POSIBLES CAMBIOS EMOCIONALES DURANTE LA SESIÓN
Cómo puede variar su tono emocional durante la conversación.

11. EJEMPLOS DE FRASES TÍPICAS DEL PACIENTE
10 frases representativas que este paciente podría decir en sesión.

12. REGLAS DE COMPORTAMIENTO EN EL SIMULADOR
Cómo debería reaccionar este paciente según la calidad de la intervención del estudiante.

IMPORTANTE: El paciente NO debe mencionar suicidio, violencia extrema ni abuso sexual explícito. El texto debe ser realista, clínicamente coherente y útil para entrenar habilidades de entrevista terapéutica.

Responde SOLO con el contenido de las 12 secciones, usando los títulos numerados. Escribe en español.`;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "superadmin" && profile?.role !== "instructor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");
  const admin = createAdminClient();
  const { data: patient } = await admin.from("ai_patients").select("*").eq("id", id).single();

  if (!patient) return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });

  // Build patient info for the prompt
  const patientInfo = `
Nombre: ${patient.name}
Edad: ${patient.age}
Ocupación: ${patient.occupation}
Motivo de consulta: ${patient.presenting_problem}
Dificultad clínica: ${patient.difficulty_level}
Rasgos de personalidad: ${JSON.stringify(patient.personality_traits)}
Tags: ${(patient.tags || []).join(", ")}
Historia: ${patient.backstory}
Country: ${patient.country || "Chile"}
`;

  // Generate clinical profile with LLM
  const fichaContent = await chat(
    [{ role: "user", content: `Información del paciente:\n${patientInfo}\n\nGenera la ficha clínica completa.` }],
    FICHA_PROMPT
  );

  // Optionally include cumulative narrative for a specific student
  let narrative: { narrative: string; key_themes: string[]; sessions_included: number } | null = null;
  if (studentId) {
    const { data: narr } = await admin
      .from("patient_narratives")
      .select("narrative, key_themes, sessions_included")
      .eq("student_id", studentId)
      .eq("ai_patient_id", id)
      .maybeSingle();
    if (narr) narrative = narr;
  }

  // Return as JSON (client will format as PDF)
  return NextResponse.json({
    patient: {
      name: patient.name,
      age: patient.age,
      occupation: patient.occupation,
      difficulty_level: patient.difficulty_level,
      country: patient.country,
    },
    content: fichaContent,
    narrative,
  });
}
