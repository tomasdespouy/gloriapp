// Single source of truth for survey schemas.
//
// The admin dashboard and the CSV/XLSX exports are schema-driven: they
// read from the structures below to know which groups/items/questions
// to render and how to aggregate them. When a new form version is
// introduced, add a new SURVEY_SCHEMA_* constant and wire it in
// `getSurveySchema()` — no changes should be needed in the endpoint
// (`/api/admin/pilots/[id]/survey-responses`), in the dashboard
// components (`QuantitativeSummary`, `OpenAnswersSection`), or in the
// spreadsheet exporter.
//
// The SurveyModal (student-facing) has its own rendering logic because
// the questions are branded and interactive. The structures here are
// for READING responses only (admin dashboard + exports).
//
// IMPORTANT: the `key` values in LikertItem and the `answersKey`
// values in LikertGroup / OpenQuestion are the JSON keys used when the
// survey_responses row was created. Never rename them — past responses
// already use those keys and renaming would silently break every
// historical dashboard and export.

export type LikertItem = {
  /** Sub-key inside answers[group.answersKey] (e.g. "navegacion" for
      answers.q5_usabilidad.navegacion). */
  key: string;
  /** Human-readable label rendered in the dashboard detail row. */
  label: string;
};

export type LikertGroup = {
  /** Top-level key in the answers JSON (e.g. "q5_usabilidad"). */
  answersKey: string;
  /** Section title rendered in the dashboard ("Usabilidad y navegación"). */
  title: string;
  /** User-facing number in the dashboard ("1.", "2."…). */
  number: number;
  items: LikertItem[];
};

export type OpenQuestion = {
  /** Top-level key in the answers JSON (e.g. "q7_mas_gusto"). */
  answersKey: string;
  /** Label rendered as the section heading. */
  label: string;
  /** User-facing number in the dashboard. */
  number: number;
  /** Short id used as column header in CSV/XLSX exports (no accents,
      no spaces) — also reused as the fallback key if needed. */
  exportColumn: string;
};

export type SurveySchema = {
  /** Matches the `form_version` column in the `surveys` table. */
  formVersion: string;
  /** Short label used in dashboard headers ("v2_pilot", "v1"). */
  shortLabel: string;
  /** How to render Likert grids in the quantitative summary. */
  likertGroups: LikertGroup[];
  /** How to render the open-text answers section. */
  openQuestions: OpenQuestion[];
};

// ────────────────────────────────────────────────────────────────────
// v1 — legacy form (pre 2026-04)
// ────────────────────────────────────────────────────────────────────
//
// Still alive because some closed pilots have survey_responses rows
// with no form_version (null → interpreted as v1). Keeping this
// schema around lets the admin dashboard and exports continue working
// for those historical pilots without any special-casing.

export const SURVEY_SCHEMA_V1: SurveySchema = {
  formVersion: "v1",
  shortLabel: "v1",
  likertGroups: [
    {
      answersKey: "q5_usabilidad",
      title: "Usabilidad",
      number: 1,
      items: [
        { key: "navegacion", label: "Navegar por la plataforma me resultó intuitivo y cómodo." },
        { key: "performance", label: "El tiempo de carga y funcionamiento general fue adecuado." },
        { key: "claridad", label: "La plataforma explica claramente su propósito." },
        { key: "feedback", label: "La retroalimentación del sistema fue comprensible y útil." },
      ],
    },
    {
      answersKey: "q6_formacion",
      title: "Formación",
      number: 2,
      items: [
        { key: "aplicacion", label: "Me permitió aplicar conocimientos propios de mi formación." },
        { key: "habilidades", label: "Podría contribuir al desarrollo de habilidades profesionales." },
        { key: "incorporacion", label: "Debería incorporarse regularmente en los cursos." },
        { key: "verosimilitud", label: "El escenario simulado fue verosímil y coherente." },
        { key: "atencion", label: "Logró mantener mi atención durante toda la actividad." },
      ],
    },
  ],
  openQuestions: [
    { answersKey: "q7_mas_gusto", label: "¿Qué fue lo que más te gustó?", number: 3, exportColumn: "q7_mas_gusto" },
    { answersKey: "q8_mejoras", label: "¿Qué mejorarías?", number: 4, exportColumn: "q8_mejoras" },
    { answersKey: "q9_integracion", label: "¿Cómo integrarla mejor?", number: 5, exportColumn: "q9_integracion" },
    { answersKey: "q10_comentarios", label: "Comentarios adicionales", number: 6, exportColumn: "q10_comentarios" },
  ],
};

// ────────────────────────────────────────────────────────────────────
// v2_pilot — current form (2026-04 onwards)
// ────────────────────────────────────────────────────────────────────

export const SURVEY_SCHEMA_V2_PILOT: SurveySchema = {
  formVersion: "v2_pilot",
  shortLabel: "v2",
  likertGroups: [
    {
      answersKey: "q7_usabilidad",
      title: "Usabilidad y navegación",
      number: 1,
      items: [
        { key: "registro", label: "El proceso de registro e inicio de sesión fue sencillo." },
        { key: "navegacion", label: "La plataforma es fácil de navegar." },
        { key: "inicio_sesion", label: "Iniciar una sesión de chat fue intuitivo." },
        { key: "dialogo", label: "Mantener la conversación con el paciente simulado fue simple." },
        { key: "general", label: "En general, Glor-IA es fácil de usar." },
      ],
    },
    {
      answersKey: "q8_realismo",
      title: "Realismo clínico",
      number: 2,
      items: [
        { key: "respuestas", label: "Las respuestas del paciente simulado se sintieron realistas." },
        { key: "personalidad", label: "La personalidad y motivo de consulta fueron creíbles." },
        { key: "comprension", label: "El paciente virtual entendió y respondió adecuadamente." },
        { key: "sesion_real", label: "Me generó una sensación similar a una sesión clínica real." },
        { key: "emocional", label: "Las reacciones emocionales fueron consistentes con su historia." },
      ],
    },
    {
      answersKey: "q9_pertinencia",
      title: "Pertinencia cultural y contextual",
      number: 3,
      items: [
        { key: "lenguaje", label: "El lenguaje es pertinente a mi contexto cultural." },
        { key: "experiencias", label: "Las experiencias son coherentes con mi realidad local." },
        { key: "tematica", label: "La temática es pertinente a las problemáticas de salud mental locales." },
        { key: "estereotipos", label: "La interacción evita estereotipos ofensivos." },
        { key: "sensibilidad", label: "Glor-IA es sensible a las particularidades del contexto." },
      ],
    },
    {
      answersKey: "q10_diseno",
      title: "Diseño, interfaz y funcionamiento técnico",
      number: 4,
      items: [
        { key: "visual", label: "El diseño visual es agradable y coherente." },
        { key: "informacion", label: "La información en pantalla está bien organizada." },
        { key: "fluidez", label: "La plataforma funcionó de manera fluida (sin caídas)." },
        { key: "interactivos", label: "Los elementos interactivos son claros y fáciles de identificar." },
        { key: "adaptacion", label: "La plataforma se adaptó correctamente al dispositivo." },
      ],
    },
    {
      answersKey: "q11_satisfaccion",
      title: "Satisfacción global e intención de uso futuro",
      number: 5,
      items: [
        { key: "satisfaccion", label: "Estoy satisfecho/a con mi experiencia general." },
        { key: "volver_usar", label: "Me gustaría volver a usar Glor-IA." },
        { key: "recomendar", label: "Recomendaría Glor-IA a otros estudiantes." },
        { key: "incorporacion", label: "Sería valioso incorporarlo formalmente en la formación clínica." },
        { key: "tiempo_valio", label: "El tiempo dedicado valió la pena para mi aprendizaje." },
      ],
    },
  ],
  openQuestions: [
    { answersKey: "q12_mas_gusto", label: "¿Qué fue lo que más te gustó?", number: 6, exportColumn: "q12_mas_gusto" },
    { answersKey: "q13_menos_gusto", label: "¿Qué fue lo que menos te gustó?", number: 7, exportColumn: "q13_menos_gusto" },
    { answersKey: "q14_cambio", label: "¿Qué cambiarías?", number: 8, exportColumn: "q14_cambio" },
    { answersKey: "q15_incomodidad", label: "¿Hubo algo que te generó incomodidad?", number: 9, exportColumn: "q15_incomodidad" },
    { answersKey: "q16_comentarios", label: "Comentarios adicionales", number: 10, exportColumn: "q16_comentarios" },
  ],
};

// ────────────────────────────────────────────────────────────────────
// Registry + lookup
// ────────────────────────────────────────────────────────────────────

const SCHEMAS_BY_VERSION: Record<string, SurveySchema> = {
  v1: SURVEY_SCHEMA_V1,
  v2_pilot: SURVEY_SCHEMA_V2_PILOT,
};

/**
 * Look up the schema for a given form_version. Falls back to v1 for
 * null / unknown values, which matches how the legacy surveys were
 * seeded (form_version column didn't exist before 2026-04-16).
 *
 * When a new form version ships, just add it to SCHEMAS_BY_VERSION
 * above — endpoint and UI pick it up automatically.
 */
export function getSurveySchema(formVersion: string | null | undefined): SurveySchema {
  if (!formVersion) return SURVEY_SCHEMA_V1;
  return SCHEMAS_BY_VERSION[formVersion] || SURVEY_SCHEMA_V1;
}

// ────────────────────────────────────────────────────────────────────
// Aggregation helpers (used by the endpoint to precompute stats)
// ────────────────────────────────────────────────────────────────────

export type LikertItemStats = {
  /** How many non-null scores were provided for this item. */
  n: number;
  /** Arithmetic mean of the scores, rounded to 2 decimals (null if n=0). */
  mean: number | null;
  /** Count of each score, 1..5. */
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
};

export type LikertGroupStats = {
  answersKey: string;
  title: string;
  number: number;
  /** Mean of the items' means (items without responses are ignored). */
  groupMean: number | null;
  items: Array<LikertItemStats & { key: string; label: string }>;
};

export type SurveyStats = {
  formVersion: string;
  totalResponses: number;
  groups: LikertGroupStats[];
};

/**
 * Compute aggregated stats for all Likert groups declared in the
 * schema, based on an array of `answers` JSONs from survey_responses.
 */
export function computeLikertStats(
  schema: SurveySchema,
  answersList: Array<Record<string, unknown>>,
): SurveyStats {
  const groups: LikertGroupStats[] = schema.likertGroups.map((group) => {
    const items = group.items.map((item) => {
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let sum = 0;
      let count = 0;

      for (const answers of answersList) {
        const groupAnswers = answers[group.answersKey];
        if (!groupAnswers || typeof groupAnswers !== "object") continue;
        const score = (groupAnswers as Record<string, unknown>)[item.key];
        const n = typeof score === "number" ? score : Number(score);
        if (!Number.isFinite(n) || n < 1 || n > 5) continue;
        const rounded = Math.round(n) as 1 | 2 | 3 | 4 | 5;
        distribution[rounded]++;
        sum += rounded;
        count++;
      }

      return {
        key: item.key,
        label: item.label,
        n: count,
        mean: count > 0 ? Number((sum / count).toFixed(2)) : null,
        distribution,
      };
    });

    const itemMeans = items.map((i) => i.mean).filter((m): m is number => m !== null);
    const groupMean =
      itemMeans.length > 0
        ? Number((itemMeans.reduce((a, b) => a + b, 0) / itemMeans.length).toFixed(2))
        : null;

    return {
      answersKey: group.answersKey,
      title: group.title,
      number: group.number,
      groupMean,
      items,
    };
  });

  return {
    formVersion: schema.formVersion,
    totalResponses: answersList.length,
    groups,
  };
}
