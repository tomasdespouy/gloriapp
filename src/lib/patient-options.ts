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
  context: string;
  motivo: string;
  archetype: string;
  personalityTraits: string[];
  defenseMechanisms: string[];
  openness: string;
  sensitiveTopics: string[];
  variability: string;
  difficulty: string;
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

// --- 15-step creation workflow types ---

export const NARRATIVE_SECTIONS = [
  "datos_basicos",
  "motivo_consulta",
  "contexto_familiar",
  "personalidad",
  "dinamica_relacional",
] as const;

export const EXTENDED_NARRATIVE_SECTIONS = [
  "historia_personal",
  "historia_familiar",
  "vinculos_apego",
  "historia_profesional",
  "eventos_traumaticos",
  "mecanismos_defensa",
  "contexto_cultural",
  "estado_actual",
] as const;

export const EXTENDED_NARRATIVE_LABELS: Record<string, string> = {
  historia_personal: "Historia personal (infancia, adolescencia, adultez)",
  historia_familiar: "Historia familiar (familia de origen, dinamicas, eventos)",
  vinculos_apego: "Vinculos de apego y estilo relacional",
  historia_profesional: "Historia profesional / academica",
  eventos_traumaticos: "Eventos traumaticos o significativos",
  mecanismos_defensa: "Mecanismos de defensa y patrones repetitivos",
  contexto_cultural: "Contexto cultural y socioeconomico",
  estado_actual: "Estado actual y motivo de consulta",
};

export const NARRATIVE_LABELS: Record<string, string> = {
  datos_basicos: "Datos basicos",
  motivo_consulta: "Motivo de consulta",
  contexto_familiar: "Contexto familiar",
  personalidad: "Personalidad y rasgos",
  dinamica_relacional: "Dinamica relacional",
};

export interface ShortNarrative {
  datos_basicos: string;
  motivo_consulta: string;
  contexto_familiar: string;
  personalidad: string;
  dinamica_relacional: string;
}

export interface ExtendedNarrative {
  historia_personal: string;
  historia_familiar: string;
  vinculos_apego: string;
  historia_profesional: string;
  eventos_traumaticos: string;
  mecanismos_defensa: string;
  contexto_cultural: string;
  estado_actual: string;
}

export interface CoherenceItem {
  section: string;
  severity: "critica" | "sugerencia" | "ok";
  type: "interna" | "clinica";
  message: string;
}

export interface CoherenceReview {
  items: CoherenceItem[];
  summary: string;
}

export interface SessionProjection {
  session_number: number;
  summary: string;
  alliance: number;
  symptoms: number;
  resistance: number;
  key_moment: string;
}

export interface LevelProjection {
  level: "principiante" | "intermedio" | "experto";
  sessions: SessionProjection[];
  overall_assessment: string;
  coherence_score: number;
  evolution_score: number;
}

export interface Projections {
  principiante: LevelProjection;
  intermedio: LevelProjection;
  experto: LevelProjection;
}

export interface GeneratedSystemPrompt {
  system_prompt: string;
  quote: string;
  presenting_problem: string;
  backstory: string;
  personality_traits: {
    openness: number;
    neuroticism: number;
    resistance: string;
    communication_style: string;
  };
  tags: string[];
  skills_practiced: string[];
  total_sessions: number;
  birthday?: string;
  neighborhood?: string;
  family_members?: { name: string; age: number; relationship: string; notes: string }[];
}
