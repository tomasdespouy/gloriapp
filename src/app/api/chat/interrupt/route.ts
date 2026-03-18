/**
 * PATIENT INTERRUPT — WebSocket-triggered patient reactions
 *
 * Called by the client when the therapist has been typing for too long
 * or when a shorter idle interval fires (90s).
 * Generates a patient reaction and broadcasts it via Supabase Realtime.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chat } from "@/lib/ai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { patientId, conversationId, trigger } = await request.json();
  // trigger: "typing_long" | "idle_short" | "idle_medium"

  if (!patientId || !conversationId || !trigger) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

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

  // Build reaction prompt based on trigger type
  const triggerPrompts: Record<string, string> = {
    typing_long: `[INSTRUCCIÓN ESPECIAL]
El terapeuta lleva un rato escribiendo algo pero no lo envía. Reacciona naturalmente al verlo teclear sin hablar. Opciones según tu personalidad:
- "¿Va a decir algo o solo escribe?" [mira con curiosidad]
- [observa las manos del terapeuta] "Parece que le cuesta encontrar las palabras..."
- "Tómese su tiempo, no hay apuro..." [se acomoda en la silla]
- [silencio incómodo, mira alrededor]
Elige UNA reacción breve (1 oración + lenguaje no verbal). Sé coherente con tu estado emocional actual.`,

    idle_short: `[INSTRUCCIÓN ESPECIAL]
Ha pasado más de un minuto sin que el terapeuta diga nada. Reacciona al silencio corto según tu personalidad:
- Mostrar incomodidad: [se mueve en la silla] "Este silencio me incomoda un poco..."
- Llenar el vacío: "Bueno... no sé si debería seguir hablando o..."
- Mostrar nerviosismo: [juega con las manos] "¿Está esperando que diga algo más?"
- Ser pasivo: [mira al suelo en silencio]
Elige UNA reacción breve (1 oración). No repitas reacciones anteriores.`,

    idle_medium: `[INSTRUCCIÓN ESPECIAL]
Han pasado unos 3 minutos sin que el terapeuta hable. El silencio se ha extendido. Reacciona con más intensidad:
- Frustración: "¿Me está escuchando? Porque no ha dicho nada..."
- Vulnerabilidad: "Este silencio me hace pensar que dije algo malo..."
- Impaciencia: "¿Podemos seguir? Ya no sé qué hacer con este silencio."
- Reflexión: "Supongo que quiere que piense... [pausa larga] tal vez tiene razón."
Elige UNA reacción breve. Sé auténtico con tu personalidad.`,
  };

  // Check if the last message is already an interrupt (avoid stacking)
  const lastMsg = history[history.length - 1];
  const secondLastMsg = history.length > 1 ? history[history.length - 2] : null;
  if (lastMsg?.role === "assistant" && secondLastMsg?.role === "assistant") {
    // Two assistant messages in a row = already interrupted, don't stack another
    return NextResponse.json({ message: null });
  }

  const recentAssistant = history.filter(m => m.role === "assistant").map(m => m.content);
  const reactionPrompt = `${patient.system_prompt}

[REGLA ANTI-REPETICIÓN ABSOLUTA]
Estas son TODAS tus respuestas anteriores en esta sesión:
${recentAssistant.map((c, i) => `${i + 1}. "${c}"`).join("\n")}

Tu próxima respuesta DEBE ser COMPLETAMENTE diferente en:
- Palabras usadas (no repitas "agradezco", "estoy aquí para", "conversar")
- Estructura de la oración
- Tono o enfoque

Si no tienes nada nuevo que decir, responde SOLO con lenguaje no verbal entre corchetes, por ejemplo: [mira al suelo en silencio]

${triggerPrompts[trigger] || triggerPrompts.idle_short}`;

  try {
    const response = await chat(
      history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      reactionPrompt
    );

    if (!response) {
      return NextResponse.json({ message: null });
    }

    // Save the interrupt message to DB
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: response,
    });

    // Broadcast via Supabase Realtime
    const admin = createAdminClient();
    await admin.channel(`chat:${conversationId}`).send({
      type: "broadcast",
      event: "patient_message",
      payload: { type: "interrupt", content: response },
    });

    return NextResponse.json({ message: response });
  } catch {
    return NextResponse.json({ message: null });
  }
}
