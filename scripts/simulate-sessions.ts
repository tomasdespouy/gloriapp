/**
 * GloriA — Simulation of 8 sessions × 2 patients × 3 therapist levels
 *
 * Uses the EXACT same delta formulas from clinical-state-engine.ts
 * to project state evolution deterministically.
 *
 * Run: npx tsx scripts/simulate-sessions.ts
 */

// ─── State engine (exact copy from src/lib/clinical-state-engine.ts) ───

interface ClinicalState {
  resistencia: number;
  alianza: number;
  apertura_emocional: number;
  sintomatologia: number;
  disposicion_cambio: number;
}

const INITIAL_STATE: ClinicalState = {
  resistencia: 7.0,
  alianza: 2.0,
  apertura_emocional: 2.0,
  sintomatologia: 7.0,
  disposicion_cambio: 2.0,
};

type InterventionType =
  | "pregunta_abierta" | "pregunta_cerrada" | "validacion_empatica"
  | "reformulacion" | "confrontacion" | "silencio_terapeutico"
  | "directividad" | "interpretacion" | "normalizacion" | "resumen" | "otro";

interface Deltas {
  resistencia?: number;
  alianza?: number;
  apertura_emocional?: number;
  sintomatologia?: number;
  disposicion_cambio?: number;
}

function calculateDeltas(type: InterventionType, state: ClinicalState): Deltas {
  switch (type) {
    case "pregunta_abierta":
      return { resistencia: -0.5, alianza: 0.3, apertura_emocional: 0.5 };
    case "pregunta_cerrada":
      return { resistencia: 0.3, apertura_emocional: -0.2 };
    case "validacion_empatica":
      return { resistencia: -0.8, alianza: 1.0, apertura_emocional: 0.7, sintomatologia: -0.5 };
    case "reformulacion":
      return { resistencia: -0.3, alianza: 0.5, apertura_emocional: 0.5 };
    case "confrontacion":
      if (state.alianza > 5) {
        return { resistencia: -0.3, apertura_emocional: 0.8, disposicion_cambio: 1.0 };
      } else {
        return { resistencia: 1.5, alianza: -1.0, apertura_emocional: -1.0 };
      }
    case "silencio_terapeutico":
      if (state.apertura_emocional > 4) {
        return { apertura_emocional: 0.5, sintomatologia: -0.3 };
      } else {
        return { resistencia: 0.5, sintomatologia: 0.3 };
      }
    case "directividad":
      return { resistencia: 1.0, alianza: -0.5, disposicion_cambio: -0.5 };
    case "interpretacion":
      if (state.alianza > 6 && state.apertura_emocional > 5) {
        return { apertura_emocional: 0.5, disposicion_cambio: 0.8 };
      } else {
        return { resistencia: 1.0, alianza: -0.5 };
      }
    case "normalizacion":
      return { alianza: 0.5, apertura_emocional: 0.3, sintomatologia: -0.5 };
    case "resumen":
      return { resistencia: -0.3, alianza: 0.5 };
    case "otro":
    default:
      return {};
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(10, parseFloat(v.toFixed(1))));
}

function applyDeltas(state: ClinicalState, deltas: Deltas): ClinicalState {
  return {
    resistencia: clamp(state.resistencia + (deltas.resistencia || 0)),
    alianza: clamp(state.alianza + (deltas.alianza || 0)),
    apertura_emocional: clamp(state.apertura_emocional + (deltas.apertura_emocional || 0)),
    sintomatologia: clamp(state.sintomatologia + (deltas.sintomatologia || 0)),
    disposicion_cambio: clamp(state.disposicion_cambio + (deltas.disposicion_cambio || 0)),
  };
}

// ─── Therapist profiles ───
// Each profile defines a probability distribution of interventions per session.
// A 60-minute session ≈ 15 therapist turns.

interface TherapistProfile {
  name: string;
  level: string;
  // Distribution of interventions (must sum to 1.0)
  distribution: Record<InterventionType, number>;
  // Per-session strategy adjustments (simulates learning/adaptation)
  adaptStrategy?: (session: number, state: ClinicalState) => Record<InterventionType, number>;
}

// PRINCIPIANTE: Relies heavily on closed questions, some open questions,
// attempts confrontation/directividad too early, little empathic validation.
const BEGINNER: TherapistProfile = {
  name: "Terapeuta Principiante",
  level: "beginner",
  distribution: {
    pregunta_abierta: 0.15,
    pregunta_cerrada: 0.30,
    validacion_empatica: 0.05,
    reformulacion: 0.05,
    confrontacion: 0.10,
    silencio_terapeutico: 0.02,
    directividad: 0.15,
    interpretacion: 0.05,
    normalizacion: 0.03,
    resumen: 0.02,
    otro: 0.08,
  },
};

// INTERMEDIO: More balanced. Uses open questions and validation,
// occasional confrontation, less directividad. Shows improvement over sessions.
const INTERMEDIATE: TherapistProfile = {
  name: "Terapeuta Intermedio",
  level: "intermediate",
  distribution: {
    pregunta_abierta: 0.25,
    pregunta_cerrada: 0.12,
    validacion_empatica: 0.18,
    reformulacion: 0.12,
    confrontacion: 0.05,
    silencio_terapeutico: 0.05,
    directividad: 0.05,
    interpretacion: 0.03,
    normalizacion: 0.05,
    resumen: 0.05,
    otro: 0.05,
  },
};

// AVANZADO: Strategically uses validation + open questions early to build alliance,
// reserves confrontation/interpretation for when conditions are met.
// Adapts across sessions.
const ADVANCED: TherapistProfile = {
  name: "Terapeuta Avanzado",
  level: "advanced",
  distribution: {
    pregunta_abierta: 0.22,
    pregunta_cerrada: 0.05,
    validacion_empatica: 0.25,
    reformulacion: 0.15,
    confrontacion: 0.03,
    silencio_terapeutico: 0.08,
    directividad: 0.02,
    interpretacion: 0.02,
    normalizacion: 0.05,
    resumen: 0.08,
    otro: 0.05,
  },
  adaptStrategy: (_session: number, state: ClinicalState) => {
    // Advanced therapist adapts: if alliance is high, uses more confrontation/interpretation
    if (state.alianza > 5 && state.apertura_emocional > 4) {
      return {
        pregunta_abierta: 0.18,
        pregunta_cerrada: 0.03,
        validacion_empatica: 0.20,
        reformulacion: 0.12,
        confrontacion: 0.10,
        silencio_terapeutico: 0.10,
        directividad: 0.02,
        interpretacion: 0.08,
        normalizacion: 0.04,
        resumen: 0.08,
        otro: 0.05,
      };
    }
    return {
      pregunta_abierta: 0.22,
      pregunta_cerrada: 0.05,
      validacion_empatica: 0.25,
      reformulacion: 0.15,
      confrontacion: 0.03,
      silencio_terapeutico: 0.08,
      directividad: 0.02,
      interpretacion: 0.02,
      normalizacion: 0.05,
      resumen: 0.08,
      otro: 0.05,
    };
  },
};

// ─── Simulation engine ───

function selectIntervention(dist: Record<InterventionType, number>, rng: () => number): InterventionType {
  const r = rng();
  let cumulative = 0;
  for (const [type, prob] of Object.entries(dist)) {
    cumulative += prob;
    if (r < cumulative) return type as InterventionType;
  }
  return "otro";
}

// Deterministic PRNG (mulberry32) for reproducibility
function mulberry32(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

interface TurnLog {
  turn: number;
  intervention: InterventionType;
  state: ClinicalState;
  deltas: Deltas;
}

interface SessionLog {
  session: number;
  turns: TurnLog[];
  startState: ClinicalState;
  endState: ClinicalState;
  interventionCounts: Record<string, number>;
}

const TURNS_PER_SESSION = 15; // ~60 min ≈ 15 therapist turns

function simulateSession(
  sessionNum: number,
  startState: ClinicalState,
  profile: TherapistProfile,
  rng: () => number,
): SessionLog {
  let state = { ...startState };
  const turns: TurnLog[] = [];
  const counts: Record<string, number> = {};

  for (let t = 1; t <= TURNS_PER_SESSION; t++) {
    // Get distribution (may adapt based on state)
    const dist = profile.adaptStrategy
      ? profile.adaptStrategy(sessionNum, state)
      : profile.distribution;

    const intervention = selectIntervention(dist, rng);
    counts[intervention] = (counts[intervention] || 0) + 1;

    const deltas = calculateDeltas(intervention, state);
    const newState = applyDeltas(state, deltas);

    turns.push({ turn: t, intervention, state: newState, deltas });
    state = newState;
  }

  return {
    session: sessionNum,
    turns,
    startState,
    endState: state,
    interventionCounts: counts,
  };
}

function simulate8Sessions(
  profile: TherapistProfile,
  seed: number,
): SessionLog[] {
  const rng = mulberry32(seed);
  const sessions: SessionLog[] = [];
  let state = { ...INITIAL_STATE };

  for (let s = 1; s <= 8; s++) {
    const session = simulateSession(s, state, profile, rng);
    sessions.push(session);
    // Next session starts where last one ended (state persists between sessions)
    state = session.endState;
  }

  return sessions;
}

// ─── Report generation ───

interface PatientConfig {
  name: string;
  difficulty: string;
  presenting_problem: string;
}

const PATIENTS: PatientConfig[] = [
  {
    name: "Lucía Mendoza",
    difficulty: "Principiante",
    presenting_problem: "Duelo perinatal, insomnio, conflicto de pareja",
  },
  {
    name: "Marcos Herrera",
    difficulty: "Intermedio",
    presenting_problem: "Ansiedad, insomnio, irritabilidad, duelo no procesado",
  },
];

const THERAPISTS: TherapistProfile[] = [BEGINNER, INTERMEDIATE, ADVANCED];

function formatState(s: ClinicalState): string {
  return `R:${s.resistencia.toFixed(1)} A:${s.alianza.toFixed(1)} AE:${s.apertura_emocional.toFixed(1)} S:${s.sintomatologia.toFixed(1)} DC:${s.disposicion_cambio.toFixed(1)}`;
}

function deltaSymbol(start: number, end: number): string {
  const d = end - start;
  if (d > 0) return `+${d.toFixed(1)}`;
  if (d < 0) return `${d.toFixed(1)}`;
  return "0.0";
}

function generateReport(): string {
  const lines: string[] = [];

  lines.push("═══════════════════════════════════════════════════════════════════════════");
  lines.push("  INFORME DE SIMULACIÓN — SENSIBILIDAD DEL MOTOR ADAPTATIVO");
  lines.push("  GloriA — Plataforma de Entrenamiento Clínico");
  lines.push("═══════════════════════════════════════════════════════════════════════════");
  lines.push("");
  lines.push("PARÁMETROS DE SIMULACIÓN:");
  lines.push("  - 2 pacientes × 3 niveles de terapeuta × 8 sesiones × 15 turnos/sesión");
  lines.push("  - Total: 720 intervenciones simuladas");
  lines.push("  - Motor adaptativo: fórmulas determinísticas (mismos deltas que producción)");
  lines.push("  - PRNG determinístico (mulberry32) para reproducibilidad");
  lines.push("  - 60 min/sesión ≈ 15 turnos de terapeuta");
  lines.push("");
  lines.push("ESTADO INICIAL (todas las conversaciones):");
  lines.push("  Resistencia: 7.0 | Alianza: 2.0 | Apertura: 2.0 | Síntomas: 7.0 | Disp. cambio: 2.0");
  lines.push("");

  const allResults: Record<string, Record<string, SessionLog[]>> = {};

  for (const patient of PATIENTS) {
    allResults[patient.name] = {};
    lines.push("┌─────────────────────────────────────────────────────────────────────────┐");
    lines.push(`│  PACIENTE: ${patient.name.padEnd(58)}│`);
    lines.push(`│  Dificultad: ${patient.difficulty.padEnd(55)}│`);
    lines.push(`│  Motivo: ${patient.presenting_problem.padEnd(59)}│`);
    lines.push("└─────────────────────────────────────────────────────────────────────────┘");
    lines.push("");

    for (const therapist of THERAPISTS) {
      // Use different seed per patient×therapist combo for variety
      const seed = PATIENTS.indexOf(patient) * 1000 + THERAPISTS.indexOf(therapist) * 100 + 42;
      const sessions = simulate8Sessions(therapist, seed);
      allResults[patient.name][therapist.level] = sessions;

      lines.push(`  ── ${therapist.name} ──`);
      lines.push("");
      lines.push("  Sesión │ Resistencia │ Alianza │ Apertura │ Síntomas │ Disp.Cambio │ Intervenciones principales");
      lines.push("  ───────┼─────────────┼─────────┼──────────┼──────────┼─────────────┼──────────────────────────");

      for (const session of sessions) {
        const s = session.endState;
        const topInterventions = Object.entries(session.interventionCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([type, count]) => `${type.replace(/_/g, " ")}(${count})`)
          .join(", ");

        lines.push(
          `     ${String(session.session).padStart(2)}   │    ${s.resistencia.toFixed(1).padStart(4)}     │  ${s.alianza.toFixed(1).padStart(4)}   │   ${s.apertura_emocional.toFixed(1).padStart(4)}   │   ${s.sintomatologia.toFixed(1).padStart(4)}   │     ${s.disposicion_cambio.toFixed(1).padStart(4)}     │ ${topInterventions}`
        );
      }

      // Total delta from session 1 start to session 8 end
      const initial = INITIAL_STATE;
      const final8 = sessions[7].endState;
      lines.push("  ───────┼─────────────┼─────────┼──────────┼──────────┼─────────────┼");
      lines.push(
        `  DELTA  │    ${deltaSymbol(initial.resistencia, final8.resistencia).padStart(5)}     │  ${deltaSymbol(initial.alianza, final8.alianza).padStart(5)}  │   ${deltaSymbol(initial.apertura_emocional, final8.apertura_emocional).padStart(5)}  │   ${deltaSymbol(initial.sintomatologia, final8.sintomatologia).padStart(5)}  │     ${deltaSymbol(initial.disposicion_cambio, final8.disposicion_cambio).padStart(5)}     │`
      );
      lines.push("");
    }

    lines.push("");
  }

  // ─── Comparative analysis ───
  lines.push("═══════════════════════════════════════════════════════════════════════════");
  lines.push("  ANÁLISIS COMPARATIVO");
  lines.push("═══════════════════════════════════════════════════════════════════════════");
  lines.push("");

  for (const patient of PATIENTS) {
    lines.push(`  ── ${patient.name} — Estado final después de 8 sesiones ──`);
    lines.push("");
    lines.push("                    │ Resistencia │ Alianza │ Apertura │ Síntomas │ Disp.Cambio │");
    lines.push("  ──────────────────┼─────────────┼─────────┼──────────┼──────────┼─────────────┤");
    lines.push(`  Estado inicial     │     7.0     │   2.0   │    2.0   │    7.0   │     2.0     │`);

    for (const therapist of THERAPISTS) {
      const final8 = allResults[patient.name][therapist.level][7].endState;
      lines.push(
        `  ${therapist.name.padEnd(18).slice(0, 18)} │     ${final8.resistencia.toFixed(1).padStart(4)}    │   ${final8.alianza.toFixed(1).padStart(4)}  │    ${final8.apertura_emocional.toFixed(1).padStart(4)}  │    ${final8.sintomatologia.toFixed(1).padStart(4)}  │     ${final8.disposicion_cambio.toFixed(1).padStart(4)}    │`
      );
    }
    lines.push("");
  }

  // ─── Sensitivity analysis ───
  lines.push("");
  lines.push("═══════════════════════════════════════════════════════════════════════════");
  lines.push("  ANÁLISIS DE SENSIBILIDAD");
  lines.push("═══════════════════════════════════════════════════════════════════════════");
  lines.push("");

  for (const patient of PATIENTS) {
    lines.push(`  ── ${patient.name} ──`);

    const beg = allResults[patient.name]["beginner"][7].endState;
    const int_ = allResults[patient.name]["intermediate"][7].endState;
    const adv = allResults[patient.name]["advanced"][7].endState;

    const dims: (keyof ClinicalState)[] = ["resistencia", "alianza", "apertura_emocional", "sintomatologia", "disposicion_cambio"];
    const labels: Record<string, string> = {
      resistencia: "Resistencia",
      alianza: "Alianza",
      apertura_emocional: "Apertura emocional",
      sintomatologia: "Sintomatología",
      disposicion_cambio: "Disposición al cambio",
    };

    for (const dim of dims) {
      const range = Math.abs(adv[dim] - beg[dim]);
      const direction = adv[dim] > beg[dim] ? "↑" : adv[dim] < beg[dim] ? "↓" : "=";
      const sensitivity = range > 4 ? "ALTA" : range > 2 ? "MEDIA" : "BAJA";

      lines.push(`    ${labels[dim].padEnd(24)} Principiante: ${beg[dim].toFixed(1)} → Intermedio: ${int_[dim].toFixed(1)} → Avanzado: ${adv[dim].toFixed(1)}  |  Rango: ${range.toFixed(1)} ${direction}  Sensibilidad: ${sensitivity}`);
    }
    lines.push("");
  }

  // ─── Session-by-session progression chart (ASCII) ───
  lines.push("");
  lines.push("═══════════════════════════════════════════════════════════════════════════");
  lines.push("  GRÁFICO DE EVOLUCIÓN — ALIANZA TERAPÉUTICA (sesión por sesión)");
  lines.push("═══════════════════════════════════════════════════════════════════════════");
  lines.push("");

  for (const patient of PATIENTS) {
    lines.push(`  ${patient.name}:`);
    lines.push("  10 ┤");

    for (let row = 9; row >= 0; row--) {
      let line = `  ${row.toString().padStart(2)} ┤ `;
      for (let s = 0; s < 8; s++) {
        const chars: string[] = [];
        for (const therapist of THERAPISTS) {
          const val = allResults[patient.name][therapist.level][s].endState.alianza;
          const rounded = Math.round(val);
          if (rounded === row) {
            chars.push(therapist.level === "beginner" ? "P" : therapist.level === "intermediate" ? "I" : "A");
          }
        }
        if (chars.length > 0) {
          line += chars.join("").padEnd(9);
        } else {
          line += "·".padEnd(9);
        }
      }
      lines.push(line);
    }
    lines.push("   0 ┤ ");
    lines.push("     └────────┬────────┬────────┬────────┬────────┬────────┬────────┬────────┐");
    lines.push("          S1       S2       S3       S4       S5       S6       S7       S8");
    lines.push("     P = Principiante   I = Intermedio   A = Avanzado");
    lines.push("");
  }

  // ─── Key findings ───
  lines.push("");
  lines.push("═══════════════════════════════════════════════════════════════════════════");
  lines.push("  HALLAZGOS CLAVE");
  lines.push("═══════════════════════════════════════════════════════════════════════════");
  lines.push("");

  // Calculate specific metrics
  for (const patient of PATIENTS) {
    const beg = allResults[patient.name]["beginner"];
    const adv = allResults[patient.name]["advanced"];

    // Find when advanced therapist gets alliance > 5 (enabling productive confrontation)
    const advAllianceOver5 = adv.findIndex(s => s.endState.alianza > 5) + 1;
    const begAllianceOver5 = beg.findIndex(s => s.endState.alianza > 5) + 1;

    lines.push(`  ${patient.name}:`);
    if (advAllianceOver5 > 0) {
      lines.push(`    - Terapeuta avanzado alcanza alianza > 5 en sesión ${advAllianceOver5} (habilita confrontación productiva)`);
    } else {
      lines.push(`    - Terapeuta avanzado NO alcanza alianza > 5 en 8 sesiones`);
    }
    if (begAllianceOver5 > 0) {
      lines.push(`    - Terapeuta principiante alcanza alianza > 5 en sesión ${begAllianceOver5}`);
    } else {
      lines.push(`    - Terapeuta principiante NUNCA alcanza alianza > 5 en 8 sesiones`);
    }

    // Confrontation impact
    const begConfrontations = beg.flatMap(s => s.turns.filter(t => t.intervention === "confrontacion"));
    const advConfrontations = adv.flatMap(s => s.turns.filter(t => t.intervention === "confrontacion"));
    const begConfProductiveCount = begConfrontations.filter(t => (t.deltas.resistencia || 0) < 0).length;
    const advConfProductiveCount = advConfrontations.filter(t => (t.deltas.resistencia || 0) < 0).length;

    lines.push(`    - Confrontaciones: Principiante ${begConfrontations.length} (${begConfProductiveCount} productivas) vs Avanzado ${advConfrontations.length} (${advConfProductiveCount} productivas)`);

    // Symptom reduction
    const begSymptomDelta = beg[7].endState.sintomatologia - 7;
    const advSymptomDelta = adv[7].endState.sintomatologia - 7;
    lines.push(`    - Reducción de síntomas: Principiante ${begSymptomDelta > 0 ? "+" : ""}${begSymptomDelta.toFixed(1)} vs Avanzado ${advSymptomDelta > 0 ? "+" : ""}${advSymptomDelta.toFixed(1)}`);
    lines.push("");
  }

  // ─── Sensitivity verdict ───
  lines.push("");
  lines.push("═══════════════════════════════════════════════════════════════════════════");
  lines.push("  VEREDICTO DE SENSIBILIDAD");
  lines.push("═══════════════════════════════════════════════════════════════════════════");
  lines.push("");
  lines.push("  El motor adaptativo es SENSIBLE al nivel del terapeuta si las variables");
  lines.push("  de estado divergen significativamente entre perfiles.");
  lines.push("");

  for (const patient of PATIENTS) {
    const beg = allResults[patient.name]["beginner"][7].endState;
    const adv = allResults[patient.name]["advanced"][7].endState;

    const totalDivergence =
      Math.abs(beg.resistencia - adv.resistencia) +
      Math.abs(beg.alianza - adv.alianza) +
      Math.abs(beg.apertura_emocional - adv.apertura_emocional) +
      Math.abs(beg.sintomatologia - adv.sintomatologia) +
      Math.abs(beg.disposicion_cambio - adv.disposicion_cambio);

    const verdict = totalDivergence > 15 ? "MUY SENSIBLE" : totalDivergence > 8 ? "SENSIBLE" : totalDivergence > 4 ? "MODERADO" : "INSENSIBLE";

    lines.push(`  ${patient.name}: Divergencia total = ${totalDivergence.toFixed(1)} puntos → ${verdict}`);
    lines.push(`    (Principiante vs Avanzado, suma de diferencias absolutas en 5 dimensiones)`);
    lines.push("");
  }

  // ─── Narrative impact simulation ───
  lines.push("");
  lines.push("═══════════════════════════════════════════════════════════════════════════");
  lines.push("  IMPACTO DEL NARRATIVO ACUMULATIVO");
  lines.push("═══════════════════════════════════════════════════════════════════════════");
  lines.push("");
  lines.push("  El narrativo acumulativo no afecta los NÚMEROS del motor adaptativo");
  lines.push("  (estado siempre reinicia en 7/2/2/7/2 por sesión nueva).");
  lines.push("  Su impacto es CUALITATIVO: afecta cómo el LLM genera las respuestas");
  lines.push("  del paciente, dándole memoria entre sesiones.");
  lines.push("");
  lines.push("  SIN narrativo (sesión 5): El paciente no recuerda sesiones 1-3.");
  lines.push("  CON narrativo (sesión 5): El paciente refiere evolución emocional previa.");
  lines.push("");
  lines.push("  Ejemplo proyectado (terapeuta avanzado, Lucía, sesión 5):");
  lines.push("    Narrativo acumulativo incluiría:");
  lines.push("    → Sesión 1: Lucía llegó nerviosa, habló del insomnio pero evitó el duelo.");
  lines.push("    → Sesión 2: Mencionó la pérdida del embarazo. Lloró brevemente.");
  lines.push("    → Sesión 3: Habló del conflicto con su pareja. Expresó culpa.");
  lines.push("    → Sesión 4: Reveló el alivio secreto. Se abrió emocionalmente.");
  lines.push("    → Esto permite que en sesión 5 el paciente diga: 'He pensado en lo que");
  lines.push("      hablamos la vez pasada sobre ese sentimiento de alivio...'");
  lines.push("");
  lines.push("  El narrativo es especialmente sensible al TERAPEUTA AVANZADO porque");
  lines.push("  logra estados de alta apertura que producen revelaciones más profundas");
  lines.push("  → narrativos más ricos → respuestas más contextuales en sesiones futuras.");
  lines.push("");

  return lines.join("\n");
}

// ─── Run ───
const report = generateReport();
console.log(report);
