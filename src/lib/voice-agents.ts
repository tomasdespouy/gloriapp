// Prototype-only mapping: patient → ElevenLabs Conversational AI agent.
//
// Lives in code (not the DB) on purpose, so the voice-mode prototype can
// iterate without a migration — and without touching the schema while the
// Supabase CLI is still linked to prod. Productionizing this = an
// `ai_patients.elevenlabs_agent_id` column (plus an optional image override)
// instead of this map.
export type VoiceAgent = {
  agentId: string;
  // Slug del asset de imagen en storage (patients/<slug>.png). Permite que un
  // paciente clonado reutilice la foto del original cuando su propio slug no
  // tiene archivo (caso [QA] Sandbox — Carlos → carlos-paredes).
  imageSlug?: string;
};

export const VOICE_AGENTS: Record<string, VoiceAgent> = {
  // [QA] Sandbox — Carlos (staging)
  "16d8d543-dd2d-4ae2-b8f9-5947e8af0b88": {
    agentId: "agent_6101kt2efan2f5wt002edwq0rx3d",
    imageSlug: "carlos-paredes",
  },
};

export function getVoiceAgent(patientId: string): VoiceAgent | null {
  return VOICE_AGENTS[patientId] ?? null;
}
