/**
 * CLINICAL KNOWLEDGE BASE
 *
 * Base de conocimiento clínico para RAG.
 * Cada entrada tiene un tema, contexto clínico, y síntomas/comportamientos
 * que el paciente virtual puede exhibir de forma clínicamente coherente.
 *
 * El sistema RAG busca las entradas más relevantes según el contexto
 * de la conversación y las inyecta en el prompt del paciente.
 */

export type ClinicalEntry = {
  id: string;
  topic: string;
  keywords: string[];
  content: string;
};

export const CLINICAL_KNOWLEDGE: ClinicalEntry[] = [
  // ═══ DUELO ═══
  {
    id: "duelo-normal",
    topic: "Duelo normal",
    keywords: ["duelo", "muerte", "fallecimiento", "pérdida", "luto"],
    content: `El duelo normal incluye: oleadas de dolor intenso, anhelo por la persona fallecida, recuerdos intrusivos, dificultad para aceptar la pérdida, sensación de vacío, irritabilidad, retraimiento social, alteraciones del sueño y apetito. Estas reacciones son esperables y no patológicas. El proceso no es lineal — hay días mejores y peores. La persona puede sentir culpa por momentos de alegría ("culpa del sobreviviente").`,
  },
  {
    id: "duelo-complicado",
    topic: "Duelo complicado / prolongado",
    keywords: ["duelo", "prolongado", "complicado", "no supera", "meses", "años"],
    content: `El duelo prolongado (DSM-5-TR) se diagnostica cuando los síntomas persisten más de 12 meses con intensidad incapacitante: anhelo persistente, preocupación por la persona o circunstancias de la muerte, incredulidad, evitación de recordatorios, culpa intensa, dificultad para retomar la vida. Factores de riesgo: relación muy cercana, muerte inesperada, falta de apoyo social, pérdidas múltiples, historia de depresión.`,
  },
  {
    id: "duelo-masculinidad",
    topic: "Duelo y masculinidad",
    keywords: ["hombre", "llorar", "masculino", "fuerte", "contener", "aguantar"],
    content: `Los hombres socializados en patrones tradicionales de masculinidad pueden expresar el duelo de forma diferente: irritabilidad en lugar de tristeza, somatización (dolores, fatiga), hiperactividad para evitar emociones, consumo de alcohol, aislamiento disfrazado de "estar bien". La frase "los hombres no lloran" puede impedir el procesamiento emocional. Preguntar por síntomas físicos puede ser una vía de entrada más aceptable.`,
  },

  // ═══ ANSIEDAD ═══
  {
    id: "ansiedad-generalizada",
    topic: "Trastorno de ansiedad generalizada",
    keywords: ["ansiedad", "preocupación", "nervioso", "tensión", "no puedo parar"],
    content: `TAG: preocupación excesiva y difícil de controlar por al menos 6 meses, asociada a 3+ síntomas: inquietud, fatiga, dificultad de concentración, irritabilidad, tensión muscular, alteración del sueño. El paciente puede decir "mi mente no para", "siempre estoy pensando en lo peor", "me cuesta relajarme". Distinguir de preocupación normal: la ansiedad patológica es desproporcionada, persistente e interfiere con el funcionamiento.`,
  },
  {
    id: "ansiedad-sintomas-fisicos",
    topic: "Síntomas físicos de la ansiedad",
    keywords: ["palpitaciones", "sudor", "temblor", "mareo", "estómago", "dolor pecho"],
    content: `Manifestaciones somáticas de ansiedad: taquicardia, sudoración, temblor, disnea, dolor torácico, náuseas, mareo, parestesias, escalofríos. Muchos pacientes consultan primero al médico creyendo tener un problema cardíaco. La somatización es especialmente frecuente en culturas donde hablar de emociones es estigmatizado. Validar la experiencia física sin minimizarla es clave.`,
  },

  // ═══ DEPRESIÓN ═══
  {
    id: "depresion-criterios",
    topic: "Episodio depresivo mayor",
    keywords: ["depresión", "triste", "sin ganas", "vacío", "nada importa"],
    content: `EDM (DSM-5): 5+ síntomas por 2+ semanas: ánimo depresivo, anhedonia, cambios de peso/apetito, insomnio o hipersomnia, agitación o retardo psicomotor, fatiga, culpa/inutilidad, dificultad de concentración, ideación de muerte. Al menos uno debe ser ánimo depresivo o anhedonia. El paciente puede no reconocerlo como "depresión" — puede decir "estoy cansado", "nada me motiva", "para qué".`,
  },

  // ═══ RELACIONES ═══
  {
    id: "conflicto-pareja",
    topic: "Conflicto de pareja",
    keywords: ["pareja", "relación", "pelea", "comunicación", "separación", "divorcio"],
    content: `Patrones disfuncionales frecuentes: comunicación pasivo-agresiva, perseguidor-distanciador, escalada simétrica, invalidación emocional, stonewalling (muro de piedra). Los cuatro jinetes de Gottman: crítica, desprecio, actitud defensiva, evasión. Preguntar por patrones repetitivos ("¿qué pasa típicamente cuando discuten?"), no solo por el último conflicto.`,
  },
  {
    id: "dependencia-emocional",
    topic: "Dependencia emocional",
    keywords: ["dependencia", "necesito", "sin él/ella", "miedo abandono", "celoso"],
    content: `Patrón de necesidad excesiva de aprobación y cercanía, miedo intenso al abandono, dificultad para tomar decisiones sin validación, tolerancia a maltrato por temor a la soledad, idealización de la pareja, pérdida de identidad propia. Suele asociarse a estilos de apego ansioso formados en la infancia. El paciente puede normalizar ("es que lo amo mucho") conductas que son señales de dependencia.`,
  },

  // ═══ ESTRÉS LABORAL ═══
  {
    id: "burnout",
    topic: "Síndrome de burnout",
    keywords: ["trabajo", "agotado", "burnout", "estrés laboral", "no puedo más"],
    content: `Burnout (OMS CIE-11): agotamiento emocional, despersonalización/cinismo hacia el trabajo, reducción de eficacia profesional. El paciente puede decir "antes me gustaba mi trabajo", "ya no me importa", "llego y solo quiero dormir". Factores: sobrecarga, falta de control, recompensa insuficiente, ausencia de comunidad, injusticia, valores conflictivos.`,
  },

  // ═══ AUTOESTIMA ═══
  {
    id: "autoestima-baja",
    topic: "Autoestima baja",
    keywords: ["autoestima", "no valgo", "inútil", "fracaso", "no soy suficiente"],
    content: `Autoestima baja persistente: auto-evaluación negativa, comparación social constante, dificultad para aceptar cumplidos, perfeccionismo compensatorio, sabotaje de oportunidades, tolerancia a malos tratos. Puede manifestarse como "no merezco cosas buenas" o como sobrecompensación ("tengo que ser perfecto"). Explorar creencias centrales sobre sí mismo y su origen (usualmente en la infancia o adolescencia).`,
  },

  // ═══ FAMILIA ═══
  {
    id: "conflicto-familiar",
    topic: "Conflicto familiar",
    keywords: ["familia", "padres", "hijos", "hermanos", "mamá", "papá"],
    content: `Dinámicas familiares disfuncionales: triangulación, parentificación, chivo expiatorio, lealtades invisibles, secretos familiares, mandatos transgeneracionales. El paciente puede reproducir patrones aprendidos sin ser consciente de ello. Preguntar por la familia de origen y cómo se manejaban los conflictos puede revelar el patrón que replica hoy.`,
  },

  // ═══ AISLAMIENTO ═══
  {
    id: "aislamiento-social",
    topic: "Aislamiento social",
    keywords: ["solo", "aislado", "no tengo amigos", "encerrado", "no salgo"],
    content: `El aislamiento social puede ser síntoma (depresión, fobia social) o causa de malestar. Distinguir: ¿la persona elige estar sola o se siente incapaz de conectar? ¿Hubo un evento desencadenante? La soledad crónica aumenta el riesgo de depresión, ansiedad, deterioro cognitivo y problemas cardiovasculares. Los pacientes pueden minimizarlo ("prefiero estar solo") cuando en realidad sufren la desconexión.`,
  },

  // ═══ MANEJO DE IRA ═══
  {
    id: "manejo-ira",
    topic: "Manejo de la ira",
    keywords: ["ira", "enojo", "rabia", "explotar", "agresivo", "impulsivo"],
    content: `La ira desregulada puede manifestarse como explosiones verbales/físicas, irritabilidad crónica, resentimiento acumulado, o somatización. Frecuentemente enmascara emociones más vulnerables: miedo, tristeza, impotencia, vergüenza. Explorar qué hay "debajo" de la ira. Patrones: acumulación-explosión, ira dirigida a otros vs. a sí mismo, ira como mecanismo de control. En hombres, la ira puede ser la única emoción "permitida" culturalmente.`,
  },

  // ═══ CRISIS VITAL ═══
  {
    id: "crisis-vital",
    topic: "Crisis vital / Transición",
    keywords: ["crisis", "transición", "cambio", "no sé qué hacer", "perdido", "sentido"],
    content: `Las crisis vitales surgen en transiciones significativas: jubilación, divorcio, nido vacío, cambio de carrera, migración, enfermedad. Generan pérdida de identidad, cuestionamiento de valores, ansiedad existencial. El paciente puede sentir que "perdió el norte" o que "ya no sabe quién es". No son patológicas per se, pero pueden precipitar depresión o ansiedad si no se procesan. Explorar qué se perdió y qué nueva identidad está emergiendo.`,
  },

  // ═══ TÉCNICAS TERAPÉUTICAS ═══
  {
    id: "tecnica-escucha-activa",
    topic: "Escucha activa en terapia",
    keywords: ["escucha", "atención", "silencio", "no verbal", "empatía"],
    content: `La escucha activa implica: contacto visual, postura abierta, asentimientos, reflejos verbales ("mm-hmm"), parafraseo, resúmenes. No es solo oír — es comunicar comprensión. Errores frecuentes: interrumpir, dar consejos prematuros, cambiar de tema, minimizar ("no es para tanto"), intelectualizar. Un buen silencio terapéutico comunica: "estoy aquí, no tengo prisa, tu proceso importa".`,
  },
  {
    id: "tecnica-preguntas",
    topic: "Tipos de preguntas en entrevista clínica",
    keywords: ["pregunta", "indagar", "explorar", "entrevista"],
    content: `Preguntas abiertas ("¿Cómo fue eso para usted?") invitan a explorar. Preguntas cerradas ("¿Duerme bien?") obtienen datos específicos. Preguntas circulares ("¿Qué diría su esposa si estuviera aquí?") amplían perspectiva. Preguntas reflexivas ("¿Qué significa eso para usted?") profundizan. Evitar preguntas sugestivas ("¿No cree que debería...?") o múltiples ("¿Cómo se siente y qué piensa y qué va a hacer?").`,
  },
];

/**
 * Search the knowledge base for entries relevant to the conversation.
 * Uses keyword matching (lightweight RAG without vector embeddings).
 */
export function searchKnowledge(query: string, maxResults = 3): ClinicalEntry[] {
  const lower = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Score each entry by keyword matches
  const scored = CLINICAL_KNOWLEDGE.map((entry) => {
    let score = 0;
    for (const kw of entry.keywords) {
      const kwNorm = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (lower.includes(kwNorm)) score += 2;
      // Partial match
      const words = kwNorm.split(/\s+/);
      for (const w of words) {
        if (w.length > 3 && lower.includes(w)) score += 1;
      }
    }
    // Also check topic
    const topicNorm = entry.topic.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (lower.includes(topicNorm)) score += 3;

    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((s) => s.entry);
}

/**
 * Build a RAG context block to inject into the patient's system prompt.
 * The patient uses this clinical knowledge to respond more realistically.
 */
export function buildRAGContext(entries: ClinicalEntry[]): string {
  if (entries.length === 0) return "";

  const context = entries
    .map((e) => `[${e.topic}]\n${e.content}`)
    .join("\n\n");

  return `\n[CONOCIMIENTO CLÍNICO RELEVANTE — usa esta información para dar respuestas clínicamente coherentes, pero NO la cites textualmente ni actúes como profesional. Úsala para que tus síntomas, emociones y reacciones sean realistas]
${context}
[FIN CONOCIMIENTO CLÍNICO]\n`;
}
