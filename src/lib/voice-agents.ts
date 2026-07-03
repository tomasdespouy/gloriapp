// Prototype-only mapping: patient → ElevenLabs Conversational AI agent.
//
// Lives in code (not the DB) on purpose, so the voice-mode prototype can
// iterate without a migration — and without touching the schema while the
// Supabase CLI is still linked to prod. Productionizing this = an
// `ai_patients.elevenlabs_agent_id` column (plus an optional image override)
// instead of this map.
export type VoiceAgent = {
  // Modo 1: eleven_flash_v2_5 + emoción por prompt (rápido, acento estable).
  agentId: string;
  // Modo 2 (A/B): eleven_v3_conversational + Expressive Mode + audio tags
  // (más expresivo por turno, a costa de latencia y algo de deriva de acento).
  agentIdV3?: string;
  // Slug del asset de imagen en storage (patients/<slug>.png). Permite que un
  // paciente clonado reutilice la foto del original cuando su propio slug no
  // tiene archivo (caso [QA] Sandbox — Carlos → carlos-paredes).
  imageSlug?: string;
};

export const VOICE_AGENTS: Record<string, VoiceAgent> = {
  // [QA] Sandbox — Carlos (staging)
  "16d8d543-dd2d-4ae2-b8f9-5947e8af0b88": {
    agentId: "agent_6101kt2efan2f5wt002edwq0rx3d",
    agentIdV3: "agent_6301kwktv9ane96tj04ndrkb3mrx",
    imageSlug: "carlos-paredes",
  },
};

export function getVoiceAgent(patientId: string): VoiceAgent | null {
  return VOICE_AGENTS[patientId] ?? null;
}

// Elige el agentId según el modo (1 = rápido, 2 = expresivo). Cae al Modo 1 si
// el paciente no tiene agente v3 configurado.
export function pickAgentId(agent: VoiceAgent, mode: string | null): string {
  return mode === "2" && agent.agentIdV3 ? agent.agentIdV3 : agent.agentId;
}
