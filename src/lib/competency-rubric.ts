/**
 * Rúbrica conductual analítica para la evaluación de competencias V2.
 *
 * Basada en Valdés & Gómez (2023) — Pauta para la Evaluación de Competencias
 * Psicoterapéuticas para el trabajo con Adultos (Ediciones Universidad
 * Santo Tomás).
 *
 * Cada competencia define:
 *   - na_criteria        Cuándo marcar "no aplicaba" (score = null, justificación obligatoria)
 *   - omitido_criteria   Cuándo es 0 (la situación requería la competencia y el estudiante no la desplegó)
 *   - levels[1..4]       Descriptores conductuales observables, diferenciables entre niveles
 *
 * Diseño: los descriptores son específicos por competencia y por nivel para
 * reducir la inferencia del LLM evaluador y mejorar la consistencia
 * inter-evaluador. Se inyectan al EVALUATION_PROMPT como contexto.
 *
 * ADVERTENCIA: estos descriptores son un primer pase y deben ser validados
 * por un docente clínico (preferentemente del equipo Valdés & Gómez o
 * UST) antes de su uso en producción.
 */

import { COMPETENCY_KEYS_V2 } from "./gamification";

export type CompetencyKey = typeof COMPETENCY_KEYS_V2[number];
export type RubricLevel = 1 | 2 | 3 | 4;

export type CompetencyRubric = {
  na_criteria: string;
  omitido_criteria: string;
  levels: Record<RubricLevel, string>;
};

export const COMPETENCY_RUBRIC: Record<CompetencyKey, CompetencyRubric> = {
  setting_terapeutico: {
    na_criteria:
      "Sesión de continuidad donde el encuadre ya quedó establecido en sesiones previas y no emergen rupturas o quiebres que requieran re-encuadre.",
    omitido_criteria:
      "Era primera sesión o emergió una necesidad de aclarar/re-encuadrar y el estudiante no lo abordó.",
    levels: {
      1: "No explicita encuadre cuando corresponde; ignora rupturas del encuadre o las normaliza sin intervenir.",
      2: "Menciona algún elemento aislado del encuadre (ej. duración) pero no integra confidencialidad y roles; no verifica comprensión del paciente.",
      3: "Explicita los ejes centrales del encuadre (duración, confidencialidad, roles), abre espacio a preguntas y re-encuadra ante desvíos.",
      4: "Explicita el encuadre con lenguaje accesible, lo conecta con los objetivos del paciente, valida emociones que el encuadre suscita y re-encuadra naturalmente durante la sesión.",
    },
  },
  motivo_consulta: {
    na_criteria:
      "Sesión de seguimiento con motivo de consulta ya consensuado y trabajado, sin que emerjan nuevos motivos en esta sesión.",
    omitido_criteria:
      "Era primera sesión o emergieron nuevos motivos manifiestos y el estudiante no los exploró.",
    levels: {
      1: "Asume el motivo sin indagar, lo interpreta prematuramente o lo reduce a una etiqueta diagnóstica.",
      2: "Pregunta por el motivo manifiesto pero no profundiza más allá; no recoge la perspectiva del paciente.",
      3: "Indaga el motivo manifiesto y explora capas latentes con preguntas abiertas; integra la perspectiva del paciente.",
      4: "Integra motivos manifiestos y latentes, distingue motivo de derivación vs. motivo personal del paciente, identifica recursos asociados y los retroalimenta.",
    },
  },
  datos_contextuales: {
    na_criteria:
      "La información contextual necesaria ya está integrada de sesiones previas y no aplican nuevos contextos en esta sesión.",
    omitido_criteria:
      "El motivo de consulta requería indagar contextos relevantes (familia, trabajo, salud, redes) y el estudiante avanzó sin recogerlos.",
    levels: {
      1: "No recoge contextos relevantes o los indaga de forma intrusiva y desconectada del motivo.",
      2: "Pregunta por uno o dos contextos básicos (ej. familia o trabajo) sin integrarlos con el motivo de consulta.",
      3: "Indaga contextos relevantes (familia, trabajo, salud, redes) y los conecta explícitamente con el motivo.",
      4: "Tejido fluido entre múltiples contextos y motivo; integra dimensión sociocultural sin estereotipar; el paciente percibe coherencia clínica.",
    },
  },
  objetivos: {
    na_criteria:
      "Fase temprana de la sesión centrada en exploración inicial; aún no procede formular objetivos terapéuticos.",
    omitido_criteria:
      "La fase clínica permitía y requería plantear objetivos, y el estudiante no los abrió a diálogo.",
    levels: {
      1: "Impone objetivos unilateralmente sin verificar con el paciente, o los enuncia en términos vagos no verificables.",
      2: "Propone uno o dos objetivos y obtiene aceptación general, sin desglosar metas verificables ni alineación explícita con el motivo.",
      3: "Construye objetivos en diálogo con el paciente, alineados con el motivo de consulta y con metas verificables.",
      4: "Co-construcción explícita; objetivos escalonados, revisables, conectados con los recursos del paciente y con criterios de avance pactados.",
    },
  },
  escucha_activa: {
    na_criteria:
      "Caso excepcional: la sesión transcurrió sin contenidos verbales o no verbales que requirieran reflejo o validación (raramente aplicable).",
    omitido_criteria:
      "El paciente expresó contenidos relevantes y el estudiante no los reconoció ni reflejó en momentos clave.",
    levels: {
      1: "Interrumpe al paciente, cambia tema sin reconocer lo dicho o emite respuestas incongruentes con la comunicación recibida.",
      2: "Refleja contenido verbal de forma literal pero sin integrar la dimensión emocional ni el matiz del relato.",
      3: "Refleja contenido y emoción en al menos tres momentos significativos; chequea comprensión y toma pausas para procesar.",
      4: "Integra reflejo, validación y síntesis; usa silencios funcionales; deja espacio para que el paciente corrija interpretaciones y profundice.",
    },
  },
  actitud_no_valorativa: {
    na_criteria:
      "Caso excepcional: la sesión no contuvo contenidos sensibles donde la postura valorativa pudiera manifestarse (raramente aplicable).",
    omitido_criteria:
      "El paciente compartió contenido cargado de valor (ej. consumo, sexualidad, creencias) y el estudiante no sostuvo neutralidad.",
    levels: {
      1: "Emite aprobaciones o desaprobaciones explícitas, consejos morales o sugerencias prematuras de lo que el paciente 'debería' hacer.",
      2: "Evita juicios obvios pero deja escapar señales implícitas (tono, preguntas dirigidas, omisiones selectivas).",
      3: "Aceptación sostenida; valida sin aprobar ni desaprobar contenidos sensibles; preguntas abiertas y neutrales.",
      4: "Sostiene aceptación incluso ante contenidos disonantes con sus propios valores; nombra y elabora la diferencia cuando es terapéuticamente útil.",
    },
  },
  optimismo: {
    na_criteria:
      "Momentos donde transmitir optimismo sería invalidante o iatrogénico (duelo agudo, crisis emocional intensa, ideación suicida activa).",
    omitido_criteria:
      "El paciente buscó explícitamente esperanza o el estudiante no apoyó recursos identificables en el material.",
    levels: {
      1: "Optimismo falso o forzado que minimiza el sufrimiento ('ya pasará', 'no es tan grave') o invalida el malestar.",
      2: "Optimismo genérico sin anclar en recursos específicos del paciente; frases motivacionales sin base clínica.",
      3: "Transmite esperanza anclada en recursos observados en el paciente, sin minimizar el sufrimiento.",
      4: "Integra optimismo terapéutico con intervenciones técnicas; convierte percepciones de bloqueo en oportunidades sin negar el dolor.",
    },
  },
  presencia: {
    na_criteria:
      "Caso excepcional: la sesión fue tan breve o estructural que no permitió observar presencia (raramente aplicable).",
    omitido_criteria:
      "Las respuestas del estudiante fueron mecánicas o distantes a lo largo de toda la sesión, sin sintonía con el momento emocional.",
    levels: {
      1: "Respuestas genéricas, fuera de sintonía con el registro emocional del paciente; ritmo desacoplado.",
      2: "Presencia intermitente; sintoniza algunos momentos y se desconecta en otros; estructura rígida ante cambios emocionales.",
      3: "Presencia sostenida; se adapta al ritmo emocional del paciente; flexibiliza estructura cuando es necesario.",
      4: "Sintonía fina con los cambios de registro emocional; deja que la sesión emerja sin forzar agenda; nombra el aquí y ahora cuando es clínicamente útil.",
    },
  },
  conducta_no_verbal: {
    na_criteria:
      "Modalidad puramente textual sin indicadores no verbales observables (chat sin pausas largas, emojis, escritura entrecortada o paráfrasis de gestos).",
    omitido_criteria:
      "El paciente manifestó señales no verbales identificables (suspiros mencionados, silencios extensos, descripciones corporales) y el estudiante no las integró.",
    levels: {
      1: "Ignora señales no verbales explícitas del paciente aunque sean centrales para entender su estado.",
      2: "Detecta alguna señal (ej. silencios) pero no la integra en su intervención ni la nombra para el paciente.",
      3: "Nombra señales no verbales relevantes y las conecta explícitamente con el contenido verbal del paciente.",
      4: "Integra fluidamente lo verbal y lo no verbal; usa la conducta no verbal como pista para profundizar; chequea su lectura con el paciente.",
    },
  },
  contencion_afectos: {
    na_criteria:
      "La sesión no contuvo momentos de intensidad emocional alta que requirieran contención específica.",
    omitido_criteria:
      "Emergió intensidad emocional alta y el estudiante la evadió, cambió tema o intelectualizó.",
    levels: {
      1: "Responde con racionalización, consejos o minimización cuando el paciente expresa malestar intenso.",
      2: "Reconoce la emoción ('entiendo que estás triste') pero no sostiene el espacio emocional ni acompaña el proceso.",
      3: "Sostiene momentos de alta intensidad con validación, presencia y silencios funcionales.",
      4: "Contiene sin invadir; modula su intervención según la fase emocional; integra contención con apertura a nuevos significados.",
    },
  },
};

/**
 * Serializa la rúbrica a un bloque de texto inyectable en el prompt del LLM.
 * Devuelve un fragmento listo para concatenar al EVALUATION_PROMPT.
 */
export function rubricToPromptSection(): string {
  const blocks = Object.entries(COMPETENCY_RUBRIC).map(([key, rubric]) => {
    const levels = ([1, 2, 3, 4] as RubricLevel[])
      .map((lvl) => `  ${lvl}: ${rubric.levels[lvl]}`)
      .join("\n");
    return [
      `### ${key}`,
      `NA (no aplicaba): ${rubric.na_criteria}`,
      `0 (omitido — debió aplicar y no se hizo): ${rubric.omitido_criteria}`,
      `Niveles 1-4:`,
      levels,
    ].join("\n");
  });
  return blocks.join("\n\n");
}
