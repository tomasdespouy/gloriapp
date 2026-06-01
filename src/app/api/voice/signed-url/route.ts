import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getVoiceAgent } from "@/lib/voice-agents";

// Mints a short-lived signed URL so the browser can open the ElevenLabs
// Conversational AI WebSocket without ever seeing the API key. The agent has
// authentication enabled, so a signed URL is required to connect.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const patientId = req.nextUrl.searchParams.get("patientId");
  if (!patientId) return NextResponse.json({ error: "Falta patientId" }, { status: 400 });

  const agent = getVoiceAgent(patientId);
  if (!agent) return NextResponse.json({ error: "Este paciente no tiene modo voz" }, { status: 404 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ELEVENLABS_API_KEY no configurada" }, { status: 500 });

  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agent.agentId}`,
    { headers: { "xi-api-key": apiKey }, cache: "no-store" }
  );

  if (!res.ok) {
    console.error("[voice/signed-url] ElevenLabs error:", res.status, await res.text());
    return NextResponse.json({ error: "No se pudo iniciar la llamada" }, { status: 502 });
  }

  // Create (or reuse) a conversation row so the voice brain (/api/voice/llm)
  // can persist turns + clinical state to it. These IDs travel to ElevenLabs
  // via customLlmExtraBody and arrive back in each Custom LLM request.
  let conversationId: string | undefined;
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("student_id", user.id)
    .eq("ai_patient_id", patientId)
    .in("status", ["active", "abandoned"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    conversationId = existing.id;
    await supabase.from("conversations").update({ status: "active" }).eq("id", conversationId);
  } else {
    const { count } = await supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("student_id", user.id)
      .eq("ai_patient_id", patientId);
    const { data: conv } = await supabase
      .from("conversations")
      .insert({ student_id: user.id, ai_patient_id: patientId, session_number: (count || 0) + 1, status: "active" })
      .select("id")
      .single();
    conversationId = conv?.id;
  }

  const { signed_url } = await res.json();
  return NextResponse.json({
    signedUrl: signed_url,
    conversationId,
    userId: user.id,
    patientId,
  });
}
