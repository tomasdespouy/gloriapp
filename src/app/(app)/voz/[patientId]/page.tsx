import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { VoiceCall } from "@/components/VoiceCall";
import { getVoiceAgent } from "@/lib/voice-agents";

// Voice-mode prototype: full-duplex call with an ElevenLabs Conversational AI
// agent. Separate surface from /chat to avoid entangling the fragile
// SessionTimer in ChatInterface. UX is voice-only (photo + halo, no live text);
// the transcript is captured during the call and shown at the end.
export default async function VozPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;

  // Admin client to bypass RLS, same as the chat page.
  const { data: patient } = await createAdminClient()
    .from("ai_patients")
    .select("id, name, age, occupation")
    .eq("id", patientId)
    .single();

  if (!patient) notFound();

  const agent = getVoiceAgent(patientId);

  return (
    <VoiceCall patient={patient} hasVoice={!!agent} imageSlug={agent?.imageSlug} />
  );
}
