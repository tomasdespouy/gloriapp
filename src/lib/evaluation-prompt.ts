/**
 * Construcción del prompt de evaluación + parseo y persistencia.
 *
 * Centraliza la lógica que antes estaba duplicada entre:
 *   - src/app/api/sessions/[conversationId]/evaluate/route.ts
 *   - src/app/api/sessions/[conversationId]/complete/route.ts
 *
 * Incorpora las mejoras V3:
 *   P1  Rúbrica conductual analítica inyectada al prompt
 *   P2  Distinción explícita NA (null) vs. omitido (0)
 *   P3  Evidencia como array (múltiples citas por competencia)
 *   P4  Snapshot ai_original al persistir
 */

import {
  COMPETENCY_RUBRIC,
  rubricToPromptSection,
  type CompetencyKey,
} from "./competency-rubric";
import { COMPETENCY_KEYS_V2 } from "./gamification";

export const RUBRIC_VERSION = "v3.0";

/**
 * Shape de la salida esperada del LLM.
 *
 * - `scores[competency]` puede ser un número 0-4 o la string sentinel "NA"
 *   (algunos modelos manejan null en JSON de forma inconsistente; usamos
 *   "NA" y convertimos a null al persistir).
 * - `evidence[competency]` es un array de citas, no un objeto único.
 */
export type EvaluationEvidence = {
  quote: string;
  turn?: number;
  observation: string;
  polarity: "fortaleza" | "oportunidad";
};

export type LLMScoreValue = number | "NA";

export type LLMEvaluationOutput = {
  scores: Record<CompetencyKey, LLMScoreValue>;
  overall_score_v2: number;
  na_justifications: Partial<Record<CompetencyKey, string>>;
  commentary: string;
  strengths: string[];
  areas_to_improve: string[];
  evidence: Partial<Record<CompetencyKey, EvaluationEvidence[]>>;
};

/**
 * Versión normalizada para persistencia: NA → null, números pasan tal cual.
 */
export type NormalizedScores = Record<CompetencyKey, number | null>;

export type NormalizedEvaluation = {
  scores: NormalizedScores;
  overall_score_v2: number;
  na_justifications: Partial<Record<CompetencyKey, string>>;
  commentary: string;
  strengths: string[];
  areas_to_improve: string[];
  evidence: Partial<Record<CompetencyKey, EvaluationEvidence[]>>;
};

// ─────────────────────────────────────────────────────────────────
// Prompt
// ─────────────────────────────────────────────────────────────────

const COMPETENCY_LIST = COMPETENCY_KEYS_V2.join(", ");

export const EVALUATION_PROMPT = `Eres un supervisor clínico experto evaluando la sesión de un estudiante de psicología.
Usa la Pauta para la Evaluación de Competencias Psicoterapéuticas para el trabajo con Adultos (Valdés & Gómez, 2023), del libro "Supervisión clínica para estudiantes de Psicología" (Ediciones Universidad Santo Tomás).

═══════════════════════════════════════════════════
ESCALA DE PUNTUACIÓN (aplica a cada competencia)
═══════════════════════════════════════════════════

  "NA"  No aplicaba — la situación clínica no requería esta competencia
        (DEBES justificar en na_justifications por qué).
   0    Omitido — la situación la requería y el estudiante no la desplegó.
   1    Deficiente
   2    Básico/parcial
   3    Adecuado
   4    Excelente/integrado

REGLAS CRÍTICAS:
- NO uses "NA" como excusa para evitar evaluar. Si el contexto requería
  la competencia (aunque sea de forma básica), asigna 0-4.
- "NA" se usa SOLO cuando hay un motivo clínico documentable
  (ej. setting ya consensuado en sesión previa de continuidad).
- 0 NO es lo mismo que "NA". 0 significa que la competencia debió
  aplicarse y no se vio en la conversación.

═══════════════════════════════════════════════════
RÚBRICA CONDUCTUAL POR COMPETENCIA
═══════════════════════════════════════════════════

${rubricToPromptSection()}

═══════════════════════════════════════════════════
EVIDENCIA TEXTUAL (obligatoria)
═══════════════════════════════════════════════════

Para cada competencia con score numérico (0-4), incluye AL MENOS 2 citas
textuales del estudiante en evidence[competency] (array). Cada cita debe
indicar si ilustra una fortaleza o una oportunidad de mejora. Las citas
deben ser literales (copia exacta del mensaje del terapeuta).

Para competencias con score "NA", evidence[competency] puede ser array vacío [].

═══════════════════════════════════════════════════
PROMEDIO GENERAL
═══════════════════════════════════════════════════

overall_score_v2 = promedio aritmético de las competencias con score
numérico (0-4). Las marcadas como "NA" se EXCLUYEN del promedio.
Las marcadas con 0 SÍ entran al promedio (penalización por omisión).

═══════════════════════════════════════════════════
FORMATO DE RESPUESTA (JSON estricto, sin markdown)
═══════════════════════════════════════════════════

{
  "scores": {
    "setting_terapeutico": 0,
    "motivo_consulta": "NA",
    "datos_contextuales": 2,
    "objetivos": "NA",
    "escucha_activa": 3,
    "actitud_no_valorativa": 3,
    "optimismo": "NA",
    "presencia": 2,
    "conducta_no_verbal": 1,
    "contencion_afectos": 2
  },
  "overall_score_v2": 1.9,
  "na_justifications": {
    "motivo_consulta": "Sesión de seguimiento donde el motivo ya estaba consensuado",
    "objetivos": "Fase temprana de exploración inicial",
    "optimismo": "Momento de duelo agudo donde el optimismo sería invalidante"
  },
  "commentary": "Retroalimentación constructiva, 3-5 oraciones que identifiquen el patrón general (no eventos sueltos). Para cada área de mejora, incluir un contrafactual: qué pudo decir/hacer en su lugar y por qué.",
  "strengths": ["fortaleza específica con anclaje en la conversación", "otra fortaleza"],
  "areas_to_improve": ["área concreta y accionable", "otra área"],
  "evidence": {
    "setting_terapeutico": [
      {"quote": "cita literal del terapeuta", "turn": 1, "observation": "por qué ilustra el nivel asignado", "polarity": "oportunidad"}
    ],
    "datos_contextuales": [
      {"quote": "cita 1", "turn": 5, "observation": "...", "polarity": "fortaleza"},
      {"quote": "cita 2", "turn": 12, "observation": "...", "polarity": "oportunidad"}
    ]
  }
}

Competencias a evaluar: ${COMPETENCY_LIST}.
Responde ÚNICAMENTE con el JSON, sin markdown ni backticks.

═══════════════════════════════════════════════════
REGLAS CRÍTICAS (cumplir sin excepción)
═══════════════════════════════════════════════════

1. EVIDENCIA OBLIGATORIA: cada competencia con score numérico (0, 1, 2, 3 o
   4) DEBE tener al menos 2 entradas en evidence[competency]. Si una
   competencia obtiene un score numérico, evidence[competency] NO PUEDE ser
   un array vacío. Si solo encuentras una cita representativa, busca una
   segunda — puede ser del mismo turno (una fortaleza y una oportunidad
   del mismo turno cuentan como dos citas distintas).

2. overall_score_v2: usa el promedio aritmético exacto de los scores
   numéricos (excluyendo "NA"). Usa un decimal — no redondees al entero
   (ej. 1.9, 2.4, 2.86). No pongas valores como 2.0 a menos que el
   promedio sea exactamente 2.

3. NA Y CONTEXTO DE SESIÓN: antes de marcar una competencia como "NA",
   relee el bloque "CONTEXTO DE LA SESIÓN" que se entrega al inicio del
   mensaje del usuario. Si el contexto indica que es la PRIMERA sesión,
   NO puedes marcar setting_terapeutico, motivo_consulta ni
   datos_contextuales como "NA" por motivo de "seguimiento" o "ya
   consensuado". Esas competencias deben recibir un score 0-4 en una
   primera sesión.`;

// ─────────────────────────────────────────────────────────────────
// Parseo y normalización
// ─────────────────────────────────────────────────────────────────

function parseScore(v: unknown): number | null {
  if (v === "NA" || v === null || v === undefined) return null;
  if (typeof v === "number" && v >= 0 && v <= 4) return v;
  if (typeof v === "string") {
    const trimmed = v.trim().toUpperCase();
    if (trimmed === "NA" || trimmed === "N/A") return null;
    const n = Number(trimmed);
    if (Number.isFinite(n) && n >= 0 && n <= 4) return n;
  }
  return null;
}

function computeOverallV2(scores: NormalizedScores): number {
  const numeric = Object.values(scores).filter(
    (v): v is number => typeof v === "number",
  );
  if (numeric.length === 0) return 0;
  const avg = numeric.reduce((a, b) => a + b, 0) / numeric.length;
  return Math.round(avg * 10) / 10;
}

function normalizeEvidence(
  raw: unknown,
): Partial<Record<CompetencyKey, EvaluationEvidence[]>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<CompetencyKey, EvaluationEvidence[]>> = {};

  for (const key of COMPETENCY_KEYS_V2 as CompetencyKey[]) {
    const val = (raw as Record<string, unknown>)[key];
    if (!val) continue;
    // Backward compat: si llega como {quote, observation} en vez de array
    if (Array.isArray(val)) {
      out[key] = (val as Record<string, unknown>[])
        .map((e): EvaluationEvidence => ({
          quote: String(e.quote ?? ""),
          turn: typeof e.turn === "number" ? e.turn : undefined,
          observation: String(e.observation ?? ""),
          polarity:
            e.polarity === "fortaleza" ? "fortaleza" : "oportunidad",
        }))
        .filter((e) => e.quote.length > 0);
    } else if (typeof val === "object") {
      const v = val as Record<string, unknown>;
      if (typeof v.quote === "string" && v.quote.length > 0) {
        out[key] = [
          {
            quote: v.quote,
            observation: String(v.observation ?? ""),
            polarity: "oportunidad",
          },
        ];
      }
    }
  }
  return out;
}

/**
 * Parsea la respuesta cruda del LLM y la normaliza al shape persistible.
 * Tolerante a variantes (LLM puede devolver claves al nivel raíz en vez
 * de en `scores`, o evidencia en shape viejo).
 */
export function normalizeEvaluation(raw: unknown): NormalizedEvaluation {
  const r = (raw ?? {}) as Record<string, unknown>;

  // Algunos modelos devuelven los scores al nivel raíz (compat con prompts antiguos)
  const scoresSource =
    (r.scores as Record<string, unknown> | undefined) ?? r;

  const scores: NormalizedScores = Object.fromEntries(
    COMPETENCY_KEYS_V2.map((key) => [key, parseScore(scoresSource[key])]),
  ) as NormalizedScores;

  const naJustRaw =
    (r.na_justifications as Record<string, unknown> | undefined) ?? {};
  const na_justifications: Partial<Record<CompetencyKey, string>> = {};
  for (const key of COMPETENCY_KEYS_V2 as CompetencyKey[]) {
    if (scores[key] === null && typeof naJustRaw[key] === "string") {
      na_justifications[key] = naJustRaw[key] as string;
    }
  }

  // Siempre recomputamos overall_score_v2 desde los scores normalizados.
  // Los LLM tienden a redondear (2.0 en lugar de 1.86), lo que distorsiona
  // las métricas agregadas a través de muchas sesiones.
  const overall_score_v2 = computeOverallV2(scores);

  return {
    scores,
    overall_score_v2,
    na_justifications,
    commentary: typeof r.commentary === "string" ? r.commentary : "",
    strengths: Array.isArray(r.strengths) ? (r.strengths as string[]) : [],
    areas_to_improve: Array.isArray(r.areas_to_improve)
      ? (r.areas_to_improve as string[])
      : [],
    evidence: normalizeEvidence(r.evidence),
  };
}

/**
 * Construye el snapshot ai_original para persistencia.
 */
export function buildAiOriginal(
  evaluation: NormalizedEvaluation,
  modelInfo: { model: string },
) {
  return {
    scores: evaluation.scores,
    overall_score_v2: evaluation.overall_score_v2,
    na_justifications: evaluation.na_justifications,
    commentary: evaluation.commentary,
    strengths: evaluation.strengths,
    areas_to_improve: evaluation.areas_to_improve,
    evidence: evaluation.evidence,
    model: modelInfo.model,
    rubric_version: RUBRIC_VERSION,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Devuelve el payload de upsert a session_competencies para una evaluación
 * V3. Maneja:
 *   - NULL en las 10 columnas para casos NA
 *   - Mapeo legacy V1 (para reportes que aún consultan V1)
 *   - Snapshot ai_original inmutable
 */
export function buildCompetencyUpsert(
  evaluation: NormalizedEvaluation,
  ctx: {
    conversationId: string;
    studentId: string;
    model: string;
  },
) {
  const s = evaluation.scores;

  // Para columnas legacy V1: usamos 0 cuando el equivalente V2 es null,
  // ya que las V1 son NOT NULL DEFAULT 0. Esto solo afecta reportes legacy.
  const v1Fallback = (v: number | null) => v ?? 0;

  return {
    conversation_id: ctx.conversationId,
    student_id: ctx.studentId,
    feedback_status: "pending",
    // V2 (NULL = NA, 0-4 = puntaje)
    setting_terapeutico: s.setting_terapeutico,
    motivo_consulta: s.motivo_consulta,
    datos_contextuales: s.datos_contextuales,
    objetivos: s.objetivos,
    escucha_activa: s.escucha_activa,
    actitud_no_valorativa: s.actitud_no_valorativa,
    optimismo: s.optimismo,
    presencia: s.presencia,
    conducta_no_verbal: s.conducta_no_verbal,
    contencion_afectos: s.contencion_afectos,
    overall_score_v2: evaluation.overall_score_v2,
    // eval_version queda en 2 (rúbrica V3 se distingue por ai_original.rubric_version)
    eval_version: 2,
    na_justifications: evaluation.na_justifications,
    // Legacy V1 mapeado (mismo criterio que el código previo)
    empathy: v1Fallback(s.escucha_activa),
    active_listening: v1Fallback(s.escucha_activa),
    open_questions: v1Fallback(s.motivo_consulta),
    reformulation: v1Fallback(s.datos_contextuales),
    confrontation: v1Fallback(s.actitud_no_valorativa),
    silence_management: v1Fallback(s.presencia),
    rapport: v1Fallback(s.contencion_afectos),
    overall_score: evaluation.overall_score_v2,
    // Feedback verbal y evidencia
    ai_commentary: evaluation.commentary,
    strengths: evaluation.strengths,
    areas_to_improve: evaluation.areas_to_improve,
    evidence: evaluation.evidence,
    // Snapshot inmutable (P4)
    ai_original: buildAiOriginal(evaluation, { model: ctx.model }),
  };
}

/**
 * Construye el mensaje del usuario para el LLM evaluador, anteponiendo
 * un bloque de contexto de sesión cuando se conoce el número.
 *
 * El contexto ayuda al LLM a no marcar setting/motivo/objetivos como
 * "NA por seguimiento" cuando en realidad es la primera sesión.
 */
export function buildUserMessage(
  transcript: string,
  ctx?: { sessionNumber?: number | null },
): string {
  const n = ctx?.sessionNumber;
  let header = "";
  if (typeof n === "number") {
    if (n === 1) {
      header =
        "CONTEXTO DE LA SESIÓN: esta es la PRIMERA sesión entre el estudiante y el paciente. No existen sesiones previas. " +
        "Por lo tanto, las competencias de Estructura (setting_terapeutico, motivo_consulta, datos_contextuales) NO PUEDEN marcarse como 'NA' por motivo de 'seguimiento' o 'ya consensuado'. " +
        "En primera sesión esas tres competencias siempre aplican y deben recibir un score 0-4.\n\n";
    } else {
      header =
        `CONTEXTO DE LA SESIÓN: esta es la sesión número ${n} entre el estudiante y el paciente. ` +
        `Hay ${n - 1} sesion${n - 1 === 1 ? "" : "es"} previa${n - 1 === 1 ? "" : "s"}. ` +
        "Si una competencia de Estructura quedó consensuada en sesiones anteriores y no aplica re-trabajar en esta, puede marcarse 'NA' con justificación clínica.\n\n";
    }
  }
  return `${header}Conversación a evaluar:\n\n${transcript}`;
}

/**
 * Determina el identificador del modelo LLM activo a partir de env vars.
 */
export function activeModelLabel(): string {
  const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase();
  if (provider === "gemini") return process.env.GEMINI_MODEL || "gemini-2.5-flash";
  return process.env.OPENAI_MODEL || "gpt-4o";
}

/**
 * Normaliza el campo `evidence` para consumo en la UI. Acepta:
 *   - Array nuevo: EvaluationEvidence[] (V3)
 *   - Objeto legacy: {quote, observation} (V2)
 *   - undefined/null → []
 *
 * Idempotente: pasar un EvaluationEvidence[] devuelve el mismo array.
 */
export function getEvidenceList(raw: unknown): EvaluationEvidence[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return (raw as unknown[])
      .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
      .map((e): EvaluationEvidence => ({
        quote: String(e.quote ?? ""),
        turn: typeof e.turn === "number" ? e.turn : undefined,
        observation: String(e.observation ?? ""),
        polarity: e.polarity === "fortaleza" ? "fortaleza" : "oportunidad",
      }))
      .filter((e) => e.quote.length > 0);
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o.quote === "string" && o.quote.length > 0) {
      return [
        {
          quote: o.quote,
          observation: typeof o.observation === "string" ? o.observation : "",
          polarity: "oportunidad",
        },
      ];
    }
  }
  return [];
}

/**
 * Aplana una NormalizedEvaluation al shape histórico que el frontend
 * (ReviewClient, TeacherReviewClient) consume directamente. Mantiene
 * compatibilidad con código que espera campos al nivel raíz.
 *
 * Convención: NA → 0 en el shape plano (la UI aún no distingue NA de 0;
 * la distinción vive en la BD a través de na_justifications).
 */
export function evaluationToFlat(e: NormalizedEvaluation) {
  const s = e.scores;
  const flat = (v: number | null) => (v ?? 0);
  return {
    setting_terapeutico: flat(s.setting_terapeutico),
    motivo_consulta: flat(s.motivo_consulta),
    datos_contextuales: flat(s.datos_contextuales),
    objetivos: flat(s.objetivos),
    escucha_activa: flat(s.escucha_activa),
    actitud_no_valorativa: flat(s.actitud_no_valorativa),
    optimismo: flat(s.optimismo),
    presencia: flat(s.presencia),
    conducta_no_verbal: flat(s.conducta_no_verbal),
    contencion_afectos: flat(s.contencion_afectos),
    overall_score_v2: e.overall_score_v2,
    overall_score: e.overall_score_v2,
    eval_version: 2,
    commentary: e.commentary,
    ai_commentary: e.commentary,
    strengths: e.strengths,
    areas_to_improve: e.areas_to_improve,
    evidence: e.evidence,
    na_justifications: e.na_justifications,
    // Legacy V1 mapeado (campos consumidos por componentes V1)
    empathy: flat(s.escucha_activa),
    active_listening: flat(s.escucha_activa),
    open_questions: flat(s.motivo_consulta),
    reformulation: flat(s.datos_contextuales),
    confrontation: flat(s.actitud_no_valorativa),
    silence_management: flat(s.presencia),
    rapport: flat(s.contencion_afectos),
  };
}

// Re-exporta para acceso unificado desde los route handlers
export { COMPETENCY_RUBRIC };
