/**
 * INF-2026-050 .docx — Enriquecimiento masivo + propuesta módulo creación.
 */
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageBreak, PageNumber
} = require("docx");

const gloriaLogo = fs.readFileSync("public/branding/gloria-logo.png");
const ugmLogo = fs.readFileSync("public/branding/ugm-logo.png");

const SIM = JSON.parse(fs.readFileSync("C:/tmp/sim-050.json", "utf8"));
const ENRICHED = JSON.parse(fs.readFileSync("C:/tmp/enriched-blocks.json", "utf8"));
const ANALYSIS = JSON.parse(fs.readFileSync("C:/tmp/sim-050-analysis.json", "utf8"));

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
const PAGE_W = 12240, MARGIN = 1440;
const CONTENT_W = PAGE_W - 2 * MARGIN;

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
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: cols,
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
        borders: { top: { style: BorderStyle.SINGLE, size: 4, color: opts.borderColor || BORDER },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: opts.borderColor || BORDER },
          left: { style: BorderStyle.SINGLE, size: 4, color: opts.borderColor || BORDER },
          right: { style: BorderStyle.SINGLE, size: 4, color: opts.borderColor || BORDER } },
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

function dataTable(rows, colWidths, opts = {}) {
  const t_rows = rows.map((row, ri) => new TableRow({
    tableHeader: ri === 0,
    children: row.map((cell, ci) => {
      const isHeader = ri === 0;
      const text = typeof cell === "string" ? cell : "";
      return new TableCell({
        borders, width: { size: colWidths[ci], type: WidthType.DXA },
        shading: { fill: isHeader ? INDIGO : (ri % 2 === 0 ? LIGHT_BG : WHITE), type: ShadingType.CLEAR },
        margins: cellMargins, verticalAlign: "top",
        children: [new Paragraph({ children: [new TextRun({
          text, bold: isHeader, color: isHeader ? WHITE : DARK,
          font: "Calibri", size: 19,
        })] })]
      });
    })
  }));
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: colWidths, rows: t_rows });
}

// ─── Cover ───
const cover = [
  empty(), empty(), empty(), empty(),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new ImageRun({ type: "png", data: gloriaLogo, transformation: { width: 130, height: 130 },
      altText: { title: "GlorIA", description: "Logo GlorIA", name: "gloria-logo" } })] }),
  empty(),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "INF-2026-050", color: INDIGO, bold: true, size: 22, font: "Calibri" })] }),
  empty(),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
    children: [new TextRun({ text: "Enriquecimiento masivo de los 34 pacientes", bold: true, size: 40, font: "Calibri", color: INDIGO })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
    children: [new TextRun({ text: "y propuesta de rediseño del módulo de creación", size: 32, font: "Calibri", color: DARK })] }),
  empty(),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: "Generación con gpt-4o + validación empírica con 15 pacientes",
      size: 22, font: "Calibri", color: GREY, italics: true })] }),
  empty(), empty(), empty(), empty(),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new ImageRun({ type: "png", data: ugmLogo, transformation: { width: 110, height: 38 },
      altText: { title: "UGM", description: "Logo UGM", name: "ugm-logo" } })] }),
  empty(),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Documento técnico-clínico", size: 22, font: "Calibri" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Mayo 2026", size: 22, font: "Calibri" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Universidad Gabriela Mistral", size: 22, font: "Calibri" })] }),
];

// ─── Promedios ────────────────────────────────────────────────
const rows_a = ANALYSIS.rows;
const avg = (k) => rows_a.reduce((s, r) => s + Number(r[k]), 0) / rows_a.length;
const a_delta = avg("delta_chars_pct");
const a_ent_o = avg("entities_used_orig");
const a_ent_e = avg("entities_used_enri");
const a_dia_o = avg("dialect_orig");
const a_dia_e = avg("dialect_enri");
const ent_factor = a_ent_e / a_ent_o;
const dia_pct = ((a_dia_e - a_dia_o) / a_dia_o) * 100;

// ─── Buscar paciente ─
const findPatient = (n) => SIM.patients.find(p => p.name === n);
const andres = findPatient("Andrés Castillo");

// Comparison table for Andrés
function comp3turns(patient, turnIndices, notes) {
  const colWidths = [800, 2700, 4430, 4430];
  const headRow = new TableRow({ tableHeader: true,
    children: ["T", "Pregunta del estudiante", "Original", "Enriquecido"].map((t, i) =>
      new TableCell({ borders, width: { size: colWidths[i], type: WidthType.DXA },
        shading: { fill: INDIGO, type: ShadingType.CLEAR }, margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, color: WHITE, size: 19, font: "Calibri" })] })] }))
  });
  const rows = [headRow];
  for (const i of turnIndices) {
    const o = patient.original_turns[i - 1];
    const e = patient.enriched_turns[i - 1];
    rows.push(new TableRow({
      children: [
        new TableCell({ borders, width: { size: colWidths[0], type: WidthType.DXA },
          shading: { fill: LIGHT_BG, type: ShadingType.CLEAR }, margins: cellMargins, verticalAlign: "top",
          children: [new Paragraph({ children: [new TextRun({ text: `T${i}`, bold: true, font: "Calibri", size: 19 })] })] }),
        new TableCell({ borders, width: { size: colWidths[1], type: WidthType.DXA },
          margins: cellMargins, verticalAlign: "top",
          children: [new Paragraph({ children: [new TextRun({ text: o.student.length > 60 ? o.student.slice(0, 60) + "…" : o.student, font: "Calibri", size: 18, color: GREY, italics: true })] })] }),
        new TableCell({ borders, width: { size: colWidths[2], type: WidthType.DXA },
          margins: cellMargins, verticalAlign: "top",
          children: o.reply.split("\n").map(l => new Paragraph({ spacing: { after: 0 },
            children: [new TextRun({ text: l || " ", font: "Calibri", size: 19 })] })) }),
        new TableCell({ borders, width: { size: colWidths[3], type: WidthType.DXA },
          margins: cellMargins, verticalAlign: "top",
          children: e.reply.split("\n").map(l => new Paragraph({ spacing: { after: 0 },
            children: [new TextRun({ text: l || " ", font: "Calibri", size: 19 })] })) }),
      ]
    }));
    if (notes[i]) {
      rows.push(new TableRow({
        children: [
          new TableCell({ borders, width: { size: colWidths[0], type: WidthType.DXA },
            shading: { fill: ORANGE_BG, type: ShadingType.CLEAR }, margins: cellMargins,
            children: [new Paragraph({ children: [] })] }),
          new TableCell({ borders, columnSpan: 3,
            shading: { fill: ORANGE_BG, type: ShadingType.CLEAR }, margins: cellMargins,
            children: [new Paragraph({ children: [new TextRun({
              text: notes[i], italics: true, color: GREY, font: "Calibri", size: 18 })] })] }),
        ]
      }));
    }
  }
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: colWidths, rows });
}

const main = [
  // ─── METADATOS + RESUMEN ───
  h1("Metadatos del informe"),
  kvTable([
    ["Número", "INF-2026-050"],
    ["Fecha", "2026-05-08"],
    ["Categoría", "Investigación / Propositiva"],
    ["Prioridad", "Alta"],
    ["Sujeto del estudio", "Los 34 pacientes IA de GlorIA 5.0 + módulo de creación de pacientes"],
    ["Documentos hermanos", [
      { text: "INF-2026-047 (Alejandro 1.0), INF-2026-048 (Diego 5.0), " },
      { text: "INF-2026-049 (propuesta enriquecimiento Diego)", bold: true },
    ]],
    ["Alcance experimental", "Generación de bloques: 34 pacientes (gpt-4o, T=0.7). Simulación: 15 pacientes aleatorios (seed=42) × 2 prompts × 15 turnos = 450 llamadas a gpt-4.1-mini, T=0.7"],
    ["Estado de pacientes en producción", [
      { text: "NO MODIFICADOS", bold: true },
      { text: " — todo se generó en memoria/archivos JSON locales" }
    ]],
    ["Costo total API", "≈ USD 0,40"],
  ]),
  empty(),
  h2("Resumen ejecutivo"),
  body("Este informe extiende el experimento del INF-2026-049 (que demostró el enriquecimiento del prompt de Diego con 4 bloques nuevos) a los 34 pacientes activos de la plataforma. Para cada paciente se generaron — vía gpt-4o instruido con un meta-prompt específico — los 4 bloques RED SOCIAL Y VÍNCULOS, LUGARES SIGNIFICATIVOS, ESTADO CORPORAL Y RUTINA y FRASES TIPO QUE DICES, garantizando coherencia con la familia ya tipada, el país de origen, el motivo de consulta y el dialecto regional. Posteriormente se seleccionaron 15 pacientes al azar (seed=42) y se ejecutó la misma comparativa empírica que con Diego."),
  body([
    { text: "Hallazgo principal: ", bold: true },
    { text: `a diferencia del experimento controlado con Diego (que mostró +22% de longitud), el estudio agregado de 15 pacientes muestra un Δ promedio de ` },
    { text: `+${a_delta.toFixed(1)}% en longitud`, bold: true },
    { text: " — el enriquecimiento NO hace al modelo más verboso. Sin embargo, el uso de elementos biográficos del prompt nuevo se multiplica por " },
    { text: `${ent_factor.toFixed(1)}×`, bold: true },
    { text: ` (promedio ${a_ent_o.toFixed(1)} entidades en original vs ${a_ent_e.toFixed(1)} en enriquecido). Es decir: el enriquecimiento no produce respuestas más largas, sino respuestas ` },
    { text: "biográficamente más precisas", bold: true },
    { text: ". Esto es exactamente lo que se esperaba clínicamente: el paciente menciona a sus hijos por nombre, ubica anécdotas en lugares específicos, articula su sueño con datos concretos." }
  ]),
  body([
    { text: "Hallazgo secundario: ", bold: true },
    { text: `la mejora en uso de marcadores dialectales regionales es leve pero positiva (+${dia_pct.toFixed(0)}% en promedio). Y la diversidad léxica se mantiene intacta — no hay degradación.` }
  ]),
  body([
    { text: "Recomendación: ", bold: true },
    { text: "proceder con la migración de los 34 pacientes a su versión enriquecida en STAGING primero, monitorear durante 2-4 semanas, y luego promover a PROD. En paralelo, rediseñar el módulo de creación de pacientes incorporando los 4 nuevos bloques como campos JSONB independientes (ver §8), con un asistente IA para generar borradores que el equipo académico revisa antes de aprobar." }
  ]),

  pageBreak(),

  // ─── §1 CONTEXTO ───
  h1("1. Contexto y objetivo"),
  body("El INF-2026-049 propuso enriquecer el prompt de un solo paciente (Diego Fuentes) con 4 bloques nuevos inspirados en lo que Alejandro López (GlorIA 1.0) tenía y el estándar de 5.0 carecía: universo poblado de personajes secundarios, lugares físicos concretos, estado corporal/rutina, y frases prototípicas para anclar el dialecto. La validación con 3 corridas × 2 prompts × 15 turnos mostró que el enriquecimiento producía respuestas con más densidad biográfica concreta."),
  body([
    { text: "Este informe responde a la pregunta natural siguiente: " },
    { text: "¿el patrón se generaliza a todos los pacientes?", bold: true },
    { text: " Para responderla, se aplicó el enriquecimiento a los 34 pacientes activos en producción y se validó con una muestra aleatoria de 15." }
  ]),

  // ─── §2 METODOLOGÍA ───
  h1("2. Diseño metodológico"),
  kvTable([
    ["Pipeline de generación de bloques", [
      { text: "gpt-4o", bold: true },
      { text: " con meta-prompt que recibe nombre, edad, ocupación, país, barrio, motivo de consulta, backstory, family_members, visual_identity, system_prompt actual. Output: JSON con los 4 bloques en formato Markdown coherente." }
    ]],
    ["Reglas duras del meta-prompt", "(1) coherencia absoluta con family_members; (2) dialecto del país; (3) coherencia con edad/ocupación/motivo; (4) no contradecir el prompt original; (5) no agregar elementos clínicos que cambien el cuadro; (6) sin emojis; (7) formato de líneas con guion."],
    ["Pipeline de simulación", "Modelo gpt-4.1-mini (idéntico a producción), T=0.7, max_tokens=400. 15 intervenciones del estudiante idénticas a INF-049. Concurrencia 3 a nivel de paciente."],
    ["Selección de los 15", "Random reproducible con Mulberry32, seed=42, sobre los 34 pacientes activos."],
    ["Métricas calculadas", "(a) Δ longitud; (b) uso de entidades — palabras capitalizadas extraídas de los bloques nuevos; (c) marcadores dialectales por país; (d) diversidad léxica."],
    ["Reproducibilidad", [
      { text: "docs/gen-enrichment-blocks.js", mono: true },
      { text: " · " },
      { text: "docs/sim-050.js", mono: true },
      { text: " · " },
      { text: "docs/analyze-sim-050.js", mono: true },
      { text: ". Datos en C:/tmp/." }
    ]],
  ]),

  // ─── §3 GENERACIÓN ───
  h1("3. Generación de bloques para los 34 pacientes"),
  h2("3.1 Resultados"),
  kvTable([
    ["Pacientes procesados", String(ENRICHED.patients.length)],
    ["Bloques generados con éxito", `${ENRICHED.successes}/34`],
    ["Fallos definitivos", String(ENRICHED.failures)],
    ["Tiempo total (incluye retry)", "≈ 80 segundos"],
    ["Costo aproximado", "USD ~0,30 (≈ 60K tokens input + 30K output con gpt-4o)"],
    ["Concurrencia inicial", "5 (con rate limit hit en Tier 1, TPM 30K)"],
    ["Strategy de retry", "Concurrencia 1 + backoff exponencial 1,5 → 3 → 6 → 12s, máx 5 intentos"],
  ]),
  h2("3.2 Calidad cualitativa"),
  body("Spot-check sobre 6 pacientes (uno por país) confirmó que el modelo generador respeta el dialecto regional y la familia tipada. Tres ejemplos representativos:"),

  ...["Roberto Salas", "Yesenia De Los Santos", "Camila Bertoni"].flatMap(name => {
    const pt = ENRICHED.patients.find(p => p.name === name);
    if (!pt || !pt.enriched_blocks) return [];
    const lines = pt.enriched_blocks.frases_tipo_que_dices.split("\n").slice(1, 5).join("\n");
    return [
      h3(`${name} (${pt.country}, ${pt.difficulty})`),
      codeBlock(lines, { bg: GREEN_BG, borderColor: GREEN }),
    ];
  }),

  body([
    { text: "Patrón observado: ", bold: true },
    { text: "Roberto (Chile, 52, duelo) usa registro formal sin voseo; Yesenia (Rep. Dominicana, 24, ansiedad social) usa apocopes típicos (\"e' verdad\", \"Ta bien\"); Camila (Argentina, 22) usa voseo correcto (\"entendés\", \"viste\"). Ningún caso confunde dialectos." }
  ]),

  pageBreak(),

  // ─── §4 SIMULACIÓN ───
  h1("4. Selección y simulación de 15 pacientes"),
  h2("4.1 Pacientes seleccionados (seed=42)"),
  dataTable([
    ["Paciente", "País", "Dificultad", "Edad", "Motivo de consulta"],
    ...SIM.patients.map(r => [
      r.name, r.country, r.difficulty, String(r.age),
      (r.presenting_problem || "").length > 50 ? (r.presenting_problem || "").slice(0, 50) + "…" : (r.presenting_problem || "")
    ])
  ], [2300, 1700, 1500, 800, 3060]),
  empty(),
  h3("4.2 Distribución de la muestra"),
  body((() => {
    const c = {}, d = {};
    for (const r of SIM.patients) {
      c[r.country] = (c[r.country] || 0) + 1;
      d[r.difficulty] = (d[r.difficulty] || 0) + 1;
    }
    return `Por país: ${Object.entries(c).map(([k,v])=>`${k}: ${v}`).join(", ")}. Por dificultad: ${Object.entries(d).map(([k,v])=>`${k}: ${v}`).join(", ")}. La muestra cubre los 6 países y los 3 niveles, con ligero sesgo hacia advanced (${d.advanced || 0}/15) por azar de la selección.`;
  })()),

  pageBreak(),

  // ─── §5 MÉTRICAS ───
  h1("5. Métricas agregadas"),
  body([
    { text: "Tabla resumen de los 15 pacientes. Columnas clave: " },
    { text: "Δchars%", bold: true },
    { text: " (cambio de longitud), " },
    { text: "Ents O/E", bold: true },
    { text: " (entidades del prompt enriquecido detectadas), " },
    { text: "Dial. O/E", bold: true },
    { text: " (marcadores dialectales del país)." }
  ]),
  dataTable([
    ["Paciente", "País", "Dif.", "Δchars %", "Ents O/E (de N)", "Dial. O/E"],
    ...rows_a.map(r => [
      r.name, r.country.slice(0,3), r.difficulty.slice(0,4),
      `${Number(r.delta_chars_pct) >= 0 ? "+" : ""}${r.delta_chars_pct}%`,
      `${r.entities_used_orig}/${r.entities_used_enri} (${r.entities_total})`,
      `${r.dialect_orig}/${r.dialect_enri}`,
    ])
  ], [2400, 1100, 1000, 1500, 2360, 1000]),
  empty(),
  body([
    { text: "Promedios: ", bold: true },
    { text: `Δ longitud ${a_delta >= 0 ? "+" : ""}${a_delta.toFixed(1)}%; entidades ${a_ent_o.toFixed(1)} → ${a_ent_e.toFixed(1)} (factor ${ent_factor.toFixed(1)}×); marcadores dialectales ${a_dia_o.toFixed(1)} → ${a_dia_e.toFixed(1)} (${dia_pct >= 0 ? "+" : ""}${dia_pct.toFixed(0)}%); diversidad léxica 0,60 → 0,60 (sin cambio).` }
  ]),

  pageBreak(),

  // ─── §6 HALLAZGOS ───
  h1("6. Hallazgos"),
  h2("6.1 El enriquecimiento NO infla la respuesta"),
  body(`El Δ de longitud agregado es de ${a_delta >= 0 ? "+" : ""}${a_delta.toFixed(1)}%, prácticamente nulo. Esto contradice la hipótesis intuitiva de que un prompt más largo (~+2.500 chars) haría al modelo más verboso. El modelo ajusta su producción a la pregunta del estudiante, no al tamaño del system prompt. El material biográfico nuevo es opcional para el modelo — lo usa cuando es relevante a la pregunta, no lo recita compulsivamente. Esto es deseable clínicamente: las sesiones no se vuelven más largas o cansadoras.`),

  h2("6.2 El enriquecimiento multiplica por 3,5× el uso de elementos biográficos"),
  body(`De los ~13 elementos nuevos introducidos por paciente (nombres de personajes, lugares, datos somáticos), el prompt original usa en promedio ${a_ent_o.toFixed(1)} (los que ya estaban en family_members), mientras el enriquecido usa ${a_ent_e.toFixed(1)}. Es decir: el modelo activa el material nuevo cuando la pregunta del estudiante lo invoca. Esta es la mejora clínicamente significativa: las respuestas son más texturizadas, no más largas.`),

  h2("6.3 Mejora dialectal sutil"),
  body(`Los marcadores dialectales por país suben de ${a_dia_o.toFixed(1)} a ${a_dia_e.toFixed(1)} marcadores por sesión (${dia_pct >= 0 ? "+" : ""}${dia_pct.toFixed(0)}%). Mejora real pero modesta. El dialecto ya estaba parcialmente codificado en family_members y en el system_prompt original; las frases prototípicas refuerzan pero no transforman el registro.`),

  h2("6.4 Variabilidad por paciente"),
  body("Los promedios esconden variabilidad. Tres patrones distintos:"),
  body([
    { text: "(a) Pacientes que se expanden notablemente: ", bold: true },
    { text: "Andrés Castillo (+43%), Diego Fuentes (+40%), Carlos Paredes (+27%). Tienden a ser pacientes con redes sociales ricas en el bloque RED SOCIAL." }
  ]),
  body([
    { text: "(b) Pacientes que se contraen con el enriquecimiento: ", bold: true },
    { text: "Rafael Santos (−38%), Macarena Sépulveda (−21%), Milagros Flores (−15%). Tienden a ser advanced donde el original era ya verboso, y el enriquecido le da pivotes concretos para responder con más economía." }
  ]),
  body([
    { text: "(c) Pacientes con cambio mínimo: ", bold: true },
    { text: "Lucía Mendoza (0%), Hernán Mejía (−2%), Valentina Ospina (−3%). El prompt enriquecido aporta pero el modelo lo absorbe sin alterar su longitud media." }
  ]),
  body([
    { text: "Conclusión: el efecto " },
    { text: "NO es uniforme", bold: true },
    { text: ", depende del perfil del paciente. Esto refuerza la recomendación de migración por lotes con monitoreo, no de aplicación masiva sin revisar." }
  ]),

  pageBreak(),

  // ─── §7 ANÁLISIS COMPARATIVO ───
  h1("7. Análisis comparativo — caso Andrés Castillo"),
  body("Se selecciona Andrés Castillo (Colombia, advanced, viudo de 52 años) como ejemplo ilustrativo. Es uno de los pacientes con mayor delta positivo (+43%) y mayor uso de entidades nuevas (+5)."),
  body("Tres turnos clave lado a lado:"),
  comp3turns(andres, [2, 6, 9], {
    2: "Original menciona la muerte de la esposa hace 6 meses. Enriquecido agrega \"trato de ser fuerte por los pelados\" — invoca a los hijos, materializa el motivo.",
    6: "Original: respuesta abstracta sobre la familia. Enriquecido: aparecen Camila (hija) + Sebastián (hijo) por nombre, con detalles concretos (universidad, fútbol, sueño de ser ingeniero). Salto cualitativo evidente.",
    9: "Ambos describen el insomnio. Enriquecido cierra con \"hay que seguir pa'lante\" — rasgo dialectal colombiano + actitud activa coherente con el prompt nuevo.",
  }),
  empty(),
  h2("7.1 Patrón general observado en los 15 pacientes"),
  body([
    { text: "El patrón más consistente es el del " },
    { text: "turno 6", bold: true },
    { text: " (\"¿y tu familia, cómo está?\"): el prompt enriquecido produce respuestas que " },
    { text: "nombran a los miembros familiares", bold: true },
    { text: " específicamente, con sus actividades. El prompt original tiende a respuestas abstractas que son clínicamente menos útiles." }
  ]),
  body([
    { text: "El segundo patrón consistente es " },
    { text: "turno 9", bold: true },
    { text: " (\"¿cómo está tu sueño?\"): el enriquecido ofrece datos concretos (\"3 horas / 12 horas\") que permiten formular hipótesis clínicas. El original tiende a generalidades." }
  ]),

  pageBreak(),

  // ─── §8 PROPUESTA MÓDULO ───
  h1("8. Propuesta de rediseño del módulo de creación de pacientes"),
  body([
    { text: "Actualmente el flujo de creación de pacientes en supradmin sigue 15 pasos definidos en la migración " },
    { text: "20260316165059_patient_creation_workflow.sql", mono: true },
    { text: ", con campos auxiliares short_narrative, extended_narrative, coherence_review, projections, creation_step. Este flujo NO incluye los 4 nuevos bloques. Proponemos extenderlo así:" }
  ]),

  h2("8.1 Cambios al schema de base de datos"),
  body([
    { text: "Agregar 4 columnas JSONB independientes a " },
    { text: "ai_patients", mono: true },
    { text: ":" }
  ]),
  codeBlock(`ALTER TABLE public.ai_patients
  ADD COLUMN IF NOT EXISTS enrichment_red_social JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS enrichment_lugares JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS enrichment_estado_corporal JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS enrichment_frases_tipo JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS enrichment_version INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrichment_approved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS enrichment_approved_at TIMESTAMPTZ;`, { bg: GREEN_BG, borderColor: GREEN }),
  body([
    { text: "Justificación: ", bold: true },
    { text: "separar los 4 bloques en columnas independientes — no como una sola columna enrichment_blocks ni como texto inline en system_prompt — permite (a) editar cada bloque por separado en el supradmin sin tocar los otros, (b) versionar cada bloque, (c) revisar/aprobar bloques individualmente, (d) componer dinámicamente el system_prompt al runtime a partir de la base + bloques activos." }
  ]),

  h2("8.2 Composición dinámica del system_prompt en runtime"),
  body([
    { text: "Se modifica " },
    { text: "src/lib/build-system-prompt.ts", mono: true },
    { text: " (nuevo módulo) para que componga el prompt en runtime, no en la BD:" }
  ]),
  codeBlock(`// Nuevo: src/lib/build-system-prompt.ts
export function buildSystemPrompt(patient: AiPatient): string {
  const base = patient.system_prompt;
  const blocks = [
    patient.enrichment_red_social?.text,
    patient.enrichment_lugares?.text,
    patient.enrichment_estado_corporal?.text,
  ].filter(Boolean).join("\\n\\n");
  const frases = patient.enrichment_frases_tipo?.text;

  let composed = base.replace(
    /\\n\\nCOMPORTAMIENTO EN SESIÓN:/,
    blocks ? \`\\n\\n\${blocks}\\n\\nCOMPORTAMIENTO EN SESIÓN:\` : "$&"
  );
  composed = composed.replace(
    /\\n\\nREGLAS:/,
    frases ? \`\\n\\n\${frases}\\n\\nREGLAS:\` : "$&"
  );
  return composed;
}`),
  body([
    { text: "Con esto, " },
    { text: "el system_prompt almacenado no cambia", bold: true },
    { text: " — sigue siendo el bloque base. Los 4 bloques nuevos se componen al vuelo, lo que facilita la migración progresiva." }
  ]),

  h2("8.3 Pipeline de creación actualizado"),
  body("Se agregan 4 pasos al pipeline existente, después del paso 8 (visual_identity) y antes del paso 12 (revisión final):"),
  dataTable([
    ["Paso", "Nombre", "Descripción"],
    ["1-8", "Pasos existentes", "Sin cambios: nombre, edad, ocupación, motivo de consulta, backstory, personalidad, family, visual."],
    ["9 (NUEVO)", "RED SOCIAL", "Personajes secundarios (5-8) con nombre, edad, rol, micro-historia. Asistente IA pre-popula con un draft basado en backstory + family + país."],
    ["10 (NUEVO)", "LUGARES SIGNIFICATIVOS", "3-5 lugares físicos del día a día con detalle sensorial. Asistente IA sugiere lugares coherentes con el barrio + ocupación."],
    ["11 (NUEVO)", "ESTADO CORPORAL Y RUTINA", "Sueño, apetito, vestimenta, energía. Asistente IA genera draft coherente con el motivo de consulta."],
    ["12 (NUEVO)", "FRASES TIPO QUE DICES", "6-8 frases prototípicas. Asistente IA genera con dialecto del país."],
    ["13", "Revisión de coherencia", "Existente. Ahora revisa también que los 4 bloques sean coherentes entre sí."],
    ["14-15", "Aprobación final", "Existente. Cada bloque se aprueba por separado."],
  ], [1600, 4000, 9760]),
  empty(),

  h2("8.4 UI del editor en supradmin"),
  body([
    { text: "Cada bloque debería tener su propia tab/sección en la página de edición de paciente (" },
    { text: "/supradmin/patients/[id]/edit", mono: true },
    { text: "), con:" }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Textarea grande", bold: true },
    { text: " (10-15 filas) para el contenido del bloque." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Botón \"Generar borrador con IA\"", bold: true },
    { text: " que llama a un endpoint nuevo " },
    { text: "/api/admin/patients/[id]/enrich/[block]", mono: true },
    { text: " que invoca gpt-4o con el meta-prompt y devuelve un draft." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Diff visual", bold: true },
    { text: " contra la versión anterior si enrichment_version > 0." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Botón \"Vista previa del system_prompt compuesto\"", bold: true },
    { text: " que muestra cómo quedaría el prompt final inyectado al modelo." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Botón \"Probar con 3 turnos\"", bold: true },
    { text: " que ejecuta una mini-simulación contra gpt-4.1-mini y muestra las respuestas — para que el equipo académico vea el efecto antes de aprobar." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Aprobación con doble click", bold: true },
    { text: " (\"Marcar como aprobado\") que escribe enrichment_approved_by + enrichment_approved_at." }
  ]),

  h2("8.5 Asistente IA — flujo de generación de borrador"),
  body("Cuando el equipo académico hace click en \"Generar borrador con IA\":"),
  body("1. El servidor lee los datos del paciente (system_prompt, family, visual, country, etc.)."),
  body("2. Llama a gpt-4o con el meta-prompt (mismo de docs/gen-enrichment-blocks.js) restringido al bloque pedido."),
  body("3. Recibe el JSON con el bloque, lo persiste como draft en una tabla auxiliar (enrichment_drafts)."),
  body("4. Devuelve al UI el contenido para revisión."),
  body("5. El equipo académico edita libremente, prueba con \"3 turnos\" si quiere, y aprueba."),
  body("6. Al aprobar, el contenido se mueve de enrichment_drafts a la columna oficial enrichment_* con un INSERT/UPDATE incremental, y se incrementa enrichment_version."),

  h2("8.6 Versionado y reversibilidad"),
  body("Cada bloque guarda su historial:"),
  codeBlock(`CREATE TABLE public.enrichment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES ai_patients(id) ON DELETE CASCADE,
  block_name TEXT CHECK (block_name IN
    ('red_social', 'lugares', 'estado_corporal', 'frases_tipo')),
  version INT NOT NULL,
  content JSONB NOT NULL,
  generated_by TEXT,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`, { bg: GREEN_BG, borderColor: GREEN }),
  body("Esto permite rollback trivial a una versión anterior si un bloque resulta problemático en producción — patrón coherente con la cultura de migraciones reversibles establecida en INF-2026-037 e INF-2026-049."),

  pageBreak(),

  // ─── §9 PLAN DE ROLLOUT ───
  h1("9. Plan de rollout para los 34 pacientes"),
  body("La migración de los 34 pacientes a su versión enriquecida debe ser progresiva. Plan recomendado en 4 fases:"),
  dataTable([
    ["Fase", "Alcance", "Ambiente", "Duración", "Criterio de éxito"],
    ["1", "Schema + módulo de composición runtime", "Staging", "1 semana", "Pacientes existentes funcionan idéntico (test no regresión: 5 conversaciones random)."],
    ["2", "Migrar 5 pacientes piloto (uno por país excepto Chile que tendría 2)", "Staging", "2 semanas", "Comparativa cualitativa con docentes UGM. Sin regresión en pacing ni safety."],
    ["3", "Migrar los 29 restantes (en lotes de 5)", "Staging", "3 semanas", "Smoke test por lote. Si lote N falla, revertir antes de pasar a N+1."],
    ["4", "Promoción a PROD", "Producción", "Cut over de un día", "Mantener feature flag ENABLE_ENRICHMENT_BLOCKS=true para activación gradual."],
  ], [1100, 4500, 1800, 2000, 5960]),
  empty(),
  h2("9.1 Plan de rollback"),
  body("Si una fase falla:"),
  body("1. Activar feature flag ENABLE_ENRICHMENT_BLOCKS=false → el módulo build-system-prompt ignora las columnas de enriquecimiento y devuelve solo el system_prompt base. Reversión instantánea."),
  body("2. Si hay corrupción de datos, restaurar los bloques desde enrichment_history (versión anterior)."),
  body("3. Como último recurso, eliminar las 4 columnas con ALTER TABLE DROP COLUMN. El system_prompt original queda intacto."),

  h2("9.2 Estimación de costo y tiempo"),
  body([
    { text: "• Generación de los 34 bloques iniciales: ya completa (C:/tmp/enriched-blocks.json) — costo USD ~0,30, tiempo 80 segundos.", bold: false }
  ]),
  body("• Aprobación humana: 15-30 min × 34 = 8-17 horas del equipo académico, distribuido en 3 semanas."),
  body("• Cambios de código: schema + build-system-prompt + UI editor + endpoint AI assist = ~3-4 días de desarrollo."),
  body("• Costo operacional post-rollout: el system_prompt en runtime crece ~+2.500 chars, lo que añade ~0,0008 USD por turno (≈ 24 ¢ por sesión de 30 turnos)."),

  pageBreak(),

  // ─── §10 LIMITACIONES ───
  h1("10. Limitaciones del experimento"),
  body([
    { text: "• Una sola corrida por paciente. ", bold: true },
    { text: "A diferencia de INF-049 (3 corridas con Diego), aquí cada uno de los 15 pacientes se ejecutó solo una vez por prompt. La variabilidad intra-paciente NO está medida — solo la inter-paciente." }
  ]),
  body([
    { text: "• Estudiante simulado fijo. ", bold: true },
    { text: "Las 15 intervenciones son un script sin adaptación al paciente. Un estudiante humano podría profundizar más cuando el modelo introduce un nombre nuevo." }
  ]),
  body([
    { text: "• Métricas heurísticas, no clínicas. ", bold: true },
    { text: "Δchars, conteo de entidades y marcadores dialectales son proxies de calidad, no medidas clínicas. La validación con docentes UGM sería el siguiente paso." }
  ]),
  body([
    { text: "• Selección aleatoria con n=15 sobre 34. ", bold: true },
    { text: "Cubre los 6 países y los 3 niveles, pero está sesgada hacia advanced (6/15 vs 11/34 en la población)." }
  ]),
  body([
    { text: "• La generación de bloques con gpt-4o introduce sesgos del modelo. ", bold: true },
    { text: "El modelo puede tender a poblar pacientes femeninos con redes sociales más ricas, o a sobrerrepresentar ciertas profesiones. Una auditoría sistemática de los 34 bloques generados — antes de aplicar a producción — es esencial." }
  ]),

  empty(),

  // ─── §11 CITAS ───
  h1("11. Citas y referencias"),
  body([{ text: "Documentos hermanos:", bold: true }]),
  body("• INF-2026-047 — Caso clínico GlorIA 1.0: Alejandro López."),
  body("• INF-2026-048 — Caso clínico GlorIA 5.0: Diego Fuentes."),
  body("• INF-2026-049 — Propuesta de enriquecimiento del prompt de Diego (caso piloto)."),
  body("• INF-2026-037 — Upgrade pacientes legacy."),
  body([{ text: "Código y datos generados:", bold: true }]),
  body([{ text: "• " }, { text: "docs/gen-enrichment-blocks.js", mono: true }, { text: " — generador de los 4 bloques para los 34 pacientes." }]),
  body([{ text: "• " }, { text: "docs/gen-enrichment-blocks-retry.js", mono: true }, { text: " — retry con backoff." }]),
  body([{ text: "• " }, { text: "docs/sim-050.js", mono: true }, { text: " — simulación 15 × 2 × 15 (Mulberry32 seed=42)." }]),
  body([{ text: "• " }, { text: "docs/analyze-sim-050.js", mono: true }, { text: " — métricas de uso de entidades, dialecto, diversidad." }]),
  body([{ text: "• " }, { text: "C:/tmp/all-patients.json", mono: true }, { text: " — los 34 pacientes desde PROD." }]),
  body([{ text: "• " }, { text: "C:/tmp/enriched-blocks.json", mono: true }, { text: " — los 4 bloques × 34 pacientes." }]),
  body([{ text: "• " }, { text: "C:/tmp/sim-050.json", mono: true }, { text: " — las 30 conversaciones de 15 turnos." }]),
  body([{ text: "• " }, { text: "C:/tmp/sim-050-analysis.json", mono: true }, { text: " — métricas calculadas." }]),
  body([{ text: "Memorias relevantes:", bold: true }]),
  body([{ text: "• " }, { text: "project_staging_supabase", italic: true }, { text: " — staging vhkbbps... para validar antes de prod." }]),
  body([{ text: "• " }, { text: "feedback_supabase_link", italic: true }, { text: " — verificar project-ref antes de db push." }]),
  body([{ text: "• " }, { text: "feedback_cuidado_no_romper", italic: true }, { text: " — protocolo cuidadoso en producción." }]),
];

const doc = new Document({
  styles: { default: { document: { run: { font: "Calibri", size: 22, color: DARK } } } },
  sections: [
    { properties: { page: { size: { width: PAGE_W, height: 15840 }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
      children: cover },
    { properties: { page: { size: { width: PAGE_W, height: 15840 }, margin: { top: MARGIN, right: MARGIN, bottom: 1080, left: MARGIN } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "INF-2026-050 — Enriquecimiento masivo + propuesta módulo creación", size: 16, font: "Calibri", color: GREY, italics: true })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "GlorIA · Universidad Gabriela Mistral · ", size: 16, font: "Calibri", color: GREY }),
          new TextRun({ text: "Página ", size: 16, font: "Calibri", color: GREY }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Calibri", color: GREY }),
          new TextRun({ text: " · 2026-05-08", size: 16, font: "Calibri", color: GREY }),
        ] })] }) },
      children: main },
  ],
});

Packer.toBuffer(doc).then(buf => {
  const out = "informes/investigacion/INF-2026-050_enriquecimiento-masivo-y-modulo-creacion.docx";
  fs.writeFileSync(out, buf);
  console.log(`Generado: ${out} — ${(buf.length / 1024).toFixed(1)} KB`);
});
