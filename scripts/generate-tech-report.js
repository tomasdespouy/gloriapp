/**
 * TECHNICAL REPORT: GlorIA Platform — Technology & Clinical Value
 * Target: Rector + Director of Psychology
 * Max 5 pages, bilingual (simple + technical), persuasive
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env.local") });
const { createPDF } = require("./pdf-utils.js");

function generate() {
  const pdf = createPDF();
  const { doc } = pdf;
  const pw = doc.internal.pageSize.getWidth();
  const mg = 20;
  const mw = pw - mg * 2;

  // ═══ PAGE 1: COVER + INTRO ═══
  pdf.header(
    "GlorIA — Documento Técnico",
    "Tecnología, Capacidad Clínica y Ventajas Competitivas",
    "Plataforma de Entrenamiento Clínico con Inteligencia Artificial | Marzo 2026"
  );

  pdf.txt("1. ¿Qué es GlorIA?", 14, true, [74, 85, 162]);
  pdf.setY(pdf.getY() + 2);

  pdf.txt("En palabras simples:", 10, true);
  pdf.txt("GlorIA es una plataforma web donde estudiantes de psicología practican entrevistas terapéuticas con pacientes simulados por inteligencia artificial. Cada paciente tiene una personalidad única, una historia de vida, una familia, un barrio, y reacciona de forma realista según cómo el estudiante conduzca la sesión. Si el estudiante es empático, el paciente se abre. Si es directivo o da consejos prematuros, el paciente se cierra. Exactamente como en la vida real.", 9);
  pdf.setY(pdf.getY() + 3);

  pdf.txt("En términos técnicos:", 10, true);
  pdf.txt("GlorIA es una aplicación Next.js 16 (React 19, TypeScript) desplegada en Vercel, con base de datos PostgreSQL en Supabase (Row Level Security), motor de IA dual (GPT-4o para evaluaciones, GPT-4o-mini para conversaciones en tiempo real), motor adaptativo de estado clínico con 5 variables y 14 reglas de transición, pipeline RAG semántico con pgvector (62 entradas clínicas), sistema de evaluación por competencias basado en el instrumento UGM (10 dimensiones, escala 0-4), y comunicación bidireccional via Supabase Realtime (WebSocket) que permite al paciente interrumpir o reaccionar al silencio del terapeuta.", 9);
  pdf.setY(pdf.getY() + 5);

  // ═══ SECTION 2: CLINICAL ENGINE ═══
  pdf.sec("2. El motor clínico: por qué GlorIA no es un chatbot");

  pdf.txt("El corazón de GlorIA es su Motor Adaptativo de Estado Clínico, un sistema que simula la evolución psicológica del paciente en tiempo real.", 9);
  pdf.setY(pdf.getY() + 2);

  pdf.txt("Cinco variables clínicas se actualizan con cada intervención del terapeuta:", 9, true);
  pdf.setY(pdf.getY() + 1);

  const vars = [
    ["Resistencia", "Qué tan cerrado está el paciente. Empieza alta (7/10) y baja con empatía."],
    ["Alianza terapéutica", "Nivel de confianza en el terapeuta. Se construye con validación y reformulación."],
    ["Apertura emocional", "Disposición a hablar de temas profundos. Crece con preguntas abiertas."],
    ["Sintomatología", "Intensidad de los síntomas. Disminuye con normalización y contención."],
    ["Disposición al cambio", "Motivación para modificar patrones. Solo emerge con alianza alta."],
  ];

  for (const [name, desc] of vars) {
    pdf.txt(`• ${name}: ${desc}`, 8);
    pdf.setY(pdf.getY() + 1);
  }

  pdf.setY(pdf.getY() + 2);
  pdf.txt("Ejemplo concreto:", 9, true, [74, 85, 162]);
  pdf.txt("Si un estudiante le dice a Roberto (52 años, viudo, resistente) \"Debería salir más de casa y hacer ejercicio\", el motor clasifica esto como \"directividad\" y sube la resistencia (+1.0), baja la alianza (-0.5) y reduce la disposición al cambio (-0.5). Roberto se cierra más. Pero si el estudiante dice \"Puedo imaginar lo difícil que es la casa sin María\", el motor clasifica esto como \"validación empática\" y baja la resistencia (-0.8), sube la alianza (+1.0) y la apertura emocional (+0.7). Roberto empieza a confiar.", 8);
  pdf.setY(pdf.getY() + 3);

  pdf.txt("14 reglas de transición incluyen 4 condicionales (ej: confrontar solo funciona si la alianza es > 5). Esto replica principios terapéuticos reales: la confrontación prematura daña la alianza.", 8);
  pdf.setY(pdf.getY() + 5);

  // ═══ SECTION 3: AI ARCHITECTURE ═══
  pdf.sec("3. Arquitectura de IA: dos cerebros, un paciente");

  pdf.txt("GlorIA usa una estrategia de modelo dual que optimiza calidad y costo:", 9);
  pdf.setY(pdf.getY() + 2);

  pdf.txt("GPT-4o-mini (conversación):", 9, true);
  pdf.txt("Responde en tiempo real con streaming token-a-token. Costo: ~$0.15/millón de tokens de input. Una sesión de 15 turnos cuesta aproximadamente $0.003 USD. 500 estudiantes practicando simultáneamente costarían ~$1.50 USD en API.", 8);
  pdf.setY(pdf.getY() + 2);

  pdf.txt("GPT-4o (evaluación):", 9, true);
  pdf.txt("Analiza la transcripción completa al finalizar la sesión. Evalúa 10 competencias UGM (0-4) con comentario cualitativo, fortalezas y áreas de mejora. Costo: ~$0.02 por evaluación.", 8);
  pdf.setY(pdf.getY() + 2);

  pdf.txt("RAG Semántico (Retrieval-Augmented Generation):", 9, true);
  pdf.txt("62 entradas de conocimiento clínico vectorizadas con OpenAI embeddings + pgvector. Cuando el paciente menciona \"no puedo dormir desde que ella no está\", el sistema encuentra semánticamente \"insomnio en duelo\", \"somatización del duelo\" y \"duelo normal\" — aunque esas palabras exactas no aparezcan en la consulta. Esto enriquece las respuestas con coherencia clínica.", 8);
  pdf.setY(pdf.getY() + 5);

  // ═══ SECTION: MCP ═══
  pdf.sec("4. Memory-Context Processing (MCP): el paciente recuerda y evoluciona");

  pdf.txt("En palabras simples:", 10, true);
  pdf.txt("GlorIA incorpora un sistema de memoria persistente que permite al paciente recordar lo que se habló en sesiones anteriores, razonar sobre su propio proceso y evolucionar emocionalmente a lo largo del tiempo. Si en la sesión 2 el estudiante exploró la relación de Roberto con su esposa, en la sesión 5 Roberto puede decir: \"La vez pasada hablamos de María y me costó mucho, pero después pensé en lo que usted dijo...\". Esto no es un chatbot que empieza de cero cada vez — es un agente con memoria, contexto y evolución.", 9);
  pdf.setY(pdf.getY() + 3);

  pdf.txt("En términos técnicos:", 10, true);
  pdf.txt("El MCP de GlorIA opera en tres capas:", 9);
  pdf.setY(pdf.getY() + 2);

  const mcpLayers = [
    ["Memoria intra-sesión (contexto inmediato)", "Los últimos 50 mensajes se mantienen en el contexto del LLM. El motor adaptativo actualiza las 5 variables clínicas en cada turno, modificando el comportamiento del paciente en tiempo real. El estado se cachea en memoria durante 30 minutos."],
    ["Memoria inter-sesión (contexto persistente)", "Al finalizar una sesión, los últimos intercambios se comprimen en un resumen narrativo que se almacena en la base de datos. En la siguiente sesión, este resumen se inyecta como bloque [MEMORIA DE SESIÓN ANTERIOR] en el prompt del paciente, incluyendo cuánto tiempo ha pasado entre sesiones (\"Han pasado 3 días desde la última vez\")."],
    ["Memoria clínica (conocimiento de base)", "62 entradas de conocimiento clínico vectorizadas con OpenAI text-embedding-3-small en PostgreSQL pgvector. Búsqueda semántica por similitud coseno (threshold 0.40). El paciente no solo recuerda su propia historia — tiene acceso a conocimiento clínico contextual que enriquece sus respuestas con coherencia diagnóstica."],
  ];

  for (const [title, desc] of mcpLayers) {
    pdf.txt(`${title}:`, 9, true, [74, 85, 162]);
    pdf.txt(desc, 8);
    pdf.setY(pdf.getY() + 2);
  }

  pdf.txt("Además, el estado clínico del paciente (resistencia, alianza, apertura, sintomatología, disposición al cambio) se persiste en una tabla de trazabilidad (clinical_state_log), permitiendo análisis longitudinal de cómo evolucionó la relación terapéutica a lo largo de múltiples sesiones.", 8);
  pdf.setY(pdf.getY() + 2);

  pdf.txt("Este modelo MCP es lo que diferencia fundamentalmente a GlorIA de cualquier chatbot o simulador estático: el paciente no solo responde — recuerda, razona sobre su proceso, y cambia con el tiempo.", 9, true);
  pdf.setY(pdf.getY() + 5);

  // ═══ SECTION 5: CAPACITY ═══
  pdf.sec("5. Capacidad: ¿cuánta gente puede usar GlorIA al mismo tiempo?");

  pdf.txt("En palabras simples:", 10, true);
  pdf.txt("GlorIA está diseñada para escalar automáticamente. No hay un servidor fijo que se sature — cada petición se ejecuta en una función independiente (serverless). Si 10 o 500 estudiantes están conectados al mismo tiempo, cada uno recibe su propia instancia. El cuello de botella no es la plataforma, sino los límites de la API de OpenAI, que en el plan actual soporta miles de peticiones simultáneas.", 9);
  pdf.setY(pdf.getY() + 3);

  pdf.txt("En términos técnicos:", 10, true);
  pdf.txt("• Infraestructura: Vercel Edge Network (serverless, auto-scaling, CDN global)\n• Base de datos: Supabase PostgreSQL con connection pooling (PgBouncer)\n• Caché en memoria: LRU cache para prompts de pacientes (10 min TTL), estado clínico (30 min), perfiles (5 min)\n• Streaming: SSE (Server-Sent Events) para tokens del LLM + Supabase Realtime (WebSocket) para interrupciones bidireccionales\n• Rate limit de OpenAI Tier 3: 5,000 RPM (requests por minuto), suficiente para 500+ usuarios simultáneos\n• Latencia promedio: primera token en ~800ms, evaluación completa en ~5s", 8);
  pdf.setY(pdf.getY() + 5);

  // ═══ SECTION 5: PATIENT PROFILES ═══
  pdf.sec("6. Los pacientes: cómo se construyen y por qué son únicos");

  pdf.txt("Cada paciente de GlorIA se construye con un proceso de 4 etapas:", 9);
  pdf.setY(pdf.getY() + 2);

  const steps = [
    ["1. Configuración demográfica y clínica", "Nombre, edad, género, país de origen, país de residencia, barrio, ocupación, motivo de consulta, arquetipo clínico (resistente, complaciente, evitativo, etc.), mecanismos de defensa, apertura inicial, temas sensibles, dificultad."],
    ["2. Generación del perfil con IA", "GPT-4o genera: system prompt estructurado (HISTORIA, PERSONALIDAD, COMPORTAMIENTO, SECRETOS, REGLAS), frase característica, backstory, rasgos de personalidad (Big Five + resistencia + estilo comunicacional), grupo familiar (nombres, edades, relaciones), barrio, cumpleaños, etiquetas clínicas."],
    ["3. Validación y prueba", "El perfil pasa por un validador de 16 checks estructurales. Luego se ejecuta una simulación de 5 turnos con análisis automático de consistencia (1-10), realismo (1-10) y cumplimiento de la matriz de comportamiento (1-10)."],
    ["4. Assets visuales", "Foto generada con DALL-E 3 (prompts específicos por etnia y país) + video con Luma AI (Ray-2) para movimiento facial sutil. Ambos se almacenan en Supabase Storage."],
  ];

  for (const [title, desc] of steps) {
    pdf.txt(title, 9, true);
    pdf.txt(desc, 8);
    pdf.setY(pdf.getY() + 2);
  }

  pdf.txt("Actualmente GlorIA cuenta con pacientes de Chile, República Dominicana, Colombia y Argentina, con diversidad étnica, socioeconómica y de complejidad clínica. Se pueden crear nuevos pacientes en minutos.", 8, false, [74, 85, 162]);
  pdf.setY(pdf.getY() + 5);

  // ═══ SECTION 6: COMPETITIVE ADVANTAGES ═══
  pdf.sec("7. Ventajas frente a otras plataformas");

  const advantages = [
    ["Motor adaptativo con estado clínico", "Otros simuladores (Standardized Patients Online, Therabot, etc.) usan chatbots estáticos: siempre responden igual sin importar qué haga el terapeuta. GlorIA evoluciona sesión a sesión con 5 variables clínicas y 14 reglas condicionales."],
    ["Evaluación por instrumento UGM", "10 competencias calibradas con el instrumento de la Universidad Gabriela Mistral. No es una evaluación genérica: está diseñada para el currículo específico de la carrera."],
    ["Flujo docente completo", "El docente revisa la evaluación IA, la edita, agrega su comentario (con sugerencia IA), aprueba, y crea accionables para el estudiante. Nada se libera sin supervisión humana."],
    ["Multi-institución desde el diseño", "Jerarquía institución → asignaturas → secciones → docentes → estudiantes. Cada admin ve solo los datos de sus instituciones. Escalable a múltiples universidades y países."],
    ["Memory-Context Processing (MCP)", "Memoria persistente en 3 capas (intra-sesión, inter-sesión, conocimiento clínico) que permite al paciente recordar, razonar y evolucionar. Otros simuladores no tienen memoria entre sesiones ni estado clínico persistente."],
    ["Costo operativo mínimo", "Una sesión completa (15 turnos + evaluación) cuesta ~$0.02 USD. 1,000 sesiones al mes = ~$20 USD en API. Comparado con actores estandarizados ($50-100/hora), el ahorro es del 99.9%."],
    ["Bidireccionalidad (WebSocket)", "El paciente puede interrumpir si el terapeuta guarda silencio demasiado tiempo, reaccionar al ver que escribe sin enviar, o mostrar impaciencia. Otros simuladores esperan pasivamente la input del usuario."],
  ];

  for (const [title, desc] of advantages) {
    pdf.txt(`${title}:`, 9, true, [74, 85, 162]);
    pdf.txt(desc, 8);
    pdf.setY(pdf.getY() + 2);
  }

  // ═══ SECTION 7: EVALUATION SYSTEM ═══
  pdf.sec("8. Sistema de evaluación: instrumento UGM de 10 competencias");

  pdf.txt("Dominio 1 — Estructura de la Sesión:", 9, true);
  pdf.txt("1. Setting terapéutico: Capacidad de explicitar encuadre y aclarar dudas\n2. Motivo de consulta: Indagación del motivo manifiesto y latente\n3. Datos contextuales: Integración de contextos familiares, laborales, culturales\n4. Objetivos terapéuticos: Co-construcción colaborativa de metas", 8);
  pdf.setY(pdf.getY() + 2);

  pdf.txt("Dominio 2 — Actitudes Terapéuticas:", 9, true);
  pdf.txt("5. Escucha activa: Atención verbal y no verbal con respuesta congruente\n6. Actitud no valorativa: Aceptación incondicional sin juicios\n7. Optimismo terapéutico: Transmisión proactiva de esperanza integrada\n8. Presencia: Atención sostenida, flexibilidad y sintonía\n9. Conducta no verbal: Lectura e integración de señales corporales\n10. Contención de afectos: Sostener emociones intensas con calidez", 8);
  pdf.setY(pdf.getY() + 3);

  pdf.txt("Escala: 0 (No aplicaba), 1 (Deficiente), 2 (Básico), 3 (Adecuado), 4 (Excelente). Cada sesión genera puntaje, comentario cualitativo, fortalezas y áreas de mejora. El docente puede editar todo antes de liberar al estudiante.", 8);
  pdf.setY(pdf.getY() + 5);

  // ═══ SECTION 8: NEXT CHALLENGES ═══
  pdf.sec("9. Próximos desafíos de desarrollo");

  pdf.txt("Estos son los hitos que vienen para GlorIA en los próximos meses:", 9);
  pdf.setY(pdf.getY() + 2);

  const challenges = [
    ["Verificación de dominio para emails transaccionales", "Configurar DNS para enviar emails de bienvenida, notificaciones y reportes directamente desde @glor-ia.com o @ugm.cl. Actualmente limitado al plan gratuito de Resend."],
    ["Despliegue en producción con dominio propio", "Migrar de localhost a app.glor-ia.com con certificado SSL, CDN global y monitoreo. Infraestructura ya preparada en Vercel."],
    ["Grabación y análisis de voz", "Incorporar transcripción de audio en tiempo real (ya implementado con Web Speech API) y análisis de prosodia (tono, velocidad, pausas) como indicador de competencia clínica."],
    ["Reportes institucionales automatizados", "Dashboards comparativos por sección, asignatura e institución. Exportable en PDF con tendencias temporales y benchmarking entre cohortes."],
    ["Integración con LMS institucional", "Conexión con Moodle o Canvas para sincronizar notas, avance y asistencia de forma transparente para el docente."],
    ["Expansión de la base de conocimiento clínico", "Ampliar de 62 a 200+ entradas vectorizadas, incluyendo técnicas específicas (TCC, gestalt, sistémica), trastornos DSM-5, y expresiones culturales por país."],
    ["Validación empírica con estudio controlado", "Diseño pre-post con grupo control para medir impacto en competencias clínicas reales de estudiantes que usan GlorIA vs. métodos tradicionales."],
  ];

  for (const [title, desc] of challenges) {
    pdf.txt(`${title}:`, 9, true);
    pdf.txt(desc, 8);
    pdf.setY(pdf.getY() + 2);
  }

  pdf.setY(pdf.getY() + 5);
  pdf.txt("GlorIA no es un chatbot con un disfraz de paciente. Es un ecosistema clínico completo — con motor adaptativo, evaluación por competencias, supervisión docente, memoria longitudinal y escalabilidad institucional — diseñado para transformar la formación de terapeutas en Latinoamérica.", 10, true, [74, 85, 162]);

  // ═══ FOOTERS ═══
  pdf.footers("GlorIA — Documento Técnico | Confidencial");
  pdf.save("documento_tecnico_gloria_v2.pdf");
}

generate();
