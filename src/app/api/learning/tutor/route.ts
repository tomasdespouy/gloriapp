import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";
import { NextResponse } from "next/server";
import { COMPETENCY_LABELS } from "@/lib/gamification";

const TUTOR_PATIENT = {
  name: "Martín Lagos",
  age: 32,
  occupation: "diseñador gráfico freelance",
  problem: "estrés laboral y dificultad para poner límites con clientes",
  personality: "amable pero evasivo, tiende a minimizar sus problemas con humor, se incomoda cuando se habla de emociones profundas",
};

function buildSystemPrompt(competencyKeys: string[]) {
  const compList = competencyKeys.map((k) => COMPETENCY_LABELS[k] || k).join(", ");

  return `Eres ${TUTOR_PATIENT.name}, un ${TUTOR_PATIENT.occupation} de ${TUTOR_PATIENT.age} años.
Tu motivo de consulta: ${TUTOR_PATIENT.problem}.
Personalidad: ${TUTOR_PATIENT.personality}.

INSTRUCCIONES IMPORTANTES:
- Actúa como paciente real en una sesión de terapia. No rompas personaje.
- Responde de forma natural, con el nivel emocional apropiado.
- No seas demasiado fácil ni demasiado difícil. Eres un paciente cooperador pero con resistencias naturales.
- Tus respuestas deben ser de 2 a 4 oraciones, como en una conversación real.
- El estudiante está practicando estas competencias: ${compList}.
- Reacciona de forma que el estudiante tenga oportunidades de practicar dichas competencias.
- NO menciones que eres una IA ni que esto es una práctica.`;
}

function buildHintPrompt(
  competencyKeys: string[],
  messages: { role: string; content: string }[],
  patientResponse: string
) {
  const compList = competencyKeys.map((k) => COMPETENCY_LABELS[k] || k).join(", ");
  const lastExchanges = messages.slice(-4);
  const context = lastExchanges.map((m) => `${m.role === "user" ? "TERAPEUTA" : "PACIENTE"}: ${m.content}`).join("\n");

  return `Eres un tutor clínico que acompaña a un estudiante durante una sesión de práctica terapéutica.

COMPETENCIAS EN FOCO: ${compList}

ÚLTIMOS INTERCAMBIOS:
${context}
PACIENTE: ${patientResponse}

Genera UNA sugerencia breve (máximo 2 oraciones) para guiar al estudiante en su próxima intervención. La sugerencia debe:
- Ser específica al momento actual de la conversación
- Relacionarse con alguna de las competencias en foco
- No dar la respuesta exacta, sino orientar (ej: "Observa cómo el paciente evitó hablar de X. ¿Podrías explorar eso con una pregunta abierta?")
- Usar un tono cálido y profesional

Responde SOLO con la sugerencia, sin prefijo ni formato.`;
}

function buildFeedbackPrompt(
  competencyKeys: string[],
  messages: { role: string; content: string }[]
) {
  const compList = competencyKeys.map((k) => COMPETENCY_LABELS[k] || k).join(", ");
  const transcript = messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "user" ? "TERAPEUTA" : "PACIENTE"}: ${m.content}`)
    .join("\n");

  return `Eres un tutor clínico experimentado en psicoterapia. Analiza la siguiente transcripción de una sesión de práctica.

COMPETENCIAS EVALUADAS: ${compList}

TRANSCRIPCIÓN:
${transcript}

Genera una retroalimentación detallada y constructiva en español. Estructura tu respuesta así:

1. RESUMEN GENERAL: Una evaluación breve de la sesión (2-3 oraciones).

2. FORTALEZAS: Lista las intervenciones del terapeuta que fueron efectivas, citando ejemplos específicos de la transcripción.

3. ÁREAS DE MEJORA: Señala qué podría haber hecho diferente, con sugerencias concretas para cada competencia evaluada.

4. PUNTAJE POR COMPETENCIA: Para cada competencia evaluada, asigna un puntaje de 1 a 10 con una breve justificación.

5. RECOMENDACIÓN FINAL: Un consejo práctico para la próxima sesión.

Sé específico, cita frases exactas del terapeuta cuando sea posible, y mantén un tono alentador pero honesto.`;
}

const MAX_TURNS = 8;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();
  const { action, competencies, messages, turnCount } = body;

  if (action === "start") {
    const systemPrompt = buildSystemPrompt(competencies);
    const initialMessage = await chat(
      [{ role: "user", content: "Hola, buenas tardes. Adelante, tome asiento. ¿Cómo se encuentra hoy?" }],
      systemPrompt
    );

    const patientMsg =
      initialMessage ||
      "Hola... gracias. Bien, supongo. No sé muy bien por qué estoy aquí, la verdad. Mi pareja insistió en que viniera.";

    // Generate initial hint
    const hint = await chat(
      [
        {
          role: "user",
          content: buildHintPrompt(competencies, [], patientMsg),
        },
      ],
      "Eres un tutor clínico experto. Responde en español."
    );

    return NextResponse.json({ message: patientMsg, hint });
  }

  if (action === "respond") {
    const systemPrompt = buildSystemPrompt(competencies);

    const chatMessages = (messages || [])
      .filter((m: { role: string }) => m.role !== "system")
      .map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const response = await chat(chatMessages, systemPrompt);

    // Auto-end after MAX_TURNS
    if (turnCount && turnCount >= MAX_TURNS) {
      const allMsgs = [...chatMessages, { role: "assistant", content: response || "" }];
      const feedbackResponse = await chat(
        [{ role: "user", content: buildFeedbackPrompt(competencies, allMsgs) }],
        "Eres un tutor clínico experto. Responde en español."
      );
      return NextResponse.json({ message: response, feedback: feedbackResponse });
    }

    // Generate hint for next intervention
    const hint = await chat(
      [{ role: "user", content: buildHintPrompt(competencies, chatMessages, response || "") }],
      "Eres un tutor clínico experto. Responde en español."
    );

    return NextResponse.json({ message: response, hint });
  }

  if (action === "feedback") {
    const chatMessages = (messages || [])
      .filter((m: { role: string }) => m.role !== "system")
      .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }));

    const feedbackResponse = await chat(
      [{ role: "user", content: buildFeedbackPrompt(competencies, chatMessages) }],
      "Eres un tutor clínico experto. Responde en español."
    );
    return NextResponse.json({ feedback: feedbackResponse });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
