/**
 * Corte de LLM por saldo: qué es y cómo se reconoce.
 *
 * Módulo puro (sin base de datos ni red) para poder usarlo en cualquier lado,
 * incluido el cliente.
 *
 * Por qué existe (corte del 19 al 30-oct-2026): Gemini llegó a su tope mensual
 * y todo pasó a OpenAI sin que nadie lo notara; cuando OpenAI agotó su crédito,
 * los estudiantes conversaron con un paciente que no respondía, el paciente les
 * pedía "repetir el mensaje" y el evaluador igual les puso nota.
 */

/** Valor de conversations.end_reason para una sesión interrumpida por el corte. */
export const LLM_OUTAGE_END_REASON = "llm_outage";

export type LlmProvider = "openai" | "gemini";
export type LlmBillingKind = "credit_exhausted" | "spend_cap" | "payment_required";

/**
 * Distingue "se acabó la plata" de un fallo pasajero. Un 429 genérico NO cuenta:
 * es límite de velocidad y se resuelve solo. Los textos salen de errores reales
 * registrados en producción, más el 402 que la documentación de Gemini indica
 * para el saldo prepago en cero.
 */
export function classifyBillingError(err: unknown): LlmBillingKind | null {
  if (!err) return null;
  const e = err as { message?: unknown; code?: unknown; status?: unknown; type?: unknown };
  const text = [e.message, e.code, e.type, typeof err === "string" ? err : ""]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/credit_balance_exhausted|insufficient_quota|no credits remaining/.test(text)) return "credit_exhausted";
  if (/spending cap|spend cap/.test(text)) return "spend_cap";
  if (e.status === 402 || /"code":\s*402|payment required/.test(text)) return "payment_required";
  return null;
}
