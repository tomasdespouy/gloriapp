export type LevelDef = { level: number; name: string; minXp: number };

export const LEVELS: LevelDef[] = [
  { level: 1, name: "Observador", minXp: 0 },
  { level: 2, name: "Practicante", minXp: 100 },
  { level: 3, name: "Terapeuta Jr.", minXp: 300 },
  { level: 4, name: "Terapeuta", minXp: 600 },
  { level: 5, name: "Terapeuta Senior", minXp: 1000 },
];

export function getLevelInfo(totalXp: number) {
  let current = LEVELS[0];
  let next: LevelDef | null = LEVELS[1];

  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVELS[i].minXp) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
      break;
    }
  }

  const xpInLevel = totalXp - current.minXp;
  const xpForNext = next ? next.minXp - current.minXp : 0;
  const progress = next ? xpInLevel / xpForNext : 1;

  return { current, next, xpInLevel, xpForNext, progress };
}

export function calculateSessionXp(overallScore: number): number {
  // V2 scale is 0-4, so multiply by 12.5 to get equivalent XP range
  return Math.round(20 + overallScore * 12.5); // 20–70 XP per session
}

// ══════════════════════════════════════════
// V2 COMPETENCIES (Valdés & Gómez, 2023 — Pauta para la Evaluación de
// Competencias Psicoterapéuticas para el trabajo con Adultos, scale 0-4)
// ══════════════════════════════════════════

export const COMPETENCY_DOMAINS = {
  structure: {
    label: "Estructura de la Sesión",
    keys: ["setting_terapeutico", "motivo_consulta", "datos_contextuales", "objetivos"],
  },
  attitudes: {
    label: "Actitudes Terapéuticas",
    keys: ["escucha_activa", "actitud_no_valorativa", "optimismo", "presencia", "conducta_no_verbal", "contencion_afectos"],
  },
};

export const COMPETENCY_LABELS_V2: Record<string, string> = {
  setting_terapeutico: "Setting terapéutico",
  motivo_consulta: "Motivo de consulta",
  datos_contextuales: "Datos contextuales",
  objetivos: "Objetivos",
  escucha_activa: "Escucha activa",
  actitud_no_valorativa: "Actitud no valorativa",
  optimismo: "Optimismo",
  presencia: "Presencia aquí y ahora",
  conducta_no_verbal: "Conducta no verbal",
  contencion_afectos: "Contención de afectos",
};

export const COMPETENCY_KEYS_V2 = Object.keys(COMPETENCY_LABELS_V2);

export type CompetencyScoresV2 = {
  setting_terapeutico: number;
  motivo_consulta: number;
  datos_contextuales: number;
  objetivos: number;
  escucha_activa: number;
  actitud_no_valorativa: number;
  optimismo: number;
  presencia: number;
  conducta_no_verbal: number;
  contencion_afectos: number;
};

export const EMPTY_SCORES_V2: CompetencyScoresV2 = {
  setting_terapeutico: 0,
  motivo_consulta: 0,
  datos_contextuales: 0,
  objetivos: 0,
  escucha_activa: 0,
  actitud_no_valorativa: 0,
  optimismo: 0,
  presencia: 0,
  conducta_no_verbal: 0,
  contencion_afectos: 0,
};

export const SCORE_LEVELS = [
  { value: 0, label: "No aplicaba", color: "#9ca3af" },
  { value: 1, label: "Deficiente", color: "#ef4444" },
  { value: 2, label: "Básico", color: "#f97316" },
  { value: 3, label: "Adecuado", color: "#eab308" },
  { value: 4, label: "Excelente", color: "#22c55e" },
];

// ══════════════════════════════════════════
// V1 COMPETENCIES (legacy, for old sessions)
// ══════════════════════════════════════════

export const COMPETENCY_LABELS: Record<string, string> = {
  empathy: "Empatía",
  active_listening: "Escucha activa",
  open_questions: "Preguntas abiertas",
  reformulation: "Reformulación",
  confrontation: "Confrontación",
  silence_management: "Silencios",
  rapport: "Rapport",
};

export const COMPETENCY_KEYS = Object.keys(COMPETENCY_LABELS);

export type CompetencyScores = {
  empathy: number;
  active_listening: number;
  open_questions: number;
  reformulation: number;
  confrontation: number;
  silence_management: number;
  rapport: number;
};

export const EMPTY_SCORES: CompetencyScores = {
  empathy: 0,
  active_listening: 0,
  open_questions: 0,
  reformulation: 0,
  confrontation: 0,
  silence_management: 0,
  rapport: 0,
};
