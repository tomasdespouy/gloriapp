import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chat } from "@/lib/ai";
import { NextResponse } from "next/server";

const STAGE_PROMPTS: Record<number, string> = {
  1: `[INSTRUCCI\u00d3N ESPECIAL]
Ha pasado un minuto sin que el terapeuta diga nada. Reacciona con un saludo extra\u00f1ado, sutil, como si notaras la pausa. Algunas opciones:
- "Mmm... \u00bfest\u00e1 todo bien por ah\u00ed?"
- "Me qued\u00e9 pensando si escuch\u00f3 lo que dije..."
- "Bueno... este silencio me pone un poco nervioso/a..."
Elige la reacci\u00f3n que mejor se ajuste a tu personalidad y al momento de la conversaci\u00f3n. Responde en 1 oraci\u00f3n.`,

  2: `[INSTRUCCI\u00d3N ESPECIAL]
Han pasado casi 2 minutos sin que el terapeuta diga nada. Ya reaccionaste antes al silencio pero siguen sin responder. Ahora pregunta directamente si est\u00e1 ah\u00ed:
- "\u00bfSigue ah\u00ed? Me estoy preocupando un poco..."
- "Oiga... \u00bfme escucha? Llevo un rato esperando..."
- "No s\u00e9 si se cort\u00f3 la conexi\u00f3n o algo..."
Responde en 1-2 oraciones.`,

  3: `[INSTRUCCI\u00d3N ESPECIAL]
Han pasado 3 minutos sin que el terapeuta responda. Ya preguntaste si estaba ah\u00ed y no hubo respuesta. Ahora avisa que te retirar\u00e1s si no hay respuesta:
- "Mire, si no tiene tiempo, podemos dejarlo para otro momento..."
- "Me cuesta mucho estar aqu\u00ed y el silencio me hace sentir que no le importa... Si no responde, creo que me voy."
- "Voy a esperar un momento m\u00e1s, pero si no hay respuesta tendr\u00e9 que irme."
Responde en 1-2 oraciones. Deja claro que si no hay respuesta, te ir\u00e1s.`,

  4: `[INSTRUCCI\u00d3N ESPECIAL]
El terapeuta lleva 5 minutos sin responder. Es el momento de retirarte de la sesi\u00f3n. Desp\u00eddete de forma coherente con tu personalidad:
- Con tristeza: "Bueno... creo que mejor me voy. Espero que la pr\u00f3xima vez podamos hablar de verdad."
- Con enojo: "Esto no es lo que esperaba. Me voy. Ojal\u00e1 la pr\u00f3xima vez sea diferente."
- Con resignaci\u00f3n: "Entiendo que debe estar ocupado/a. Nos vemos en la pr\u00f3xima sesi\u00f3n, espero."
- Con dolor: "Me cost\u00f3 mucho venir aqu\u00ed y siento que no fue valorado. Hasta pronto."
Responde en 1-2 oraciones. Este mensaje CIERRA la sesi\u00f3n.`,
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { patientId, conversationId, stage = 1 } = await request.json();

  // Get patient (admin bypasses RLS)
  const { data: patient } = await createAdminClient()
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

  // Check what was already said to avoid repetition
  const prevSilenceMsgs = history
    .filter((m) => m.role === "assistant")
    .map((m) => m.content)
    .join(" | ");

  const stagePrompt = STAGE_PROMPTS[stage] || STAGE_PROMPTS[1];
  const antiRepeat = prevSilenceMsgs
    ? `\n\n[ANTI-REPETICI\u00d3N] Ya dijiste esto antes: "${prevSilenceMsgs}". NO repitas estas frases. Usa palabras y estructura COMPLETAMENTE diferentes.`
    : "";
  const silencePrompt = `${patient.system_prompt}\n\n${stagePrompt}${antiRepeat}`;

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

  // Stage 4: close the session
  if (stage === 4) {
    await supabase
      .from("conversations")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("id", conversationId);
  }

  return NextResponse.json({ message: response, stage, sessionClosed: stage === 4 });
}
