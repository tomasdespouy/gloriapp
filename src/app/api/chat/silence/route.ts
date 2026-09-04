import { createClient } from "@/lib/supabase/server";
import { resolveConversationPrompt, PATIENT_PROMPT_COLUMNS } from "@/lib/patient-prompt";
import { createAdminClient } from "@/lib/supabase/admin";
import { chat } from "@/lib/ai";
import { NextResponse } from "next/server";
import { getPacingProfile } from "@/lib/conversation-pacing";

// Allow up to 25 seconds for the silence-prompt LLM call. The default
// Vercel function timeout would otherwise kill the request before the
// model has a chance to respond, leaving the patient mute.
export const maxDuration = 30;

// Hardcoded fallback messages for each stage. Used when the LLM call
// fails for any reason (rate limit, timeout, model down). At least the
// silence detection still produces SOMETHING so the patient does not
// look frozen to the student.
const STAGE_FALLBACKS: Record<number, string[]> = {
  1: [
    "Mmm... ¿está todo bien por ahí?",
    "Me quedé pensando si leyó lo que dije...",
    "Bueno... este silencio me incomoda un poco.",
  ],
  2: [
    "¿Sigue ahí? Me estoy preocupando un poco...",
    "¿Le llegan mis mensajes? Llevo un rato esperando.",
    "No sé si se cortó la conexión o algo.",
  ],
  3: [
    "Mire, si no tiene tiempo, podemos dejarlo para otro momento.",
    "Voy a esperar un momento más, pero si no hay respuesta tendré que irme.",
  ],
  4: [
    "Bueno... creo que mejor me voy. Espero que la próxima vez podamos tener una sesión completa.",
    "Entiendo que es un mal momento. Nos vemos en la próxima sesión.",
  ],
};

const STAGE_PROMPTS: Record<number, string> = {
  1: `[INSTRUCCI\u00d3N ESPECIAL]
Ha pasado un rato sin que el terapeuta escriba nada. Reacciona con un saludo extra\u00f1ado, sutil, como si notaras la pausa. Algunas opciones:
- "Mmm... \u00bfest\u00e1 todo bien por ah\u00ed?"
- "Me qued\u00e9 pensando si ley\u00f3 lo que dije..."
- "Bueno... este silencio me incomoda un poco..."
Elige la reacci\u00f3n que mejor se ajuste a tu personalidad y al momento de la conversaci\u00f3n. Responde en 1 oraci\u00f3n.`,

  2: `[INSTRUCCI\u00d3N ESPECIAL]
Ha pasado un buen rato sin que el terapeuta escriba nada. Ya reaccionaste antes al silencio pero siguen sin responder. Ahora pregunta directamente si sigue conectado:
- "\u00bfSigue ah\u00ed? Me estoy preocupando un poco..."
- "\u00bfLe llegan mis mensajes? Llevo un rato esperando..."
- "No s\u00e9 si se cort\u00f3 la conexi\u00f3n o algo..."
Responde en 1-2 oraciones.`,

  3: `[INSTRUCCI\u00d3N ESPECIAL]
Ha pasado bastante rato sin que el terapeuta responda. Ya preguntaste si estaba ah\u00ed y no hubo respuesta. Ahora avisa que te retirar\u00e1s si no hay respuesta:
- "Mire, si no tiene tiempo, podemos dejarlo para otro momento..."
- "Me cuesta mucho estar aqu\u00ed y el silencio me hace sentir que no le importa... Si no responde, creo que me voy."
- "Voy a esperar un momento m\u00e1s, pero si no hay respuesta tendr\u00e9 que irme."
Responde en 1-2 oraciones. Deja claro que si no hay respuesta, te ir\u00e1s.`,

  4: `[INSTRUCCI\u00d3N ESPECIAL]
El terapeuta lleva ya varios minutos sin responder. Es el momento de retirarte de la sesi\u00f3n. Desp\u00eddete de forma coherente con tu personalidad:
- Con tristeza: "Bueno... creo que mejor me voy. Espero que la pr\u00f3xima vez podamos tener una sesi\u00f3n completa."
- Con enojo: "Esto no es lo que esperaba. Me voy. Ojal\u00e1 la pr\u00f3xima vez sea diferente."
- Con resignaci\u00f3n: "Entiendo que es un mal momento. Nos vemos en la pr\u00f3xima sesi\u00f3n, espero."
- Con dolor: "Me cost\u00f3 mucho venir aqu\u00ed y siento que no fue valorado. Hasta pronto."
Responde en 1-2 oraciones. Este mensaje CIERRA la sesi\u00f3n.`,
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { patientId, conversationId, stage = 1 } = await request.json();

  // Get patient (admin bypasses RLS)
  const admin = createAdminClient();
  const { data: patient } = await admin
    .from("ai_patients")
    .select(`name, pacing_profile, ${PATIENT_PROMPT_COLUMNS}`)
    .eq("id", patientId)
    .single();

  if (!patient) return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });

  // La última etapa SIEMPRE desconecta. Todos los perfiles tienen ahora 4 etapas
  // (3 avisos "¿sigue ahí?" + irse), escaladas al presupuesto de paciencia de la
  // dificultad (8/6/5 min para principiante/intermedio/avanzado). El tipeo del
  // estudiante suprime los avisos Y el irse (respectsTyping="full"), así que estos
  // mensajes solo salen cuando NO está escribiendo.
  const pacing = getPacingProfile(patient.pacing_profile);
  const totalStages = pacing.silenceThresholdsMs.length;
  const isClosingStage = stage >= totalStages;

  // Get last few messages for context
  const { data: recentMsgs } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(6);

  const history = (recentMsgs || []).reverse();

  // Lo último que dijo el paciente. Sirve para pedirle que no lo reformule:
  // NO se le pide "decir lo mismo con otras palabras" — esa instrucción es la
  // que producía paráfrasis de la respuesta anterior en vez de una reacción al
  // silencio.
  const ultimoDelPaciente = [...history]
    .reverse()
    .find((m) => m.role === "assistant")?.content?.trim() ?? "";

  // Map the (possibly shorter) profile stage to a prompt template.
  // Rule: the last stage always uses the closing template (4); the
  // preceding stages keep their natural order. So for a 3-stage
  // profile we use templates 1, 2, 4 (skip the intermediate insist).
  const promptStageKey = isClosingStage ? 4 : stage;
  const stagePrompt = STAGE_PROMPTS[promptStageKey] || STAGE_PROMPTS[1];
  const antiRepeat = ultimoDelPaciente
    ? `\n- Tu \u00faltimo mensaje fue: "${ultimoDelPaciente}". NO lo repitas NI lo reformules: el/la terapeuta no ha escrito nada nuevo, as\u00ed que no hay nada que responder.`
    : "";
  // Grounding de coherencia: sin esto, el nudge se genera solo con el
  // system_prompt base y puede contradecir lo dicho en la conversaci\u00f3n
  // (ej. "la semana pasada" tras haber dicho "hace minutos"). El historial
  // ya va en `history`; aqu\u00ed reforzamos que NO se contradiga.
  const coherencia = `\n\n[COHERENCIA \u2014 PRIORIDAD]\nMant\u00e9n TOTAL coherencia con lo que YA dijiste en esta conversaci\u00f3n (ver el historial reciente): NO te contradigas sobre cu\u00e1ndo fue la \u00faltima sesi\u00f3n, fechas, ni datos personales. Respeta el tiempo real: si la \u00faltima sesi\u00f3n fue hace minutos u horas, NO digas "la semana pasada". Este es un mensaje por el silencio, NO repitas un recuento de la sesi\u00f3n anterior.`;
  // Mismo prompt que rige el chat de esta conversación (snapshot congelado
  // o composición con enriquecimiento). Antes iba el system_prompt crudo y el
  // paciente perdía sus lugares y frases justo al reaccionar al silencio.
  const promptBase = await resolveConversationPrompt(admin, conversationId, patient);
  const silencePrompt = `${promptBase}${coherencia}`;

  // La instrucción del silencio va como ÚLTIMO turno, no enterrada en el system
  // prompt. El historial termina con el propio mensaje del paciente: si la
  // instrucción queda lejos, el modelo continúa el hilo (vuelve a contestar lo
  // que ya contestó) en vez de reaccionar a la pausa. Se marca claramente como
  // acotación de dirección para que no la lea como si hablara el terapeuta.
  const direccion = `[ACOTACI\u00d3N DE DIRECCI\u00d3N \u2014 no lo dice el/la terapeuta, no la menciones]
El/la terapeuta NO ha escrito nada. Su \u00faltimo mensaje sigue siendo el mismo de antes.
Lo que viene NO es una respuesta a ninguna pregunta: es tu reacci\u00f3n al SILENCIO.

[QUI\u00c9N HABLA \u2014 no te equivoques de rol]
NADIE te ha preguntado nada. El que rompe el silencio eres T\u00da.
Si escribieras "s\u00ed, aqu\u00ed estoy", "sigo ac\u00e1" o parecido, estar\u00edas CONTESTANDO una pregunta que
nadie te hizo. Es al rev\u00e9s: quien pregunta, se extra\u00f1a o se despide eres t\u00fa.
${stagePrompt}${antiRepeat}`;

  // Try the LLM, but never let a failure leave the patient mute. Falls
  // back to a hardcoded line for the current stage if the model errors,
  // times out, or returns an empty string.
  let response: string | null = null;
  try {
    response = await chat(
      [
        ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: direccion },
      ],
      silencePrompt
    );
  } catch (err) {
    console.error(`[silence] LLM call failed for stage ${stage}:`, err);
  }

  if (!response || !response.trim()) {
    const pool = STAGE_FALLBACKS[promptStageKey] || STAGE_FALLBACKS[1];
    response = pool[Math.floor(Math.random() * pool.length)];
    console.warn(`[silence] using fallback message for stage ${stage} (template ${promptStageKey})`);
  }

  // Save the message
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: response,
  });

  // Closing stage: end the session (regardless of whether the profile
  // uses 3 or 4 nudges, we always close when we hit the last one).
  if (isClosingStage) {
    await supabase
      .from("conversations")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("id", conversationId);
  }

  return NextResponse.json({ message: response, stage, sessionClosed: isClosingStage });
}
