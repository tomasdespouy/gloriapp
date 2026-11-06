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

// v3.1 (10-sep-2026): en conducta_no_verbal, el 0 y el 1 dejaron de describir
// la misma conducta. Las evaluaciones anteriores llevan "v3.0" en
// ai_original.rubric_version, así que un informe puede distinguirlas y no
// comparar puntajes de esa competencia a través del corte.
// v3.2 (26-oct-2026): calibración contra las supervisoras del CAP UGM — 3 y 4
// exigen patrón sostenido, lo no verbal deja de ser el área por defecto, y se
// suman los aspectos transversales (intervención prematura, riesgo, anamnesis,
// forma de escribir). Además se descartan las citas que no son del estudiante.
export const RUBRIC_VERSION = "v3.2";

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
  /** Citas descartadas por no estar en un turno del estudiante (ver dropNonStudentEvidence). */
  evidence_dropped?: number;
  /** Chequeo explícito de riesgo: el texto libre no bastaba para que lo señalara. */
  riesgo?: RiskCheck | null;
};

export type RiskCheck = {
  indicadores: string;
  explorado: "si" | "no" | "no_corresponde";
  pregunta_sin_indicadores: boolean;
};

function normalizeRisk(raw: unknown): RiskCheck | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const explorado = r.explorado === "si" || r.explorado === "no" ? r.explorado : "no_corresponde";
  return {
    indicadores: typeof r.indicadores === "string" ? r.indicadores : "ninguno",
    explorado,
    pregunta_sin_indicadores: r.pregunta_sin_indicadores === true,
  };
}

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
- "objetivos" y "setting_terapeutico" dependen de la ETAPA del proceso: sigue
  las reglas de "QUÉ SE ESPERA EN CADA ETAPA" más abajo.
- "optimismo": en una sesión que transcurre con normalidad NO es "NA". Transmitir
  que el cambio es posible casi siempre aplica; reserva "NA" solo para casos
  excepcionales y documentados en na_justifications.
- Las justificaciones de "NA" deben describir ESTA sesión, no frases genéricas.

═══════════════════════════════════════════════════
QUÉ SE ESPERA EN CADA ETAPA DEL PROCESO
═══════════════════════════════════════════════════

El proceso tiene sesiones de EVALUACIÓN (desde la primera hasta la
penúltima) y una sesión final de DEVOLUCIÓN (por lo general la cuarta). El
bloque "CONTEXTO DE LA SESIÓN" indica en qué etapa estás. En las sesiones
de evaluación el objetivo es explorar y comprender, NO intervenir.

Sesiones de evaluación:
- setting_terapeutico: en la primera sesión, encuadre completo (duración,
  confidencialidad y sus límites, rol de estudiante en práctica,
  institución). Desde la segunda, NO se espera repetir el encuadre: si no
  hubo quiebre que lo requiera, márcalo "NA" (nunca 0 por no repetirlo).
  Repetir el encuadre completo sin necesidad no es una fortaleza.
- motivo_consulta: en la primera sesión, indagar el motivo manifiesto y el
  de derivación. Desde la segunda puede marcarse "NA" si el motivo ya
  quedó claro y la sesión se dedicó a otros aspectos sin que emergieran
  motivos nuevos; la justificación debe decir qué se trabajó en su lugar.
  Si el estudiante sí lo retomó o profundizó, puntúalo.
- datos_contextuales: central en todas las sesiones de evaluación
  (anamnesis, historia, vínculos, síntomas).
- objetivos: NO corresponde plantearlos todavía. Si el estudiante no los
  planteó, márcalo "NA" ("sesión de evaluación: aún no corresponde
  plantear objetivos"). Si los propuso, es intervención prematura:
  puntaje máximo 1 y señálalo en areas_to_improve.
- optimismo: sin promesas ni certezas sobre el resultado.

Sesión de devolución:
- setting_terapeutico: se espera que explique qué es una devolución y el
  objetivo de la sesión, y que acuerde día y hora de la siguiente.
- motivo_consulta: se espera que integre lo manifiesto y lo latente en una
  hipótesis comprensiva que devuelve al paciente, en lenguaje accesible.
  Un resumen descriptivo de lo conversado no supera el nivel 2.
- objetivos: central. Se espera que proponga 1 o 2 objetivos y los acuerde
  con el paciente; no se marca "NA".
- optimismo: esperanza anclada en recursos concretos del paciente.

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
CALIBRACIÓN DE PUNTAJES ALTOS (obligatorio)
═══════════════════════════════════════════════════

Estas reglas afinan criterios PUNTUALES; no son una instrucción de bajar
todos los puntajes. Una sesión buena debe seguir recibiendo 3 en la mayoría
de las competencias, y una sesión excelente, 4. Cada competencia se
puntúa por lo que se observó en ella, no por los problemas de otra.

- escucha_activa: identifica los momentos clave de la sesión (cuando el
  paciente trae contenido emocional o información nueva relevante) y
  revisa qué hizo el estudiante en cada uno:
    · sigue el relato: pregunta a partir de las palabras del paciente;
    · refleja o valida lo que el paciente expresó;
    · NO cambia de tema ni pasa a la siguiente pregunta de su lista sin
      recoger lo dicho.
  4 = lo hace en prácticamente todos los momentos clave y además sintetiza
  o chequea comprensión. 3 = lo hace en la mayoría. 2 = en algunos, pero
  en otros momentos clave pasó por alto lo dicho. 1 = casi nunca. Un solo
  buen reflejo no alcanza para 3.
- contencion_afectos: puntúa cómo respondió a los momentos de intensidad
  emocional que aparecieron, con su rúbrica. Tranquilizar, aconsejar o
  cambiar de tema en uno de esos momentos baja UN nivel respecto de lo que
  habría correspondido; no es un tope fijo.
- Tranquilizar o dar certezas sin antecedentes ("estoy segura de que...",
  "vas a lograrlo", "no te preocupes") no cuenta como optimismo
  terapéutico.
- conducta_no_verbal: evalúala con su rúbrica, pero NO la conviertas en el
  área de mejora por defecto. Inclúyela en areas_to_improve solo si el
  paciente describió señales relevantes y omitirlas fue clínicamente
  importante en ESTA sesión. Si alguno de los aspectos transversales de
  abajo ocurrió, priorízalo por sobre lo no verbal.

═══════════════════════════════════════════════════
ASPECTOS TRANSVERSALES QUE LAS SUPERVISORAS PRIORIZAN
═══════════════════════════════════════════════════

No son competencias con puntaje propio, pero cuando ocurren DEBEN aparecer
en commentary o areas_to_improve, con cita textual, y afectan los puntajes
indicados:

1. Intervención prematura: interpretar o explicar el funcionamiento del
   paciente, aconsejar, asignar tareas, proponer objetivos, hacer role play
   o prometer resultados antes de haber explorado lo suficiente. También
   instalar conceptos o etiquetas que el paciente no dijo ("trauma",
   "codependencia", "autoboicot"). Si ocurre de forma reiterada, baja UN
   nivel en motivo_consulta; nunca sube objetivos ni optimismo.
2. Riesgo: completa SIEMPRE el campo "riesgo" del JSON (ver formato).
   Indicadores: desesperanza, ideas de muerte, autolesión, violencia,
   consumo grave, aislamiento marcado con deterioro. Si hubo indicadores y
   el estudiante no exploró el riesgo, la PRIMERA área de mejora debe
   decirlo, citando el indicador. Si preguntó por riesgo sin ningún
   indicador en el relato, o insistió después de una respuesta clara,
   también va en areas_to_improve (pregunta descontextualizada).
3. Anamnesis e hipótesis: en primera sesión se esperan datos básicos (edad,
   con quién vive, familia, inicio y curso de los síntomas). Recolectar
   datos como lista de chequeo, sin profundizar en lo que el paciente
   trae, no supera el nivel 2 en datos_contextuales.
4. Forma de escribir: una pregunta por turno, mensajes claros y breves, sin
   frases truncas; preferir preguntas abiertas a afirmaciones cerradas.

═══════════════════════════════════════════════════
ESTILO DE LAS ÁREAS DE MEJORA (obligatorio)
═══════════════════════════════════════════════════

Escribe como las supervisoras: cada área de mejora cita lo que el
estudiante dijo, explica en una frase el efecto clínico y propone una
alternativa concreta. Ejemplos ilustrativos (casos ficticios):

  "La rabia quedó sin explorar: cuando dijo 'a veces me dan ganas de
   mandar todo a la cresta', pasaste a preguntar por su horario de
   trabajo. '¿Qué es lo que te dan ganas de mandar lejos?' habría abierto
   lo que está debajo de esa rabia."

  "Respondiste 'tranquila, vas a ver que todo se va a solucionar' cuando
   contó que llora todas las noches. Eso minimiza lo que siente y cierra
   la conversación. Alternativa: 'Cuéntame cómo son esas noches'."

  "Riesgo, prioritario: 'ya no le veo sentido a levantarme', sumado a que
   dejó de ver a sus amigos → había indicadores para preguntar por
   desesperanza e ideas de muerte, y no se exploraron."

  "En la segunda sesión le dijiste 'lo que te pasa es que repites el
   patrón de tu papá'. Todavía no hay antecedentes para sostener esa
   interpretación; en esta etapa conviene preguntar '¿cómo entiendes tú lo
   que te pasa?'."

  "Varios turnos traen tres preguntas juntas ('¿cómo duermes?, ¿comes
   bien?, ¿con quién vives?') → una pregunta por turno permite que el
   paciente desarrolle cada respuesta."

═══════════════════════════════════════════════════
CALIBRACIÓN DEL LENGUAJE (obligatorio)
═══════════════════════════════════════════════════

El lenguaje de commentary, strengths y areas_to_improve debe ser proporcional
a CUÁNTA evidencia hay en la sesión, no solo a la nota. Con estudiantes
novatos o con pocos momentos que ilustren el patrón, evita el categórico
absoluto:

  EVITA (sobre-afirma con poca evidencia):
    "se observa una sólida competencia en..."
    "domina la técnica de..."
    "siempre/nunca hace..."

  PREFIERE (ajustado a la evidencia disponible):
    - Con 1-2 momentos puntuales: "se observan señales de...",
      "de manera incipiente...", "en el momento en que... mostró...".
    - Solo si el patrón se repite de forma consistente en varios turnos,
      es correcto decir "muestra una competencia..." o "de manera sostenida...".
    - Para áreas de mejora, evita "no sabe" o "no puede"; usa
      "no se observó en esta sesión" o "sería necesario ver más sesiones para...".

Una nota baja (0-2) NO habilita lenguaje categórico negativo ("carece
totalmente de", "es incapaz de"): describe lo observado en ESTA sesión,
no un rasgo permanente del estudiante. El objetivo es que el lenguaje
sea defendible frente a la evidencia citada, no una sentencia.

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
    "setting_terapeutico": "NA",
    "motivo_consulta": 2,
    "datos_contextuales": 2,
    "objetivos": "NA",
    "escucha_activa": 3,
    "actitud_no_valorativa": 3,
    "optimismo": 2,
    "presencia": 2,
    "conducta_no_verbal": 1,
    "contencion_afectos": 2
  },
  "overall_score_v2": 2.1,
  "na_justifications": {
    "setting_terapeutico": "Sesión 2 de evaluación sin quiebres del encuadre acordado en la primera",
    "objetivos": "Sesión de evaluación: el estudiante no planteó objetivos, lo que corresponde a esta etapa"
  },
  "commentary": "Retroalimentación constructiva, 3-5 oraciones que identifiquen el patrón general (no eventos sueltos). Para cada área de mejora, incluir un contrafactual: qué pudo decir/hacer en su lugar y por qué.",
  "strengths": ["fortaleza específica con anclaje en la conversación", "otra fortaleza"],
  "areas_to_improve": ["área concreta y accionable", "otra área"],
  "riesgo": {
    "indicadores": "cita literal del paciente que muestra el indicador, o \\"ninguno\\"",
    "explorado": "si | no | no_corresponde",
    "pregunta_sin_indicadores": false
  },
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
    riesgo: normalizeRisk(r.riesgo),
  };
}

// Normaliza para comparar citas con la transcripción: sin tildes, mayúsculas,
// acotaciones entre corchetes ni puntuación.
function foldForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/\p{M}/gu, "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Descarta las citas de evidencia que no están en un turno del TERAPEUTA.
 *
 * En el CAP UGM (oct-2026) el 6,4 % de las citas eran frases del PACIENTE
 * atribuidas al estudiante — 26 de ellas como "fortaleza", en 18 de 64
 * sesiones — y otro 6,5 % no aparecía en la transcripción.
 *
 * No se exige coincidencia literal: al citar, el evaluador corrige las faltas
 * de tipeo del estudiante ("acreques" → "acerques"), y una regla literal
 * descartaba esas citas legítimas. Se compara por palabras: la cita se conserva
 * si al menos el 70 % de sus palabras está en un mismo turno del estudiante y
 * ese turno la explica mejor que cualquier turno del paciente.
 * `transcript` es el formato "TERAPEUTA: / PACIENTE:" de session-evaluation.ts.
 */
export function dropNonStudentEvidence(
  evaluation: NormalizedEvaluation,
  transcript: string,
): NormalizedEvaluation {
  const turns = transcript.split(/\n(?=(?:TERAPEUTA|PACIENTE): )/);
  const wordsOf = (s: string) => new Set(foldForMatch(s).split(" ").filter((w) => w.length > 0));
  const studentTurns = turns.filter((t) => t.startsWith("TERAPEUTA: ")).map((t) => wordsOf(t.slice("TERAPEUTA: ".length)));
  const patientTurns = turns.filter((t) => t.startsWith("PACIENTE: ")).map((t) => wordsOf(t.slice("PACIENTE: ".length)));

  const bestCoverage = (quoteWords: string[], pool: Set<string>[]) =>
    pool.reduce((best, turn) => Math.max(best, quoteWords.filter((w) => turn.has(w)).length / quoteWords.length), 0);

  const isStudentQuote = (quote: string) => {
    const quoteWords = [...wordsOf(quote.replace(/^\s*(?:terapeuta|estudiante)\s*:\s*/i, ""))];
    if (quoteWords.length === 0) return false;
    const student = bestCoverage(quoteWords, studentTurns);
    return student >= 0.7 && student >= bestCoverage(quoteWords, patientTurns);
  };

  let dropped = 0;
  const evidence: Partial<Record<CompetencyKey, EvaluationEvidence[]>> = {};
  for (const [key, list] of Object.entries(evaluation.evidence) as [CompetencyKey, EvaluationEvidence[]][]) {
    const kept = list.filter((e) => isStudentQuote(e.quote));
    dropped += list.length - kept.length;
    evidence[key] = kept;
  }
  return { ...evaluation, evidence, evidence_dropped: dropped };
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
    evidence_dropped: evaluation.evidence_dropped ?? 0,
    riesgo: evaluation.riesgo ?? null,
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
    /**
     * 'pending' (default): pasa por revisión docente, como hoy. 'approved':
     * se libera directo al alumno sin pasar por el docente — usado por
     * certification_feedback_mode = 'auto' en programas de certificación.
     */
    feedbackStatus?: "pending" | "approved";
  },
) {
  const s = evaluation.scores;

  // Para columnas legacy V1: usamos 0 cuando el equivalente V2 es null,
  // ya que las V1 son NOT NULL DEFAULT 0. Esto solo afecta reportes legacy.
  const v1Fallback = (v: number | null) => v ?? 0;

  return {
    conversation_id: ctx.conversationId,
    student_id: ctx.studentId,
    feedback_status: ctx.feedbackStatus ?? "pending",
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
        "CONTEXTO DE LA SESIÓN: esta es la PRIMERA sesión entre el estudiante y el paciente (etapa de EVALUACIÓN). No existen sesiones previas. " +
        "Por lo tanto, setting_terapeutico, motivo_consulta y datos_contextuales NO PUEDEN marcarse como 'NA' y deben recibir un score 0-4.\n\n";
    } else {
      // La devolución va en la última sesión del proceso, por lo general la
      // cuarta (CAP UGM). El evaluador no sabe si es la última, así que desde
      // la cuarta se le pide reconocerla por el contenido.
      const etapa = n >= 4
        ? "Desde la cuarta sesión puede ser la sesión de DEVOLUCIÓN: trátala como tal si el estudiante la presenta como devolución o entrega al paciente una comprensión de lo evaluado; si no, sigue siendo de EVALUACIÓN."
        : "Etapa de EVALUACIÓN.";
      header =
        `CONTEXTO DE LA SESIÓN: esta es la sesión número ${n} entre el estudiante y el paciente. ` +
        `Hay ${n - 1} sesion${n - 1 === 1 ? "" : "es"} previa${n - 1 === 1 ? "" : "s"}. ${etapa}\n\n`;
    }
  }
  return `${header}Conversación a evaluar:\n\n${transcript}`;
}

/**
 * Determina el identificador del modelo LLM activo a partir de env vars.
 */
export function activeModelLabel(): string {
  // Misma comparación EXACTA que el ruteo de src/lib/ai.ts: cualquier valor que
  // no sea literalmente "openai" (p. ej. "openai\n", como está en PROD) deja a
  // Gemini como principal. Antes esto devolvía "gpt-4o" en ese caso y las
  // evaluaciones quedaban rotuladas con un modelo que no las había hecho.
  // Preferir el modelo real que devuelve runEvaluator() (session-evaluation.ts).
  const provider = process.env.LLM_PROVIDER || "openai";
  if (provider !== "openai") return process.env.GEMINI_MODEL || "gemini-2.5-flash";
  return process.env.OPENAI_EVAL_MODEL || process.env.OPENAI_MODEL || "gpt-4o";
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
