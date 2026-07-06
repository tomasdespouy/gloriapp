/**
 * Comportamiento por nivel de dificultad del paciente IA.
 *
 * Capa ORTOGONAL al pacing_profile (conversation-pacing.ts):
 *   - pacing_profile   → temperamento / ritmo (CÓMO escribe el paciente)
 *   - difficulty_level → dureza clínica (QUÉ TAN difícil es tratarlo)
 *
 * Las dos perillas son independientes: un paciente puede ser
 * "principiante ansioso" o "avanzado depresivo".
 *
 * Dos sub-capas, con MUY distinta fiabilidad:
 *
 *   ⚙️ DETERMINISTA (código): timers y lógica de cliente. Fiable ~100%,
 *      no le pide nada al modelo y no agranda el system_prompt.
 *        - patienceMs     → presupuesto total de silencio antes de irse
 *        - respectsTyping → si el tipeo del estudiante pausa los nudges
 *
 *   🧠 CONDUCTUAL (modelo): cómo reacciona emocionalmente. Frágil.
 *      NO se implementa como prosa apilada en el system_prompt (diluye la
 *      identidad; ver hallazgo "rúbrica ≠ conducta"). Se implementará
 *      sembrando el ESTADO CLÍNICO inicial (initialStateBias) que el motor
 *      de alianza ya renderiza como UNA línea por turno, y con
 *      micro-inyecciones POR EVENTO (offenseSensitivity). Estos campos son
 *      SCAFFOLD: viven aquí como datos pero TODAVÍA NO están cableados. Se
 *      validan con el harness A/B (scripts/ab-conductual.js) antes de
 *      extenderlos a los 34 pacientes.
 */

export type DifficultyKey = "beginner" | "intermediate" | "advanced";

export type RespectsTyping = "full" | "partial" | "from2";
export type OffenseSensitivity = "none" | "mild" | "high";
export type AllianceSpeed = "fast" | "medium" | "slow";

export type DifficultyBehavior = {
  // ── ⚙️ ACTIVO ──
  /** Presupuesto total de silencio (ms) antes de que el paciente se
   *  retire. La curva de nudges del pacing se escala a este techo. */
  patienceMs: number;
  /** Cómo reacciona el "¿sigue ahí?" mientras el estudiante está
   *  escribiendo en la caja de texto:
   *    - "full"    → el tipeo pausa TODOS los nudges (principiante).
   *    - "partial" → el tipeo pausa, salvo el nudge final (intermedio).
   *    - "from2"   → el tipeo pausa solo el nudge 1; desde el nudge 2,
   *                  si está escribiendo, pregunta igual (avanzado).
   *  Lo consumirá ChatInterface (pendiente de cablear, ver doc). */
  respectsTyping: RespectsTyping;

  // ── 🧠 SCAFFOLD (datos, aún SIN cablear) ──
  /** Sensibilidad a comentarios torpes (juicio, minimizar, consejo
   *  prematuro): none = no se ofende, mild = se incomoda leve,
   *  high = se siente herido y lo expresa. */
  offenseSensitivity: OffenseSensitivity;
  /** Qué tan rápido sube la alianza por buena intervención. */
  allianceSpeed: AllianceSpeed;
  /** Sesgo del ESTADO CLÍNICO inicial (deltas sobre el baseline del motor
   *  de alianza). Más resistencia / menos alianza / menos apertura = más
   *  difícil. Se sumará al estado inicial al sembrar el motor. */
  initialStateBias: { resistencia: number; alianza: number; apertura: number };
};

export const DIFFICULTY_BEHAVIOR: Record<DifficultyKey, DifficultyBehavior> = {
  beginner: {
    patienceMs: 480_000, // 8 min
    // "full" en TODOS los niveles: mientras el estudiante escribe (hay texto en
    // la caja), se suprimen TODOS los nudges INCLUIDO el irse → estar redactando
    // nunca hace que el paciente te abandone. Si NO escribe, salen los 3 avisos
    // "¿sigue ahí?" y recién al final se va. (partial/from2 quedan en el tipo por
    // si se quiere diferenciar a futuro, pero hoy no se usan.)
    respectsTyping: "full",
    offenseSensitivity: "none",
    allianceSpeed: "fast",
    initialStateBias: { resistencia: 0, alianza: 0, apertura: 0 },
  },
  intermediate: {
    patienceMs: 360_000, // 6 min
    respectsTyping: "full",
    offenseSensitivity: "mild",
    allianceSpeed: "medium",
    initialStateBias: { resistencia: +1, alianza: -1, apertura: -1 },
  },
  advanced: {
    patienceMs: 300_000, // 5 min
    respectsTyping: "full",
    offenseSensitivity: "high",
    allianceSpeed: "slow",
    initialStateBias: { resistencia: +2, alianza: -2, apertura: -2 },
  },
};

export const DEFAULT_DIFFICULTY_KEY: DifficultyKey = "beginner";

/** Nombre legible para mostrar al admin al editar un paciente. */
export const DIFFICULTY_LABELS: Record<DifficultyKey, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

/** Resuelve un difficulty_level (posiblemente null/desconocido) a un
 *  comportamiento concreto. Fallback conservador a "beginner". */
export function getDifficultyBehavior(key: string | null | undefined): DifficultyBehavior {
  if (key && key in DIFFICULTY_BEHAVIOR) {
    return DIFFICULTY_BEHAVIOR[key as DifficultyKey];
  }
  return DIFFICULTY_BEHAVIOR[DEFAULT_DIFFICULTY_KEY];
}

/**
 * Escala la curva de umbrales de silencio del pacing_profile para que el
 * ÚLTIMO umbral coincida con el presupuesto de paciencia de la dificultad,
 * preservando el espaciado RELATIVO entre nudges.
 *
 * NO cambia la CANTIDAD de nudges (la longitud del array se conserva) —
 * solo CUÁNDO ocurren. Así el silence route (que deriva `totalStages` de
 * `.length`) queda intacto: cambia el "cuándo", no el "cuántos".
 *
 * Ejemplo: [60s, 120s, 210s, 300s] con patienceMs=180s (avanzado)
 *   factor = 180/300 = 0.6 → [36s, 72s, 126s, 180s].
 *
 * @param pacingThresholds  umbrales originales del pacing (ascendentes, ms)
 * @param patienceMs        techo de paciencia de la dificultad (ms)
 */
export function scaleSilenceThresholds(pacingThresholds: number[], patienceMs: number): number[] {
  if (!pacingThresholds || pacingThresholds.length === 0) return [];
  if (pacingThresholds.length === 1) return [patienceMs];
  const last = pacingThresholds[pacingThresholds.length - 1];
  if (last <= 0) return [...pacingThresholds]; // sin referencia válida: no escalar
  const factor = patienceMs / last;
  return pacingThresholds.map((t, i) =>
    // el último se fija exacto al presupuesto para evitar drift por redondeo
    i === pacingThresholds.length - 1 ? patienceMs : Math.round(t * factor)
  );
}
