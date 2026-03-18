export const GENDER_OPTIONS = ["Masculino", "Femeniño", "No binario"];

export const CONTEXT_OPTIONS = [
  "Urbano - clase media",
  "Urbano - clase alta",
  "Urbano - clase baja",
  "Rural",
  "Migrante",
];

export const MOTIVO_OPTIONS = [
  "Ansiedad generalizada",
  "Duelo",
  "Problemas de pareja",
  "Conflicto familiar",
  "Estres laboral / burnout",
  "Autoestima baja",
  "Aislamiento social",
  "Problemas de adaptación",
  "Manejo de ira",
  "Dependencia emocional",
  "Crisis vital / transición",
];

export const ARCHETYPE_OPTIONS = [
  { value: "resistente", label: "El resistente", description: "Se opone activamente a la terapia" },
  { value: "complaciente", label: "El complaciente", description: "Dice que si a todo pero no cambia" },
  { value: "intelectualizador", label: "El intelectualizador", description: "Analiza en vez de sentír" },
  { value: "evitativo", label: "El evitativo", description: "Evade temas profundos" },
  { value: "demandante", label: "El demandante", description: "Exige respuestas y soluciónes" },
  { value: "silencioso", label: "El silencioso", description: "Apenas habla, respuestas mínimas" },
  { value: "verborreico", label: "El verborreico", description: "Habla mucho para no profundizar" },
  { value: "desconfiado", label: "El desconfiado", description: "Desconfia del terapeuta y del proceso" },
];

export const PERSONALITY_OPTIONS = [
  "Introvertido",
  "Extrovertido",
  "Ansioso",
  "Perfeccionista",
  "Dependiente",
  "Impulsivo",
  "Controlador",
  "Sensible",
  "Desconfiado",
  "Rigido",
];

export const DEFENSE_OPTIONS = [
  "Negacion",
  "Racionalizacion",
  "Proyeccion",
  "Humor como defensa",
  "Intelectualizacion",
  "Somatizacion",
  "Evitacion",
  "Minimizacion",
  "Desplazamiento",
];

export const OPENNESS_OPTIONS = ["Bajo", "Medio", "Alto"];

export const SENSITIVE_TOPICS = [
  "Infancia",
  "Relacion con padres",
  "Sexualidad",
  "Muerte / pérdida",
  "Dinero",
  "Fracaso",
  "Soledad",
  "Abandono",
  "Imagen corporal",
  "Adicciones",
];

export const VARIABILITY_OPTIONS = ["Baja", "Media", "Alta"];

export const DIFFICULTY_OPTIONS = [
  { value: "beginner", label: "Principiante" },
  { value: "intermediate", label: "Intermedio" },
  { value: "advanced", label: "Avanzado" },
];

export const COUNTRY_OPTIONS = [
  "Chile", "Argentina", "Colombia", "México", "Perú",
  "España", "Ecuador", "Bolivia", "Uruguay", "Paraguay", "Venezuela",
  "República Dominicana",
];

export interface PatientFormData {
  name: string;
  age: number;
  gender: string;
  occupation: string;
  countries: string[];
  countryOrigin: string;
  countryResidence: string;
  enabledCountries: string[];
  context: string;
  motivo: string;
  archetype: string;
  personalityTraits: string[];
  defenseMechanisms: string[];
  openness: string;
  sensitiveTopics: string[];
  variability: string;
  difficulty: string;
  distinctiveFactor: string;
}

export interface GeneratedProfile {
  system_prompt: string;
  quote: string;
  presenting_problem: string;
  backstory: string;
  personality_traits: {
    openness: number;
    neuroticism: number;
    resistance: string;
    commúnication_style: string;
  };
  tags: string[];
  skills_practiced: string[];
  total_sessions: number;
  birthday?: string;
  neighborhood?: string;
  family_members?: { name: string; age: number; relationship: string; notes: string }[];
}

export interface TestResult {
  conversation: Array<{
    role: "estudiante" | "paciente";
    content: string;
  }>;
  analysis: {
    consistency: number;
    realism: number;
    matrix_compliance: number;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  };
}

// ══════════════════════════════════════════
// 15-STEP WORKFLOW TYPES
// ══════════════════════════════════════════

export interface ShortNarrative {
  historia_personal: string;
  dinamica_familiar: string;
  motivo_consulta: string;
  patron_relacional: string;
  momento_vital: string;
}

export interface ExtendedNarrative {
  infancia_y_apego: string;
  familia_de_origen: string;
  desarrollo_adolescente: string;
  relaciones_significativas: string;
  historia_laboral_academica: string;
  evento_precipitante: string;
  estado_actual: string;
  recursos_y_fortalezas: string;
}

export interface CoherenceReview {
  score: number;
  clinical_consistency: string[];
  narrative_gaps: string[];
  dsm5_alignment: string;
  pdm2_alignment: string;
  suggestions: string[];
  approved: boolean;
}

export interface SessionProjection {
  session_number: number;
  focus: string;
  patient_state: string;
  expected_intervention: string;
  key_moment: string;
}

export interface LevelProjection {
  level: "principiante" | "intermedio" | "experto";
  description: string;
  sessions: SessionProjection[];
}

export interface Projections {
  levels: LevelProjection[];
}

export interface GeneratedSystemPrompt {
  system_prompt: string;
  design_notes: string[];
}

export const NARRATIVE_SECTIONS: Record<keyof ShortNarrative, string> = {
  historia_personal: "Historia personal",
  dinamica_familiar: "Dinámica familiar",
  motivo_consulta: "Motivo de consulta",
  patron_relacional: "Patrón relacional",
  momento_vital: "Momento vital",
};

export const EXTENDED_SECTIONS: Record<keyof ExtendedNarrative, string> = {
  infancia_y_apego: "Infancia y apego",
  familia_de_origen: "Familia de origen",
  desarrollo_adolescente: "Desarrollo adolescente",
  relaciones_significativas: "Relaciones significativas",
  historia_laboral_academica: "Historia laboral/académica",
  evento_precipitante: "Evento precipitante",
  estado_actual: "Estado actual",
  recursos_y_fortalezas: "Recursos y fortalezas",
};
