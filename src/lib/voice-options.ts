/**
 * Opciones elegibles del piloto de voz (panel /admin/voice-pilots). Una sola
 * fuente para el panel, la validación de la API y el armado del prompt.
 *
 * Modelos y precios: verificados el 2026-09-26 contra la documentación y la
 * página de precios de OpenAI (Realtime). Precios en US$ por millón de
 * tokens de audio, entrada/salida.
 * Voces: lista de developers.openai.com/api/docs/guides/realtime-conversations.
 */

export const VOICE_MODEL_OPTIONS = [
  { value: "gpt-realtime-2.1", label: "gpt-realtime-2.1 · el más nuevo · US$32 / 64" },
  { value: "gpt-realtime-2.1-mini", label: "gpt-realtime-2.1-mini · nuevo y económico · US$10 / 20" },
  { value: "gpt-realtime-2", label: "gpt-realtime-2 · generación anterior · US$32 / 64" },
  { value: "gpt-realtime-1.5", label: "gpt-realtime-1.5 · rápido, sin razonamiento · US$32 / 64" },
  { value: "gpt-realtime-mini", label: "gpt-realtime-mini · el original, económico · US$10 / 20" },
] as const;

export const DEFAULT_REALTIME_VOICE = "marin";

export const REALTIME_VOICES = [
  "marin",
  "cedar",
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
] as const;

export const SPEECH_STYLE_OPTIONS = [
  { value: "ninguno", label: "Ninguno · sin indicaciones de estilo (línea base)" },
  { value: "sobrio", label: "Sobrio · pocas muletillas, ritmo pausado" },
  { value: "natural", label: "Natural · muletillas, dudas y frases a medias" },
  { value: "expresivo", label: "Expresivo · emoción marcada, voz quebrada" },
] as const;

export type SpeechStyle = (typeof SPEECH_STYLE_OPTIONS)[number]["value"];

export const DEFAULT_SPEECH_STYLE: SpeechStyle = "natural";

export function isSpeechStyle(v: unknown): v is SpeechStyle {
  return SPEECH_STYLE_OPTIONS.some((o) => o.value === v);
}

export function isRealtimeModel(v: unknown): boolean {
  return VOICE_MODEL_OPTIONS.some((o) => o.value === v);
}

export function isRealtimeVoice(v: unknown): boolean {
  return (REALTIME_VOICES as readonly unknown[]).includes(v);
}
