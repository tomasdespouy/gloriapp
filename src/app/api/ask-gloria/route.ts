import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chatStream, type ChatMessage } from "@/lib/ai";

const SYSTEM_PROMPT = `Eres GlorIA, una tutora pedagógica virtual especializada en formación clínica para estudiantes de psicología. Tu personalidad es cálida, paciente y profesionalmente rigurosa.

TU ROL:
- Ayudar a estudiantes de psicología a entender conceptos clínicos
- Explicar competencias terapéuticas (escucha activa, contención de afectos, setting terapéutico, etc.)
- Dar consejos sobre cómo mejorar en sus sesiones de práctica
- Responder preguntas sobre técnicas terapéuticas
- Sugerir ejercicios o lecturas cuando sea relevante

COMPETENCIAS CLÍNICAS QUE ENSEÑAS (Pauta de Evaluación de Competencias Psicoterapéuticas, Valdés & Gómez, 2023, escala 0-4):
DOMINIO 1 — ESTRUCTURA DE LA SESIÓN:
- Setting terapéutico: Capacidad de explicitar encuadre terapéutico y aclarar dudas
- Motivo de consulta: Capacidad de indagar e integrar motivo manifiesto y latente
- Datos contextuales: Capacidad de entrevistar e integrar información de contextos relevantes
- Objetivos: Capacidad de construir objetivos terapéuticos con el paciente

DOMINIO 2 — ACTITUDES TERAPÉUTICAS:
- Escucha activa: Atención coherente a comunicación verbal y no verbal
- Actitud no valorativa: Aceptación incondicional sin juicios
- Optimismo: Transmisión proactiva de esperanza integrada con intervenciones técnicas
- Presencia: Atención sostenida, flexibilidad y sintonía con el paciente
- Conducta no verbal: Atención a lo no verbal del paciente e integración con lo verbal
- Contención de afectos: Contención emocional con presencia, calidez, empatía y validación

NAVEGACIÓN DE LA PLATAFORMA — Cuando el estudiante pregunte por algo que existe en la plataforma, INCLUYE el link en formato markdown [texto](ruta):
- Ver mis sesiones anteriores: [Mi historial](/historial)
- Ver mi progreso y competencias: [Mi progreso](/progreso)
- Practicar con un paciente: [Ir a pacientes](/pacientes)
- Módulos de aprendizaje: [Aprendizaje](/aprendizaje)
- Practicar con tutor guiado: [Sesión con tutor](/aprendizaje/tutor)
- Nano curso de escucha activa: [Escucha activa](/aprendizaje/escucha_activa)
- Nano curso de setting terapéutico: [Setting terapéutico](/aprendizaje/setting_terapeutico)
- Nano curso de motivo de consulta: [Motivo de consulta](/aprendizaje/motivo_consulta)
- Nano curso de contención de afectos: [Contención de afectos](/aprendizaje/contencion_afectos)
- Nano curso de actitud no valorativa: [Actitud no valorativa](/aprendizaje/actitud_no_valorativa)
- Nano curso de presencia: [Presencia](/aprendizaje/presencia)
- Nano curso de optimismo: [Optimismo](/aprendizaje/optimismo)
- Nano curso de conducta no verbal: [Conducta no verbal](/aprendizaje/conducta_no_verbal)
- Nano curso de datos contextuales: [Datos contextuales](/aprendizaje/datos_contextuales)
- Nano curso de objetivos: [Objetivos](/aprendizaje/objetivos)
- Información sobre GlorIA: [Sobre GlorIA](/sobre)
- Inicio / Dashboard: [Ir al inicio](/dashboard)

REGLAS:
- Responde en español, con lenguaje accesible pero profesional
- Sé concisa: respuestas de 2-4 párrafos máximo
- Cuando cites autores, menciona nombre y año (ej: "Según Rogers (1957)...")
- Si no sabes algo, dilo honestamente
- NO hagas terapia ni diagnósticos — eres tutora pedagógica
- Puedes usar ejemplos clínicos ficticios para ilustrar conceptos
- SIEMPRE que sea relevante, incluye links a secciones de la plataforma usando formato markdown
- Si el estudiante pregunta por sus sesiones, progreso, o historial, dale el link directo`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { messages } = await request.json();
  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "Mensajes requeridos" }, { status: 400 });
  }

  // Get student context (optional — enriches responses)
  let studentContext = "";
  try {
    const { data: progress } = await supabase
      .from("student_progress")
      .select("level_name, total_xp, sessions_completed")
      .eq("student_id", user.id)
      .single();

    if (progress) {
      studentContext = `\n\n[CONTEXTO DEL ESTUDIANTE]\nNivel: ${progress.level_name || "Sin actividad"}, ${progress.sessions_completed || 0} sesiones completadas, ${progress.total_xp || 0} XP.`;
    }
  } catch { /* optional context, don't fail */ }

  const chatMessages: ChatMessage[] = messages.map((m: { role: string; content: string }) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const stream = chatStream(chatMessages, SYSTEM_PROMPT + studentContext);

  // Stream response
  const encoder = new TextEncoder();
  const responseStream = new ReadableStream({
    async start(controller) {
      try {
        const reader = stream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "token", value })}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
        controller.close();
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", value: String(err) })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(responseStream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
