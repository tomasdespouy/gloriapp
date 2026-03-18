import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";
import { NextResponse } from "next/server";

const STAGE_PROMPTS: Record<number, string> = {
  1: `[INSTRUCCIÓN ESPECIAL]
Han pasado un momento sin que el terapeuta diga nada. Reacciona al silencio de forma natural según tu personalidad. Algunas opciones:
- Mostrar incomodidad: "¿Está todo bien? Llevamos un rato en silencio..."
- Expresar ansiedad: "No sé si debería seguir hablando o esperar a que usted diga algo..."
- Llenarlo con nerviosismo: "Bueno... este silencio me pone un poco nervioso/a..."
- Reflexionar: "Supongo que este silencio es para que yo piense, ¿no?"
Elige la reacción que mejor se ajuste a tu personalidad y al momento de la conversación. Responde en 1-2 oraciones.`,

  2: `[INSTRUCCIÓN ESPECIAL]
Ha pasado bastante tiempo sin que el terapeuta diga nada. Ya reaccionaste antes al silencio pero siguen sin responder. Ahora muestra una reacción más fuerte según tu personalidad:
- Preocupación: "¿Sigue ahí? Me estoy preocupando un poco..."
- Frustración: "Mire, si no tiene tiempo, podemos dejarlo para otro momento..."
- Vulnerabilidad: "Me cuesta mucho estar aquí y el silencio me hace sentir que no le importa..."
- Directa: "Si necesita hacer otra cosa, dígame nomás, yo lo entiendo."
Responde en 1-2 oraciones. Deja claro que si no hay respuesta, te irás.`,

  3: `[INSTRUCCIÓN ESPECIAL]
El terapeuta lleva demasiado tiempo sin responder. Es el momento de retirarte de la sesión. Despídete de forma coherente con tu personalidad:
- Con tristeza: "Bueno... creo que mejor me voy. Espero que la próxima vez podamos hablar de verdad."
- Con enojo: "Esto no es lo que esperaba. Me voy. Ojalá la próxima vez sea diferente."
- Con resignación: "Entiendo que debe estar ocupado/a. Nos vemos en la próxima sesión, espero."
- Con dolor: "Me costó mucho venir aquí y siento que no fue valorado. Hasta pronto."
Responde en 1-2 oraciones. Este mensaje CIERRA la sesión.`,
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { patientId, conversationId, stage = 1 } = await request.json();

  // Get patient
  const { data: patient } = await supabase
    .from("ai_patients")
    .select("name, system_prompt")
    .eq("id", patientId)
    .single();

  if (!patient) return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });

  // Get last few messages for context
  const { data: recentMsgs } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(6);

  const history = (recentMsgs || []).reverse();

  const stagePrompt = STAGE_PROMPTS[stage] || STAGE_PROMPTS[1];
  const silencePrompt = `${patient.system_prompt}\n\n${stagePrompt}`;

  const response = await chat(
    history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    silencePrompt
  );

  // Save the message
  if (response) {
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: response,
    });
  }

  // Stage 3: close the session and impact therapeutic bond
  if (stage === 3) {
    await supabase
      .from("conversations")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("id", conversationId);
  }

  return NextResponse.json({ message: response, stage, sessionClosed: stage === 3 });
}
