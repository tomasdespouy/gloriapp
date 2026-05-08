/**
 * INF-2026-050: composición runtime del system_prompt con los 4 bloques de enriquecimiento.
 *
 * El system_prompt almacenado en ai_patients NO cambia. Esta función toma el prompt base
 * y lo enriquece insertando los bloques RED SOCIAL Y VÍNCULOS, LUGARES SIGNIFICATIVOS,
 * ESTADO CORPORAL Y RUTINA antes de "COMPORTAMIENTO EN SESIÓN", y FRASES TIPO QUE DICES
 * antes de "REGLAS".
 *
 * Si todos los bloques son NULL (paciente no enriquecido), devuelve el prompt sin cambios.
 * Esto garantiza retrocompatibilidad con pacientes pre-INF-050.
 *
 * Feature flag ENABLE_ENRICHMENT_BLOCKS: si es "false", la función ignora los bloques y
 * devuelve siempre el prompt original. Útil para rollback instantáneo en producción.
 */

export interface EnrichmentBlock {
  text: string;
  version?: number;
  generated_by?: "ai" | "human";
  generated_at?: string;
  model?: string;
}

export interface EnrichablePatient {
  system_prompt: string;
  enrichment_red_social?: EnrichmentBlock | null;
  enrichment_lugares?: EnrichmentBlock | null;
  enrichment_estado_corporal?: EnrichmentBlock | null;
  enrichment_frases_tipo?: EnrichmentBlock | null;
}

const COMPORTAMIENTO_MARKERS = [
  "\n\nCOMPORTAMIENTO EN SESIÓN:",
  "\n\nCOMPORTAMIENTO EN SESION:",
  "\nCOMPORTAMIENTO EN SESIÓN:",
  "\nCOMPORTAMIENTO EN SESION:",
];
const REGLAS_MARKERS = ["\n\nREGLAS:", "\nREGLAS:"];

function isFlagEnabled(): boolean {
  // Default true. Set to "false" in env to disable enrichment globally.
  return process.env.ENABLE_ENRICHMENT_BLOCKS !== "false";
}

function findFirstMarker(text: string, markers: readonly string[]): string | null {
  for (const m of markers) {
    if (text.includes(m)) return m;
  }
  return null;
}

/**
 * Build the system prompt with enrichment blocks injected at the canonical positions.
 *
 * Positions:
 *   - RED SOCIAL + LUGARES + ESTADO CORPORAL → before "\n\nCOMPORTAMIENTO EN SESIÓN:"
 *   - FRASES TIPO → before "\n\nREGLAS:"
 *
 * Fallbacks:
 *   - If COMPORTAMIENTO EN SESIÓN marker is missing, the first 3 blocks are inserted
 *     before REGLAS instead.
 *   - If REGLAS marker is also missing, blocks are appended to the end.
 *   - Empty/null blocks are skipped silently.
 *
 * Side effect: none. Pure function.
 */
export function buildEnrichedPrompt(patient: EnrichablePatient): string {
  if (!isFlagEnabled()) return patient.system_prompt;

  // Normalize line endings to \n so marker matching is reliable across Windows/Unix
  // sources (the existing prompts in DB were inserted with \r\n in some cases).
  let prompt = patient.system_prompt.replace(/\r\n/g, "\n");

  const rs = patient.enrichment_red_social?.text?.trim();
  const lu = patient.enrichment_lugares?.text?.trim();
  const ec = patient.enrichment_estado_corporal?.text?.trim();
  const ft = patient.enrichment_frases_tipo?.text?.trim();

  // Block 1-3 → injected together before COMPORTAMIENTO EN SESIÓN
  const earlyBlocks = [rs, lu, ec].filter(Boolean).join("\n\n");

  if (earlyBlocks) {
    const marker = findFirstMarker(prompt, COMPORTAMIENTO_MARKERS);
    if (marker) {
      prompt = prompt.replace(marker, `\n\n${earlyBlocks}${marker}`);
    } else {
      // Fallback 1: insert before REGLAS if it exists
      const reglasMarker = findFirstMarker(prompt, REGLAS_MARKERS);
      if (reglasMarker) {
        prompt = prompt.replace(reglasMarker, `\n\n${earlyBlocks}${reglasMarker}`);
      } else {
        // Fallback 2: append to end
        prompt = `${prompt}\n\n${earlyBlocks}`;
      }
    }
  }

  // Block 4 → injected before REGLAS (independent of the previous insertion)
  if (ft) {
    const reglasMarker = findFirstMarker(prompt, REGLAS_MARKERS);
    if (reglasMarker) {
      prompt = prompt.replace(reglasMarker, `\n\n${ft}${reglasMarker}`);
    } else {
      prompt = `${prompt}\n\n${ft}`;
    }
  }

  return prompt;
}

/**
 * Returns true if the patient has at least one enrichment block populated.
 * Useful for analytics and UI badges.
 */
export function hasEnrichment(patient: EnrichablePatient): boolean {
  return Boolean(
    patient.enrichment_red_social?.text ||
    patient.enrichment_lugares?.text ||
    patient.enrichment_estado_corporal?.text ||
    patient.enrichment_frases_tipo?.text
  );
}
