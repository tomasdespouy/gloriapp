/**
 * F4 – Constructor del prompt PECT-extendido.
 *
 * Toma el PECT completo (46 ítems en 7 secciones) y devuelve un prompt para
 * un evaluador LLM que cubra TODAS las competencias evaluables vía chat.
 *
 * Excluidas (no observables en chat):
 *   - SECCIÓN 4: CARACTERÍSTICAS DE LA TERAPEUTA (8 ítems)
 *     Razón: requiere observación del estudiante, no del diálogo.
 *   - SECCIÓN 5: CONCEPTUALIZACIÓN DEL CASO (5 ítems)
 *     Razón: el propio libro indica que se evalúan en supervisión escrita/oral.
 *   - SECCIÓN 1: "Solicita consentimientos informados" (sub-ítem)
 *     Razón: el flujo de consentimiento ocurre fuera del chat (UI).
 *   - SECCIÓN 1: "Toma en cuenta elementos institucionales"
 *     Razón: no observable en una sesión simulada de chat.
 *   - SECCIÓN 2: "Comunica y realiza derivaciones adecuadamente"
 *     Razón: una sola sesión no genera derivaciones.
 *   - SECCIÓN 2: "Redacta los respectivos informes del caso"
 *     Razón: artefacto de supervisión, no del chat.
 *   - SECCIÓN 6: "Aplica sugerencias de la supervisión"
 *     Razón: requiere ciclo de supervisión, no observable en 1 sesión.
 *
 * Quedan: 35 ítems evaluables + 17 sub-técnicas opcionales.
 */

const PECT_ITEMS = {
  estructura_terapeutica: {
    titulo: "ESTRUCTURA TERAPÉUTICA",
    descripcion:
      "Acciones que delimitan, mantienen y monitorean el marco terapéutico desde la primera sesión.",
    items: [
      {
        key: "setting_comunicado",
        nombre: "Comunica y mantiene el setting terapéutico",
        descriptor:
          "Transmitir desde la primera sesión las condiciones que permanecerán constantes: modalidad, frecuencia, duración, horario, importancia de la asistencia/puntualidad. Enmarcar el trabajo en el contexto psicológico.",
      },
      {
        key: "setting_modificado",
        nombre: "Modifica el setting terapéutico de ser necesario",
        descriptor:
          "Flexibilizar aspectos del encuadre cuando el paciente lo requiera (turnos laborales, viajes, crisis puntual), siempre comunicándolo y considerando su opinión.",
      },
      {
        key: "motivo_consulta",
        nombre: "Identifica un motivo de consulta",
        descriptor:
          "Indagar signos y síntomas desde la perspectiva del paciente y de sus personas significativas. Distinguir motivo manifiesto del latente. Explorar recursos personales/familiares/sociales.",
      },
      {
        key: "datos_contextuales",
        nombre: "Considera los datos contextuales del paciente",
        descriptor:
          "Indagar contextos del paciente (familiar, sociocultural, laboral, educacional) en entrevista semiestructurada. Antecedentes mórbidos, sociofamiliares, suicidalidad, etc.",
      },
      {
        key: "objetivos",
        nombre: "Acuerda objetivos junto con el paciente",
        descriptor:
          "Proponer y acordar conjuntamente con el paciente los objetivos que guiarán la terapia. Objetivos en términos positivos, específicos y comprensibles.",
      },
    ],
  },

  diseno_plan: {
    titulo: "DISEÑO Y COMUNICACIÓN DEL PLAN DE TRABAJO",
    descripcion:
      "Plan de intervención: pasos a seguir para alcanzar los objetivos.",
    items: [
      {
        key: "plan_de_trabajo",
        nombre: "Diseña y comunica un plan de trabajo",
        descriptor:
          "Diseñar y proponer al paciente un plan de intervención acorde a la gravedad/complejidad del caso. Comunicar 'ruta a seguir' (etapas: evaluación, devolución, planteamiento de objetivos, tratamiento, monitoreo, cierre).",
      },
      {
        key: "modifica_tareas_metas",
        nombre: "Modifica las tareas y las metas de ser necesario",
        descriptor:
          "Flexibilizar ajustes al plan o a los objetivos en beneficio del paciente y su proceso.",
      },
      {
        key: "cierre",
        nombre: "Realiza un adecuado cierre",
        descriptor:
          "Cierre adecuado de cada sesión (con tiempo suficiente para integrar lo trabajado, ni abrupto ni demorado). Reflexionar sobre cambios y recursos al final del proceso.",
      },
    ],
  },

  actitud_terapeuta: {
    titulo: "ACTITUD DE LA TERAPEUTA",
    descripcion:
      "Las diez actitudes transversales que sostienen el vínculo terapéutico.",
    items: [
      {
        key: "escucha_activa",
        nombre: "Muestra una actitud de escucha activa",
        descriptor:
          "Prestar atención e interés a contenidos verbales y no-verbales. Procesar la información, dar respuestas congruentes (asentir, parafrasear, decir 'mmm', 'continúe'). Atender también a lo que el paciente NO dice.",
      },
      {
        key: "actitud_no_valorativa",
        nombre: "Muestra una actitud no valorativa del paciente",
        descriptor:
          "Aceptar incondicionalmente al paciente, sin emitir juicios de valor ni criticar sus creencias. Respetar estilos de vida diferentes.",
      },
      {
        key: "optimismo",
        nombre: "Muestra optimismo al paciente",
        descriptor:
          "Actitud optimista y de apoyo, pero realista. Atender a recursos y puntos fuertes sin obviar limitaciones. Expresar esperanza acerca de la capacidad de cambio del paciente.",
      },
      {
        key: "presencia",
        nombre: "Está presente (aquí y ahora)",
        descriptor:
          "Plenamente concentrada y atenta. Mindfulness durante la sesión. Flexibilidad, apertura, empatía desde el marco de referencia del paciente. Sintonía intersubjetiva.",
      },
      {
        key: "conducta_no_verbal",
        nombre: "Presta atención a la conducta no verbal",
        descriptor:
          "Atender a contacto ocular, postura, proxemia, expresiones faciales, gestos, prosodia, titubeos, silencios, conductas autoafirmadoras (tocarse el cabello, morderse los labios, etc.).",
      },
      {
        key: "contencion_afectos",
        nombre: "Contiene los afectos del paciente",
        descriptor:
          "Permitir hablar del problema en clima de calidez y empatía. Reconocimiento, validación y posibilidad de expresar emociones. Espacio seguro y confiable. Regulación emocional.",
      },
      {
        key: "curiosidad_cordialidad",
        nombre: "Muestra curiosidad, cordialidad y sensibilidad",
        descriptor:
          "Interés genuino (no rutinario). Preguntas abiertas para profundizar. Autenticidad y espontaneidad sinceras pero con tacto. Cordialidad verbal y no-verbal: contacto visual, sonrisas genuinas, asentimientos, tono suave.",
      },
      {
        key: "espontaneidad",
        nombre: "Muestra espontaneidad en la sesión",
        descriptor:
          "Flexibilidad para adaptar intervenciones al paciente. Cierto grado de directividad sin caer en exceso. Humor espontáneo cuando es bienvenido.",
      },
      {
        key: "manejo_silencios",
        nombre: "Maneja los silencios del paciente",
        descriptor:
          "Los silencios nunca están vacíos de significado. Permitir silencios del paciente sin apresurar. Usar los propios silencios en beneficio del paciente (tiempo de elaboración).",
      },
      {
        key: "actitud_etica",
        nombre: "Demuestra una actitud ética",
        descriptor:
          "Cumple en todo momento con principios éticos: confidencialidad, respeto a la autonomía, libre elección, derivación cuando se carece de habilidad.",
      },
    ],
  },

  evaluacion_proceso: {
    titulo: "EVALUACIÓN DEL PROCESO",
    descripcion:
      "Monitoreo del proceso terapéutico, timing y vínculo.",
    items: [
      {
        key: "timing",
        nombre: "Interviene en el momento oportuno (timing)",
        descriptor:
          "Respetar ritmo, velocidad y pausas del paciente. Acelerar o desacelerar según las características del paciente, los contenidos trabajados, el momento de la sesión.",
      },
      {
        key: "desarrollo_vinculo",
        nombre: "Realiza acciones para desarrollar el vínculo",
        descriptor:
          "Monitorear el desarrollo de una adecuada alianza terapéutica. Chequear compromiso, participación, satisfacción y expectativas del paciente con el tratamiento.",
      },
      {
        key: "identifica_tensiones",
        nombre: "Identifica tensiones o problemas en el vínculo",
        descriptor:
          "Detectar tensión, aburrimiento, desmotivación, problemas de comunicación, invalidación de la terapeuta, rompimiento de acuerdos.",
      },
      {
        key: "repara_tensiones",
        nombre: "Intenta reparar problemas en el vínculo",
        descriptor:
          "Realizar acciones para reparar rupturas del vínculo cuando son detectadas durante la sesión.",
      },
      {
        key: "monitoreo_avance",
        nombre: "Monitorea y da cuenta del avance terapéutico",
        descriptor:
          "Tener una teoría del cambio explícita o implícita. Registrar evolución, estancamiento y retrocesos.",
      },
    ],
  },

  intervenciones: {
    titulo: "TIPOS DE INTERVENCIÓN PRINCIPALES",
    descripcion:
      "Las cuatro grandes intervenciones genéricas, independientemente del enfoque.",
    items: [
      {
        key: "explorar_contenidos",
        nombre: "Realiza exploración de contenidos",
        descriptor:
          "Solicitar información: pensamientos, afectos, comportamientos, conocimientos, deseos, motivaciones. Forma básica: la Pregunta. También Aseveraciones que solicitan información.",
      },
      {
        key: "sintonia_paciente",
        nombre: "Muestra sintonía con el paciente",
        descriptor:
          "Comunicar al paciente que está comprendiendo. Chequear comprensión. Armonizar/empatizar. Dar retroalimentación afectiva del impacto del paciente en la terapeuta.",
      },
      {
        key: "apoyar",
        nombre: "Ofrece apoyo al paciente",
        descriptor:
          "Reforzar recursos del paciente para enfrentar crisis. Aliviar el sufrimiento, reforzar defensas adaptativas, contener ansiedad. Movilizar fortalezas y autoestima.",
      },
      {
        key: "resignificar",
        nombre: "Facilita la resignificación de contenidos",
        descriptor:
          "Construir nuevos significados junto con el paciente: ofrecer nueva visión, cuestionar contenidos contradictorios, relacionar contenidos, dar por cierta una idea presentada.",
      },
    ],
  },

  tecnicas: {
    titulo: "TÉCNICAS TERAPÉUTICAS ESPECÍFICAS",
    descripcion:
      "Las 17 técnicas que apoyan las intervenciones. Evaluá cada una independientemente.",
    items: [
      {
        key: "tec_argumentacion",
        nombre: "Argumentación",
        descriptor:
          "Entregar fundamento, ejemplo, generalización o justificación. Ej: 'es importante hacer interconsulta porque...', 'todos se vieron afectados por la pandemia'.",
      },
      {
        key: "tec_autorrevelacion",
        nombre: "Autorrevelación",
        descriptor:
          "Evidenciar información personal de la terapeuta cuando es estrictamente beneficioso. Uso muy puntual.",
      },
      {
        key: "tec_clarificacion",
        nombre: "Clarificación",
        descriptor:
          "Profundizar en descripción/indagación. Corroborar lo dicho. Ej: '¿a qué se refiere exactamente?', '¿podría explicarlo mejor?'.",
      },
      {
        key: "tec_confrontacion",
        nombre: "Confrontación",
        descriptor:
          "Enfrentar al paciente con sus propias aseveraciones para mostrar incongruencia. Ej: 'hace un rato dijiste X, pero ahora Y'.",
      },
      {
        key: "tec_consejo",
        nombre: "Consejo",
        descriptor:
          "Dar instrucción o tarea con intención persuasiva. Ej: 'le aconsejo que...', 'debería retomar el deporte'. NOTA: dar consejo prematuro puede ser iatrogénico.",
      },
      {
        key: "tec_focalizacion",
        nombre: "Focalización",
        descriptor:
          "Dirigir atención hacia un foco. Iniciar tema, regresar a tema previo. Ej: 'volvamos a revisar lo que mencionaste sobre tu sueño'.",
      },
      {
        key: "tec_imaginacion",
        nombre: "Imaginación",
        descriptor:
          "Representación mental de situación presente/pasada/futura. Ej: 'cierre los ojos e imagine cómo va a actuar en ese momento'.",
      },
      {
        key: "tec_informacion",
        nombre: "Información (psicoeducación)",
        descriptor:
          "Entregar conocimientos dados por verdaderos. Ej: 'todos los niños necesitan límites', 'la adolescencia es una etapa de búsqueda de identidad'.",
      },
      {
        key: "tec_interpretacion",
        nombre: "Interpretación",
        descriptor:
          "Traducir un contenido en nueva forma de expresión que permite comprenderlo de manera distinta. Más usada en enfoque psicodinámico.",
      },
      {
        key: "tec_metafora",
        nombre: "Metáfora",
        descriptor:
          "Expresar una realidad a través de otra con la que guarda semejanza. Ej: 'esto es como una montaña rusa', 'cargando una mochila pesada'.",
      },
      {
        key: "tec_paradoja",
        nombre: "Paradoja",
        descriptor:
          "Declaración que aparenta ser verdadera pero implícitamente guarda contradicción lógica. Uso puntual.",
      },
      {
        key: "tec_parafrasis",
        nombre: "Paráfrasis",
        descriptor:
          "Recapitular con OTRAS palabras el mensaje del paciente. NO repetir literalmente, sí usar algunas palabras del paciente y reorganizar.",
      },
      {
        key: "tec_reflejo",
        nombre: "Reflejo",
        descriptor:
          "Espejar estados afectivos/cognitivos/comportamentales del paciente en el aquí-y-ahora. Ej: 'te veo desganado, lo veo en tu semblante'. NO es interpretación.",
      },
      {
        key: "tec_refuerzo",
        nombre: "Refuerzo",
        descriptor:
          "Alentar/validar al paciente. Transmitir convicción de que tiene condiciones para realizar la acción. Ej: 'es muy bueno que hayas decidido buscar ayuda'.",
      },
      {
        key: "tec_resumen",
        nombre: "Resumen",
        descriptor:
          "Sintetizar gran cantidad de contenidos. Ej: 'haciendo un resumen de lo conversado hoy...'.",
      },
      {
        key: "tec_role_playing",
        nombre: "Role Playing",
        descriptor:
          "Pedir al paciente actuar una situación con otros personajes. Ej: 'hable como si usted fuera su nuera'.",
      },
      {
        key: "tec_tareas",
        nombre: "Asignación de tareas",
        descriptor:
          "Solicitar ejercicios o actividades para entre-sesiones. Ej: 'cuente y registre las veces que se sienta ansioso'.",
      },
    ],
  },
};

function flattenItems() {
  const out = [];
  for (const [sect, data] of Object.entries(PECT_ITEMS)) {
    for (const item of data.items) {
      out.push({
        section: sect,
        section_title: data.titulo,
        ...item,
      });
    }
  }
  return out;
}

function rubricSectionToText(sect, data) {
  const lines = [
    `── ${data.titulo} ──`,
    data.descripcion,
    "",
  ];
  for (const it of data.items) {
    lines.push(`* ${it.key}: ${it.nombre}`);
    lines.push(`  ${it.descriptor}`);
  }
  return lines.join("\n");
}

function buildPectExtendedPrompt() {
  const allItems = flattenItems();
  const itemKeys = allItems.map((i) => `"${i.key}"`).join(", ");

  const rubric = Object.entries(PECT_ITEMS)
    .map(([s, d]) => rubricSectionToText(s, d))
    .join("\n\n");

  return `Eres un supervisor clínico experto evaluando la sesión de un estudiante de psicología.
Usá la **PECT — Pauta de Evaluación de Competencias Psicoterapéuticas para el trabajo con Adultos** (Valdés Sánchez, N. & Gómez Gallo, D., 2023), del libro "Supervisión clínica para estudiantes de Psicología: Un modelo de competencias psicoterapéuticas genéricas básicas" (Ediciones Universidad Santo Tomás / RIL Editores).

ESCALA DE PUNTUACIÓN (del libro, literal):

  0 = No aplica    — No fue posible o no fue necesario que el/la terapeuta demostrara la competencia.
  1 = Ausente      — No fue demostrada la competencia, pudiendo haberlo hecho. Requiere mucha supervisión.
  2 = Insuficiente — La competencia fue mínimamente demostrada. Requiere supervisión.
  3 = Buena        — La competencia fue adecuadamente demostrada. Requiere mínima supervisión.
  4 = Excelente    — La competencia fue excelentemente demostrada. No requiere supervisión.

REGLAS:
- Distinguí estrictamente entre 0 (no aplicaba) y 1 (estaba ausente cuando se esperaba que estuviera).
- Las TÉCNICAS específicas (tec_*) puntúan 0 si el contexto de la sesión no demandaba esa técnica.
  Pero si demandaba la técnica y no se usó, es 1, no 0.
- Para ítems de actitud (escucha_activa, presencia, etc.) es muy raro que aplique 0.
- Sé ESPECÍFICO con las técnicas: una "paráfrasis" debe ser un reformular con OTRAS palabras, no
  repetir lo dicho. Un "reflejo" es nombrar el estado afectivo/conductual aquí-y-ahora del paciente,
  no interpretar.

═══════════════════════════════════════════════════
DESCRIPTORES DE CADA COMPETENCIA
═══════════════════════════════════════════════════

${rubric}

═══════════════════════════════════════════════════
FORMATO DE RESPUESTA (JSON estricto, sin markdown)
═══════════════════════════════════════════════════

{
  "scores": {
    ${allItems.map((i) => `"${i.key}": <0|1|2|3|4>`).join(",\n    ")}
  },
  "evidence": {
    "<key>": "cita breve del estudiante que ilustra el nivel asignado (vacío permitido si score=0)"
  },
  "commentary": "3-5 oraciones que sinteticen el patrón general del estudiante",
  "strengths": ["fortaleza 1", "fortaleza 2"],
  "areas_to_improve": ["área 1", "área 2"]
}

Ítems a evaluar (TODOS, sin omitir): ${itemKeys}.

Respondé ÚNICAMENTE con el JSON, sin markdown ni backticks.`;
}

module.exports = {
  PECT_ITEMS,
  flattenItems,
  buildPectExtendedPrompt,
};

if (require.main === module) {
  const prompt = buildPectExtendedPrompt();
  const items = flattenItems();
  console.log(`[ok] PECT-extendido construido`);
  console.log(`     Total ítems: ${items.length}`);
  console.log(`     Por sección:`);
  for (const [s, d] of Object.entries(PECT_ITEMS)) {
    console.log(`       - ${s}: ${d.items.length} ítems`);
  }
  console.log(`     Prompt length: ${prompt.length} chars`);
}
