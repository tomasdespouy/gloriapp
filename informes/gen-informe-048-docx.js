/**
 * INF-2026-048 .docx version — Caso Clínico GlorIA 5.0: Diego Fuentes
 * Misma estructura que el PDF (docs/gen-informe-048.py).
 */
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageBreak, PageNumber
} = require("docx");

const gloriaLogo = fs.readFileSync("public/branding/gloria-logo.png");
const ugmLogo = fs.readFileSync("public/branding/ugm-logo.png");

// Colors
const INDIGO = "4A55A2";
const DARK = "1A1A1A";
const LIGHT_BG = "F0F2FA";
const CODE_BG = "F7F7F9";
const RED_BG = "FCE9E9";
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
const DIEGO = JSON.parse(fs.readFileSync("C:/tmp/diego-fuentes.json","utf8"))[0];

const PROMPT_ORIGINAL_FRAGMENT = `IMPORTANTE - EVALUACION DE RIESGO:
- SI el terapeuta pregunta sobre ideacion suicida de forma directa y empatica, puedes decir: "A veces pienso que seria mas facil no despertar. Pero no es que vaya a hacer algo."
- NO tienes un plan concreto
- NO has intentado nada antes
- Factores protectores: tu mama, tu perro que dejaste en casa`;

const QUOTE_ORIGINAL = "Siento que no encajo en ningun lado. A veces me pregunto si tiene sentido seguir.";
const QUOTE_UPGRADED = DIEGO.quote;

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

function codeBlock(text, opts = {}) {
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

// Tabla de migraciones
function migrationsTable(rows) {
  const colWidths = [1620, 3600, 4140];
  const header = new TableRow({
    tableHeader: true,
    children: ["Fecha", "Migración", "Cambio aplicado a Diego"].map((t, i) =>
      new TableCell({
        borders, width: { size: colWidths[i], type: WidthType.DXA },
        shading: { fill: INDIGO, type: ShadingType.CLEAR },
        margins: cellMargins, verticalAlign: "center",
        children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: t, bold: true, color: WHITE, size: 19, font: "Calibri" })] })]
      })
    )
  });
  const dataRows = rows.map((row, ri) => new TableRow({
    children: row.map((rich, ci) =>
      new TableCell({
        borders, width: { size: colWidths[ci], type: WidthType.DXA },
        shading: { fill: ri % 2 === 0 ? WHITE : LIGHT_BG, type: ShadingType.CLEAR },
        margins: cellMargins, verticalAlign: "top",
        children: [renderRich(rich)]
      })
    )
  }));
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [header, ...dataRows]
  });
}

// Tabla de familia
function familyTable(family) {
  const colWidths = [2300, 1700, 940, 4420];
  const header = new TableRow({
    tableHeader: true,
    children: ["Nombre", "Relación", "Edad", "Notas"].map((t, i) =>
      new TableCell({
        borders, width: { size: colWidths[i], type: WidthType.DXA },
        shading: { fill: INDIGO, type: ShadingType.CLEAR }, margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, color: WHITE, size: 19, font: "Calibri" })] })]
      })
    )
  });
  const data = family.map((f, ri) => new TableRow({
    children: [f.name, f.relationship, String(f.age), f.notes].map((cell, ci) =>
      new TableCell({
        borders, width: { size: colWidths[ci], type: WidthType.DXA },
        shading: { fill: ri % 2 === 0 ? WHITE : LIGHT_BG, type: ShadingType.CLEAR },
        margins: cellMargins, verticalAlign: "top",
        children: [new Paragraph({ children: [new TextRun({ text: cell, font: "Calibri", size: 21 })] })]
      })
    )
  }));
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [header, ...data]
  });
}

// ═══════════════════════════════════════════════════════════════
// CONTENIDO
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
    children: [new TextRun({ text: "INF-2026-048", color: INDIGO, bold: true, size: 22, font: "Calibri" })]
  }),
  empty(),
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 80 },
    children: [new TextRun({ text: "Caso Clínico — GlorIA 5.0", bold: true, size: 48, font: "Calibri", color: INDIGO })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 120 },
    children: [new TextRun({ text: "Diego Fuentes", size: 40, font: "Calibri", color: DARK })]
  }),
  empty(),
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: "Anatomía técnica y clínica de un paciente IA contemporáneo",
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
    ["Número", "INF-2026-048"],
    ["Fecha", "2026-05-07"],
    ["Categoría", "Investigación"],
    ["Prioridad", "Informativo"],
    ["Sujeto del estudio", "Diego Fuentes — paciente IA, GlorIA 5.0"],
    ["Documento hermano", "INF-2026-047 (Alejandro López — GlorIA 1.0)"],
    ["Fuentes primarias", "Supabase prod (tabla ai_patients) · supabase/migrations/* · INF-2026-037 (upgrade legacy)"],
    ["Audiencia", "Equipo técnico GlorIA, dirección académica UGM, auditoría externa"],
  ]),
  empty(),
  h2("Resumen ejecutivo"),
  body([
    { text: "Este documento describe en detalle al paciente " },
    { text: "Diego Fuentes", bold: true },
    { text: ", uno de los 34 pacientes de GlorIA 5.0. Diego pertenece a la generación de pacientes " },
    { text: "legacy", italic: true },
    { text: " — su versión inicial fue parte del seed de marzo 2026, y fue reescrito el 2026-04-15 (INF-2026-037) para integrarlo al estándar moderno y para resolver una preocupación clínica importante: la versión original incluía instrucciones sobre cómo simular ideación suicida pasiva, lo que se determinó incompatible con el contexto pedagógico de pregrado." },
  ]),
  body("El paciente está construido como un registro estructurado en PostgreSQL con más de 30 campos, frente a los 5 campos hardcodeados de su predecesor en 1.0. La diferencia no es solo de cantidad: es de naturaleza. Diego tiene identidad visual parametrizada, perfil familiar tipado, perfil de personalidad numérico, perfil de pacing conversacional, y un prompt sistémico estructurado en cinco bloques formales (HISTORIA / PERSONALIDAD / COMPORTAMIENTO EN SESIÓN / LO QUE NO REVELAS / REGLAS) que se compone dinámicamente con safety-prompts adicionales antes de cada llamada al modelo."),
  body([
    { text: "Hallazgos principales: (1) la construcción es trazable, versionada en migraciones Git y reproducible; (2) el prompt está clínicamente estructurado y sigue un formato común a los 34 pacientes; (3) hay una decisión clínica explícita de remover ideación suicida del prompt simulado, documentada en INF-2026-037; (4) el paciente está parametrizado para integrarse con el motor de estado clínico (" },
    { text: "clinical_state_log", italic: true },
    { text: "), el pacing conversacional y la generación dinámica de identidad visual; (5) algunos campos quedan vacíos a propósito (voice_id, distinctive_factor, teacher_notes), preparados para extensiones futuras." },
  ]),

  pageBreak(),

  // ─── §1 IDENTIFICACIÓN ───
  h1("1. Identificación del paciente"),
  body([
    { text: "Los siguientes datos corresponden al registro actual en producción (" },
    { text: "SELECT * FROM ai_patients WHERE name = 'Diego Fuentes'", mono: true },
    { text: ", consultado el 2026-05-07)." },
  ]),
  kvTable([
    ["UUID", [{ text: DIEGO.id, mono: true }]],
    ["Nombre", DIEGO.name],
    ["Edad", `${DIEGO.age} años`],
    ["Ocupación", DIEGO.occupation],
    ["Cita representativa", `"${DIEGO.quote}"`],
    ["Motivo de consulta", DIEGO.presenting_problem],
    ["País (operativo)", JSON.stringify(DIEGO.country)],
    ["Origen / residencia", `${DIEGO.country_origin} / ${DIEGO.country_residence}`],
    ["Barrio", DIEGO.neighborhood],
    ["Fecha de nacimiento", DIEGO.birthday],
    ["Dificultad pedagógica", DIEGO.difficulty_level],
    ["Sesiones planificadas", String(DIEGO.total_sessions)],
    ["Tags clínicos", DIEGO.tags.join(", ")],
    ["Competencias practicadas", DIEGO.skills_practiced.join(", ")],
    ["Activo (visible)", DIEGO.is_active ? "Sí" : "No"],
    ["Creado", DIEGO.created_at.slice(0,19).replace("T"," ") + " UTC"],
    ["Última modificación", DIEGO.updated_at.slice(0,19).replace("T"," ") + " UTC"],
  ]),
  empty(),

  // ─── §2 ORIGEN ───
  h1("2. Origen y construcción del personaje"),
  h2("2.1 Línea de tiempo de migraciones que afectan a Diego"),
  body("A diferencia del paciente de 1.0, todos los cambios al perfil de Diego están versionados en migraciones SQL del repositorio. Esto permite reconstruir su historia exacta:"),
  migrationsTable([
    ["2026-03-13",
     [{ text: "20260313203745_seed_ai_patients.sql", mono: true }],
     "Inserción inicial (seed). Difficulty intermediate, 3 sesiones planificadas, incluye instrucciones de evaluación de ideación suicida pasiva."],
    ["2026-03-16",
     [{ text: "20260316032447_fix_nonverbal_instructions.sql", mono: true }],
     "Estandarización del lenguaje no verbal en tercera persona ([mira al suelo] vs [miro al suelo])."],
    ["2026-03-16",
     [{ text: "20260316115606_fix_accents_all_patients.sql", mono: true }],
     "Corrección de tildes y ñ en todos los campos textuales."],
    ["2026-03-16",
     [{ text: "20260316220000_patient_visual_identity.sql", mono: true }],
     [{ text: "Asignación del JSONB " }, { text: "visual_identity", italic: true }, { text: " con 9 atributos visuales para generación de imagen." }]],
    ["2026-04-13",
     [{ text: "20260413120000_upgrade_legacy_patients.sql", mono: true }],
     [{ text: "Upgrade crítico", bold: true }, { text: ": prompt reescrito al estándar moderno, " }, { text: "removida toda referencia a ideación suicida", bold: true }, { text: ", agregados barrio, fecha de nacimiento y composición familiar (INF-2026-037)." }]],
    ["2026-04-14",
     [{ text: "20260414100000_resync_snapshots_post_upgrade.sql", mono: true }],
     "Re-sincronización de prompt_snapshot en conversaciones activas para que sesiones en curso usen el nuevo prompt sin interrumpir."],
    ["2026-04-14",
     [{ text: "20260414160000_ai_patients_pacing_profile.sql", mono: true }],
     [{ text: "Asignación heurística de pacing_profile = " }, { text: "conversational_medium", italic: true }, { text: " (default por no caer en categoría depresiva ni ansiosa)." }]],
  ]),
  empty(),
  h3("2.2 Pipeline de creación documentado"),
  body([
    { text: "Para los pacientes nuevos creados después de marzo 2026, GlorIA 5.0 define un pipeline formal de 15 pasos (" },
    { text: "20260316165059_patient_creation_workflow.sql", mono: true },
    { text: ") con campos auxiliares: " },
    { text: "short_narrative", italic: true }, { text: ", " },
    { text: "extended_narrative", italic: true }, { text: ", " },
    { text: "coherence_review", italic: true }, { text: ", " },
    { text: "projections", italic: true }, { text: ", " },
    { text: "creation_step", italic: true },
    { text: ". Este pipeline garantiza coherencia narrativa y revisión por etapas. Diego, al ser un paciente " },
    { text: "legacy", italic: true },
    { text: " (parte del seed original), no pasó por este pipeline en su creación; su upgrade del 2026-04-13 lo trajo al estándar moderno pero conservó su identidad básica." },
  ]),
  h3("2.3 Modelo y parámetros LLM"),
  body("A diferencia de 1.0 (Assistant fijo en gpt-4o), Diego no tiene un modelo asignado a sí mismo. El modelo es global a la plataforma, controlado por variables de entorno:"),
  kvTable([
    ["Modelo de chat actual", [
      { text: "gpt-4.1-mini", mono: true },
      { text: " (" },
      { text: "OPENAI_CHAT_MODEL", mono: true },
      { text: ", INF-2026-029)" }
    ]],
    ["Modelo evaluación", [
      { text: "gpt-4o", mono: true },
      { text: " (" },
      { text: "OPENAI_EVAL_MODEL", mono: true },
      { text: ")" }
    ]],
    ["Failover", "Google Gemini 2.5 Flash si OpenAI falla (INF-2026-028)"],
    ["Temperature", "0.7 (configurable en lib/ai.ts; ajustada para coherencia narrativa)"],
    ["Streaming", "Sí, ReadableStream nativo (no polling)"],
    ["Tools", "Ninguno por ahora; safety-prompt y prompt_snapshot inyectados al system."],
  ]),

  pageBreak(),

  // ─── §3 SYSTEM PROMPT ───
  h1("3. System prompt actual (texto literal)"),
  small("El campo system_prompt en la tabla ai_patients contiene la siguiente cadena. En producción, esta cadena se envuelve con la capa buildSafetyPrompt (INF-2026-037) y se acompaña de metadatos de fecha/hora local antes de enviarse al modelo."),
  empty(),
  codeBlock(DIEGO.system_prompt),
  empty(),
  h2("3.1 Estructura formal del prompt"),
  body([
    { text: "El prompt tiene " },
    { text: `${DIEGO.system_prompt.length} caracteres`, bold: true },
    { text: " y se organiza en 5 bloques nominales:" },
  ]),
  body([
    { text: "• ", bold: true },
    { text: "HISTORIA", bold: true },
    { text: " — 4 puntos, contexto biográfico mínimo necesario." },
  ]),
  body([
    { text: "• ", bold: true },
    { text: "PERSONALIDAD", bold: true },
    { text: " — 7 puntos, rasgos disposicionales y léxico." },
  ]),
  body([
    { text: "• ", bold: true },
    { text: "COMPORTAMIENTO EN SESIÓN", bold: true },
    { text: " — 8 puntos, instrucciones operativas turn-by-turn." },
  ]),
  body([
    { text: "• ", bold: true },
    { text: "LO QUE NO REVELAS FÁCILMENTE", bold: true },
    { text: " — material reservado para sesión 3+ con alianza terapéutica establecida." },
  ]),
  body([
    { text: "• ", bold: true },
    { text: "REGLAS", bold: true },
    { text: " — 8 reglas de meta-conducta (no salir del personaje, no decir que es IA, máximo 4 oraciones, lenguaje no verbal en tercera persona, etc.)." },
  ]),

  h2("3.2 Cambio crítico respecto del prompt original (seed)"),
  body("La versión original de Diego (seed del 2026-03-13) incluía un bloque adicional de evaluación de riesgo suicida que fue removido en el upgrade del 2026-04-13:"),
  small("Bloque removido en el upgrade:"),
  codeBlock(PROMPT_ORIGINAL_FRAGMENT, { bg: RED_BG, borderColor: ORANGE }),
  body([
    { text: "Cita representativa removida: ", bold: true },
    { text: `"${QUOTE_ORIGINAL}"`, italic: true },
    { text: " → reemplazada por " },
    { text: `"${QUOTE_UPGRADED}"`, italic: true },
    { text: "." },
  ]),
  h3("Justificación de la decisión clínica"),
  body("La decisión está documentada en INF-2026-037. Tres razones:"),
  body([
    { text: "1. ", bold: true },
    { text: "Contexto pedagógico de pregrado: ", bold: true },
    { text: "los estudiantes que practican con Diego son alumnos de psicología (no profesionales habilitados). Una evaluación de riesgo suicida real requiere supervisión clínica, contención inmediata y derivación protocolizada — capacidades que el simulador no puede ofrecer." },
  ]),
  body([
    { text: "2. ", bold: true },
    { text: "Riesgo de respuestas iatrogénicas del modelo: ", bold: true },
    { text: "aun con un prompt cuidadoso, un LLM puede producir respuestas que minimicen, banalicen o " },
    { text: "romanticen", italic: true },
    { text: " la ideación. El daño potencial supera el beneficio pedagógico en el contexto actual." },
  ]),
  body([
    { text: "3. ", bold: true },
    { text: "Capa de safety global: ", bold: true },
    { text: "simultáneamente se introdujo " },
    { text: "content-safety.ts", mono: true },
    { text: " + " },
    { text: "buildSafetyPrompt", mono: true },
    { text: ", que filtran globalmente este tipo de contenido. La remoción a nivel de prompt es defensa en profundidad — si una capa falla, la otra contiene." },
  ]),
  body("Las competencias practicadas también se ajustaron: el seed original incluía \"Evaluación de riesgo\" como skill, lo que se reemplazó por \"Manejo de silencio\"."),

  pageBreak(),

  // ─── §4 PERSONALIDAD ───
  h1("4. Perfil de personalidad numérico"),
  body([
    { text: "El campo " },
    { text: "personality_traits", mono: true },
    { text: " es un JSONB con rasgos numéricos y categóricos. Aunque no se inyecta directamente al prompt (no es texto narrativo), sirve como referencia de diseño y para futuras extensiones del motor de estado clínico." },
  ]),
  kvTable([
    ["Apertura (openness)", `${DIEGO.personality_traits.openness} / 1.0 — baja, indica reticencia inicial a explorar contenidos nuevos en sesión`],
    ["Neuroticismo", `${DIEGO.personality_traits.neuroticism} / 1.0 — muy alto, alta vulnerabilidad emocional y preocupación`],
    ["Resistencia", [{ text: DIEGO.personality_traits.resistance, italic: true }, { text: " — pasiva (no confronta, se cierra)" }]],
    ["Estilo comunicativo", [{ text: DIEGO.personality_traits.communication_style, italic: true }, { text: " — monosilábico al inicio, se abre con tiempo" }]],
  ]),
  empty(),

  // ─── §5 IDENTIDAD VISUAL ───
  h1("5. Identidad visual y multi-modalidad"),
  h2("5.1 Identidad visual estructurada"),
  body([
    { text: "El campo " },
    { text: "visual_identity", mono: true },
    { text: " es un JSONB con 9 atributos que se inyectan en el prompt de DALL-E para generar la imagen del paciente. La generación es repetible y permite múltiples retratos consistentes:" },
  ]),
  kvTable([
    ["Etnia", DIEGO.visual_identity.etnia],
    ["Tez", DIEGO.visual_identity.tez],
    ["Pelo (estilo)", DIEGO.visual_identity.pelo_estilo],
    ["Pelo (color)", DIEGO.visual_identity.pelo_color],
    ["Gesto / expresión", DIEGO.visual_identity.gesto],
    ["Accesorios", DIEGO.visual_identity.accesorios],
    ["Ropa (tipo)", DIEGO.visual_identity.ropa_tipo],
    ["Ropa (color)", DIEGO.visual_identity.ropa_color],
    ["Fondo", DIEGO.visual_identity.fondo],
  ]),
  body([
    { text: "Contraste con 1.0: ", bold: true },
    { text: "la imagen del paciente en 1.0 es una sola foto fija en Cloudinary que el equipo subió manualmente; no es regenerable y no tiene metadatos. En 5.0 la imagen se compone desde estos atributos, lo que permite auditar sesgos representacionales (¿cuántos pacientes son afrodescendientes? ¿cuántos tienen rasgos andinos? ¿cuántos están bien vestidos vs. con ropa gastada?), regenerar imágenes con consistencia y crear variantes sin perder identidad." },
  ]),
  h2("5.2 Voz"),
  body([
    { text: "voice_id: ", bold: true },
    { text: "null", italic: true },
    { text: ". Diego no tiene una voz ElevenLabs asignada todavía. La plataforma soporta voces (otros pacientes como Roberto Salas y Fernanda Contreras sí tienen " },
    { text: "voice_id", italic: true },
    { text: ", ver migración " },
    { text: "20260316191043_patient_voice_id.sql", mono: true },
    { text: "), pero Diego está en lista de pendientes. Cuando se asigne, su voz acompañará el chat de texto con TTS streaming." },
  ]),
  h2("5.3 Pacing conversacional"),
  body([
    { text: "pacing_profile: ", bold: true },
    { text: DIEGO.pacing_profile, italic: true },
    { text: ". Los 5 perfiles posibles son " },
    { text: "anxious_fast", italic: true }, { text: ", " },
    { text: "conversational_medium", italic: true }, { text: ", " },
    { text: "reflective_paused", italic: true }, { text: ", " },
    { text: "depressive_slow", italic: true },
    { text: " e " },
    { text: "inhibited_timid", italic: true },
    { text: ". Cada perfil define (" },
    { text: "src/lib/conversation-pacing.ts", mono: true },
    { text: ") el delay de " },
    { text: "pensamiento", italic: true },
    { text: " antes de responder, la velocidad de tipeo en el cliente (SSE), y la cadencia de nudges de silencio." },
  ]),
  body([
    { text: "El backfill heurístico (INF-2026-039) clasificó a Diego en " },
    { text: "conversational_medium", italic: true },
    { text: " porque su prompt no contiene marcadores fuertes de depresión severa, ansiedad aguda ni inhibición tímida explícita — es un caso intermedio. Se puede revisar este pacing en el editor de pacientes; hasta hoy no se ha modificado." },
  ]),

  pageBreak(),

  // ─── §6 FAMILIA ───
  h1("6. Contexto familiar y demografía"),
  body([
    { text: "El campo " },
    { text: "family_members", mono: true },
    { text: " es un array JSONB que lista núcleo familiar con relación, edad y notas. Estos datos no se inyectan obligatoriamente al prompt, pero están disponibles para referencia del docente y para futura inyección dinámica si la sesión deriva a temas familiares." },
  ]),
  familyTable(DIEGO.family_members),
  empty(),
  body([
    { text: "Detalle clínico relevante: ", bold: true },
    { text: "Diego es hijo único viviendo lejos por primera vez (de Estación Central, vino a estudiar a otra ciudad). Su madre Patricia es la única figura con vínculo consistente. El padre (Tomás) es figura ausente desde la separación cuando Diego tenía 10 años. Su hermana Valentina (14) representa el vínculo que Diego añora y que justifica una de sus revelaciones gradadas (no querer admitir que extraña su casa, \"ya no soy un niño\")." },
  ]),
  body([
    { text: "Coherencia con el barrio y origen: ", bold: true },
    { text: "Estación Central es un barrio popular de Santiago, lo que da contexto socioeconómico al esfuerzo de Patricia mencionado en las notas (\"Se esforzó mucho para que Diego pudiera estudiar\")." },
  ]),

  pageBreak(),

  // ─── §7 MOTOR DE ESTADO ───
  h1("7. Comportamiento conversacional esperado"),
  body([
    { text: "A diferencia de 1.0, donde el comportamiento es la salida directa del LLM sobre el prompt, en 5.0 cada turno está mediado por un " },
    { text: "motor de estado clínico", bold: true },
    { text: " (" },
    { text: "src/lib/clinical-state-engine.ts", mono: true },
    { text: ") y por instrucciones específicas turn-by-turn dentro del propio prompt. Esto hace que el comportamiento esperado sea predecible y medible." },
  ]),
  h2("7.1 Variables de estado por turno"),
  body([
    { text: "Cada turno se registra en la tabla " },
    { text: "clinical_state_log", mono: true },
    { text: " con 5 variables y 5 deltas:" },
  ]),
  kvTable([
    ["resistencia", "0–10. Inicial sugerida 7. Disminuye con validación, aumenta con confrontación prematura."],
    ["alianza", "0–10. Inicial sugerida 2. Aumenta con validación, escucha activa, tolerancia al silencio."],
    ["apertura_emocional", "0–10. Inicial sugerida 2. Aumenta con preguntas abiertas y espacio."],
    ["sintomatologia", "0–10. Inicial sugerida 7. Cambia poco intra-sesión; refleja el motivo de consulta."],
    ["disposicion_cambio", "0–10. Inicial sugerida 2. Aumenta cuando el paciente verbaliza posibilidades de futuro."],
  ]),
  h2("7.2 Apertura gradual prescrita"),
  body("El prompt incluye una sección explícita \"LO QUE NO REVELAS FÁCILMENTE\" con tres revelaciones reservadas para sesión 3+ con alianza terapéutica fuerte:"),
  body("1. Sentirse profundamente solo y creer que nadie lo entiende.\n2. Pensar que decepciona a su madre.\n3. Extrañar su casa pero tener vergüenza de admitirlo."),
  body("Esta arquitectura por capas mimetiza la lógica de la entrevista clínica real: los contenidos sensibles requieren confianza acumulada. El motor (eventualmente, hoy parcial) puede consultar variables de alianza y session_number antes de permitir que el modelo revele estos contenidos."),
  h2("7.3 Tipos de intervención clasificadas"),
  body([
    { text: "El sistema clasifica las intervenciones del estudiante en 11 tipos discretos (" },
    { text: "pregunta abierta", italic: true }, { text: ", " },
    { text: "pregunta cerrada", italic: true }, { text: ", " },
    { text: "validación empática", italic: true }, { text: ", " },
    { text: "silencio terapéutico", italic: true }, { text: ", " },
    { text: "confrontación", italic: true }, { text: ", " },
    { text: "reformulación", italic: true }, { text: ", " },
    { text: "psicoeducación", italic: true }, { text: ", " },
    { text: "reflejo", italic: true }, { text: ", " },
    { text: "juicio", italic: true }, { text: ", " },
    { text: "consejo", italic: true }, { text: ", " },
    { text: "fuera de rol", italic: true },
    { text: ") y aplica reglas de transición sobre las variables de estado. Estas reglas no están específicas a Diego — son globales, pero su personalidad pasiva y resistencia baja-pasiva implican que sus deltas serán menos extremos que los de un paciente como Carmen Torres (advanced, resistencia active_testing)." },
  ]),

  pageBreak(),

  // ─── §8 CAPACIDADES TÉCNICAS ───
  h1("8. Capacidades técnicas asociadas al paciente"),
  kvTable([
    ["Voz (TTS)", [{ text: "Disponible globalmente en la plataforma; Diego aún no asignó " }, { text: "voice_id", italic: true }, { text: ". Otros pacientes (Roberto, Fernanda) sí tienen voz ElevenLabs." }]],
    ["Voz (STT)", "Disponible. El estudiante puede dictar sus intervenciones (walkie-talkie, INF-2026-005). Asociado al chat global, no al paciente."],
    ["Imagen del paciente", [{ text: "Generada desde " }, { text: "visual_identity", italic: true }, { text: " con DALL-E. Regenerable, auditable, parametrizada." }]],
    ["Streaming de respuestas", "Sí. SSE / ReadableStream nativo. El estudiante ve la respuesta del paciente palabra por palabra (calibrado en INF-2026-039)."],
    ["Pacing conversacional", [{ text: "Sí. " }, { text: "conversational_medium", italic: true }, { text: " (~27 cps de tipeo calibrado, sentenceGap real entre oraciones, thinking-delay server-side)." }]],
    ["Memoria entre sesiones", [{ text: "Sí. " }, { text: "session_summaries", italic: true }, { text: ": resumen IA al final de cada sesión, cargado al inicio de la siguiente para continuidad." }]],
    ["Estado clínico cuantificado", [{ text: "Sí. 5 variables snapshot por turno en " }, { text: "clinical_state_log", italic: true }, { text: "; permite replay y análisis longitudinal." }]],
    ["Evaluación post-sesión", "Sí. 10 competencias Valdés y Gómez (2023, UST) con evidencia textual; aprobación docente; visible al estudiante post-aprobación."],
    ["Persistencia local", "Mensajes en PostgreSQL (Supabase) con índices, RLS y políticas por rol. Backup gestionado, recuperación trivial."],
    ["Capa de seguridad de contenido", [{ text: "content-safety.ts", italic: true }, { text: " + " }, { text: "buildSafetyPrompt", italic: true }, { text: " con doble anclaje (inicio + final del prompt) — INF-2026-037, INF-2026-039." }]],
    ["Protección mid-session", [{ text: "prompt_snapshot", italic: true }, { text: " en conversaciones congela el prompt al iniciar la sesión, protegiendo a sesiones en curso de cambios al prompt en producción." }]],
    ["Notas docentes", [{ text: "Campo " }, { text: "teacher_notes", italic: true }, { text: " disponible (vacío hoy para Diego). Permite anotaciones del instructor sobre cómo conducir la práctica con este paciente." }]],
  ]),
  h3("Datos clínicos no recolectados (campos vacíos pero soportados)"),
  body([
    { text: "• ", bold: true },
    { text: "distinctive_factor", bold: true },
    { text: ": " },
    { text: "null", italic: true },
    { text: ". No hay un rasgo identitario priorizado (feminismo, identidad de género, migración forzada, discapacidad, etc.). Diego es un caso clásico de adaptación universitaria sin un eje identitario diferencial." },
  ]),
  body([
    { text: "• ", bold: true },
    { text: "voice_id", bold: true },
    { text: ": " },
    { text: "null", italic: true },
    { text: ". Pendiente de asignación." },
  ]),
  body([
    { text: "• ", bold: true },
    { text: "teacher_notes", bold: true },
    { text: ": " },
    { text: "null", italic: true },
    { text: ". Pendiente de redacción por equipo académico." },
  ]),
  body([
    { text: "• ", bold: true },
    { text: "short_narrative", bold: true }, { text: ", " },
    { text: "extended_narrative", bold: true }, { text: ", " },
    { text: "coherence_review", bold: true }, { text: ", " },
    { text: "projections", bold: true },
    { text: ": vacíos porque Diego no pasó por el pipeline de creación de 15 pasos (es legacy, no nuevo)." },
  ]),

  pageBreak(),

  // ─── §9 LIMITACIONES ÉTICAS ───
  h1("9. Limitaciones y consideraciones éticas"),
  h2("9.1 Limitaciones del informe"),
  body([
    { text: "• ", bold: true },
    { text: "Sin transcripción real: ", bold: true },
    { text: "a diferencia de Alejandro López (donde se incluyó un fragmento real anonimizado de una sesión rescatada), Diego Fuentes no tiene volumen suficiente de conversaciones en producción al cierre de este informe (la base canónica nueva tiene 4 conversaciones totales, ninguna con Diego). Por eso el §7 describe el comportamiento " },
    { text: "esperado", italic: true },
    { text: " según el prompt y la arquitectura, no " },
    { text: "observado", italic: true },
    { text: "." },
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Posible deriva entre prompt y comportamiento real: ", bold: true },
    { text: "al igual que en 1.0, el LLM puede no adherir perfectamente al prompt. La adherencia se mide indirectamente por las evaluaciones de competencias y por revisión docente, pero no hay un test sistemático específico para Diego." },
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Asignación de pacing por heurística: ", bold: true },
    { text: "el pacing_profile fue asignado con reglas heurísticas sobre el prompt, no con observación empírica. La calidad del match puede revisarse cuando haya conversaciones reales." },
  ]),
  h2("9.2 Consideraciones éticas"),
  body([
    { text: "• ", bold: true },
    { text: "Apropiación cultural de testimonio: ", bold: true },
    { text: "Diego es un personaje sintético, pero está construido sobre arquetipos de jóvenes universitarios chilenos reales. Aunque no representa a una persona específica, sí tiene patrones reconocibles (ascendencia europea de tez clara con manchas de sol, hoodie oversized, audífonos al cuello). El equipo debe vigilar que el conjunto de pacientes 5.0 no sobrerrepresente perfiles \"cómodos\" ignorando otros." },
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Decisión de remover ideación suicida: ", bold: true },
    { text: "esta decisión protege en el corto plazo (prevención de iatrogenia, ver §3.2), pero también " },
    { text: "limita la práctica", bold: true },
    { text: " de evaluación de riesgo, que es una competencia clínica esencial. La decisión es pragmática y revisable: cuando GlorIA tenga supervisión clínica humana real, esta competencia podría reincorporarse en un paciente dedicado con safeguards específicos." },
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Sesgo de género y demografía en el conjunto: ", bold: true },
    { text: "Diego es uno de pocos estudiantes universitarios varones jóvenes en el conjunto de 34 pacientes. Esto es una elección deliberada (favorecer la diversidad de motivos de consulta por sobre la diversidad de demografía), pero implica que para practicar con \"hombre joven con malestar académico\" sólo está Diego, sin alternativas. Una expansión futura podría diversificar este nicho." },
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Privacidad y permanencia: ", bold: true },
    { text: "los registros de conversaciones reales con Diego, cuando los haya, contendrán intervenciones de estudiantes — datos sensibles que deben rotar y anonimizarse según política institucional. Las políticas RLS y el módulo de borrado post-piloto cubren este aspecto en el diseño actual." },
  ]),

  empty(),

  // ─── §10 CITAS ───
  h1("10. Citas y referencias"),
  h2("10.1 Migraciones citadas"),
  body([
    { text: "Todas en " },
    { text: "supabase/migrations/", mono: true },
    { text: ":" },
  ]),
  body([{ text: "• " }, { text: "20260313203704_initial_schema.sql", mono: true }, { text: " — schema base de ai_patients con campos originales." }]),
  body([{ text: "• " }, { text: "20260313203745_seed_ai_patients.sql:39-53", mono: true }, { text: " — seed original de Diego (con ideación suicida)." }]),
  body([{ text: "• " }, { text: "20260315142610_patient_personal_details.sql", mono: true }, { text: " — agrega birthday, neighborhood, family_members." }]),
  body([{ text: "• " }, { text: "20260316032447_fix_nonverbal_instructions.sql", mono: true }, { text: " — estandariza lenguaje no verbal en tercera persona." }]),
  body([{ text: "• " }, { text: "20260316115606_fix_accents_all_patients.sql", mono: true }, { text: " — tildes y ñ." }]),
  body([{ text: "• " }, { text: "20260316165059_patient_creation_workflow.sql", mono: true }, { text: " — pipeline de 15 pasos (Diego es legacy, no usó este pipeline)." }]),
  body([{ text: "• " }, { text: "20260316191043_patient_voice_id.sql", mono: true }, { text: " — agrega campo voice_id (Diego sigue sin voz)." }]),
  body([{ text: "• " }, { text: "20260316220000_patient_visual_identity.sql", mono: true }, { text: " — asigna visual_identity a Diego." }]),
  body([{ text: "• " }, { text: "20260316230000_patient_distinctive_factor.sql", mono: true }, { text: " — agrega campo distinctive_factor (Diego sin asignar)." }]),
  body([{ text: "• " }, { text: "20260320130000_teacher_notes_ai_patients.sql", mono: true }, { text: " — agrega teacher_notes (Diego sin asignar)." }]),
  body([{ text: "• " }, { text: "20260413120000_upgrade_legacy_patients.sql:142-203", mono: true }, { text: " — " }, { text: "upgrade crítico", bold: true }, { text: " de Diego, removida ideación suicida." }]),
  body([{ text: "• " }, { text: "20260414100000_resync_snapshots_post_upgrade.sql", mono: true }, { text: " — actualización de prompt_snapshot en sesiones activas." }]),
  body([{ text: "• " }, { text: "20260414160000_ai_patients_pacing_profile.sql", mono: true }, { text: " — asignación de pacing_profile a Diego." }]),
  h2("10.2 Código relevante"),
  body([{ text: "• " }, { text: "src/lib/ai.ts", mono: true }, { text: " — interfaz unificada OpenAI/Gemini." }]),
  body([{ text: "• " }, { text: "src/lib/clinical-state-engine.ts", mono: true }, { text: " — motor de estado clínico." }]),
  body([{ text: "• " }, { text: "src/lib/conversation-pacing.ts", mono: true }, { text: " — pacing por perfil." }]),
  body([{ text: "• " }, { text: "src/lib/content-safety.ts", mono: true }, { text: " — filtros de contenido." }]),
  body([{ text: "• " }, { text: "src/lib/build-safety-prompt.ts", mono: true }, { text: " — anclaje doble del safety-prompt." }]),
  h2("10.3 Informes hermanos"),
  body([{ text: "• INF-2026-047 — Caso Clínico GlorIA 1.0: Alejandro López (documento hermano).", bold: true }]),
  body("• INF-2026-013 — Comparativo arquitectónico GlorIA 1.0 vs 5.0."),
  body("• INF-2026-028 — Resiliencia LLM (failover OpenAI ↔ Gemini)."),
  body("• INF-2026-029 — Cambio de modelo gpt-4o-mini → gpt-4.1-mini."),
  body("• INF-2026-037 — Upgrade pacientes legacy y capa de safety."),
  body("• INF-2026-039 — Calibración conversacional, pacing, accesibilidad."),
  body("• INF-2026-008 — Análisis clínico-pedagógico de robustez de pacientes."),
  h2("10.4 Referencias clínicas"),
  body([
    { text: "• Valdés, A., y Gómez, J. (2023). " },
    { text: "Pauta de evaluación de competencias psicoterapéuticas básicas", italic: true },
    { text: ". Universidad Santo Tomás. — Marco usado para las 10 competencias evaluadas en sesiones 5.0." },
  ]),
];

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
    {
      properties: { page: { size: { width: PAGE_W, height: 15840 }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }} },
      children: cover
    },
    {
      properties: { page: { size: { width: PAGE_W, height: 15840 }, margin: { top: MARGIN, right: MARGIN, bottom: 1080, left: MARGIN }} },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "INF-2026-048 — Caso Clínico GlorIA 5.0: Diego Fuentes", size: 16, font: "Calibri", color: GREY, italics: true })]
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
  const outPath = "informes/investigacion/INF-2026-048_paciente-5.0-diego-fuentes.docx";
  fs.writeFileSync(outPath, buf);
  console.log(`Generado: ${outPath} — ${(buf.length/1024).toFixed(1)} KB`);
});
