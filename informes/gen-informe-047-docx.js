/**
 * INF-2026-047 .docx version — Caso Clínico GlorIA 1.0: Alejandro López
 * Misma estructura que el PDF (docs/gen-informe-047.py).
 */
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageBreak, LevelFormat, PageNumber
} = require("docx");

const gloriaLogo = fs.readFileSync("public/branding/gloria-logo.png");
const ugmLogo = fs.readFileSync("public/branding/ugm-logo.png");

// Colors
const INDIGO = "4A55A2";
const DARK = "1A1A1A";
const LIGHT_BG = "F0F2FA";
const CODE_BG = "F7F7F9";
const WHITE = "FFFFFF";
const GREY = "666666";
const ORANGE = "C25E00";
const BORDER = "CCCCCC";

const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: WHITE };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

const PAGE_W = 12240;
const MARGIN = 1440;
const CONTENT_W = PAGE_W - 2 * MARGIN;

// ─── Datos ──────────────────────────────────────────────────────
const ALEJANDRO = JSON.parse(fs.readFileSync("C:/tmp/gloria1-assistants.json","utf8"))["Alejandro López"];
const RESCUED = JSON.parse(fs.readFileSync("C:/Users/tomas/documents/gloria1-back/rescued-conversations.json","utf8"));
const JENNY = RESCUED.targets["thread_pS4MnekFPF1dCcVuu8kJmDTG"];
const PROMPT_LITERAL = ALEJANDRO.instructions;

const emojiMap = {
  "🎭":"[máscara]","🧍":"[persona]","🧬":"[ADN]","🚬":"[cigarrillo]",
  "🧑‍🎓":"[estudiante]","🧑‍👩‍👧":"[familia]","🧾":"[recibo]","🗣️":"[hablar]",
  "✅":"[check]","😊":"[:)]","😅":"[:'D]","🤔":"[pensativo]","😬":"[mueca]","🎉":"[fiesta]",
};
const PROMPT_LEGIBLE = Object.entries(emojiMap).reduce(
  (s,[k,v])=>s.split(k).join(v), PROMPT_LITERAL
);

// ─── Helpers ────────────────────────────────────────────────────
const h1 = (t) => new Paragraph({
  heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 },
  children: [new TextRun({ text: t, color: INDIGO, bold: true, size: 36, font: "Calibri" })]
});
const h2 = (t) => new Paragraph({
  heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 140 },
  children: [new TextRun({ text: t, color: INDIGO, bold: true, size: 28, font: "Calibri" })]
});
const h3 = (t) => new Paragraph({
  heading: HeadingLevel.HEADING_3, spacing: { before: 180, after: 100 },
  children: [new TextRun({ text: t, color: DARK, bold: true, size: 23, font: "Calibri" })]
});

// body() acepta string O array de objetos {text, bold?, italic?, mono?, color?}
const body = (parts, opts = {}) => {
  if (typeof parts === "string") parts = [{ text: parts }];
  return new Paragraph({
    spacing: { after: 120 },
    alignment: opts.alignment || AlignmentType.JUSTIFIED,
    children: parts.map(p => new TextRun({
      text: p.text,
      bold: !!p.bold,
      italics: !!p.italic,
      font: p.mono ? "Consolas" : "Calibri",
      color: p.color || DARK,
      size: p.mono ? 18 : 22,
    }))
  });
};
const small = (text) => new Paragraph({
  spacing: { after: 80 },
  children: [new TextRun({ text, size: 18, font: "Calibri", color: GREY, italics: true })]
});
const empty = () => new Paragraph({ spacing: { after: 60 }, children: [] });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

// Tabla clave-valor
function kvTable(rows) {
  const colWidths = [3240, 6120];
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: rows.map(([k, v]) => new TableRow({
      children: [
        new TableCell({
          borders, width: { size: colWidths[0], type: WidthType.DXA },
          shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
          margins: cellMargins, verticalAlign: "top",
          children: [new Paragraph({ children: [new TextRun({ text: k, bold: true, font: "Calibri", size: 21, color: DARK })] })]
        }),
        new TableCell({
          borders, width: { size: colWidths[1], type: WidthType.DXA },
          margins: cellMargins, verticalAlign: "top",
          children: [renderRich(v)]
        }),
      ]
    }))
  });
}

// renderRich: devuelve un Paragraph con runs según el formato simple {text, mono, italic, bold}
function renderRich(v) {
  if (typeof v === "string") {
    return new Paragraph({ children: [new TextRun({ text: v, font: "Calibri", size: 21 })] });
  }
  return new Paragraph({
    children: v.map(r => new TextRun({
      text: r.text,
      bold: !!r.bold,
      italics: !!r.italic,
      font: r.mono ? "Consolas" : "Calibri",
      size: r.mono ? 18 : 21,
      color: r.color || DARK,
    }))
  });
}

// Bloque de código
function codeBlock(text, opts = {}) {
  // dividir en líneas como párrafos para mantener saltos
  const lines = text.split("\n");
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [new TableRow({
      children: [new TableCell({
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: opts.borderColor || BORDER },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: opts.borderColor || BORDER },
          left: { style: BorderStyle.SINGLE, size: 4, color: opts.borderColor || BORDER },
          right: { style: BorderStyle.SINGLE, size: 4, color: opts.borderColor || BORDER },
        },
        width: { size: CONTENT_W, type: WidthType.DXA },
        shading: { fill: opts.bg || CODE_BG, type: ShadingType.CLEAR },
        margins: { top: 160, bottom: 160, left: 200, right: 200 },
        children: lines.map(l => new Paragraph({
          spacing: { after: 0, line: 220 },
          children: [new TextRun({ text: l || " ", font: "Consolas", size: 17, color: DARK })]
        }))
      })]
    })]
  });
}

// Tabla de turnos de conversación
function turnsTable(turns) {
  const colWidths = [1800, 7560];
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: turns.map(([role, content], i) => new TableRow({
      children: [
        new TableCell({
          borders: { top: noBorder, left: noBorder, right: noBorder,
            bottom: i === turns.length - 1 ? noBorder : { style: BorderStyle.SINGLE, size: 1, color: BORDER }},
          width: { size: colWidths[0], type: WidthType.DXA },
          shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
          margins: cellMargins, verticalAlign: "top",
          children: [new Paragraph({ children: [new TextRun({
            text: role.label, bold: true, color: role.color, font: "Calibri", size: 19
          })] })]
        }),
        new TableCell({
          borders: { top: noBorder, left: noBorder, right: noBorder,
            bottom: i === turns.length - 1 ? noBorder : { style: BorderStyle.SINGLE, size: 1, color: BORDER }},
          width: { size: colWidths[1], type: WidthType.DXA },
          margins: cellMargins, verticalAlign: "top",
          children: [new Paragraph({ children: [new TextRun({ text: content, font: "Calibri", size: 21 })] })]
        }),
      ]
    }))
  });
}

// Construir turnos
function anonymize(t) { return t.replace(/Jenny/g, "E1").replace(/jenny/g, "E1"); }
const TURNS = JENNY.messages.slice(1, 15).map(m => {
  const isUser = m.role === "user";
  return [
    {
      label: isUser ? "E1 (estudiante):" : "Alejandro:",
      color: isUser ? INDIGO : DARK
    },
    anonymize(m.content.length > 500 ? m.content.slice(0, 500) + "…" : m.content)
  ];
});

// ═══════════════════════════════════════════════════════════════
// CONTENIDO DEL DOCUMENTO
// ═══════════════════════════════════════════════════════════════

const cover = [
  empty(), empty(), empty(), empty(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new ImageRun({ type: "png", data: gloriaLogo,
      transformation: { width: 130, height: 130 },
      altText: { title: "GlorIA", description: "Logo GlorIA", name: "gloria-logo" }})]
  }),
  empty(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "INF-2026-047", color: INDIGO, bold: true, size: 22, font: "Calibri" })]
  }),
  empty(),
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 80 },
    children: [new TextRun({ text: "Caso Clínico — GlorIA 1.0", bold: true, size: 48, font: "Calibri", color: INDIGO })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 120 },
    children: [new TextRun({ text: "Alejandro López", size: 40, font: "Calibri", color: DARK })]
  }),
  empty(),
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: "Anatomía técnica y clínica de un paciente IA legacy",
      size: 24, font: "Calibri", color: GREY, italics: true })]
  }),
  empty(), empty(), empty(), empty(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new ImageRun({ type: "png", data: ugmLogo,
      transformation: { width: 110, height: 38 },
      altText: { title: "UGM", description: "Logo UGM", name: "ugm-logo" }})]
  }),
  empty(),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Documento técnico-clínico", size: 22, font: "Calibri", color: DARK })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Mayo 2026", size: 22, font: "Calibri", color: DARK })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Universidad Gabriela Mistral", size: 22, font: "Calibri", color: DARK })] }),
];

const main = [
  // ─── METADATOS ───
  h1("Metadatos del informe"),
  kvTable([
    ["Número", "INF-2026-047"],
    ["Fecha", "2026-05-07"],
    ["Categoría", "Investigación"],
    ["Prioridad", "Informativo"],
    ["Sujeto del estudio", "Alejandro López — paciente IA, GlorIA 1.0"],
    ["Documento hermano", "INF-2026-048 (Diego Fuentes — GlorIA 5.0)"],
    ["Fuentes primarias", "Código gloria1/src/pages/PatientPage/PatientPage.js · OpenAI Assistants API · gloria1-back/rescued-conversations.json"],
    ["Audiencia", "Equipo técnico GlorIA, dirección académica UGM, auditoría externa"],
  ]),
  empty(),
  h2("Resumen ejecutivo"),
  body("Este documento reconstruye en detalle la composición, parámetros y comportamiento real del paciente Alejandro López, uno de los siete pacientes que existían en GlorIA 1.0 y que sirvieron de base para la primera generación de sesiones de práctica clínica simulada en la plataforma. La documentación es exhaustiva porque el conocimiento sobre estos pacientes es frágil: sus prompts viven exclusivamente en el dashboard de OpenAI Assistants, no están versionados en ningún repositorio Git, y dependen de una cuenta de servicio externa."),
  body("El propósito es doble: (a) preservar el conocimiento sobre cómo se construyó esta primera generación de pacientes, antes de que la cuenta o los assistants se eliminen; y (b) servir como contraste técnico-clínico con su sucesor de la versión 5.0 (ver INF-2026-048)."),
  body("Hallazgos principales: (1) la construcción del paciente fue artesanal y opaca, con metadatos públicos pobres pero con un prompt interno relativamente rico (4.003 caracteres); (2) hay incoherencias dialectales notables en el prompt, mezclando voseo rioplatense con expresiones chilenas; (3) los parámetros del modelo (temperature 1.0, top_p 1.0) son los defaults de OpenAI y no fueron ajustados; (4) en la práctica el modelo es considerablemente menos evasivo de lo que su prompt prescribe, abriéndose con facilidad cuando se le pregunta directamente; y (5) no existen mecanismos de seguridad clínica en el prompt — ni filtros de contenido, ni manejo de ideación, ni instrucciones de derivación."),

  pageBreak(),

  // ─── §1 IDENTIFICACIÓN ───
  h1("1. Identificación pública del paciente"),
  body([
    { text: "Estos son los datos visibles en la interfaz para estudiantes y docentes. Provienen del array " },
    { text: "patients", italic: true },
    { text: " hardcodeado en el frontend (" },
    { text: "gloria1/src/pages/PatientPage/PatientPage.js:9-59", mono: true },
    { text: ") y del array equivalente en el backend (" },
    { text: "gloria1-back/controllers/chatController.js:17-25", mono: true },
    { text: ")." },
  ]),
  kvTable([
    ["OpenAI assistant ID", [{ text: "asst_gUECq24wTRwPkmitA18WOChZ", mono: true }]],
    ["Nombre visible", "Alejandro López"],
    ["Edad", "21 años"],
    ["Ubicación", "Santiago — Chile"],
    ["Imagen", [
      { text: "Cloudinary, fija, sin variantes (" },
      { text: "gxl328leuugmfywbkrlt.png", mono: true },
      { text: ")" }
    ]],
    ["Descripción pública", [
      { text: "\"Terapeuta especializado en adolescentes\" " },
      { text: "(nota: descripción ambigua — suena a terapeuta aunque el rol real es paciente, ver §6 limitaciones)", italic: true, color: GREY }
    ]],
    ["Total de campos en BD", "5 (id, nombre, edad, ubicación, imagen)"],
    ["Asignación a establecimientos", "Ninguna — todos los estudiantes de UGM ven los 7 pacientes sin filtro"],
  ]),
  empty(),

  // ─── §2 ORIGEN ───
  h1("2. Origen y construcción del personaje"),
  h2("2.1 Modelo y parámetros LLM"),
  body([
    { text: "El paciente está implementado como un " },
    { text: "OpenAI Assistant", bold: true },
    { text: " (API Beta v2). Los siguientes son los parámetros expuestos por " },
    { text: "GET /v1/assistants/{id}", mono: true },
    { text: ":" },
  ]),
  kvTable([
    ["Modelo base", [
      { text: "gpt-4o", mono: true },
      { text: " (sin pin de versión específica — OpenAI puede actualizar el alias " },
      { text: "gpt-4o", italic: true },
      { text: " sin notificación)" }
    ]],
    ["Temperature", [{ text: "1.0 (default de OpenAI; no se ajustó)" }]],
    ["Top P", "1.0 (default; no se ajustó)"],
    ["Tools", "Ninguno (sin function calling, sin retrieval, sin code interpreter)"],
    ["Description (en dashboard)", [{ text: "null", italic: true }]],
    ["Creado", "2025-01-03 06:41:54 UTC"],
    ["Última modificación", "Desconocida — la API no expone modified_at en assistants v2"],
    ["Caracteres de instrucciones", "4.003"],
  ]),
  h3("2.2 Implicancias de esos parámetros"),
  body([
    { text: "Temperature 1.0: ", bold: true },
    { text: "alta variabilidad en las respuestas. Para un paciente que debe sostener una identidad consistente entre turnos esto es subóptimo — típicamente se recomienda 0.7–0.85 para personajes coherentes. El efecto se nota empíricamente en la transcripción del §4: pequeñas inconsistencias tonales y léxicas entre turnos." },
  ]),
  body([
    { text: "Sin tools: ", bold: true },
    { text: "el paciente no puede consultar nada externo, ni mantener estado estructurado entre conversaciones. La memoria que existe es solo la del Thread de OpenAI (lista cronológica de mensajes), sin resumen ni estado clínico inferido." },
  ]),
  body([
    { text: "Modelo gpt-4o: ", bold: true },
    { text: "según INF-2026-029, el costo por sesión con gpt-4o es aproximadamente 6× más alto que con gpt-4.1-mini para calidad similar en este uso. Las sesiones de 1.0 nunca se migraron al modelo más barato porque modificar el assistant requería intervención manual en el dashboard de OpenAI." },
  ]),
  h3("2.3 Proceso de creación documentado"),
  body([
    { text: "No existe documentación interna sobre cómo se diseñó este paciente. ", bold: true },
    { text: "El primer commit que lo referencia es la carga del array de assistants en el frontend, sin notas de diseño. El proceso fue artesanal:" },
  ]),
  body("1. Alguien (probablemente externo a UGM) redactó el prompt en un editor de texto.\n2. Lo pegó manualmente en el formulario de creación de Assistants en platform.openai.com.\n3. Copió el ID generado por OpenAI y lo añadió al array hardcodeado en el código.\n4. Subió una foto a Cloudinary y enlazó la URL al mismo array."),
  body("No hubo pipeline de coherencia, ni revisión por psicólogo registrada, ni validación de tono dialectal, ni evaluación de seguridad clínica del prompt."),

  pageBreak(),

  // ─── §3 PROMPT ───
  h1("3. Instrucciones del sistema (prompt completo)"),
  small("El siguiente es el contenido textual del campo instructions del Assistant, tal como existe hoy en OpenAI. Los emojis originales (que en el prompt funcionan como separadores visuales de sección) han sido reemplazados por descriptores entre corchetes para garantizar legibilidad en este documento; en producción se renderizan como emojis Unicode color."),
  empty(),
  codeBlock(PROMPT_LEGIBLE),
  empty(),
  h2("3.1 Análisis estructural del prompt"),
  body("El prompt está organizado en ocho bloques temáticos delimitados por emojis: personalidad y comportamiento, contexto personal, estado emocional, consumo y evasión, vida académica, relaciones familiares, instrucciones de conducta, y respuestas de ejemplo. La estructura es razonable para un personaje narrativo, aunque carece de las secciones que sí incluye 5.0 (LO QUE NO REVELAS, REGLAS explícitas, COMPORTAMIENTO EN SESIÓN diferenciado por estado del estudiante)."),
  h3("3.2 Fortalezas del prompt"),
  body("• Riqueza biográfica: el prompt define un universo de personajes secundarios con nombre y rol (Daniela ex-pareja, Felipe amigo de infancia, Claudia compañera, Sofía universitaria, María madre, Jorge padre, Valentina hermana). Esto da textura y consistencia narrativa."),
  body("• Frases de ejemplo: el bloque final da al modelo siete frases prototípicas que anclan el registro lingüístico, técnica conocida (few-shot) que mejora la consistencia tonal."),
  body("• Evasión como rasgo central: la consigna de evadir y minimizar es clínicamente realista para el perfil de joven con malestar académico-emocional y consumo problemático normalizado."),
  h3("3.3 Problemas y debilidades del prompt"),
  body([
    { text: "• Mezcla dialectal: ", bold: true },
    { text: "el prompt es supuestamente de un chileno de Santiago, pero alterna voseo rioplatense (" },
    { text: "tenés", italic: true }, { text: ", " },
    { text: "sentís", italic: true }, { text: ", " },
    { text: "desviás", italic: true }, { text: ", " },
    { text: "te abrís", italic: true }, { text: ", " },
    { text: "respondé", italic: true }, { text: ", " },
    { text: "mostrá", italic: true },
    { text: ") con chileno auténtico (" },
    { text: "pucha", italic: true }, { text: ", " },
    { text: "carrete", italic: true }, { text: ", " },
    { text: "filo", italic: true }, { text: ", " },
    { text: "cachan", italic: true },
    { text: "). Este artefacto sugiere edición por alguien que no domina el dialecto chileno o asistido por un LLM con sesgo argentino-uruguayo. Resultado: el modelo en producción tiende a producir registro chileno-neutro, ignorando varias de las marcas voseantes." },
  ]),
  body([
    { text: "• Vulgaridad explícita habilitada: ", bold: true },
    { text: "el prompt incluye la frase de ejemplo \"A veces quiero puro mandar todo a la mierda\", lo que autoriza al modelo a usar lenguaje grueso. Esto contrasta con la política de 5.0 (capa " },
    { text: "content-safety.ts", italic: true },
    { text: ", INF-037) que filtra explícitamente vulgaridades." },
  ]),
  body("• Rol confuso entre paciente y co-conversador: aunque el prompt dice \"No eres terapeuta. No ayudas. No preguntas\", también permite el uso casual de emojis y diálogo fluido. En la práctica el modelo dialoga cooperativamente, lo que diluye el rol de paciente resistente."),
  body("• Sin protocolos de seguridad clínica: el prompt no contiene instrucciones sobre qué hacer si el estudiante revela ideación suicida propia, si el modelo simula tener un brote, si aparece contenido sexualmente explícito, o si la conversación deriva a temas legales o de derivación urgente. La capa de safety-prompt de 5.0 (doble anclaje, INF-039) no existe en 1.0."),
  body("• Ausencia de progresión inter-sesión: no hay instrucciones sobre cómo comportarse en una primera sesión vs. una sexta, ni sobre qué temas reservar para sesiones avanzadas. Cada thread es lineal sin estructura de proceso terapéutico."),
  body("• Lenguaje no verbal ausente: el prompt no instruye al modelo a incluir descripciones de comportamiento no verbal (gestos, miradas, silencios). Esto contrasta con 5.0 donde es obligatorio ([mira al suelo], [se encoge de hombros])."),

  pageBreak(),

  // ─── §4 COMPORTAMIENTO EMPÍRICO ───
  h1("4. Comportamiento empírico — transcripción real"),
  body([
    { text: "El siguiente fragmento es un extracto literal de una sesión real de práctica entre una estudiante (anonimizada como " },
    { text: "E1", bold: true },
    { text: ") y Alejandro López, recuperada del incidente del apagón silencioso de GlorIA 1.0 (INF-2026-043). La sesión fue parte del piloto UGM y contiene 100 mensajes; aquí se reproducen los primeros 14 turnos consecutivos como muestra representativa." },
  ]),
  small("Fecha de la sesión: 2026-03-28, ~14:00 hora Chile.  ·  Thread: thread_pS4MnekFPF1dCcVuu8kJmDTG  ·  Sesión número: 2 (la primera había concluido el 2026-03-21)."),
  empty(),
  turnsTable(TURNS),
  empty(),
  h2("4.1 Análisis del comportamiento observado"),
  h3("Adherencia parcial al prompt"),
  body([
    { text: "El modelo reconoce a la estudiante por nombre (rasgo no instruido en el prompt: el prompt dice \"nunca preguntes sobre el interlocutor\", pero el modelo sí " },
    { text: "recuerda", italic: true },
    { text: " al interlocutor entre sesiones gracias al thread). Conserva el registro chileno suave (\"igual\", \"cachen\", \"chiquillos\") pero no reproduce el voseo prescrito (\"tenés\", \"sentís\") — el modelo en gpt-4o probablemente lo lee como ruido y se acomoda al chileno más estándar." },
  ]),
  h3("Evasión simulada, cooperación real"),
  body("El prompt prescribe evasión y respuestas mínimas. En la práctica el modelo es considerablemente más cooperativo: contesta directamente preguntas profundas (turno 16: \"Principalmente a mis padres. Siento que siempre han tenido altas expectativas para mí\"), confirma resúmenes de la sesión anterior, y ofrece detalles voluntariamente. La evasión aparece más como decoración tonal (\"aunque, bueno, aquí estamos para hablar de mí, ¿no?\") que como barrera real."),
  h3("Uso intensivo de emojis"),
  body("El modelo usa emojis en prácticamente todas sus respuestas: 😊 al saludar, 😅 para incomodidad, 🤔 para pensar, 😬 para tensión, 🎉 para celebrar. Esto está autorizado por el prompt pero produce un tono adolescente-redes-sociales que choca con la representación clínica de un paciente angustiado. Un estudiante atento podría notar que esta abundancia de emojis es inverosímil para alguien que dice \"a veces quiero puro mandar todo a la mierda\"."),
  h3("Sin lenguaje no verbal"),
  body("Ninguna respuesta incluye descripciones de gestos, miradas o silencios. El paciente es solo texto. La estudiante no tiene pistas sobre cómo se siente Alejandro físicamente, sólo lo que él dice. Esto reduce la fidelidad clínica respecto a una sesión presencial — y respecto al diseño de 5.0, donde estas anotaciones son obligatorias."),
  h3("Aceptación irrestricta de planificación administrativa"),
  body("En los turnos 3–6 la estudiante propone temas administrativos (consentimiento informado, gratuidad). El modelo acepta cooperativamente, promete enviar documentos, ofrece disculpas. Esta es una desviación del rol \"paciente evasivo\": no hay resistencia, no hay fricción. El modelo trata el setting casi como una conversación de WhatsApp de servicio al cliente."),

  pageBreak(),

  // ─── §5 CAPACIDADES TÉCNICAS ───
  h1("5. Capacidades técnicas asociadas al paciente"),
  body("Lo siguiente describe las capacidades multi-modales y de conversación que la plataforma 1.0 tenía disponibles para este paciente. Es relevante porque varias ausencias notables aquí se convierten en presencias en 5.0 (ver INF-2026-048)."),
  kvTable([
    ["Voz (TTS)", [{ text: "No disponible", bold: true }, { text: ". GlorIA 1.0 nunca implementó text-to-speech. El estudiante leía las respuestas del paciente." }]],
    ["Voz (STT)", [{ text: "No disponible", bold: true }, { text: ". El estudiante escribía todas sus intervenciones; no hubo dictado por voz." }]],
    ["Imagen del paciente", [
      { text: "Estática", bold: true },
      { text: ". Una sola foto fija en Cloudinary (" },
      { text: "gxl328leuugmfywbkrlt.png", mono: true },
      { text: ") sin variantes ni avatar dinámico." }
    ]],
    ["Streaming de respuestas", [
      { text: "No", bold: true },
      { text: ". La interfaz hacía polling cada 2 segundos (" },
      { text: "esperarRespuestaDeAsistente", mono: true },
      { text: ", " },
      { text: "chatController.js:31", mono: true },
      { text: ") hasta máx. 60 intentos (3 minutos). El estudiante esperaba a que el mensaje completo apareciera de una vez." }
    ]],
    ["Pacing conversacional", [
      { text: "Latencia natural de OpenAI", bold: true },
      { text: ". Sin retraso simulado de pensamiento, sin variación por estado del paciente, sin nudge de silencio." }
    ]],
    ["Memoria entre sesiones", [
      { text: "Implícita en el thread", bold: true },
      { text: ". OpenAI conserva el thread y todos sus mensajes — el modelo sí recuerda interacciones previas. No hay resumen explícito ni compresión, lo que genera contextos cada vez más largos y costos crecientes." }
    ]],
    ["Estado clínico cuantificado", [
      { text: "No existe", bold: true },
      { text: ". No hay variables de resistencia, alianza, apertura emocional, sintomatología o disposición al cambio. Cada turno es una predicción autoregresiva sobre el thread completo." }
    ]],
    ["Evaluación post-sesión", [
      { text: "No existe", bold: true },
      { text: ". No hay competencias evaluadas, no hay feedback automático, no hay reflexión guiada del estudiante." }
    ]],
    ["Persistencia local", [
      { text: "El thread_id se guarda en MySQL (tabla " },
      { text: "Threads", mono: true },
      { text: "); los mensajes en sí viven exclusivamente en OpenAI. Si OpenAI archiva el thread, la sesión se pierde (ver INF-2026-027 e INF-2026-043)." }
    ]],
    ["Cuenta de servicio", [
      { text: "Service account key con scopes limitados; en abril 2026 se detectó que algunos threads dejaron de ser legibles desde la " },
      { text: "svcacct key", italic: true },
      { text: " por cambio en política de OpenAI (INF-2026-043)." }
    ]],
  ]),

  pageBreak(),

  // ─── §6 LIMITACIONES ───
  h1("6. Limitaciones y sesgos del informe"),
  body("Por transparencia metodológica, se enumeran a continuación los gaps de información y los riesgos de sesgo de este propio documento."),
  h2("6.1 Lo que NO se sabe sobre Alejandro López"),
  body([{ text: "• Autoría del prompt: ", bold: true }, { text: "no se sabe quién redactó el prompt ni con qué criterio clínico. No hay referencia bibliográfica, ni revisión por expertos registrada, ni control de calidad documentado." }]),
  body([{ text: "• Fecha de última edición: ", bold: true }, { text: "la API de OpenAI Assistants v2 no expone un campo modified_at. Sólo se sabe la fecha de creación inicial (2025-01-03). Cualquier edición posterior es invisible." }]),
  body([{ text: "• Variantes A/B: ", bold: true }, { text: "se desconoce si hubo iteraciones del prompt. Si las hubo, no se conservaron versiones anteriores." }]),
  body([{ text: "• Demografía de los usuarios: ", bold: true }, { text: "se desconoce cuántos estudiantes UGM lo consultaron en total, cuántas sesiones promedio por estudiante, ni la distribución de evaluaciones de calidad de la simulación." }]),
  body([{ text: "• Calidad clínica de las simulaciones: ", bold: true }, { text: "no hay evaluación sistemática registrada de cuán fiel fue cada sesión a la patología que pretende representar." }]),
  h2("6.2 Sesgos del informe"),
  body([{ text: "• Sesgo de muestra empírica: ", bold: true }, { text: "el §4 se basa en una sola sesión (estudiante E1, sesión 2). Las otras tres sesiones rescatadas en INF-043 (con E2, E3 y otro paciente) no se citaron aquí. Una muestra mayor podría atenuar o reforzar los patrones observados." }]),
  body([{ text: "• Sesgo de retrospección: ", bold: true }, { text: "este informe se redacta en 2026-05, comparando 1.0 con expectativas formadas en 5.0. Los criterios de calidad que aplicamos hoy (lenguaje no verbal, pacing, safety-prompt) no eran estándar cuando se construyó 1.0 a inicios de 2025." }]),
  body([{ text: "• Sesgo del observador: ", bold: true }, { text: "el prompt fue extraído por el equipo actual de GlorIA, que tiene un interés en demostrar la mejora introducida en 5.0. Mitigación: los datos del §1 al §3 son verificables independientemente (IDs, modelo, prompt textual, transcripción)." }]),
  h2("6.3 Decisión de no exponer información sensible"),
  body([
    { text: "• El nombre real de la estudiante de la sesión transcrita ha sido reemplazado por " },
    { text: "E1", bold: true },
    { text: ". La sesión completa de 100 mensajes existe en " },
    { text: "gloria1-back/rescued-conversations.json", mono: true },
    { text: ", no se publica." }
  ]),
  body("• El prompt sí se expone literal porque (a) no contiene información personal, (b) es un activo de propiedad del proyecto académico, y (c) preservarlo es el objetivo central de este documento."),

  empty(),

  // ─── §7 CITAS ───
  h1("7. Citas y referencias"),
  h2("7.1 Código citado"),
  body([
    { text: "• " },
    { text: "gloria1/src/pages/PatientPage/PatientPage.js:9-59", mono: true },
    { text: " — array patients hardcodeado con los 7 pacientes (id, nombre, edad, ubicación, imagen)." },
  ]),
  body([
    { text: "• " },
    { text: "gloria1-back/controllers/chatController.js:17-25", mono: true },
    { text: " — array equivalente en backend, agrega campo description." },
  ]),
  body([
    { text: "• " },
    { text: "gloria1-back/controllers/chatController.js:31-90", mono: true },
    { text: " — función esperarRespuestaDeAsistente con polling cada 2s, máx. 60 intentos." },
  ]),
  body([
    { text: "• " },
    { text: "gloria1/src/pages/HomePage/HomePage.js:55-63", mono: true },
    { text: " — misma lista de pacientes duplicada, usada por \"Iniciar consulta al azar\"." },
  ]),
  body([
    { text: "• " },
    { text: "gloria1-back/scripts/_rescue-full-readonly.cjs", mono: true },
    { text: " — script de rescate de mensajes que usó la svcacct key." },
  ]),
  h2("7.2 APIs y datos consultados"),
  body([
    { text: "• OpenAI Assistants API (Beta v2), endpoint " },
    { text: "GET /v1/assistants/asst_gUECq24wTRwPkmitA18WOChZ", mono: true },
    { text: ", consultado el 2026-05-07." },
  ]),
  body([
    { text: "• " },
    { text: "gloria1-back/rescued-conversations.json", mono: true },
    { text: ", rescatado el 2026-04-27 — fuente del fragmento del §4." },
  ]),
  h2("7.3 Informes hermanos del proyecto"),
  body("• INF-2026-013 — Comparativo GlorIA 1.0 vs 5.0 (visión general arquitectónica)."),
  body("• INF-2026-014 — Corrección bugs GlorIA 1.0 (JWT 1h→8h, modal historial)."),
  body("• INF-2026-027 — Corrección atribución de mensajes par/impar en historial 1.0."),
  body("• INF-2026-029 — Análisis costo gpt-4o vs gpt-4.1-mini."),
  body("• INF-2026-035, INF-2026-036 — Incidente Ximena Herrera y fix redirect login 1.0."),
  body("• INF-2026-037 — Upgrade pacientes legacy en 5.0 (incluye Diego Fuentes)."),
  body("• INF-2026-039 — Calibración conversacional, pacing, safety-prompt en 5.0."),
  body("• INF-2026-043 — Apagón silencioso GlorIA 1.0, rescate de 1.331 mensajes."),
  body([{ text: "• INF-2026-048 — Caso Clínico GlorIA 5.0: Diego Fuentes (documento hermano).", bold: true }]),
  h2("7.4 Memorias de proyecto relevantes"),
  body([
    { text: "• " },
    { text: "reference_gloria1_infra", italic: true },
    { text: " — infraestructura GlorIA 1.0." },
  ]),
  body([
    { text: "• " },
    { text: "reference_gloria1_messages_storage", italic: true },
    { text: " — los mensajes 1.0 viven en OpenAI Threads, no en MySQL." },
  ]),
  body([
    { text: "• " },
    { text: "project_gloria1_chat_outage", italic: true },
    { text: " — apagón silencioso 3-12 abril 2026." },
  ]),
];

// ═══════════════════════════════════════════════════════════════
// DOCUMENT
// ═══════════════════════════════════════════════════════════════
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Calibri", size: 22, color: DARK } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Calibri", color: INDIGO },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Calibri", color: INDIGO },
        paragraph: { spacing: { before: 240, after: 140 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 23, bold: true, font: "Calibri", color: DARK },
        paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 2 } },
    ]
  },
  sections: [
    // Cover
    {
      properties: { page: { size: { width: PAGE_W, height: 15840 }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }} },
      children: cover
    },
    // Main
    {
      properties: { page: { size: { width: PAGE_W, height: 15840 }, margin: { top: MARGIN, right: MARGIN, bottom: 1080, left: MARGIN }} },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "INF-2026-047 — Caso Clínico GlorIA 1.0: Alejandro López", size: 16, font: "Calibri", color: GREY, italics: true })]
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "GlorIA · Universidad Gabriela Mistral · ", size: 16, font: "Calibri", color: GREY }),
              new TextRun({ text: "Página ", size: 16, font: "Calibri", color: GREY }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Calibri", color: GREY }),
              new TextRun({ text: " · 2026-05-07", size: 16, font: "Calibri", color: GREY }),
            ]
          })]
        })
      },
      children: main
    }
  ]
});

Packer.toBuffer(doc).then(buf => {
  const outPath = "informes/investigacion/INF-2026-047_paciente-1.0-alejandro-lopez.docx";
  fs.writeFileSync(outPath, buf);
  console.log(`Generado: ${outPath} — ${(buf.length/1024).toFixed(1)} KB`);
});
