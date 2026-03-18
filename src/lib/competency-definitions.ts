/**
 * Competency definitions, descriptions, and learning links.
 * Used by (i) tooltips in student review, teacher review, and progress pages.
 */

export const COMPETENCY_INFO: Record<string, {
  name: string;
  domain: "estructura" | "actitudes";
  definition: string;
  learnLink: string;
}> = {
  setting_terapeutico: {
    name: "Setting terapéutico",
    domain: "estructura",
    definition: "Capacidad de explicitar el encuadre terapéutico (duración, confidencialidad, roles) y aclarar dudas del paciente al inicio y durante la sesión.",
    learnLink: "/aprendizaje/setting_terapeutico",
  },
  motivo_consulta: {
    name: "Motivo de consulta",
    domain: "estructura",
    definition: "Capacidad de indagar e integrar el motivo manifiesto y latente de consulta, explorando los recursos y la perspectiva del paciente.",
    learnLink: "/aprendizaje/motivo_consulta",
  },
  datos_contextuales: {
    name: "Datos contextuales",
    domain: "estructura",
    definition: "Capacidad de entrevistar e integrar información de contextos relevantes: familia, trabajo, salud, relaciones y entorno sociocultural.",
    learnLink: "/aprendizaje/datos_contextuales",
  },
  objetivos: {
    name: "Objetivos",
    domain: "estructura",
    definition: "Capacidad de construir objetivos terapéuticos de forma colaborativa con el paciente, alineados con el motivo de consulta.",
    learnLink: "/aprendizaje/objetivos",
  },
  escucha_activa: {
    name: "Escucha activa",
    domain: "actitudes",
    definition: "Atención coherente a la comunicación verbal y no verbal del paciente, respondiendo en congruencia con lo expresado.",
    learnLink: "/aprendizaje/escucha_activa",
  },
  actitud_no_valorativa: {
    name: "Actitud no valorativa",
    domain: "actitudes",
    definition: "Aceptación incondicional del paciente sin juicios explícitos ni implícitos, independiente de sus valores, creencias o conductas.",
    learnLink: "/aprendizaje/actitud_no_valorativa",
  },
  optimismo: {
    name: "Optimismo terapéutico",
    domain: "actitudes",
    definition: "Transmisión proactiva de esperanza y optimismo integrado con intervenciones técnicas, sin minimizar el sufrimiento del paciente.",
    learnLink: "/aprendizaje/optimismo",
  },
  presencia: {
    name: "Presencia",
    domain: "actitudes",
    definition: "Atención sostenida, flexibilidad y sintonía emocional con el paciente. Estar genuinamente presente en el aquí y ahora de la sesión.",
    learnLink: "/aprendizaje/presencia",
  },
  conducta_no_verbal: {
    name: "Conducta no verbal",
    domain: "actitudes",
    definition: "Atención a lo no verbal del paciente (gestos, postura, tono de voz, silencios) e integración de estas señales con el contenido verbal.",
    learnLink: "/aprendizaje/conducta_no_verbal",
  },
  contencion_afectos: {
    name: "Contención de afectos",
    domain: "actitudes",
    definition: "Contención emocional del paciente con presencia, calidez, empatía y validación. Capacidad de sostener momentos de alta intensidad emocional.",
    learnLink: "/aprendizaje/contencion_afectos",
  },
};
