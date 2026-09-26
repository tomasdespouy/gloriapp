import crypto from "node:crypto";

/**
 * Firma de tickets para el relé de voz (Etapa 2, voice-relay/). Espejo
 * exacto de la verificación en voice-relay/ticket.js — mismo algoritmo
 * (HMAC-SHA256 sobre el payload en base64url), mismo secreto
 * (VOICE_RELAY_SHARED_SECRET, configurado igual en ambos servicios).
 *
 * Sin librerías de JWT: el payload es mínimo y de un solo uso — un ticket
 * vive exactamente lo que dura el intento, no hace falta más que esto.
 */
export interface VoiceRelayTicketPayload {
  attemptId: string;
  aiPatientId: string;
  deadlineAt: string;
  model?: string;
  voice?: string;
  instructions?: string;
  /** Epoch ms — vencimiento del TICKET en sí (no de la sesión de voz). */
  exp: number;
}

export function signVoiceRelayTicket(payload: VoiceRelayTicketPayload): string {
  const secret = process.env.VOICE_RELAY_SHARED_SECRET;
  if (!secret) throw new Error("VOICE_RELAY_SHARED_SECRET no configurada");

  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payloadB64).digest("hex");
  return `${payloadB64}.${sig}`;
}
