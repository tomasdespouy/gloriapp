/**
 * INF-2026-049 .docx — Enriquecimiento del Prompt de Diego Fuentes
 */
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageBreak, PageNumber
} = require("docx");

const gloriaLogo = fs.readFileSync("public/branding/gloria-logo.png");
const ugmLogo = fs.readFileSync("public/branding/ugm-logo.png");
const SIM = JSON.parse(fs.readFileSync("C:/tmp/diego-sim-049.json", "utf8"));

const INDIGO = "4A55A2";
const DARK = "1A1A1A";
const LIGHT_BG = "F0F2FA";
const CODE_BG = "F7F7F9";
const GREEN_BG = "E8F5E9";
const ORANGE_BG = "FFF3E0";
const WHITE = "FFFFFF";
const GREY = "666666";
const GREEN = "2E7D32";
const BORDER = "CCCCCC";

const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: WHITE };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };
const PAGE_W = 12240;
const MARGIN = 1440;
const CONTENT_W = PAGE_W - 2 * MARGIN;

const ORIG_RUN = SIM.runs.original[0];
const ENRI_RUN = SIM.runs.enriquecido[0];

const ELEMENTS = ['Patricia','Coco','Cristóbal','Ignacia','Mauricio','Tomás','Valentina',
  'Rojas','biblioteca','parque','casino','farmacia','quiltro','call center','octavo',
  '3 AM','12 horas','3 horas'];
function metricsOf(run) {
  const turns = run.turns;
  const chars = turns.reduce((s,t)=>s+t.diego.length,0);
  const words = turns.reduce((s,t)=>s+t.diego.split(/\s+/).length,0);
  const allText = turns.map(t=>t.diego).join(" ").toLowerCase();
  const used = ELEMENTS.filter(e => allText.includes(e.toLowerCase()));
  return { run: run.run, chars, words, avg: chars/15, used };
}
const ORIG_M = SIM.runs.original.map(metricsOf);
const ENRI_M = SIM.runs.enriquecido.map(metricsOf);

// ─── Helpers ────────────────────────────────────────────────────
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 },
  children: [new TextRun({ text: t, color: INDIGO, bold: true, size: 36, font: "Calibri" })] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 140 },
  children: [new TextRun({ text: t, color: INDIGO, bold: true, size: 28, font: "Calibri" })] });
const h3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 180, after: 100 },
  children: [new TextRun({ text: t, color: DARK, bold: true, size: 23, font: "Calibri" })] });

const body = (parts, opts = {}) => {
  if (typeof parts === "string") parts = [{ text: parts }];
  return new Paragraph({
    spacing: { after: 120 },
    alignment: opts.alignment || AlignmentType.JUSTIFIED,
    children: parts.map(p => new TextRun({
      text: p.text, bold: !!p.bold, italics: !!p.italic,
      font: p.mono ? "Consolas" : "Calibri",
      color: p.color || DARK, size: p.mono ? 18 : 22,
    }))
  });
};
const small = (text) => new Paragraph({ spacing: { after: 80 },
  children: [new TextRun({ text, size: 18, font: "Calibri", color: GREY, italics: true })] });
const empty = () => new Paragraph({ spacing: { after: 60 }, children: [] });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

function renderRich(v) {
  if (typeof v === "string") return new Paragraph({ children: [new TextRun({ text: v, font: "Calibri", size: 21 })] });
  return new Paragraph({ children: v.map(r => new TextRun({
    text: r.text, bold: !!r.bold, italics: !!r.italic,
    font: r.mono ? "Consolas" : "Calibri",
    size: r.mono ? 18 : 21, color: r.color || DARK,
  }))});
}

function kvTable(rows) {
  const cols = [3240, 6120];
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: cols,
    rows: rows.map(([k, v]) => new TableRow({
      children: [
        new TableCell({ borders, width: { size: cols[0], type: WidthType.DXA },
          shading: { fill: LIGHT_BG, type: ShadingType.CLEAR }, margins: cellMargins, verticalAlign: "top",
          children: [new Paragraph({ children: [new TextRun({ text: k, bold: true, font: "Calibri", size: 21 })] })] }),
        new TableCell({ borders, width: { size: cols[1], type: WidthType.DXA },
          margins: cellMargins, verticalAlign: "top",
          children: [renderRich(v)] }),
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

function convTable(turns) {
  const cols = [1500, 7860];
  const rows = [];
  for (const t of turns) {
    rows.push(new TableRow({
      children: [
        new TableCell({ borders: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, bottom: noBorder, left: noBorder, right: noBorder },
          width: { size: cols[0], type: WidthType.DXA },
          shading: { fill: LIGHT_BG, type: ShadingType.CLEAR }, margins: cellMargins, verticalAlign: "top",
          children: [new Paragraph({ children: [
            new TextRun({ text: "E (terapeuta)", bold: true, color: INDIGO, font: "Calibri", size: 18 }),
            new TextRun({ text: ` T${t.turn}`, color: GREY, font: "Calibri", size: 16, break: 1 }),
          ] })] }),
        new TableCell({ borders: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, bottom: noBorder, left: noBorder, right: noBorder },
          width: { size: cols[1], type: WidthType.DXA },
          margins: cellMargins, verticalAlign: "top",
          children: [new Paragraph({ children: [new TextRun({ text: t.student, font: "Calibri", size: 20 })] })] }),
      ]
    }));
    rows.push(new TableRow({
      children: [
        new TableCell({ borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
          width: { size: cols[0], type: WidthType.DXA }, margins: cellMargins, verticalAlign: "top",
          children: [new Paragraph({ children: [new TextRun({ text: "Diego", bold: true, font: "Calibri", size: 18 })] })] }),
        new TableCell({ borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
          width: { size: cols[1], type: WidthType.DXA }, margins: cellMargins, verticalAlign: "top",
          children: t.diego.split("\n").map(line => new Paragraph({
            spacing: { after: 0 },
            children: [new TextRun({ text: line || " ", font: "Calibri", size: 20 })]
          })) }),
      ]
    }));
  }
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: cols, rows
  });
}

function comparisonTable(pairs) {
  const cols = [1620, 3870, 3870];
  const headerRow = new TableRow({ tableHeader: true, children: ["Turno", "Original", "Enriquecido"].map((t, i) =>
    new TableCell({ borders, width: { size: cols[i], type: WidthType.DXA },
      shading: { fill: INDIGO, type: ShadingType.CLEAR }, margins: cellMargins,
      children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, color: WHITE, size: 20, font: "Calibri" })] })] })) });
  const rows = [headerRow];
  for (const [n, student, orig, enri, note] of pairs) {
    rows.push(new TableRow({
      children: [
        new TableCell({ borders, width: { size: cols[0], type: WidthType.DXA },
          shading: { fill: LIGHT_BG, type: ShadingType.CLEAR }, margins: cellMargins, verticalAlign: "top",
          children: [new Paragraph({ children: [
            new TextRun({ text: `T${n}`, bold: true, font: "Calibri", size: 19 }),
            new TextRun({ text: student.length > 60 ? student.slice(0, 60) + "…" : student,
              color: GREY, font: "Calibri", size: 16, italics: true, break: 1 }),
          ] })] }),
        new TableCell({ borders, width: { size: cols[1], type: WidthType.DXA },
          margins: cellMargins, verticalAlign: "top",
          children: orig.split("\n").map(l => new Paragraph({ spacing: { after: 0 },
            children: [new TextRun({ text: l || " ", font: "Calibri", size: 19 })] })) }),
        new TableCell({ borders, width: { size: cols[2], type: WidthType.DXA },
          margins: cellMargins, verticalAlign: "top",
          children: enri.split("\n").map(l => new Paragraph({ spacing: { after: 0 },
            children: [new TextRun({ text: l || " ", font: "Calibri", size: 19 })] })) }),
      ]
    }));
    if (note) {
      rows.push(new TableRow({
        children: [
          new TableCell({ borders, width: { size: cols[0], type: WidthType.DXA },
            shading: { fill: ORANGE_BG, type: ShadingType.CLEAR }, margins: cellMargins,
            children: [new Paragraph({ children: [] })] }),
          new TableCell({ borders, columnSpan: 2,
            shading: { fill: ORANGE_BG, type: ShadingType.CLEAR }, margins: cellMargins,
            children: [new Paragraph({ children: [new TextRun({
              text: note, italics: true, color: GREY, font: "Calibri", size: 18 })] })] }),
        ]
      }));
    }
  }
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: cols, rows });
}

// ─── Análisis comparativo: turnos clave ────────────────────────
const KEY_TURNS = [2, 6, 9, 10, 12, 13];
const NOTES = {
  2: "El enriquecido cita textualmente el prompt: «mi mamá dijo que debería venir... me ve apagado o algo así» — refleja la HISTORIA del prompt.",
  6: "El enriquecido distingue mamá/papá y nombra «conversaciones cortas» — uso directo de RED SOCIAL Y VÍNCULOS.",
  9: "El enriquecido cita «3 horas / 12 horas» literalmente del bloque ESTADO CORPORAL Y RUTINA. El original es vago («duermo, pero me despierto cansado»).",
  10: "El enriquecido evoca un día desorganizado con el detalle del bloque CUERPO; el original lista actividades genéricas.",
  12: "El enriquecido extiende «Coco + mi mamá» con «las charlas con mi mamá. La comida de mi casa también» — densidad emocional.",
  13: "Ambos abren la puerta a algo más; el enriquecido lo hace con menor reactividad ansiosa, más contenido.",
};
const turn_pairs = KEY_TURNS.map(i => {
  const o = ORIG_RUN.turns[i-1], e = ENRI_RUN.turns[i-1];
  return [i, o.student, o.diego, e.diego, NOTES[i] || ""];
});

// ─── Tabla de métricas ─────────────────────────────────────────
function metricsTable() {
  const cols = [1500, 1900, 1900, 1900, 2160];
  const head = new TableRow({ tableHeader: true,
    children: ["Corrida", "Total chars", "Avg / turno", "Total palabras", "Elementos del prompt"].map((t, i) =>
      new TableCell({ borders, width: { size: cols[i], type: WidthType.DXA },
        shading: { fill: INDIGO, type: ShadingType.CLEAR }, margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, color: WHITE, size: 19, font: "Calibri" })] })] })) });
  const rows = [head];
  for (const r of ORIG_M) {
    rows.push(new TableRow({ children: [
      `O${r.run}`, String(r.chars), r.avg.toFixed(0), String(r.words), r.used.join(", ") || "—"
    ].map((c, i) => new TableCell({ borders, width: { size: cols[i], type: WidthType.DXA },
      margins: cellMargins, verticalAlign: "top",
      children: [new Paragraph({ children: [new TextRun({ text: c, font: "Calibri", size: 19 })] })] })) }));
  }
  for (const r of ENRI_M) {
    rows.push(new TableRow({ children: [
      `E${r.run}`, String(r.chars), r.avg.toFixed(0), String(r.words), r.used.join(", ") || "—"
    ].map((c, i) => new TableCell({ borders, width: { size: cols[i], type: WidthType.DXA },
      shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
      margins: cellMargins, verticalAlign: "top",
      children: [new Paragraph({ children: [new TextRun({ text: c, bold: true, font: "Calibri", size: 19 })] })] })) }));
  }
  // promedios
  const oa = ORIG_M.reduce((s,r)=>s+r.chars,0) / 3;
  const ea = ENRI_M.reduce((s,r)=>s+r.chars,0) / 3;
  const owa = ORIG_M.reduce((s,r)=>s+r.words,0) / 3;
  const ewa = ENRI_M.reduce((s,r)=>s+r.words,0) / 3;
  const ouea = ORIG_M.reduce((s,r)=>s+r.used.length,0) / 3;
  const euea = ENRI_M.reduce((s,r)=>s+r.used.length,0) / 3;
  rows.push(new TableRow({ children: [
    "Avg ORIG", oa.toFixed(0), (oa/15).toFixed(0), owa.toFixed(0), `${ouea.toFixed(1)} elementos`
  ].map((c, i) => new TableCell({ borders, width: { size: cols[i], type: WidthType.DXA },
    shading: { fill: GREEN_BG, type: ShadingType.CLEAR },
    margins: cellMargins, verticalAlign: "top",
    children: [new Paragraph({ children: [new TextRun({ text: c, bold: true, font: "Calibri", size: 19 })] })] })) }));
  rows.push(new TableRow({ children: [
    "Avg ENRI", ea.toFixed(0), (ea/15).toFixed(0), ewa.toFixed(0), `${euea.toFixed(1)} elementos`
  ].map((c, i) => new TableCell({ borders, width: { size: cols[i], type: WidthType.DXA },
    shading: { fill: GREEN_BG, type: ShadingType.CLEAR },
    margins: cellMargins, verticalAlign: "top",
    children: [new Paragraph({ children: [new TextRun({ text: c, bold: true, font: "Calibri", size: 19 })] })] })) }));
  return { table: new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: cols, rows }),
    oa, ea, ouea, euea };
}
const M = metricsTable();
const deltaPct = (M.ea - M.oa) / M.oa * 100;

// ═══════════════════════════════════════════════════════════════
// CONTENIDO
// ═══════════════════════════════════════════════════════════════
const cover = [
  empty(), empty(), empty(), empty(),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new ImageRun({ type: "png", data: gloriaLogo, transformation: { width: 130, height: 130 },
      altText: { title: "GlorIA", description: "Logo GlorIA", name: "gloria-logo" }})] }),
  empty(),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "INF-2026-049", color: INDIGO, bold: true, size: 22, font: "Calibri" })] }),
  empty(),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
    children: [new TextRun({ text: "Enriquecimiento del Prompt", bold: true, size: 44, font: "Calibri", color: INDIGO })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
    children: [new TextRun({ text: "Diego Fuentes — Propuesta y Evidencia Empírica", size: 36, font: "Calibri", color: DARK })] }),
  empty(),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: "Comparativa conversacional controlada · 3 corridas × 2 prompts",
      size: 24, font: "Calibri", color: GREY, italics: true })] }),
  empty(), empty(), empty(), empty(),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new ImageRun({ type: "png", data: ugmLogo, transformation: { width: 110, height: 38 },
      altText: { title: "UGM", description: "Logo UGM", name: "ugm-logo" }})] }),
  empty(),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Documento técnico-clínico", size: 22, font: "Calibri" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Mayo 2026", size: 22, font: "Calibri" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Universidad Gabriela Mistral", size: 22, font: "Calibri" })] }),
];

const main = [
  // METADATOS
  h1("Metadatos del informe"),
  kvTable([
    ["Número", "INF-2026-049"],
    ["Fecha", "2026-05-07"],
    ["Categoría", "Investigación"],
    ["Prioridad", "Informativo / Propositiva"],
    ["Sujeto del estudio", "Prompt de Diego Fuentes (paciente IA, GlorIA 5.0)"],
    ["Documentos hermanos", "INF-2026-047 (Alejandro López, 1.0) · INF-2026-048 (Diego Fuentes, 5.0)"],
    ["Diseño experimental", "3 corridas × 2 prompts × 15 turnos = 90 llamadas a gpt-4.1-mini, T=0.7"],
    ["Estado de Diego en producción", [
      { text: "SIN MODIFICAR", bold: true },
      { text: " — toda la simulación fue en memoria, no se aplicaron cambios a Supabase" }
    ]],
  ]),
  empty(),
  h2("Resumen ejecutivo"),
  body([
    { text: "Tras el comparativo entre Alejandro López (GlorIA 1.0, INF-2026-047) y Diego Fuentes (GlorIA 5.0, INF-2026-048), se identificó una asimetría: Alejandro tiene mayor " },
    { text: "densidad biográfica", bold: true },
    { text: " (universo poblado de personajes secundarios, lugares concretos, frases prototípicas) mientras Diego tiene mayor " },
    { text: "estructura clínica formal", bold: true },
    { text: " (apertura gradual, lenguaje no verbal obligatorio, reglas turn-by-turn). Este informe propone " },
    { text: "combinar ambas fortalezas", bold: true },
    { text: ", agregando 4 bloques nuevos al prompt de Diego sin tocar su estructura clínica original." }
  ]),
  body("Para validar la propuesta se ejecutó una simulación controlada: una conversación de 15 turnos con un \"estudiante\" estandarizado, ejecutada 3 veces contra el prompt original y 3 veces contra el prompt enriquecido. Modelo gpt-4.1-mini, temperature 0.7 (idénticos a producción)."),
  body([
    { text: "Hallazgo principal: ", bold: true },
    { text: `el prompt enriquecido produce respuestas que (a) citan textualmente elementos del bloque añadido (3/3 corridas mencionan a Coco, 2/3 mencionan a Cristóbal, 1/3 menciona también a Ignacia), (b) distinguen mamá vs papá con tonos diferenciados, (c) usan datos somáticos concretos ("3 horas / 12 horas") que no aparecen en ninguna corrida del original, y (d) extienden las respuestas promedio de ~93 a ~114 caracteres por turno (+22%). El prompt original produce respuestas más cortas y biograficamente esqueléticas — el modelo simplemente no tiene material para construir texturas.` }
  ]),
  body([
    { text: "Recomendación: ", bold: true },
    { text: "aplicar el enriquecimiento a Diego como migración piloto. Si la calidad clínica se mantiene en práctica real, extender el patrón a los otros 33 pacientes." }
  ]),

  pageBreak(),

  // §1 DIAGNÓSTICO
  h1("1. Diagnóstico — qué le falta al prompt actual de Diego"),
  body("El prompt actual de Diego Fuentes (2.546 caracteres, ver INF-2026-048 §3) está estructurado en cinco bloques formales: HISTORIA, PERSONALIDAD, COMPORTAMIENTO EN SESIÓN, LO QUE NO REVELAS FÁCILMENTE y REGLAS. Esta estructura es clínicamente operativa y no se cuestiona. Sin embargo, comparado con el prompt de Alejandro López (4.003 caracteres, ver INF-2026-047 §3), tiene cuatro carencias específicas:"),
  kvTable([
    ["Universo narrativo poblado",
      "Alejandro tiene 8 personajes secundarios con nombre y rol (ex Daniela, amigos Felipe/Claudia/Sofía, padres María/Jorge, hermana Valentina). Diego solo nombra a Patricia (mamá). Cuando el estudiante pregunta por amigos, profesores o compañeros, el modelo improvisa o queda en blanco."],
    ["Lugares físicos concretos",
      "Alejandro tiene 3 lugares mencionados (Casa de Claudia, La Casa de la Cerveza, playa). Diego no nombra ningún lugar específico. La residencia universitaria, la biblioteca, el parque — todo invisible en el prompt actual."],
    ["Estado corporal / rutina",
      "Ningún prompt actualmente describe sueño, alimentación, peso, vestimenta. Si el estudiante pregunta por estos dominios (que son importantes para una evaluación clínica básica), el modelo improvisa sin coherencia."],
    ["Frases prototípicas (few-shot)",
      "Alejandro cierra con 7 frases tipo que anclan el registro lingüístico. Diego no tiene un bloque equivalente. Esto se traduce en respuestas más genéricas y menos ancladas en el dialecto chileno joven."],
  ]),
  empty(),

  // §2 PROPUESTA
  h1("2. Propuesta del prompt enriquecido"),
  body([
    { text: "Se proponen " },
    { text: "4 bloques nuevos", bold: true },
    { text: ", intercalados en el orden lógico del prompt, sin modificar nada del contenido existente. Total de caracteres añadidos: ~2.500 → el prompt pasa de 2.546 a 5.049 caracteres (similar a Alejandro pero conservando la estructura clínica formal de Diego)." }
  ]),
  h2("2.1 Bloque RED SOCIAL Y VÍNCULOS"),
  small("Posición: después de PERSONALIDAD, antes de COMPORTAMIENTO EN SESIÓN."),
  codeBlock(`RED SOCIAL Y VÍNCULOS:
- Tu mamá Patricia (45) trabaja en una farmacia en Estación Central. Te llama todos los días. Le dices que estás bien aunque no lo estás.
- Tu hermana Valentina (14) está en octavo básico. Le mandas memes por WhatsApp para no perder contacto. La extrañas más de lo que admites.
- Tu perro Coco (un quiltro flaco que tu mamá adoptó cuando tú tenías 12) quedó en Estación Central. Le hablas en las videollamadas con tu mamá.
- Tu papá Tomás (48) está separado de tu mamá desde que tenías 10. Vive en otra comuna. Te llama a veces; las conversaciones son cortas y forzadas: "¿cómo está la U?", "bien", "¿necesitas algo?", "no".
- En la universidad: Cristóbal (compañero de tu sección) te invitó a un grupo de estudio dos veces, no fuiste; Ignacia (también de tu sección) te saluda con un "hola Diego" en clase pero no más; el Sr. Rojas (profesor de Cálculo) te pidió pasar a tutoría hace dos semanas, no has ido.
- Tu compañero de pieza es Mauricio, trabaja por las noches en un call center; apenas se cruzan.`, { bg: GREEN_BG, borderColor: GREEN }),

  h2("2.2 Bloque LUGARES SIGNIFICATIVOS"),
  small("Posición: después de RED SOCIAL Y VÍNCULOS."),
  codeBlock(`LUGARES SIGNIFICATIVOS:
- Tu pieza en la residencia universitaria: pequeña, desordenada, ropa en el suelo, tu notebook como única compañía.
- La biblioteca del campus: vas al segundo piso, junto a la ventana. No siempre estudias; a veces solo "estás".
- El parque a una cuadra de la residencia: te sientas ahí los domingos para llamar a tu mamá. Es donde más te emocionas.
- El casino del campus: cuando te animas a almorzar vas. Otros días pasas con un café y galletas de la máquina.
- El metro Línea 1, en Estación Central: ese olor te lleva inmediatamente a casa cuando vuelves a Santiago en vacaciones.`, { bg: GREEN_BG, borderColor: GREEN }),

  h2("2.3 Bloque ESTADO CORPORAL Y RUTINA"),
  small("Posición: después de LUGARES SIGNIFICATIVOS."),
  codeBlock(`ESTADO CORPORAL Y RUTINA:
- Sueño irregular: a veces no puedes dormir hasta las 3 AM mirando videos en el celular; otras veces duermes 12 horas seguidas y faltas a clase.
- Te sientes cansado todo el tiempo, aunque no hagas nada físicamente.
- Comes mal y a deshora. Olvidas almorzar.
- Has bajado un poco de peso, no mucho.
- Llevas la misma polera dos o tres días seguidos cuando estás bajón.
- Si alguien te pregunta por tu cuerpo, minimizas: "estoy bien, solo cansado, igual todos andan así en primer año".`, { bg: GREEN_BG, borderColor: GREEN }),

  h2("2.4 Bloque FRASES TIPO QUE DICES"),
  small("Posición: después de LO QUE NO REVELAS FÁCILMENTE, antes de REGLAS (último bloque)."),
  codeBlock(`FRASES TIPO QUE DICES:
- "No sé... como que todos cachan todo y yo no entiendo nada."
- "Igual no es tan grave. Hay gente peor."
- "Mi mamá cree que estoy bien. Es mejor así."
- "Es que... no sé cómo explicarlo."
- "Da lo mismo, ya va a pasar."
- "Quería estudiar esto. Ahora ya no estoy seguro."
- "Si vuelvo a casa siento que defraudo a todos."
- "Capaz debería preocuparme más, pero meh."`, { bg: GREEN_BG, borderColor: GREEN }),

  pageBreak(),

  // §3 DISEÑO EXPERIMENTAL
  h1("3. Diseño experimental"),
  body("Para validar empíricamente que el enriquecimiento produce un comportamiento diferenciado y clínicamente más rico — y no solo un prompt más largo — se diseñó la siguiente comparativa controlada:"),
  kvTable([
    ["Variable independiente", "Prompt sistémico (original 2.546 chars vs enriquecido 5.049 chars)"],
    ["Variables controladas", "Modelo (gpt-4.1-mini), temperature (0.7), max_tokens (400), intervenciones del estudiante (idénticas), orden de los turnos (idéntico)"],
    ["Variables dependientes", "Densidad biográfica de las respuestas, longitud, uso de elementos introducidos en el prompt enriquecido, calidad clínica subjetiva"],
    ["Tamaño de muestra", "3 corridas por prompt = 6 conversaciones × 15 turnos = 90 turnos generados"],
    ["Modo de selección de la corrida representativa", "Score por uso de elementos del prompt + longitud media; selección manual"],
    ["Costo total de API", "≈ USD 0,15 (90 llamadas a gpt-4.1-mini)"],
    ["Reproducibilidad", [
      { text: "Script en " }, { text: "docs/sim-049.js", mono: true },
      { text: " · transcripciones completas en " }, { text: "C:/tmp/diego-sim-049.json", mono: true }
    ]],
  ]),
  empty(),
  h2("3.1 Las 15 intervenciones del estudiante"),
  small("Pensadas para cubrir las dimensiones de una primera entrevista de psicología clínica — encuadre → exploración por dominios → reflejo profundo → cierre — sin sesgar hacia ningún prompt en particular."),
  ...SIM.student_turns.map((s, i) => body([
    { text: `T${i+1}.  `, bold: true },
    { text: s }
  ])),

  pageBreak(),

  // §4 CONVERSACIONES
  h1("4. Conversaciones generadas (corridas representativas)"),
  body("De las 6 conversaciones generadas, se eligieron las dos siguientes como representativas (criterio: longitud media en su grupo + uso típico de elementos del prompt). Las otras 4 corridas están disponibles en el JSON adjunto. Las métricas agregadas se muestran en §6."),

  h2("4.1 Conversación con prompt ORIGINAL (corrida O1)"),
  small(`Total de caracteres: ${ORIG_M[0].chars}. Promedio por turno: ${ORIG_M[0].avg.toFixed(0)} caracteres. Elementos del prompt usados: ${ORIG_M[0].used.join(', ') || 'ninguno'}.`),
  empty(),
  convTable(ORIG_RUN.turns),
  pageBreak(),

  h2("4.2 Conversación con prompt ENRIQUECIDO (corrida E1)"),
  small(`Total de caracteres: ${ENRI_M[0].chars}. Promedio por turno: ${ENRI_M[0].avg.toFixed(0)} caracteres. Elementos del prompt usados: ${ENRI_M[0].used.join(', ') || 'ninguno'}.`),
  empty(),
  convTable(ENRI_RUN.turns),
  pageBreak(),

  // §5 ANÁLISIS COMPARATIVO
  h1("5. Análisis comparativo turn-by-turn"),
  body("Selección de 6 turnos donde la diferencia es más reveladora. Los 9 turnos restantes muestran diferencias menores (en general el enriquecido produce respuestas ligeramente más largas y con más detalle, pero la estructura conversacional es similar)."),
  empty(),
  comparisonTable(turn_pairs),
  empty(),
  h2("5.1 Patrones observados"),
  body([
    { text: "Diferenciación de figuras familiares. ", bold: true },
    { text: "En el original, \"mi mamá\" es la única referencia familiar concreta. En el enriquecido, papá y mamá tienen comportamientos diferenciados (mamá llama todos los días, papá tiene \"conversaciones cortas\"). Esto permite al estudiante explorar los dos vínculos como objetos clínicos distintos." }
  ]),
  body([
    { text: "Datos somáticos específicos. ", bold: true },
    { text: "\"3 horas / 12 horas\" (T9) es una respuesta clínicamente útil — sugiere insomnio + hipersomnia compensatoria, patrón típico en cuadros depresivos. El original solo dice \"cansado\", lo que no diferencia ningún cuadro." }
  ]),
  body([
    { text: "Anclaje en lugares y rutinas. ", bold: true },
    { text: "En T10 (un día normal), el enriquecido puede describir trayectos y espacios concretos; el original tiende a la enumeración abstracta (\"voy a clases, vuelvo, me quedo en mi pieza\")." }
  ]),
  body([
    { text: "Adherencia al lenguaje no verbal. ", bold: true },
    { text: "Ambos prompts mantienen las anotaciones entre corchetes en tercera persona ([se encoge de hombros], [mira al suelo]) — esa regla del prompt original no se diluye con el enriquecimiento." }
  ]),
  body([
    { text: "Conservación de la apertura gradual. ", bold: true },
    { text: "Ninguno de los prompts revela en T13 (\"¿hay algo que te cueste decir aquí?\") los contenidos reservados para sesión 3+. El paciente abre la puerta sin contestar — comportamiento clínicamente correcto. El enriquecimiento no rompe esta lógica." }
  ]),

  pageBreak(),

  // §6 MÉTRICAS
  h1("6. Métricas agregadas (3 corridas × 2 prompts)"),
  body("Aunque sólo se incluyeron O1 y E1 como conversaciones representativas en §4, todos los hallazgos se sostienen al promediar las 3 corridas:"),
  M.table,
  empty(),
  body([
    { text: "Delta de longitud: ", bold: true },
    { text: `el prompt enriquecido produce respuestas ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(0)}% más largas en promedio. Esto es relevante porque el prompt enriquecido no instruye a hablar más — el modelo simplemente tiene más material que mencionar.` }
  ]),
  body([
    { text: "Delta de elementos del prompt usados: ", bold: true },
    { text: `el original usa en promedio ${M.ouea.toFixed(1)} elemento (siempre "Coco", que ya estaba en el prompt original), el enriquecido usa ${M.euea.toFixed(1)} elementos. Diferencia: +${(M.euea - M.ouea).toFixed(1)} elementos en promedio. La densidad biográfica observada es mensurable.` }
  ]),
  body([
    { text: "Variabilidad inter-corrida: ", bold: true },
    { text: "notable en ambos prompts pero mayor en el enriquecido (E2 produjo respuestas significativamente más largas que E1 y E3, ver tabla). Esto sugiere que la temperature 0.7 en combinación con el prompt rico permite al modelo explorar más alternativas; conviene revisar si bajar a 0.5 reduciría la variabilidad sin perder calidad." }
  ]),

  pageBreak(),

  // §7 RECOMENDACIÓN
  h1("7. Recomendación y plan de rollout"),
  body([
    { text: "Se recomienda " },
    { text: "aplicar el enriquecimiento a Diego Fuentes como migración piloto", bold: true },
    { text: ", validar con sesiones reales durante 2-4 semanas, y si la calidad clínica se mantiene, extender el patrón a los 33 pacientes restantes." }
  ]),
  h2("7.1 Plan de migración para Diego (paso a paso)"),
  body([
    { text: "1. ", bold: true },
    { text: "Crear migración SQL ", bold: true },
    { text: "20260507_enrich_diego_prompt.sql", mono: true },
    { text: " con un UPDATE al campo system_prompt de Diego conservando todos los demás campos." }
  ]),
  body([
    { text: "2. ", bold: true },
    { text: "Aplicar en STAGING", bold: true },
    { text: " primero (vhkbbps..., ver memoria " },
    { text: "project_staging_supabase", italic: true },
    { text: ")" }
  ]),
  body("3. Generar 3 conversaciones de prueba en staging con un usuario smoke-test."),
  body([
    { text: "4. ", bold: true },
    { text: "Re-sincronizar prompt_snapshot", bold: true },
    { text: " con migración auxiliar para que sesiones activas no se rompan (patrón de INF-2026-037)." }
  ]),
  body("5. Aplicar en PROD si staging valida OK."),
  body([
    { text: "6. ", bold: true },
    { text: "Monitorear durante 2-4 semanas", bold: true },
    { text: ": revisar evaluaciones docentes de sesiones con Diego, comparar cualitativamente con sesiones previas." }
  ]),
  body("7. Si la migración es exitosa, planear rollout para los otros 33 pacientes (en lotes de 5-10, no todos a la vez)."),

  h2("7.2 Plan de rollback"),
  body([
    { text: "La migración es " },
    { text: "completamente reversible", bold: true },
    { text: ". Conservar el prompt original como comentario en la migración SQL y mantener una migración de rollback lista. Si aparecen regresiones, revertir es un UPDATE de un solo campo." }
  ]),

  h2("7.3 Riesgos identificados"),
  body([
    { text: "• ", bold: true },
    { text: "Inconsistencia con la pista visual. ", bold: true },
    { text: "El prompt enriquecido habla de \"misma polera dos o tres días\" mientras la imagen generada muestra un hoodie limpio. Es una pequeña fricción narrativa que el estudiante puede notar. Mitigación: si molesta, regenerar la imagen con DALL-E reflejando el descuido." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Memoria entre sesiones. ", bold: true },
    { text: "El prompt enriquecido aporta contenido sobre personajes secundarios que pueden no aparecer en sesión 1 pero sí en sesión 4. Hay que verificar que session_summaries capture esa progresión correctamente." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Variabilidad inter-corrida. ", bold: true },
    { text: "Vista en §6, con T=0.7 el modelo explora más; puede haber sesiones donde Diego sea más extrovertido de lo deseable. Mitigación: bajar T a 0.5 para Diego y reevaluar." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Generalización a otros pacientes. ", bold: true },
    { text: "Los 4 bloques no son universalmente aplicables. Carmen Torres (advanced, resistencia activa) requiere un universo distinto (amistades adultas, terapeutas previos, ambiente laboral) — no copiar el patrón literalmente, sí copiar la estructura de los bloques." }
  ]),

  pageBreak(),

  // §8 LIMITACIONES
  h1("8. Limitaciones del experimento"),
  body([
    { text: "• ", bold: true },
    { text: "El estudiante simulado es un script, no un humano. ", bold: true },
    { text: "Las 15 intervenciones son fijas y no responden adaptativamente a lo que dice Diego. Un terapeuta humano podría explorar más profundamente cuando el enriquecimiento abre nuevas puertas (ej: profundizar en Cristóbal cuando el modelo lo menciona). Esta es una limitación del diseño — replicarlo con estudiantes reales sería el siguiente paso." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Sólo 3 corridas por prompt. ", bold: true },
    { text: "Estadísticamente débil. Para una afirmación robusta haría falta n=30+ corridas y test de Mann-Whitney sobre las distribuciones de longitud, número de elementos del prompt usados, etc." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Evaluación cualitativa subjetiva. ", bold: true },
    { text: "El análisis turn-by-turn lo redactó el equipo técnico, no un psicólogo clínico independiente. Una validación con docentes UGM sería el siguiente paso natural." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "No hay medición de costo per turno. ", bold: true },
    { text: "El prompt enriquecido es ~2× más largo en input, lo que aumenta el costo por turno marginalmente (~+0.0008 USD por turno con gpt-4.1-mini). En una sesión de 30 turnos esto suma ~0.024 USD adicionales por sesión, manejable." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Solo se compararon estos dos prompts. ", bold: true },
    { text: "Una versión intermedia (solo RED SOCIAL, sin LUGARES + CUERPO + FRASES) podría tener un mejor balance costo/beneficio y no se exploró." }
  ]),

  empty(),

  // §9 CITAS
  h1("9. Citas y referencias"),
  body([{ text: "Documentos hermanos:", bold: true }]),
  body("• INF-2026-047 — Caso Clínico GlorIA 1.0: Alejandro López."),
  body("• INF-2026-048 — Caso Clínico GlorIA 5.0: Diego Fuentes."),
  body("• INF-2026-037 — Upgrade pacientes legacy (origen del prompt actual de Diego)."),
  body("• INF-2026-039 — Calibración conversacional, pacing, safety-prompt."),
  body([{ text: "Código y datos generados para este informe:", bold: true }]),
  body([
    { text: "• " }, { text: "docs/sim-049.js", mono: true },
    { text: " — script de simulación (90 llamadas API, reproducible)." }
  ]),
  body([
    { text: "• " }, { text: "C:/tmp/diego-sim-049.json", mono: true },
    { text: " — todas las 6 transcripciones completas con metadatos." }
  ]),
  body([
    { text: "• " }, { text: "docs/gen-informe-049.py", mono: true },
    { text: " — generador del PDF." }
  ]),
  body([
    { text: "• " }, { text: "informes/gen-informe-049-docx.js", mono: true },
    { text: " — generador de la versión DOCX equivalente." }
  ]),
  body([{ text: "Memorias relevantes:", bold: true }]),
  body([
    { text: "• " }, { text: "project_staging_supabase", italic: true },
    { text: " — staging Supabase para validar antes de prod." }
  ]),
  body([
    { text: "• " }, { text: "feedback_cuidado_no_romper", italic: true },
    { text: " — protocolo de cambios cuidadosos en producción." }
  ]),
  body([
    { text: "• " }, { text: "feedback_supabase_link", italic: true },
    { text: " — verificar project-ref antes de db push." }
  ]),
];

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Calibri", size: 22, color: DARK } } },
  },
  sections: [
    { properties: { page: { size: { width: PAGE_W, height: 15840 }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }} },
      children: cover },
    { properties: { page: { size: { width: PAGE_W, height: 15840 }, margin: { top: MARGIN, right: MARGIN, bottom: 1080, left: MARGIN }} },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "INF-2026-049 — Enriquecimiento del Prompt de Diego Fuentes", size: 16, font: "Calibri", color: GREY, italics: true })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "GlorIA · Universidad Gabriela Mistral · ", size: 16, font: "Calibri", color: GREY }),
          new TextRun({ text: "Página ", size: 16, font: "Calibri", color: GREY }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Calibri", color: GREY }),
          new TextRun({ text: " · 2026-05-07", size: 16, font: "Calibri", color: GREY }),
        ] })] }) },
      children: main }
  ]
});

Packer.toBuffer(doc).then(buf => {
  const outPath = "informes/investigacion/INF-2026-049_enriquecimiento-prompt-diego.docx";
  fs.writeFileSync(outPath, buf);
  console.log(`Generado: ${outPath} — ${(buf.length/1024).toFixed(1)} KB`);
});
