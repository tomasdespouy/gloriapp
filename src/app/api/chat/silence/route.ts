import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { patientId, conversationId } = await request.json();

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

  const silencePrompt = `${patient.system_prompt}

[INSTRUCCIÓN ESPECIAL]
Han pasado varios minutos sin que el terapeuta diga nada. Reacciona al silencio prolongado de forma natural según tu personalidad. Algunas opciones:
- Mostrar incomodidad: "¿Está todo bien? Llevamos un rato en silencio..."
- Expresar ansiedad: "No sé si debería seguir hablando o esperar a que usted diga algo..."
- Llenarlo con nerviosismo: "Bueno... este silencio me pone un poco nervioso/a..."
- Enojarse: "¿Me está escuchando? Porque parece que no..."
- Reflexionar: "Supongo que este silencio es para que yo piense, ¿no?"

Elige la reacción que mejor se ajuste a tu personalidad y al momento de la conversación. Responde en 1-2 oraciones.`;

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

  return NextResponse.json({ message: response });
}
