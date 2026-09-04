/**
 * Resuelve el prompt vigente de un paciente DENTRO de una conversación.
 *
 * Existe para que las tres bocas del paciente hablen igual. Antes:
 *   /api/chat            → prompt_snapshot, o buildEnrichedPrompt() si no había
 *   /api/chat/silence    → system_prompt CRUDO
 *   /api/chat/interrupt  → system_prompt CRUDO
 *
 * O sea: al reaccionar a un silencio o a una interrupción, el paciente perdía
 * sus bloques de enriquecimiento (lugares, frases típicas, red social, estado
 * corporal) y hablaba como una versión más pobre de sí mismo. Y si el paciente
 * se editaba a mitad de una sesión, el chat seguía con el prompt congelado
 * mientras esas dos rutas usaban el nuevo: dos personas distintas en la misma
 * conversación.
 *
 * NOTA para quien venga después: `build-system-prompt.ts` no importa nada a
 * propósito — se carga directo desde `scripts/prompt-baseline.mjs` con el
 * type-stripping de Node. Si se le agrega una dependencia (supabase, por
 * ejemplo), esa prueba de regresión deja de correr. Por eso este helper, que sí
 * toca la base, vive acá y no allá.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildEnrichedPrompt, type EnrichablePatient } from "@/lib/build-system-prompt";

/** Columnas que hay que traer del paciente para poder componer su prompt. */
export const PATIENT_PROMPT_COLUMNS =
  "system_prompt, enrichment_red_social, enrichment_lugares, enrichment_estado_corporal, enrichment_frases_tipo";

/**
 * Devuelve el prompt que rige en esta conversación: el snapshot congelado al
 * iniciarla si existe, y si no, la composición en vivo (conversaciones
 * anteriores a que se guardara el snapshot).
 */
export async function resolveConversationPrompt(
  admin: SupabaseClient,
  conversationId: string | null | undefined,
  patient: EnrichablePatient,
): Promise<string> {
  if (conversationId) {
    const { data } = await admin
      .from("conversations")
      .select("prompt_snapshot")
      .eq("id", conversationId)
      .maybeSingle();
    const snapshot = data?.prompt_snapshot;
    if (typeof snapshot === "string" && snapshot.trim()) return snapshot;
  }
  return buildEnrichedPrompt(patient);
}
