export interface DialogueLine {
  role: "therapist" | "patient";
  content: string;
}

export interface LearningExample {
  id: string;
  title: string;
  context: string;
  dialogue: DialogueLine[];
  explanation: string;
  tip: string;
}

export interface CompetencyLearning {
  key: string;
  name: string;
  emoji: string;
  domain: string;
  description: string;
  examples: LearningExample[];
}

export const LEARNING_DATA: CompetencyLearning[] = [
  // ═══════════════════════════════════════════
  // DOMINIO 1 — ESTRUCTURA DE LA SESIÓN
  // ═══════════════════════════════════════════

  {
    key: "setting_terapeutico",
    name: "Setting terapéutico",
    emoji: "🏠",
    domain: "Estructura de la sesión",
    description:
      "Capacidad de explicitar el encuadre terapéutico: confidencialidad, duración, roles, reglas del espacio. Incluye aclarar dudas del paciente sobre el proceso y establecer un marco seguro desde el inicio (Bordin, 1979).",
    examples: [
      {
        id: "set-1",
        title: "Establecer el encuadre en primera sesión",
        context: "Paciente de 25 años que llega por primera vez a terapia. Está visiblemente nervioso y no sabe qué esperar.",
        dialogue: [
          { role: "patient", content: "Hola... la verdad nunca he ido a un psicólogo. No sé muy bien cómo funciona esto." },
          { role: "therapist", content: "Me alegra que estés aquí. Antes de empezar, quiero explicarte cómo funciona este espacio. Nuestras sesiones duran aproximadamente 50 minutos, y todo lo que hablemos acá es confidencial." },
          { role: "patient", content: "¿O sea que no le va a contar a nadie?" },
          { role: "therapist", content: "Exacto. Lo que hablemos queda entre nosotros, salvo que haya riesgo para tu vida o la de alguien más. Mi rol es acompañarte, no juzgarte. ¿Tienes alguna otra duda antes de empezar?" },
        ],
        explanation: "El terapeuta anticipa la ansiedad del paciente nuevo y explicita las reglas del espacio de forma cálida y accesible. No asume que el paciente sabe cómo funciona la terapia.",
        tip: "Siempre explicita confidencialidad, duración y tu rol al inicio. Un paciente que entiende el encuadre se siente más seguro para abrirse.",
      },
      {
        id: "set-2",
        title: "Renegociar el encuadre ante una ruptura",
        context: "Paciente de 40 años que llegó 20 minutos tarde por tercera vez consecutiva.",
        dialogue: [
          { role: "therapist", content: "Noto que las últimas sesiones has llegado con bastante retraso. Me gustaría que hablemos de eso, porque quiero asegurarme de que aprovechemos bien nuestro tiempo juntos." },
          { role: "patient", content: "Es que el trabajo... siempre se me complica salir." },
          { role: "therapist", content: "Entiendo que el trabajo es demandante. Y al mismo tiempo, estos 50 minutos son tu espacio. ¿Crees que podríamos buscar un horario que funcione mejor para ti?" },
          { role: "patient", content: "Tiene razón. Quizás los viernes en la tarde me conviene más." },
        ],
        explanation: "El terapeuta aborda la ruptura del encuadre sin culpabilizar. Reafirma el valor del espacio terapéutico y ofrece una solución colaborativa.",
        tip: "Las rupturas del encuadre son material clínico. No las ignores ni las castigues — abordarlas fortalece la alianza.",
      },
      {
        id: "set-3",
        title: "Aclarar roles cuando el paciente pide consejos",
        context: "Paciente de 35 años en segunda sesión que espera que el terapeuta le diga qué hacer con su matrimonio.",
        dialogue: [
          { role: "patient", content: "Entonces, ¿usted qué me recomienda? ¿Me separo o no?" },
          { role: "therapist", content: "Entiendo que buscas una respuesta clara, y esa angustia de no saber qué hacer es real. Mi rol aquí no es decirte qué hacer, sino ayudarte a entender qué necesitas y qué sientes, para que tú puedas tomar la mejor decisión." },
          { role: "patient", content: "Pero entonces para qué vengo si no me va a decir qué hacer?" },
          { role: "therapist", content: "Es una pregunta válida. Vienes porque nadie conoce tu vida mejor que tú. Lo que hacemos acá es crear un espacio donde puedas pensar con más claridad, sin la presión del día a día." },
        ],
        explanation: "El terapeuta clarifica su rol sin rechazar al paciente. Valida la frustración y redefine la expectativa de forma que el paciente entienda el valor del proceso.",
        tip: "Cuando un paciente pide consejo directo, es una oportunidad para clarificar roles. Valida primero, luego redefine.",
      },
      {
        id: "set-4",
        title: "Manejar interrupciones externas al setting",
        context: "Paciente de 28 años cuyo teléfono suena por tercera vez durante la sesión.",
        dialogue: [
          { role: "patient", content: "[Mira el teléfono] Perdón, es mi jefe otra vez..." },
          { role: "therapist", content: "Noto que el teléfono ha sonado varias veces. Este es tu espacio, y las interrupciones pueden hacer que sea difícil conectar con lo que estás sintiendo. ¿Te parece si lo dejamos en silencio?" },
          { role: "patient", content: "Sí, tiene razón. Es que me cuesta desconectarme del trabajo." },
          { role: "therapist", content: "Y eso en sí mismo puede ser algo que exploremos. El hecho de que te cueste darte este espacio dice algo importante." },
        ],
        explanation: "El terapeuta protege el encuadre de forma respetuosa y transforma la interrupción en material clínico relevante.",
        tip: "Las interrupciones no son solo molestias — pueden revelar patrones (dificultad para poner límites, ansiedad de separación del trabajo, etc.).",
      },
      {
        id: "set-5",
        title: "Cerrar la sesión con estructura",
        context: "Quedan 5 minutos y el paciente acaba de abrir un tema emocionalmente intenso.",
        dialogue: [
          { role: "patient", content: "[Con los ojos llorosos] Y ahí fue cuando me enteré de que mi papá tenía otra familia..." },
          { role: "therapist", content: "Eso que me estás contando es muy importante y merece todo el espacio. Quiero ser honesto contigo: nos quedan pocos minutos hoy. No quiero que algo tan significativo quede cortado. ¿Te parece si lo retomamos como prioridad la próxima sesión?" },
          { role: "patient", content: "[Asiente] Sí... creo que necesito más tiempo para hablar de eso." },
          { role: "therapist", content: "Me parece bien. Y quiero que sepas que lo que compartiste hoy fue muy valiente. Nos vemos el jueves." },
        ],
        explanation: "El terapeuta protege al paciente de una apertura emocional sin contención temporal suficiente. Valida lo compartido y asegura continuidad.",
        tip: "Nunca abras temas profundos en los últimos 10 minutos. Si el paciente lo hace, contenlo y asegura seguimiento.",
      },
    ],
  },

  {
    key: "motivo_consulta",
    name: "Motivo de consulta",
    emoji: "🔍",
    domain: "Estructura de la sesión",
    description:
      "Capacidad de indagar e integrar el motivo de consulta manifiesto (lo que el paciente dice que le pasa) y el latente (lo que subyace). Incluye explorar recursos, intentos previos de solución y expectativas del proceso (Fiorini, 1999).",
    examples: [
      {
        id: "mot-1",
        title: "Explorar más allá del motivo manifiesto",
        context: "Paciente de 32 años que dice venir por 'estrés laboral', pero su lenguaje corporal sugiere algo más.",
        dialogue: [
          { role: "patient", content: "Vengo porque tengo mucho estrés en el trabajo. Solo necesito técnicas para manejarlo." },
          { role: "therapist", content: "El estrés laboral puede ser muy agotante. Cuéntame un poco más: ¿desde cuándo sientes que esto se volvió un problema?" },
          { role: "patient", content: "Desde que ascendieron a mi compañero y no a mí... [pausa] pero no es por eso." },
          { role: "therapist", content: "Parece que esa situación te afectó más de lo que esperabas. ¿Qué significó para ti que ascendieran a tu compañero?" },
        ],
        explanation: "El terapeuta acepta el motivo manifiesto pero explora su temporalidad, revelando el motivo latente: una herida de reconocimiento y autoestima.",
        tip: "Pregunta 'desde cuándo' y 'qué estaba pasando en tu vida cuando empezó'. El motivo manifiesto rara vez es el motivo real.",
      },
      {
        id: "mot-2",
        title: "Indagar intentos previos de solución",
        context: "Paciente de 45 años con ansiedad crónica que ha probado varias terapias sin éxito.",
        dialogue: [
          { role: "patient", content: "Ya he ido a tres psicólogos y nada funciona. Tal vez soy un caso perdido." },
          { role: "therapist", content: "Tres intentos. Eso me dice que tienes mucha persistencia, no que seas un caso perdido. ¿Me podrías contar qué fue lo que no funcionó en esas experiencias?" },
          { role: "patient", content: "Uno me daba puros consejos, otro solo me escuchaba pero nunca decía nada, y la tercera me hacía hacer ejercicios de respiración todo el rato." },
          { role: "therapist", content: "Entonces sabes bastante bien qué NO necesitas. Eso es muy útil. ¿Qué sí te gustaría encontrar aquí?" },
        ],
        explanation: "El terapeuta reencuadra los intentos fallidos como información valiosa. Explora qué no funcionó para calibrar el enfoque actual.",
        tip: "Los 'fracasos' terapéuticos previos son datos clínicos. Pregunta qué no funcionó — te dice qué necesita este paciente.",
      },
      {
        id: "mot-3",
        title: "Explorar expectativas del proceso",
        context: "Paciente de 20 años enviado por sus padres que no entiende por qué tiene que ir a terapia.",
        dialogue: [
          { role: "patient", content: "Mis papás me mandaron. Yo no creo que necesite esto." },
          { role: "therapist", content: "Entiendo. No elegiste estar aquí. Y aun así viniste. ¿Qué crees que tus papás esperan que pase?" },
          { role: "patient", content: "Que deje de contestarles mal, supongo. Pero es que ellos no entienden nada." },
          { role: "therapist", content: "Sientes que no te entienden. Si pudieras usar este espacio para ti — no para ellos — ¿hay algo que te gustaría que fuera diferente en tu vida?" },
        ],
        explanation: "El terapeuta no fuerza motivación. Reconoce que el paciente no eligió venir, valida su posición, y busca una motivación intrínseca.",
        tip: "Con pacientes 'enviados', nunca te alíes con quien lo envió. Busca qué querría EL paciente si pudiera elegir.",
      },
      {
        id: "mot-4",
        title: "Integrar motivo manifiesto y latente",
        context: "Paciente de 38 años que consulta por insomnio pero en la conversación emerge un duelo no procesado.",
        dialogue: [
          { role: "patient", content: "No puedo dormir. Me quedo dando vueltas en la cama pensando." },
          { role: "therapist", content: "¿Qué tipo de pensamientos aparecen en esas noches?" },
          { role: "patient", content: "Pienso en mi mamá. Falleció hace un año y... no sé, siento que no hice lo suficiente." },
          { role: "therapist", content: "Entonces el insomnio no es solo un problema de sueño. Es tu mente buscando espacio para procesar algo que durante el día no encuentras cómo abordar. ¿Tiene sentido eso?" },
        ],
        explanation: "El terapeuta conecta el síntoma (insomnio) con el proceso emocional subyacente (duelo). La integración del motivo manifiesto y latente le da sentido al síntoma.",
        tip: "Los síntomas son mensajes. Pregunta siempre: '¿qué está intentando decirme este síntoma sobre la vida de este paciente?'",
      },
      {
        id: "mot-5",
        title: "Explorar recursos del paciente",
        context: "Paciente de 50 años con depresión que se define solo por sus limitaciones.",
        dialogue: [
          { role: "patient", content: "No sirvo para nada. No puedo trabajar, no puedo ser buen padre, no puedo nada." },
          { role: "therapist", content: "Escucho mucho dolor en lo que dices. Y al mismo tiempo, estás aquí. Viniste, te sentaste, y estás hablando de lo que sientes. Eso requiere algo." },
          { role: "patient", content: "¿Qué requiere? Solo vine porque mi hija me rogó." },
          { role: "therapist", content: "Requiere que te importa tu hija lo suficiente como para escucharla. Eso no es 'nada'. Cuéntame más sobre tu relación con ella." },
        ],
        explanation: "El terapeuta identifica un recurso (el vínculo con la hija) dentro del discurso de desesperanza. No confronta la negatividad directamente sino que señala evidencia concreta de capacidad.",
        tip: "Busca siempre el recurso dentro de la queja. Si el paciente dice 'no puedo nada' pero está en tu consulta, eso ya es un recurso.",
      },
    ],
  },

  {
    key: "datos_contextuales",
    name: "Datos contextuales",
    emoji: "📋",
    domain: "Estructura de la sesión",
    description:
      "Capacidad de entrevistar e integrar información relevante de los distintos contextos del paciente: familiar, laboral, social, de salud, cultural. Permite construir una imagen completa y contextualizada del problema (Engel, 1977 — modelo biopsicosocial).",
    examples: [
      {
        id: "ctx-1",
        title: "Explorar contexto familiar sin interrogar",
        context: "Paciente de 27 años que habla de ansiedad pero no menciona su familia.",
        dialogue: [
          { role: "patient", content: "La ansiedad me tiene mal. No puedo concentrarme en nada." },
          { role: "therapist", content: "¿Cómo es tu día a día? ¿Con quién vives?" },
          { role: "patient", content: "Con mi mamá y mi hermano menor. Mi papá se fue cuando yo tenía 12." },
          { role: "therapist", content: "Desde los 12 has estado en un rol diferente en tu familia. ¿Sientes que eso tiene relación con lo que te pasa ahora?" },
        ],
        explanation: "Una pregunta simple sobre convivencia abre toda una historia familiar. El terapeuta conecta el contexto con el motivo de consulta sin forzar.",
        tip: "Preguntas como '¿con quién vives?' o '¿cómo es un día normal?' revelan más contexto que interrogatorios directos.",
      },
      {
        id: "ctx-2",
        title: "Integrar contexto laboral y emocional",
        context: "Paciente de 42 años que menciona problemas de pareja pero no ha hablado de su trabajo.",
        dialogue: [
          { role: "patient", content: "Mi esposa dice que ya no estoy presente. Que llego y me encierro." },
          { role: "therapist", content: "¿Cómo está siendo tu trabajo últimamente?" },
          { role: "patient", content: "Fatal. Me cambiaron de área, tengo un jefe nuevo que me controla todo. Llego agotado." },
          { role: "therapist", content: "Entonces llegas a casa vacío. Y lo que tu esposa lee como desinterés puede ser agotamiento. ¿Cómo se siente escucharlo así?" },
        ],
        explanation: "El terapeuta explora el contexto laboral y lo conecta con el problema relacional. Ofrece una lectura integradora que el paciente no había considerado.",
        tip: "Los problemas rara vez son de un solo contexto. Un conflicto de pareja puede tener raíz laboral, familiar o de salud.",
      },
      {
        id: "ctx-3",
        title: "Explorar contexto de salud física",
        context: "Paciente de 55 años con síntomas depresivos que no ha mencionado su salud física.",
        dialogue: [
          { role: "patient", content: "No tengo energía para nada. Todo me cuesta el doble." },
          { role: "therapist", content: "Esa falta de energía, ¿ha ido al médico para descartar algo físico? A veces el cuerpo nos habla." },
          { role: "patient", content: "Hace como un año que no voy al doctor. Pero tengo diabetes y no me he controlado." },
          { role: "therapist", content: "Eso es importante. La diabetes no controlada puede afectar mucho el ánimo y la energía. ¿Le parece si trabajamos juntos para que pueda retomar ese control, además de lo que veamos acá?" },
        ],
        explanation: "El terapeuta no asume que todo es psicológico. Explora salud física y descubre un factor médico que impacta directamente el cuadro clínico.",
        tip: "Siempre pregunta por salud física, medicación y sueño. No hacerlo es un punto ciego clínico.",
      },
      {
        id: "ctx-4",
        title: "Considerar contexto cultural y migratorio",
        context: "Paciente de 30 años, migrante venezolana en Chile, que consulta por tristeza persistente.",
        dialogue: [
          { role: "patient", content: "Me siento muy sola. Acá no tengo a nadie." },
          { role: "therapist", content: "Dejar tu país y las personas que quieres es una de las experiencias más difíciles que alguien puede vivir. ¿Cuánto tiempo llevas en Chile?" },
          { role: "patient", content: "Dos años. Pero a veces siento que fue ayer." },
          { role: "therapist", content: "¿Cómo ha sido la experiencia de adaptarte? ¿Sientes que has podido construir vínculos acá, o todo se siente temporal?" },
        ],
        explanation: "El terapeuta reconoce la dimensión migratoria como factor central. No patologiza la tristeza sino que la contextualiza en una experiencia vital significativa.",
        tip: "Con pacientes migrantes, explora: duelo migratorio, red de apoyo actual, experiencias de discriminación, y sueño de retorno.",
      },
      {
        id: "ctx-5",
        title: "Explorar contexto económico con sensibilidad",
        context: "Paciente de 48 años que parece angustiado pero evita hablar de dinero.",
        dialogue: [
          { role: "patient", content: "No puedo dormir. Estoy muy preocupado. [Se frota las manos]" },
          { role: "therapist", content: "Noto que algo te tiene muy inquieto. A veces las preocupaciones más pesadas son las que nos cuesta más nombrar." },
          { role: "patient", content: "[Silencio largo] Tengo deudas. Muchas. Y no sé cómo decirle a mi familia." },
          { role: "therapist", content: "Cargar eso solo debe ser agotador. Gracias por confiar en mí con algo tan difícil. ¿Hace cuánto estás en esta situación?" },
        ],
        explanation: "El terapeuta crea espacio sin nombrar el tema directamente, permitiendo que el paciente lo revele a su ritmo. Responde con aceptación, no con juicio.",
        tip: "El contexto económico es uno de los más difíciles de abordar. No preguntes directamente por dinero — crea espacio y el paciente lo trae cuando confía.",
      },
    ],
  },

  {
    key: "objetivos",
    name: "Objetivos terapéuticos",
    emoji: "🎯",
    domain: "Estructura de la sesión",
    description:
      "Capacidad de construir objetivos terapéuticos DE FORMA COLABORATIVA con el paciente. No imponer metas sino co-construirlas, priorizarlas y revisarlas. Los objetivos dan dirección al proceso y permiten evaluar avances (Bordin, 1979 — alianza terapéutica).",
    examples: [
      {
        id: "obj-1",
        title: "Co-construir un primer objetivo",
        context: "Tercera sesión con un paciente de 33 años que tiene claro qué le duele pero no qué quiere lograr.",
        dialogue: [
          { role: "therapist", content: "Llevamos algunas sesiones y he podido conocer bastante de lo que te pasa. Me gustaría que pensemos juntos: si este proceso funcionara, ¿cómo se vería tu vida?" },
          { role: "patient", content: "No sé... supongo que quiero dejar de sentirme tan ansioso todo el tiempo." },
          { role: "therapist", content: "¿Y si en vez de 'dejar de sentir ansiedad' — que es difícil de medir — lo pensamos como: 'poder estar en situaciones sociales sin que la ansiedad me paralice'? ¿Eso se acerca?" },
          { role: "patient", content: "Sí, eso es exactamente lo que quiero. Poder ir a una reunión sin querer salir corriendo." },
        ],
        explanation: "El terapeuta transforma una meta difusa ('no sentirme ansioso') en un objetivo concreto y observable. Lo hace colaborativamente, no imponiéndolo.",
        tip: "Los buenos objetivos terapéuticos son concretos, observables y significativos para el paciente. Pregunta: '¿cómo sabrías que mejoraste?'",
      },
      {
        id: "obj-2",
        title: "Priorizar entre múltiples problemas",
        context: "Paciente de 40 años que llega con problemas de pareja, laborales, familiares y de salud.",
        dialogue: [
          { role: "patient", content: "Tengo tantos problemas que no sé por dónde empezar." },
          { role: "therapist", content: "Tienes razón, son varios frentes. Si tuvieras que elegir uno — el que más te quita el sueño — ¿cuál sería?" },
          { role: "patient", content: "Mi matrimonio. Si eso estuviera bien, creo que lo demás sería más manejable." },
          { role: "therapist", content: "Entonces empecemos por ahí. Y lo interesante es que a medida que trabajemos en tu matrimonio, probablemente vamos a tocar los otros temas también, porque están conectados." },
        ],
        explanation: "El terapeuta no intenta abordar todo a la vez. Le devuelve la agencia al paciente para priorizar y anticipa cómo los temas se entrelazan.",
        tip: "Cuando hay muchos problemas, priorizar es terapéutico en sí mismo. El paciente que elige su foco se siente con más control.",
      },
      {
        id: "obj-3",
        title: "Revisar y ajustar objetivos",
        context: "Sexta sesión. El paciente de 28 años empezó con un objetivo pero la terapia ha revelado algo más profundo.",
        dialogue: [
          { role: "therapist", content: "Cuando empezamos, dijiste que querías manejar mejor tu enojo. Después de estas sesiones, ¿sientes que ese sigue siendo el foco, o ha cambiado algo?" },
          { role: "patient", content: "Creo que el enojo es la punta del iceberg. Lo que realmente me duele es sentirme solo. Me enojo porque no sé pedir ayuda." },
          { role: "therapist", content: "Eso es un descubrimiento muy valioso. ¿Te parece si ajustamos nuestro trabajo hacia eso: aprender a pedir lo que necesitas sin que el enojo sea el único camino?" },
          { role: "patient", content: "Sí. Eso tiene mucho más sentido." },
        ],
        explanation: "El terapeuta demuestra flexibilidad al revisar los objetivos a la luz de lo que ha emergido en el proceso. Los objetivos no son estáticos.",
        tip: "Revisa objetivos cada 4-6 sesiones. El proceso terapéutico revela lo que la evaluación inicial no puede ver.",
      },
      {
        id: "obj-4",
        title: "Objetivos cuando el paciente 'no quiere nada'",
        context: "Adolescente de 16 años que fue traído por sus padres y dice que no necesita terapia.",
        dialogue: [
          { role: "patient", content: "Yo no quiero estar aquí. No tengo ningún objetivo." },
          { role: "therapist", content: "Eso es justo. No puedo obligarte a querer algo. Pero si tuvieras que estar acá — que parece que es el caso — ¿hay algo que te gustaría que fuera diferente en tu vida?" },
          { role: "patient", content: "[Pausa larga] Que mis papás dejaran de pelear." },
          { role: "therapist", content: "Eso no depende de ti, y debe ser muy difícil vivirlo. ¿Y si trabajamos en cómo tú puedes estar mejor en medio de eso? Eso sí depende de nosotros." },
        ],
        explanation: "El terapeuta no fuerza un objetivo. Acepta la resistencia, busca una motivación genuina, y reformula un deseo imposible en un objetivo viable.",
        tip: "Con adolescentes resistentes: no compitas. Acepta su posición, encuentra una grieta de motivación genuina, y trabaja desde ahí.",
      },
      {
        id: "obj-5",
        title: "Formular objetivos en lenguaje positivo",
        context: "Paciente de 52 años que formula todos sus deseos en negativo.",
        dialogue: [
          { role: "patient", content: "Quiero dejar de ser tan cobarde. Quiero dejar de huir de todo." },
          { role: "therapist", content: "Escucho lo que no quieres. Me pregunto: si no estuvieras huyendo, ¿qué estarías haciendo?" },
          { role: "patient", content: "[Piensa] Supongo que estaría diciendo lo que pienso. Enfrentando las conversaciones difíciles." },
          { role: "therapist", content: "Entonces nuestro objetivo podría ser: que puedas expresar lo que piensas y necesitas, especialmente en las situaciones que hoy evitas. ¿Cómo suena?" },
        ],
        explanation: "El terapeuta transforma objetivos en negativo ('dejar de') en positivo ('poder hacer'). Esto da dirección concreta y motivadora al trabajo.",
        tip: "Cuando el paciente dice 'quiero dejar de...', pregunta '¿y en su lugar, qué te gustaría hacer?' Los objetivos en positivo son más motivadores y medibles.",
      },
    ],
  },

  // ═══════════════════════════════════════════
  // DOMINIO 2 — ACTITUDES TERAPÉUTICAS
  // ═══════════════════════════════════════════

  {
    key: "escucha_activa",
    name: "Escucha activa",
    emoji: "👂",
    domain: "Actitudes terapéuticas",
    description:
      "Atención coherente a la comunicación verbal y no verbal del paciente, respondiendo en congruencia. Implica escuchar lo que se dice, cómo se dice, y lo que no se dice. Incluye reflejos, paráfrasis y señalamientos (Rogers, 1957; Ivey & Ivey, 2007).",
    examples: [
      {
        id: "esc-1",
        title: "Captar lo que no se dice",
        context: "Paciente de 35 años que habla rápido y con sonrisa sobre su divorcio.",
        dialogue: [
          { role: "patient", content: "[Sonriendo] Sí, fue lo mejor que pudimos hacer. Estamos todos mejor así. Los niños están bien, yo estoy bien, todo bien. [Ríe]" },
          { role: "therapist", content: "Noto que sonríes mucho al hablar de esto. Y al mismo tiempo, 'todo bien' lo repites varias veces. ¿Realmente todo está bien, o hay algo debajo de esa sonrisa?" },
          { role: "patient", content: "[La sonrisa se desvanece] La verdad... las noches son muy difíciles." },
          { role: "therapist", content: "Ahí está. Las noches. Cuéntame cómo son." },
        ],
        explanation: "El terapeuta escucha la incongruencia entre el contenido verbal (todo bien) y el no verbal (sonrisa forzada, repetición). Señala la discrepancia con cuidado.",
        tip: "Cuando el contenido verbal y el no verbal no coinciden, confía en el no verbal. Señálalo con curiosidad, no con confrontación.",
      },
      {
        id: "esc-2",
        title: "Reflejar el tono emocional",
        context: "Paciente de 60 años que habla de su jubilación con un tono que no coincide con sus palabras.",
        dialogue: [
          { role: "patient", content: "Ahora tengo todo el tiempo del mundo. Puedo hacer lo que quiera. Viajar, leer... [voz se apaga]" },
          { role: "therapist", content: "Las palabras suenan a libertad, pero tu voz suena a vacío." },
          { role: "patient", content: "[Silencio largo] Sí. Es un vacío enorme. No sé quién soy si no soy el ingeniero." },
          { role: "therapist", content: "Tu identidad estuvo ligada al trabajo durante décadas. Soltar eso no es jubilarse — es una pérdida." },
        ],
        explanation: "El terapeuta no se queda con el contenido literal. Refleja el tono emocional y nombra lo que realmente está pasando: una crisis de identidad.",
        tip: "Escucha el tono, no solo las palabras. Un paciente puede decir 'estoy bien' con voz de derrota — el tono es más honesto.",
      },
      {
        id: "esc-3",
        title: "Atender a las omisiones",
        context: "Paciente de 25 años que habla mucho de su trabajo y amigos pero nunca menciona a su familia.",
        dialogue: [
          { role: "therapist", content: "Me he dado cuenta de algo. En estas semanas me has contado de tu trabajo, tus amigos, tus proyectos. Pero nunca mencionas a tu familia. ¿Hay algo ahí?" },
          { role: "patient", content: "[Pausa] No hablo de eso." },
          { role: "therapist", content: "Y eso está bien. Solo quiero que sepas que noté la ausencia. Cuando estés listo, si quieres, ese espacio está disponible." },
          { role: "patient", content: "Gracias. Creo que en algún momento voy a tener que hablar de eso." },
        ],
        explanation: "El terapeuta escucha lo que NO se dice. Las omisiones sistemáticas son tan informativas como lo que sí se comparte. Lo señala sin presionar.",
        tip: "Lleva un mapa mental de lo que el paciente habla y lo que evita. Las omisiones consistentes señalan zonas de dolor o conflicto.",
      },
      {
        id: "esc-4",
        title: "Escuchar el ritmo y las pausas",
        context: "Paciente de 40 años que se detiene justo antes de decir algo importante.",
        dialogue: [
          { role: "patient", content: "Y entonces yo... [pausa]... nada, no importa." },
          { role: "therapist", content: "Justo ahí te detuviste. Algo iba a salir y lo frenaste. ¿Qué pasó?" },
          { role: "patient", content: "Es que si lo digo, se vuelve real." },
          { role: "therapist", content: "Entiendo ese miedo. A veces nombrar algo le da una existencia que asusta. ¿Quieres intentarlo? Aquí es un espacio seguro para que las cosas sean reales." },
        ],
        explanation: "El terapeuta escucha la pausa como comunicación. No la llena ni la ignora — la señala como un momento significativo.",
        tip: "Las pausas, los 'nada', los cambios de tema abruptos son puertas. No las ignores ni las fuerces — señálalas con curiosidad.",
      },
      {
        id: "esc-5",
        title: "Parafrasear para verificar comprensión",
        context: "Paciente de 50 años que cuenta una historia compleja sobre un conflicto familiar.",
        dialogue: [
          { role: "patient", content: "Mi hermana me dijo que mi mamá le dejó la casa a ella. Y mi otro hermano dice que es mentira. Y mi mamá no dice nada. Y yo estoy en el medio tratando de que no se peleen." },
          { role: "therapist", content: "Si entiendo bien: hay un conflicto por la herencia, tu hermana dice una cosa, tu hermano otra, tu mamá guarda silencio, y tú estás cargando con el rol de mediador entre todos." },
          { role: "patient", content: "Exacto. Y nadie me pregunta cómo estoy yo con todo esto." },
          { role: "therapist", content: "Y eso es lo que más duele: que en medio de resolver el problema de todos, nadie te ve a ti." },
        ],
        explanation: "La paráfrasis ordena la información y le devuelve al paciente una versión organizada de su propio relato. Esto valida y permite profundizar.",
        tip: "Parafrasea después de historias complejas. No es repetir — es organizar y devolver con comprensión.",
      },
    ],
  },

  {
    key: "actitud_no_valorativa",
    name: "Actitud no valorativa",
    emoji: "🫶",
    domain: "Actitudes terapéuticas",
    description:
      "Aceptación incondicional del paciente sin emitir juicios explícitos ni implícitos. No significa aprobar todo, sino crear un espacio donde el paciente pueda explorar sin miedo al rechazo. Es la base de la relación terapéutica segura (Rogers, 1957; Linehan, 1993).",
    examples: [
      {
        id: "nov-1",
        title: "Recibir una confesión difícil sin juzgar",
        context: "Paciente de 38 años que confiesa haber sido infiel a su pareja.",
        dialogue: [
          { role: "patient", content: "Le fui infiel a mi esposa. Sé que soy un desgraciado. Seguro usted también piensa eso." },
          { role: "therapist", content: "Lo que pienso es que estás cargando algo que te pesa mucho, y que tuviste la valentía de traerlo aquí. No estoy aquí para juzgarte, estoy aquí para entender qué te llevó a eso." },
          { role: "patient", content: "Es que todo el mundo me va a odiar cuando se sepa." },
          { role: "therapist", content: "Ese miedo al juicio de los demás... ¿será que te estás juzgando tú más duro que nadie?" },
        ],
        explanation: "El terapeuta no aprueba ni condena. Recibe la confesión sin juicio visible, redirige hacia la comprensión y señala la auto-condena del paciente.",
        tip: "Tu cara, tu tono, tus microexpresiones — todo comunica. Practica la neutralidad no solo en palabras sino en todo tu ser.",
      },
      {
        id: "nov-2",
        title: "No juzgar decisiones que no compartes",
        context: "Paciente de 22 años que decide volver con una pareja que la maltrataba.",
        dialogue: [
          { role: "patient", content: "Volví con Andrés. Ya sé lo que me va a decir..." },
          { role: "therapist", content: "¿Qué crees que te voy a decir?" },
          { role: "patient", content: "Que soy tonta. Que no debería haber vuelto." },
          { role: "therapist", content: "No voy a decirte eso. Tomaste una decisión y tuviste razones para hacerlo. Lo que me importa es entender qué necesidad te llevó de vuelta, y cómo podemos cuidarte en esta situación." },
        ],
        explanation: "El terapeuta no impone su opinión sobre una decisión riesgosa. Mantiene la alianza, explora la necesidad subyacente y se enfoca en la seguridad.",
        tip: "Juzgar una decisión del paciente rompe la alianza. Explorar QUÉ lo llevó a tomarla es mucho más terapéutico.",
      },
      {
        id: "nov-3",
        title: "Aceptar emociones socialmente inaceptables",
        context: "Paciente de 30 años que confiesa sentir odio hacia su hijo recién nacido.",
        dialogue: [
          { role: "patient", content: "[Llorando] A veces miro a mi bebé y siento... odio. Soy un monstruo." },
          { role: "therapist", content: "Puedo ver cuánto te duele sentir eso. Y quiero que sepas que lo que describes tiene nombre y es más común de lo que imaginas. No te hace monstruo — te hace humana pasando por algo muy difícil." },
          { role: "patient", content: "¿En serio? ¿Otras personas sienten esto?" },
          { role: "therapist", content: "Sí. Y el hecho de que te duela tanto sentirlo me dice lo mucho que te importa tu hijo." },
        ],
        explanation: "El terapeuta recibe una emoción tabú con normalización y compasión. No minimiza ni patologiza. Señala que el dolor por la emoción evidencia amor.",
        tip: "Las emociones 'prohibidas' son las que más necesitan espacio terapéutico. Si el paciente se atreve a decirlas, tu reacción define si volverá a abrirse.",
      },
      {
        id: "nov-4",
        title: "Evitar juicios implícitos en el lenguaje",
        context: "Paciente de 45 años que lleva 3 meses sin buscar trabajo.",
        dialogue: [
          { role: "patient", content: "No he buscado trabajo todavía. Sé que debería, pero no puedo." },
          { role: "therapist", content: "¿Qué sientes cuando piensas en buscar trabajo?" },
          { role: "patient", content: "Terror. Miedo a que me rechacen otra vez." },
          { role: "therapist", content: "Entonces no es que no puedas — es que el miedo al rechazo te paraliza. Tiene mucho sentido después de lo que viviste." },
        ],
        explanation: "El terapeuta evita 'pero ya llevas 3 meses' o '¿no crees que ya es hora?' Estos serían juicios implícitos. En su lugar, explora la emoción detrás de la inacción.",
        tip: "Cuidado con los 'pero', los 'ya', los '¿no crees que...?' — son juicios disfrazados de preguntas.",
      },
      {
        id: "nov-5",
        title: "Suspender el juicio ante valores diferentes",
        context: "Paciente de 55 años con creencias religiosas muy firmes que chocan con las del terapeuta.",
        dialogue: [
          { role: "patient", content: "Yo sé que Dios me está castigando. Por eso me enfermé." },
          { role: "therapist", content: "Tu fe es una parte importante de quien eres. Cuéntame más: ¿por qué crees que Dios te castigaría?" },
          { role: "patient", content: "Porque cuando joven hice cosas que no debía. Y ahora lo estoy pagando." },
          { role: "therapist", content: "Cargas mucha culpa. Y esa culpa se ha convertido en una forma de explicar tu enfermedad. Me pregunto si hay espacio en tu fe para el perdón también." },
        ],
        explanation: "El terapeuta no cuestiona la creencia religiosa ni intenta corregirla. La usa como puente para explorar la culpa y abre la posibilidad de una lectura diferente dentro del mismo marco del paciente.",
        tip: "No necesitas compartir los valores del paciente para trabajar con ellos. Usa su marco de referencia, no el tuyo.",
      },
    ],
  },

  {
    key: "optimismo",
    name: "Optimismo terapéutico",
    emoji: "🌱",
    domain: "Actitudes terapéuticas",
    description:
      "Transmisión proactiva de esperanza y optimismo integrado con intervenciones técnicas. No es un optimismo ingenuo sino la convicción genuina de que el cambio es posible, comunicada a través de la actitud del terapeuta (Frank & Frank, 1991; Snyder, 2000).",
    examples: [
      {
        id: "opt-1",
        title: "Transmitir esperanza sin minimizar",
        context: "Paciente de 40 años con depresión severa que dice no ver salida.",
        dialogue: [
          { role: "patient", content: "Esto no va a cambiar nunca. Llevo años así." },
          { role: "therapist", content: "Entiendo que se siente así. Y no voy a decirte que es fácil, porque no lo es. Pero lo que sí puedo decirte es que he visto personas en situaciones tan difíciles como la tuya encontrar formas de estar mejor. Y creo que tú también puedes." },
          { role: "patient", content: "¿Por qué cree eso?" },
          { role: "therapist", content: "Porque alguien que 'no puede nada' no se sienta en esta silla cada semana. Eso requiere algo que todavía está vivo en ti." },
        ],
        explanation: "El terapeuta no niega el dolor. Ofrece esperanza basada en evidencia concreta (el hecho de que el paciente sigue viniendo) en vez de frases vacías.",
        tip: "El optimismo terapéutico no es 'todo va a estar bien'. Es 'veo en ti algo que me dice que el cambio es posible, y te voy a mostrar por qué'.",
      },
      {
        id: "opt-2",
        title: "Destacar avances que el paciente no ve",
        context: "Paciente de 28 años que siente que no ha progresado en terapia.",
        dialogue: [
          { role: "patient", content: "Siento que no avanzo. Sigo con los mismos problemas." },
          { role: "therapist", content: "¿Puedo compartir algo que observo? Hace dos meses, cuando hablabas de tu padre, cambiabas de tema inmediatamente. Hoy llevas 20 minutos explorando eso. Eso es un avance enorme." },
          { role: "patient", content: "No lo había pensado así." },
          { role: "therapist", content: "A veces el cambio es tan gradual que no lo ves desde adentro. Pero desde aquí, te veo distinto a como llegaste." },
        ],
        explanation: "El terapeuta actúa como espejo de progreso. Señala cambios concretos que el paciente no puede ver desde su perspectiva.",
        tip: "Lleva registro mental de cómo el paciente estaba al inicio. Poder señalar cambios específicos es una herramienta poderosa de esperanza.",
      },
      {
        id: "opt-3",
        title: "Reencuadrar la recaída como parte del proceso",
        context: "Paciente de 35 años con adicción que recayó después de 3 meses limpio.",
        dialogue: [
          { role: "patient", content: "Recaí. Todo el trabajo se fue a la basura." },
          { role: "therapist", content: "Entiendo la frustración. Pero quiero preguntarte: ¿la recaída duró lo mismo que antes? ¿Volviste al mismo punto?" },
          { role: "patient", content: "No... fue solo un fin de semana. Antes eran meses." },
          { role: "therapist", content: "Entonces no se fue a la basura. Tu cerebro aprendió algo. Recaer después de 3 meses y detenerte en un fin de semana es radicalmente distinto. El proceso no es lineal, pero sí está avanzando." },
        ],
        explanation: "El terapeuta no minimiza la recaída pero la contextualiza dentro de un proceso de cambio. Muestra que incluso en la recaída hay evidencia de progreso.",
        tip: "Las recaídas son parte del cambio, no el fin del cambio. Compáralas con episodios anteriores para mostrar evolución.",
      },
      {
        id: "opt-4",
        title: "Sembrar semillas de posibilidad",
        context: "Paciente de 50 años que dice que ya es muy tarde para cambiar.",
        dialogue: [
          { role: "patient", content: "Tengo 50 años. Ya soy así. No voy a cambiar a esta edad." },
          { role: "therapist", content: "¿Sabes algo interesante? El cerebro sigue creando conexiones nuevas toda la vida. Neuroplasticidad, le llaman. No hay fecha de vencimiento para aprender a estar mejor." },
          { role: "patient", content: "¿En serio?" },
          { role: "therapist", content: "En serio. Y te voy a decir algo más: el hecho de que a los 50 años te plantees hacer algo diferente me dice que todavía hay mucho fuego adentro." },
        ],
        explanation: "El terapeuta usa psicoeducación (neuroplasticidad) para desafiar una creencia limitante, y luego valida el coraje del paciente.",
        tip: "Pequeñas dosis de psicoeducación pueden desafiar creencias fijas. Usa datos reales para alimentar la esperanza.",
      },
      {
        id: "opt-5",
        title: "Optimismo en sesiones difíciles",
        context: "Sesión donde el paciente lloró durante casi toda la hora y se siente derrotado.",
        dialogue: [
          { role: "patient", content: "[Secándose las lágrimas] Perdón por todo el llanto. Siento que fue una sesión perdida." },
          { role: "therapist", content: "Fue una sesión donde dejaste salir lo que llevabas conteniendo. Eso no es una sesión perdida — es una sesión valiente. A veces el trabajo más importante no tiene palabras bonitas, tiene lágrimas." },
          { role: "patient", content: "¿No le parece que llorar toda la sesión es un retroceso?" },
          { role: "therapist", content: "Al contrario. Significa que este espacio se siente lo suficientemente seguro para que te permitas ser vulnerable. Eso es un logro, no un retroceso." },
        ],
        explanation: "El terapeuta reencuadra la experiencia emocional intensa como signo de progreso y seguridad en la alianza, no como fracaso.",
        tip: "Nunca te disculpes por una sesión emocional ni dejes que el paciente la vea como fallida. El llanto es trabajo terapéutico.",
      },
    ],
  },

  {
    key: "presencia",
    name: "Presencia terapéutica",
    emoji: "🧘",
    domain: "Actitudes terapéuticas",
    description:
      "Atención sostenida, flexibilidad y sintonía con el paciente momento a momento. Estar plenamente presente — no en automático, no pensando en la siguiente intervención, sino genuinamente con el otro (Geller & Greenberg, 2012).",
    examples: [
      {
        id: "pre-1",
        title: "Estar presente en el silencio",
        context: "Paciente de 45 años que se queda en silencio después de compartir algo doloroso.",
        dialogue: [
          { role: "patient", content: "Fue la última vez que vi a mi hijo. [Silencio prolongado, mira al suelo]" },
          { role: "therapist", content: "[Silencio. Permanece en contacto visual suave, postura abierta, respira con calma]" },
          { role: "patient", content: "[Después de 30 segundos] Gracias por no decir nada. A veces solo necesito que alguien esté ahí." },
          { role: "therapist", content: "Aquí estoy." },
        ],
        explanation: "El terapeuta resiste el impulso de llenar el silencio. Su presencia física y emocional comunica más que cualquier palabra.",
        tip: "El silencio compartido con presencia es una de las intervenciones más poderosas. No lo llenes por incomodidad propia.",
      },
      {
        id: "pre-2",
        title: "Notar un cambio sutil en el paciente",
        context: "Paciente de 30 años que cambia sutilmente su postura cuando se menciona un tema.",
        dialogue: [
          { role: "therapist", content: "¿Y cómo va la relación con tu hermano?" },
          { role: "patient", content: "[Cruza los brazos, mira hacia otro lado] Bien. Normal." },
          { role: "therapist", content: "Noté algo. Cuando mencioné a tu hermano, cruzaste los brazos y dejaste de mirarme. ¿Qué pasó ahí?" },
          { role: "patient", content: "[Suspira] La verdad es que no nos hablamos hace seis meses." },
        ],
        explanation: "La presencia permite captar microseñales corporales que contradicen el mensaje verbal. El terapeuta está tan sintonizado que nota un cambio en milisegundos.",
        tip: "Entrena tu atención a lo corporal: brazos, mirada, postura, respiración. El cuerpo habla antes que las palabras.",
      },
      {
        id: "pre-3",
        title: "Flexibilidad ante lo inesperado",
        context: "El terapeuta tenía un plan para la sesión pero el paciente llega en crisis.",
        dialogue: [
          { role: "patient", content: "[Llega agitado] Me echaron del trabajo. Hoy. Hace una hora." },
          { role: "therapist", content: "Respira. Estás aquí. Cuéntame qué pasó." },
          { role: "patient", content: "No sé qué voy a hacer. Tengo familia que alimentar." },
          { role: "therapist", content: "Lo que tenía pensado para hoy puede esperar. Esto es lo que necesitas ahora. Estoy contigo." },
        ],
        explanation: "El terapeuta abandona su plan de sesión para responder a la necesidad inmediata. La presencia es también flexibilidad — adaptarse al momento.",
        tip: "Tener un plan de sesión es bueno. Poder soltarlo cuando el paciente necesita otra cosa es mejor.",
      },
      {
        id: "pre-4",
        title: "Reconocer cuando no estás presente",
        context: "El terapeuta nota que se distrajo mentalmente durante la sesión.",
        dialogue: [
          { role: "patient", content: "...y entonces fue cuando me di cuenta de que... ¿me está escuchando?" },
          { role: "therapist", content: "Tienes razón, me disculpo. Mi mente se fue por un momento. Lo que estabas diciendo es importante. ¿Puedes repetir lo último?" },
          { role: "patient", content: "Al menos es honesto. La mayoría hubiera fingido." },
          { role: "therapist", content: "Prefiero ser honesto contigo. Este espacio funciona con confianza." },
        ],
        explanation: "El terapeuta modela honestidad y reparación. Reconocer la falta de presencia fortalece la alianza más que fingir atención.",
        tip: "Si te distraes, reconócelo. La honestidad sobre tu propia humanidad construye más confianza que la perfección fingida.",
      },
      {
        id: "pre-5",
        title: "Sintonizar con el ritmo del paciente",
        context: "Paciente de 70 años que habla despacio y necesita más tiempo para procesar.",
        dialogue: [
          { role: "patient", content: "Es que... [pausa larga]... me cuesta... [otra pausa]... encontrar las palabras." },
          { role: "therapist", content: "[Habla más despacio, baja el ritmo] Tómate todo el tiempo que necesites. No hay apuro." },
          { role: "patient", content: "[Después de un silencio largo] Creo que lo que quiero decir es que me siento invisible." },
          { role: "therapist", content: "[Con calma] Invisible. Eso es una palabra que dice mucho. Aquí te veo." },
        ],
        explanation: "El terapeuta ajusta su propio ritmo al del paciente. No acelera, no completa frases. Permite que el proceso interno del paciente se despliegue.",
        tip: "Sintoniza tu ritmo verbal con el del paciente. Si habla despacio, tú hablas despacio. Si necesita pausas, tú respetas las pausas.",
      },
    ],
  },

  {
    key: "conducta_no_verbal",
    name: "Conducta no verbal",
    emoji: "🤲",
    domain: "Actitudes terapéuticas",
    description:
      "Atención a la comunicación no verbal del paciente (postura, gestos, expresión facial, tono de voz) e integración con lo que dice verbalmente. Incluye la conciencia de tu propia comunicación no verbal como terapeuta (Mehrabian, 1972; Knapp & Hall, 2010).",
    examples: [
      {
        id: "cnv-1",
        title: "Señalar incongruencia verbal/no verbal",
        context: "Paciente de 25 años que dice estar bien mientras se retuerce las manos.",
        dialogue: [
          { role: "patient", content: "[Retorciéndose las manos] Sí, todo está bien. Realmente no tengo mucho que decir hoy." },
          { role: "therapist", content: "Me dices que todo está bien, pero tus manos me dicen otra cosa. ¿Qué pasa?" },
          { role: "patient", content: "[Mira sus manos, sorprendida] Ni me había dado cuenta." },
          { role: "therapist", content: "A veces el cuerpo sabe antes que la mente. ¿Qué crees que tus manos están expresando?" },
        ],
        explanation: "El terapeuta usa la conducta no verbal como puerta de entrada al mundo emocional. No la interpreta — la devuelve al paciente para que la explore.",
        tip: "No interpretes la conducta no verbal ('estás nervioso'). Devuélvela: 'tus manos hacen esto, ¿qué crees que expresan?'",
      },
      {
        id: "cnv-2",
        title: "Usar tu propio lenguaje corporal como herramienta",
        context: "Paciente de 40 años muy agitado y hablando rápido.",
        dialogue: [
          { role: "patient", content: "[Hablando muy rápido, gesticulando] Y entonces le dije que no podía más y ella me dijo que yo siempre hago lo mismo y..." },
          { role: "therapist", content: "[Se recuesta ligeramente, baja las manos, habla más despacio] Puedo sentir la intensidad de lo que viviste. Antes de seguir, ¿puedes tomar una respiración profunda conmigo?" },
          { role: "patient", content: "[Respira] ...sí. Perdón, estoy muy acelerado." },
          { role: "therapist", content: "No hay nada que disculpar. Tu cuerpo está respondiendo a algo fuerte. Sigamos, pero con más calma." },
        ],
        explanation: "El terapeuta usa su propia calma corporal como regulador emocional. Su postura, ritmo y voz funcionan como ancla para el paciente agitado.",
        tip: "Tu cuerpo regula al paciente. Si quieres que se calme, tú cálmate primero. Los estados emocionales son contagiosos.",
      },
      {
        id: "cnv-3",
        title: "Atender al llanto contenido",
        context: "Paciente de 55 años cuya mandíbula tiembla pero lucha por no llorar.",
        dialogue: [
          { role: "patient", content: "[Mandíbula temblando, ojos vidriosos] Estoy bien. Siga, siga preguntando." },
          { role: "therapist", content: "Noto que tu mandíbula tiembla y tus ojos se humedecen. No tienes que estar 'bien' aquí." },
          { role: "patient", content: "[Las lágrimas empiezan a caer] Es que no quiero llorar..." },
          { role: "therapist", content: "¿Qué pasaría si te permites?" },
        ],
        explanation: "El terapeuta nombra lo que ve en el cuerpo del paciente con suavidad. No fuerza el llanto pero abre la puerta.",
        tip: "Nombrar lo que ves en el cuerpo del paciente le da permiso para sentirlo. 'Noto que...' es más poderoso que 'parece que estás triste'.",
      },
      {
        id: "cnv-4",
        title: "Leer el distanciamiento corporal",
        context: "Paciente de 18 años que se aleja físicamente cuando se toca un tema sensible.",
        dialogue: [
          { role: "therapist", content: "¿Y cómo es tu relación con tu padrastro?" },
          { role: "patient", content: "[Se cruza de brazos, se echa hacia atrás en la silla] Normal. No hay mucho que decir." },
          { role: "therapist", content: "Noté que cuando pregunté por tu padrastro, te echaste hacia atrás. Como poniendo distancia. No tienes que hablar de algo que no quieres, pero quiero que sepas que lo noté." },
          { role: "patient", content: "[Silencio largo] ...hay cosas que no le he contado a nadie." },
        ],
        explanation: "El terapeuta lee el distanciamiento como protección y lo nombra sin presionar. Esto crea seguridad para que el paciente revele lo que necesita.",
        tip: "Cuando un paciente se aleja físicamente, no avances — retrocede tú también. Dale espacio y nombra lo que ves.",
      },
      {
        id: "cnv-5",
        title: "Integrar lo verbal con lo no verbal",
        context: "Paciente de 35 años que dice haber perdonado a su ex pero su cuerpo dice otra cosa.",
        dialogue: [
          { role: "patient", content: "[Puños apretados] Ya lo perdoné. Totalmente. Estoy en paz." },
          { role: "therapist", content: "Me dices que lo perdonaste y al mismo tiempo tus puños están cerrados con fuerza. ¿Qué crees que está pasando?" },
          { role: "patient", content: "[Mira sus puños] ...tal vez no lo he perdonado tanto como creo." },
          { role: "therapist", content: "Y eso está bien. Perdonar no es un evento — es un proceso. Parece que una parte de ti ya quiere soltar y otra todavía tiene rabia legítima." },
        ],
        explanation: "El terapeuta integra contenido verbal y no verbal, señala la discrepancia y la normaliza como un proceso dual, no como una contradicción.",
        tip: "La integración verbal/no verbal no es atrapar al paciente en mentiras. Es ayudarlo a ver las partes de sí mismo que todavía no reconoce.",
      },
    ],
  },

  {
    key: "contencion_afectos",
    name: "Contención de afectos",
    emoji: "🫂",
    domain: "Actitudes terapéuticas",
    description:
      "Contención emocional del paciente con presencia, calidez, empatía y validación. Capacidad de sostener emociones intensas sin huir, minimizar, intelectualizar ni resolver prematuramente. Ser el 'envase' seguro para lo que el paciente siente (Bion, 1962; Winnicott, 1960).",
    examples: [
      {
        id: "con-1",
        title: "Sostener el llanto sin intervenir",
        context: "Paciente de 50 años que rompe en llanto intenso al hablar de su madre fallecida.",
        dialogue: [
          { role: "patient", content: "[Llanto intenso, se cubre la cara] Perdón... perdón..." },
          { role: "therapist", content: "[Silencio cálido. Ofrece pañuelos sin prisa. Mantiene contacto visual suave cuando el paciente mira]" },
          { role: "patient", content: "[Después de 2 minutos] Nadie me ha dejado llorar así. Siempre me dicen que me calme." },
          { role: "therapist", content: "Aquí no tienes que calmarte. Aquí puedes sentir lo que necesites sentir." },
        ],
        explanation: "El terapeuta contiene sin llenar el espacio. No dice 'cálmate', no interpreta, no ofrece pañuelos insistentemente. Simplemente está, sosteniendo.",
        tip: "Cuando el paciente llora, quédate. No ofrezcas soluciones, no cambies de tema, no digas 'ya pasó'. Sostén el momento.",
      },
      {
        id: "con-2",
        title: "Contener rabia sin dejarse llevar",
        context: "Paciente de 30 años que expresa rabia intensa hacia su padre abusivo.",
        dialogue: [
          { role: "patient", content: "[Gritando] ¡Lo odio! ¡Ojalá se muera! ¿Sabe lo que nos hacía? ¡No tiene derecho a estar vivo!" },
          { role: "therapist", content: "[Con voz firme pero calmada] Escucho tu rabia. Es enorme. Y tiene todo el derecho de existir." },
          { role: "patient", content: "¿No le da miedo que diga estas cosas?" },
          { role: "therapist", content: "No. La rabia que sientes es proporcional al daño que viviste. Aquí puedes expresarla sin que nadie te castigue por sentirla." },
        ],
        explanation: "El terapeuta no se asusta ante la intensidad emocional. No intenta calmar ni redirigir. Valida la rabia como respuesta legítima al trauma.",
        tip: "La rabia asusta a muchos terapeutas. Pero huir de ella es decirle al paciente que sus emociones son demasiado. Quédate firme.",
      },
      {
        id: "con-3",
        title: "Contener ansiedad desbordante",
        context: "Paciente de 25 años en pleno ataque de pánico en sesión.",
        dialogue: [
          { role: "patient", content: "[Hiperventilando] No puedo respirar... me voy a morir... [se agarra el pecho]" },
          { role: "therapist", content: "[Voz lenta y firme] Estás aquí conmigo. Esto va a pasar. Mira mis ojos. Vamos a respirar juntos. Inhala... 2, 3, 4... Exhala... 2, 3, 4, 5, 6." },
          { role: "patient", content: "[Respiración se va normalizando] ...me asusté mucho." },
          { role: "therapist", content: "Lo sé. Y lo manejaste. Estuviste aquí, seguiste mis instrucciones, y tu cuerpo te respondió. Eres más fuerte de lo que crees." },
        ],
        explanation: "El terapeuta actúa como regulador externo durante la crisis. Usa su propia calma, instrucciones concretas y presencia física para contener la ansiedad.",
        tip: "En crisis de pánico: voz lenta, instrucciones concretas, contacto visual. Tú eres el ancla del paciente. Si tú te calmas, él se calma.",
      },
      {
        id: "con-4",
        title: "No huir de la desesperanza",
        context: "Paciente de 60 años con enfermedad terminal que dice que ya no tiene sentido vivir.",
        dialogue: [
          { role: "patient", content: "¿Para qué seguir? Ya me dieron 6 meses. No tiene sentido nada." },
          { role: "therapist", content: "[Pausa] Eso que sientes es real. No voy a decirte que busques el lado positivo ni que pienses en los demás. Tienes derecho a sentir que nada tiene sentido." },
          { role: "patient", content: "¿No va a tratar de convencerme de que la vida es bella?" },
          { role: "therapist", content: "No. Voy a estar aquí contigo en lo que sea que sientas. Incluso si es desesperanza. Porque incluso en eso, no tienes que estar solo." },
        ],
        explanation: "El terapeuta no huye de la desesperanza con optimismo forzado. Acompaña en el dolor existencial sin tratar de arreglarlo.",
        tip: "Hay dolor que no se resuelve. En esos casos, tu rol no es arreglar — es acompañar. La presencia es la intervención.",
      },
      {
        id: "con-5",
        title: "Contener la confusión emocional",
        context: "Paciente de 22 años que no sabe qué siente y se frustra por eso.",
        dialogue: [
          { role: "patient", content: "No sé qué siento. Estoy enojada, triste, aliviada... todo junto. No tiene sentido." },
          { role: "therapist", content: "Y encima te frustras por no poder ordenar lo que sientes. Eso es mucho." },
          { role: "patient", content: "¿Cómo puedo sentir todo eso al mismo tiempo? Soy un desastre." },
          { role: "therapist", content: "No eres un desastre. Eres una persona compleja viviendo algo complejo. No todo tiene que tener sentido ahora. A veces el primer paso es permitirte la confusión." },
        ],
        explanation: "El terapeuta contiene la confusión sin intentar organizarla prematuramente. Normaliza la experiencia de sentir múltiples emociones simultáneas.",
        tip: "No apures la claridad emocional. A veces contener es dejar que la confusión exista hasta que el paciente esté listo para diferenciar lo que siente.",
      },
    ],
  },
];
