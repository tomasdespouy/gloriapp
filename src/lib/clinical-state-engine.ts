/**
 * MOTOR ADAPTATIVO DE ESTADO CLÍNICO
 *
 * Modela la evolución del paciente virtual mediante 5 variables internas
 * y reglas de transición causalmente vinculadas a las intervenciones del estudiante.
 *
 * Flujo:
 * 1. El estudiante envía un mensaje
 * 2. classifyIntervention() → determina qué tipo de intervención fue
 * 3. calculateDeltas() → calcula cómo afecta cada variable
 * 4. applyDeltas() → actualiza el estado
 * 5. buildStatePrompt() → inyecta el estado en el prompt del paciente
 * 6. El LLM genera una respuesta condicionada por el estado actual
 */

// ═══ TYPES ═══

export type ClinicalState = {
  resistencia: number;       // 0-10: qué tan cerrado está
  alianza: number;           // 0-10: confianza con el terapeuta
  apertura_emocional: number; // 0-10: disposición a hablar de emociones
  sintomatologia: number;    // 0-10: intensidad de síntomas ahora
  disposicion_cambio: number; // 0-10: motivación para cambiar
};

export type InterventionType =
  | "pregunta_abierta"
  | "pregunta_cerrada"
  | "validacion_empatica"
  | "reformulacion"
  | "confrontacion"
  | "silencio_terapeutico"
  | "directividad"
  | "interpretacion"
  | "normalizacion"
  | "resumen"
  | "otro";

export type StateTransition = {
  intervention: InterventionType;
  deltas: Partial<ClinicalState>;
  condition?: (state: ClinicalState) => boolean;
};

// ═══ INITIAL STATE ═══
// A new patient starts cautious, low trust, closed

export const INITIAL_STATE: ClinicalState = {
  resistencia: 7.0,
  alianza: 2.0,
  apertura_emocional: 2.0,
  sintomatologia: 7.0,
  disposicion_cambio: 2.0,
};

// ═══ TRANSITION RULES ═══
// Each intervention type has a base effect on the state variables.
// Some effects are conditional on the current state.

const TRANSITION_RULES: StateTransition[] = [
  // Preguntas abiertas: invitan a explorar → bajan resistencia, suben apertura
  { intervention: "pregunta_abierta", deltas: { resistencia: -0.5, apertura_emocional: 0.5, alianza: 0.3 } },

  // Preguntas cerradas: limitan → suben resistencia levemente
  { intervention: "pregunta_cerrada", deltas: { resistencia: 0.3, apertura_emocional: -0.2 } },

  // Validación empática: el efecto más positivo → sube alianza, baja síntomas
  { intervention: "validacion_empatica", deltas: { alianza: 1.0, resistencia: -0.8, apertura_emocional: 0.7, sintomatologia: -0.5 } },

  // Reformulación: demuestra comprensión → sube alianza y apertura
  { intervention: "reformulacion", deltas: { alianza: 0.5, apertura_emocional: 0.5, resistencia: -0.3 } },

  // Confrontación: depende de la alianza
  // Con alianza alta (>5): puede ser productiva
  {
    intervention: "confrontacion",
    deltas: { apertura_emocional: 0.8, disposicion_cambio: 1.0, resistencia: -0.3 },
    condition: (s) => s.alianza > 5,
  },
  // Con alianza baja (≤5): contraproducente
  {
    intervention: "confrontacion",
    deltas: { resistencia: 1.5, alianza: -1.0, apertura_emocional: -1.0 },
    condition: (s) => s.alianza <= 5,
  },

  // Silencio terapéutico: depende de la apertura
  // Si apertura alta: productivo
  {
    intervention: "silencio_terapeutico",
    deltas: { apertura_emocional: 0.5, sintomatologia: -0.3 },
    condition: (s) => s.apertura_emocional > 4,
  },
  // Si apertura baja: genera incomodidad
  {
    intervention: "silencio_terapeutico",
    deltas: { resistencia: 0.5, sintomatologia: 0.3 },
    condition: (s) => s.apertura_emocional <= 4,
  },

  // Directividad: el estudiante da órdenes o consejos → sube resistencia
  { intervention: "directividad", deltas: { resistencia: 1.0, alianza: -0.5, disposicion_cambio: -0.5 } },

  // Interpretación: depende del timing
  {
    intervention: "interpretacion",
    deltas: { apertura_emocional: 0.5, disposicion_cambio: 0.8 },
    condition: (s) => s.alianza > 6 && s.apertura_emocional > 5,
  },
  {
    intervention: "interpretacion",
    deltas: { resistencia: 1.0, alianza: -0.5 },
    condition: (s) => s.alianza <= 6 || s.apertura_emocional <= 5,
  },

  // Normalización: "es normal sentir eso" → baja síntomas, sube alianza
  { intervention: "normalizacion", deltas: { sintomatologia: -0.5, alianza: 0.5, apertura_emocional: 0.3 } },

  // Resumen: demuestra escucha → sube alianza
  { intervention: "resumen", deltas: { alianza: 0.5, resistencia: -0.3 } },

  // Otro: efecto neutro
  { intervention: "otro", deltas: {} },
];

// ═══ FUNCTIONS ═══

/**
 * Classify a therapist intervention using keyword matching.
 * For production, this should use the LLM, but for speed we use heuristics.
 */
export function classifyIntervention(text: string): InterventionType {
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Silence / no dice nada
  if (lower.match(/^\[.*\]$/) || lower.includes("no dice nada") || lower.trim().length < 5) {
    return "silencio_terapeutico";
  }

  // Directividad: "debería", "tiene que", "haga esto"
  if (lower.match(/deberias?|tienes? que|haga|necesitas?|le recomiendo|mi consejo/)) {
    return "directividad";
  }

  // Interpretación: "lo que realmente pasa es", "quizás inconscientemente"
  if (lower.match(/lo que realmente|inconscientemente|en el fondo|me parece que usted|creo que lo que/)) {
    return "interpretacion";
  }

  // Confrontación: señalar contradicciones
  if (lower.match(/contradicci|sin embargo usted dijo|pero antes me dijo|no le parece que|no cree que/)) {
    return "confrontacion";
  }

  // Normalización
  if (lower.match(/es normal|es comprensible|es natural|muchas personas|no tiene nada de malo|esta bien sentir/)) {
    return "normalizacion";
  }

  // Reformulación: "si entiendo bien", "lo que escucho es"
  if (lower.match(/si entiendo bien|lo que escucho|en otras palabras|lo que me dice|pareciera que|suena como/)) {
    return "reformulacion";
  }

  // Validación empática
  if (lower.match(/entiendo como|debe ser dificil|puedo imaginar|eso suena|se nota que|comprendo|me imagino lo/)) {
    return "validacion_empatica";
  }

  // Resumen
  if (lower.match(/resumiendo|hasta ahora hemos|lo que hemos conversado|recapitulando|en resumen/)) {
    return "resumen";
  }

  // Pregunta cerrada (sí/no)
  if (lower.match(/\?/) && lower.match(/^(tiene|ha |le |es |fue |puede|esta |hay |siente)/)) {
    return "pregunta_cerrada";
  }

  // Pregunta abierta
  if (lower.match(/\?/) && lower.match(/como |que |por que |cuando |donde |cual |cuenteme|digame|hableme/)) {
    return "pregunta_abierta";
  }

  // Default: if has question mark, it's a question
  if (lower.includes("?")) {
    return "pregunta_abierta";
  }

  return "otro";
}

/**
 * Calculate how the intervention changes the patient's state.
 */
export function calculateDeltas(
  intervention: InterventionType,
  currentState: ClinicalState
): Partial<ClinicalState> {
  // Find matching rule (with condition check)
  const rule = TRANSITION_RULES.find(
    (r) => r.intervention === intervention && (!r.condition || r.condition(currentState))
  );

  return rule?.deltas || {};
}

/**
 * Apply deltas to the current state, clamping to 0-10.
 */
export function applyDeltas(
  state: ClinicalState,
  deltas: Partial<ClinicalState>
): ClinicalState {
  const clamp = (v: number) => Math.max(0, Math.min(10, parseFloat(v.toFixed(1))));

  return {
    resistencia: clamp(state.resistencia + (deltas.resistencia || 0)),
    alianza: clamp(state.alianza + (deltas.alianza || 0)),
    apertura_emocional: clamp(state.apertura_emocional + (deltas.apertura_emocional || 0)),
    sintomatologia: clamp(state.sintomatologia + (deltas.sintomatologia || 0)),
    disposicion_cambio: clamp(state.disposicion_cambio + (deltas.disposicion_cambio || 0)),
  };
}

/**
 * Build a prompt block that tells the LLM the patient's current internal state.
 * This conditions the response to reflect the state realistically.
 */
export function buildStatePrompt(state: ClinicalState): string {
  const resistDesc =
    state.resistencia >= 7 ? "Estás muy cerrado, evitas profundizar, das respuestas cortas y factuales."
    : state.resistencia >= 4 ? "Empiezas a bajar la guardia pero aún eres cauteloso."
    : "Estás abierto y dispuesto a compartir. La resistencia es mínima.";

  const alianzaDesc =
    state.alianza >= 7 ? "Confías en el terapeuta. Te sientes seguro para hablar de temas difíciles."
    : state.alianza >= 4 ? "Empiezas a confiar pero aún evalúas si es seguro abrirte."
    : "No confías aún en el terapeuta. Estás evaluándolo constantemente.";

  const aperturaDesc =
    state.apertura_emocional >= 7 ? "Estás dispuesto a hablar de emociones profundas, incluso las que te asustan."
    : state.apertura_emocional >= 4 ? "Puedes hablar de algunas emociones pero evitas las más dolorosas."
    : "Evitas cualquier tema emocional. Prefieres hablar de hechos y situaciones concretas.";

  const sintomaDesc =
    state.sintomatologia >= 7 ? "Tus síntomas están muy presentes. Te sientes agobiado."
    : state.sintomatologia >= 4 ? "Los síntomas están ahí pero los manejas."
    : "Te sientes relativamente tranquilo en este momento.";

  const cambioDesc =
    state.disposicion_cambio >= 7 ? "Quieres cambiar activamente. Buscas herramientas y soluciones."
    : state.disposicion_cambio >= 4 ? "Ves que algo tiene que cambiar pero no sabes cómo."
    : "No crees que necesites cambiar. 'Estoy bien así.'";

  return `\n[ESTADO INTERNO ACTUAL DEL PACIENTE — NO MENCIONES ESTOS NÚMEROS]
Tu estado emocional AHORA (esto guía cómo respondes, pero NO lo digas explícitamente):
- Resistencia: ${state.resistencia.toFixed(1)}/10 → ${resistDesc}
- Alianza terapéutica: ${state.alianza.toFixed(1)}/10 → ${alianzaDesc}
- Apertura emocional: ${state.apertura_emocional.toFixed(1)}/10 → ${aperturaDesc}
- Sintomatología: ${state.sintomatologia.toFixed(1)}/10 → ${sintomaDesc}
- Disposición al cambio: ${state.disposicion_cambio.toFixed(1)}/10 → ${cambioDesc}

IMPORTANTE: Responde de acuerdo a estos niveles. Si tu resistencia es alta, da respuestas cortas y evasivas. Si tu alianza es alta, puedes compartir cosas más profundas. NO menciones las variables ni los números.\n`;
}

/**
 * Get a human-readable label for the intervention type.
 */
export const INTERVENTION_LABELS: Record<InterventionType, string> = {
  pregunta_abierta: "Pregunta abierta",
  pregunta_cerrada: "Pregunta cerrada",
  validacion_empatica: "Validación empática",
  reformulacion: "Reformulación",
  confrontacion: "Confrontación",
  silencio_terapeutico: "Silencio terapéutico",
  directividad: "Directividad",
  interpretacion: "Interpretación",
  normalizacion: "Normalización",
  resumen: "Resumen",
  otro: "Otra intervención",
};
