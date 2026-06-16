/**
 * INF-2026-060 .docx — Enriquecimiento clínico de pacientes IA planos:
 * piloto, validación conductual A/B y despliegue a producción.
 */
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageBreak, PageNumber
} = require("docx");

const gloriaLogo = fs.readFileSync("public/branding/gloria-logo.png");
const ugmLogo = fs.readFileSync("public/branding/ugm-logo.png");

const INDIGO = "4A55A2", DARK = "1A1A1A", LIGHT_BG = "F0F2FA";
const GREEN_BG = "E8F5E9", RED_BG = "FFEBEE", WHITE = "FFFFFF", GREY = "666666", BORDER = "CCCCCC";
const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };
const PAGE_W = 12240, MARGIN = 1440, CONTENT_W = PAGE_W - 2 * MARGIN;

const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 }, children: [new TextRun({ text: t, color: INDIGO, bold: true, size: 36, font: "Calibri" })] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 140 }, children: [new TextRun({ text: t, color: INDIGO, bold: true, size: 28, font: "Calibri" })] });
const h3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 180, after: 100 }, children: [new TextRun({ text: t, color: DARK, bold: true, size: 23, font: "Calibri" })] });
const body = (parts, opts = {}) => {
  if (typeof parts === "string") parts = [{ text: parts }];
  return new Paragraph({ spacing: { after: 120 }, alignment: opts.alignment || AlignmentType.JUSTIFIED,
    children: parts.map((p) => new TextRun({ text: p.text, bold: !!p.bold, italics: !!p.italic, font: p.mono ? "Consolas" : "Calibri", color: p.color || DARK, size: p.mono ? 18 : 22 })) });
};
const bullet = (parts) => { if (typeof parts === "string") parts = [{ text: parts }]; return new Paragraph({ spacing: { after: 80 }, bullet: { level: 0 }, children: parts.map((p) => new TextRun({ text: p.text, bold: !!p.bold, italics: !!p.italic, font: p.mono ? "Consolas" : "Calibri", color: p.color || DARK, size: 22 })) }); };
const small = (text) => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text, size: 18, font: "Calibri", color: GREY, italics: true })] });
const empty = () => new Paragraph({ spacing: { after: 60 }, children: [] });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });
const renderRich = (v) => typeof v === "string"
  ? new Paragraph({ children: [new TextRun({ text: v, font: "Calibri", size: 21 })] })
  : new Paragraph({ children: v.map((r) => new TextRun({ text: r.text, bold: !!r.bold, italics: !!r.italic, font: r.mono ? "Consolas" : "Calibri", size: r.mono ? 18 : 21, color: r.color || DARK })) });

function kvTable(rows) {
  const cols = [3240, 6120];
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: cols,
    rows: rows.map(([k, v]) => new TableRow({ children: [
      new TableCell({ borders, width: { size: cols[0], type: WidthType.DXA }, shading: { fill: LIGHT_BG, type: ShadingType.CLEAR }, margins: cellMargins, verticalAlign: "top", children: [new Paragraph({ children: [new TextRun({ text: k, bold: true, font: "Calibri", size: 21 })] })] }),
      new TableCell({ borders, width: { size: cols[1], type: WidthType.DXA }, margins: cellMargins, verticalAlign: "top", children: [renderRich(v)] }),
    ] })) });
}
function dataTable(rows, colWidths, opts = {}) {
  const t_rows = rows.map((row, ri) => new TableRow({ tableHeader: ri === 0, children: row.map((cell, ci) => {
    const isHeader = ri === 0;
    const bg = isHeader ? INDIGO : (opts.greenRow && opts.greenRow.includes(ri)) ? GREEN_BG : (opts.redRow && opts.redRow.includes(ri)) ? RED_BG : (ri % 2 === 0 ? LIGHT_BG : WHITE);
    return new TableCell({ borders, width: { size: colWidths[ci], type: WidthType.DXA }, shading: { fill: bg, type: ShadingType.CLEAR }, margins: cellMargins, verticalAlign: "top",
      children: [new Paragraph({ children: [new TextRun({ text: String(cell), bold: isHeader, color: isHeader ? WHITE : DARK, font: "Calibri", size: opts.fontSize || 19 })] })] });
  }) }));
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: colWidths, rows: t_rows });
}

// ─── Portada ───
const cover = [
  empty(), empty(), empty(), empty(),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: gloriaLogo, transformation: { width: 130, height: 130 }, altText: { title: "GlorIA", description: "Logo GlorIA", name: "gloria-logo" } })] }),
  empty(),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "INF-2026-060", color: INDIGO, bold: true, size: 22, font: "Calibri" })] }),
  empty(),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "Enriquecimiento clínico de pacientes IA", bold: true, size: 40, font: "Calibri", color: INDIGO })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: "Piloto, validación conductual A/B y despliegue a producción", size: 28, font: "Calibri", color: DARK })] }),
  empty(),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "Documento técnico-clínico · 2026-06-16", size: 22, font: "Calibri", color: GREY, italics: true })] }),
  empty(), empty(), empty(), empty(),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: ugmLogo, transformation: { width: 110, height: 38 }, altText: { title: "UGM", description: "Logo UGM", name: "ugm-logo" } })] }),
  empty(),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "GlorIA · Junio 2026", size: 22, font: "Calibri" })] }),
];

// ─── Datos ───
const rubricaRows = [
  ["Paciente", "Grupo", "Rúbrica antes", "Rúbrica después"],
  ["Carlos Paredes", "FULL", "18", "100"],
  ["Rosa Huamán", "META", "18", "100"],
  ["Andrés Castillo", "FULL", "23", "93"],
  ["Sofía Pellegrini", "FULL", "26", "100"],
  ["Camila Bertoni", "META", "46", "97"],
  ["Gabriel Navarro", "FULL", "50", "94"],
  ["Renata Ayala", "META", "52", "97"],
  ["Hernán Mejía", "META", "55", "100"],
  ["Yesenia De Los Santos", "META", "55", "93"],
  ["Fernanda Contreras", "META", "57", "93"],
  ["Lorena Gutiérrez", "META", "57", "87"],
];
const difRows = [
  ["Paciente", "Dif. antes", "Dif. después", "Lectura clínica"],
  ["Gabriel Navarro", "+0.17", "+0.54", "Incoherente → coherente y reactivo"],
  ["Carlos Paredes", "+0.17", "+0.71", "Plano → resiste y revela tras el silencio"],
  ["Andrés Castillo", "0.00", "+0.42", "Complaciente → resiste, culpa gradual"],
  ["Camila Bertoni", "+0.71", "+0.29", "Ya diferenciaba; intelectualiza (métrica la penaliza)"],
  ["Lorena Gutiérrez", "+0.33", "+0.38", "Ya diferenciaba bien"],
  ["Yesenia De Los Santos", "+0.29", "+0.38", "Ya diferenciaba bien"],
  ["Fernanda Contreras", "+0.21", "+0.33", "Mejora leve"],
  ["Sofía Pellegrini", "+0.21", "+0.25", "Mejora leve"],
  ["Renata Ayala", "0.00", "+0.13", "Ambivalencia: métrica no la mide bien"],
  ["Hernán Mejía", "+0.17", "+0.17", "Conflicto moral: métrica no la mide bien"],
];

const main = [
  h1("Metadatos del informe"),
  kvTable([
    ["Número", "INF-2026-060"],
    ["Fecha", "2026-06-16"],
    ["Categoría", "Investigación clínica + Despliegue"],
    ["Prioridad", "Alta"],
    ["Sujeto", "Homogeneización de la calidad clínica de los 34 pacientes IA"],
    ["Documentos hermanos", [{ text: "INF-2026-049 (enriquecimiento Diego), 050 (masivo 34), 051 (despliegue + tuning)" }]],
    ["Resultado", [{ text: "11", bold: true }, { text: " pacientes enriquecidos (4 reescritura completa + 7 ficha) + " }, { text: "23", bold: true }, { text: " fichas (distinctive_factor). " }, { text: "Todo en PROD.", bold: true }]],
    ["Commit", "9146569 (tooling + harness + backups)"],
    ["Rama", "feat/sandbox-emotional-heat"],
    ["Costo aproximado de API", "≈ USD 1,5 (harness A/B + generación de fichas)"],
  ]),
  empty(),
  h2("Resumen ejecutivo"),
  body("Se detectó que los 34 pacientes IA de la plataforma formaban dos 'generaciones' desiguales: unos clínicamente ricos y otros planos. El objetivo fue eliminar esa brecha. Para ello se construyó una rúbrica de riqueza clínica de 8 ejes, se enriquecieron los 11 pacientes bajo umbral, y se validó el efecto con una prueba antes/después que combina la etiqueta de calor emocional por turno con un índice de diferenciación conductual ante la técnica del terapeuta."),
  body([{ text: "El hallazgo central, contraintuitivo, es que ", }, { text: "la riqueza documental de un prompt NO predice su comportamiento en sesión", bold: true }, { text: ". Varios pacientes de ficha pobre ya reaccionaban muy bien al conversar, y reescribir su prompt no aportaba (incluso podía degradarlo). Por eso la aplicación fue quirúrgica: reescritura completa solo para los 4 planos genuinos, y enriquecimiento de ficha — sin tocar el prompt — para el resto. Los 34 quedaron con su factor distintivo poblado (antes vacío en todos)." }]),

  pageBreak(),
  h1("1. El problema: dos generaciones de pacientes"),
  body("El análisis de los 34 pacientes activos en producción reveló dos perfiles de calidad muy distintos. Los pacientes 'ricos' (p. ej. Alejandro, Jorge, Marcos) presentaban una arquitectura clínica de tres capas: una defensa de superficie, gatillos condicionales de apertura/cierre, y un núcleo oculto que emerge solo con buena alianza (episodios fechados, timing de sesión, capa de riesgo estructurada). Los pacientes 'planos' (p. ej. Carlos, Andrés, Rosa, Sofía) tenían motivo de consulta de una sola palabra, backstory autogenerado ('Generado automáticamente.') y un 'lo que no revela' genérico sin un solo episodio concreto."),
  body([{ text: "Además, un hallazgo transversal: el campo ", }, { text: "distinctive_factor", mono: true }, { text: " estaba vacío en los 34 pacientes — una columna existente pero nunca poblada." }]),

  h1("2. Rúbrica de riqueza clínica (8 ejes)"),
  body("Para objetivar 'qué hace rico a un paciente' se construyó un puntaje 0-100 verificable por script (scripts/score-richness.js), derivado de los prompts que ya funcionaban:"),
  dataTable([
    ["Eje", "Qué mide", "Peso"],
    ["presenting_problem", "Cuadro multicapa (no una palabra)", "12"],
    ["backstory", "Trasfondo real (no autogenerado)", "8"],
    ["distinctive_factor", "Rasgo identitario distintivo", "5"],
    ["defensa", "Mecanismo de defensa explícito", "15"],
    ["gatillos", "Condicionales apertura/cierre ('si el terapeuta…')", "20"],
    ["episodios", "Episodio concreto fechado en el núcleo", "15"],
    ["timing", "Emergencia por sesión (3+/4+)", "10"],
    ["riesgo", "Capa de riesgo estructurada donde aplique", "5"],
    ["bloques", "4 bloques de enriquecimiento presentes", "10"],
  ], [3200, 8700, 1460], { fontSize: 18 }),
  small("Baseline de los 34: promedio 67/100. 11 pacientes bajo el umbral de 60."),

  pageBreak(),
  h1("3. Metodología de validación: prueba antes/después"),
  body("La rúbrica mide la 'materia prima' del prompt. Para medir el comportamiento real al conversar se construyó un harness A/B (scripts/ab-*.js):"),
  bullet([{ text: "Terapeuta simulado con guion fijo ", bold: true }, { text: "de 12 intervenciones idénticas para la versión vieja (A) y la enriquecida (B), de modo que la única variable sea el prompt del paciente." }]),
  bullet([{ text: "Calor emocional por turno ", bold: true }, { text: "(réplica exacta de src/lib/emotional-heat.ts): categoría e intensidad 1-5 de cada respuesta del paciente, leídas en contexto." }]),
  bullet([{ text: "Índice de diferenciación por gatillo: ", bold: true }, { text: "fracción de cierre (evasivo/cauteloso) ante la mala técnica (preguntas en ráfaga, consejo no pedido, intrusión) menos la fracción de cierre ante la buena técnica (validación, silencio, reflejo). Un buen paciente se cierra ante la mala técnica y se abre ante la buena." }]),
  body([{ text: "Se descartó el panel de jueces LLM holístico: ", bold: true }, { text: "demostró ser ruidoso (el ingenuo premiaba el dramatismo, el recalibrado penalizaba a los pacientes por tener un núcleo que emerge). La señal confiable fue la conductual objetiva, complementada con lectura clínica humana." }]),

  h1("4. Resultados antes/después"),
  h2("4.1 Riqueza de rúbrica (los 11 enriquecidos)"),
  dataTable(rubricaRows, [4500, 1800, 3500, 3560], { fontSize: 19 }),
  small("Antes: 18-57. Después: 87-100 (promedio 95)."),
  empty(),
  h2("4.2 Diferenciación conductual (índice por gatillo)"),
  dataTable(difRows, [3600, 1800, 1800, 6160], { fontSize: 17, greenRow: [1, 2, 3] }),
  small("Verde: planos genuinos con gran mejora conductual. El resto ya reaccionaba bien o tiene una dinámica (intelectualización, ambivalencia, conflicto moral) que el índice no captura."),

  pageBreak(),
  h1("5. Hallazgo central: la rúbrica no predice la conducta"),
  body("El cruce de ambas métricas arrojó la lección más valiosa del trabajo:"),
  bullet([{ text: "Camila", bold: true }, { text: " tenía rúbrica 46 (bajo umbral) pero ya diferenciaba mejor que casi todos (índice +0,71): su prompt viejo tenía gatillos fuertes aunque le faltaran episodios fechados. Al enriquecerla con intelectualización coherente, el índice 'bajó' — pero la lectura cualitativa muestra que la versión nueva es clínicamente superior (su defensa no cede ni ante la buena técnica, como debe ser)." }]),
  bullet([{ text: "Gabriel, Carlos y Andrés", bold: true }, { text: " eran planos de verdad y mejoraron de forma clara y medible." }]),
  bullet([{ text: "Renata (ambivalencia ante el abuso) y Hernán (conflicto moral)", bold: true }, { text: " tienen defensas que no ceden ante la buena técnica; el índice los subestima." }]),
  body([{ text: "Conclusión: ", bold: true }, { text: "la planitud es de dos tipos — documental (ficha pobre, frecuente, barata de arreglar) y conductual (responde igual a todo, rara y costosa). Solo 4 pacientes eran planos en conducta. Ninguna métrica automática única (ni juez LLM ni calor) basta para evaluar la calidad de un paciente simulado: la lectura clínica humana sigue siendo el juez final." }]),

  h1("6. Aplicación a producción"),
  body("La estrategia de aplicación respetó el hallazgo: reescribir solo donde rinde, sin arriesgar lo que ya funciona."),
  dataTable([
    ["Grupo", "Pacientes", "Qué se aplicó", "Entorno"],
    ["FULL (4)", "Carlos, Andrés, Sofía, Gabriel", "system_prompt reescrito + ficha", "Staging → PROD"],
    ["META (7)", "Rosa, Camila, Fernanda, Hernán, Lorena, Renata, Yesenia", "Solo ficha (sin tocar el prompt)", "Staging → PROD"],
    ["Ficha (23)", "Resto de los 34", "distinctive_factor (+ revisión)", "Staging + PROD"],
  ], [2400, 5200, 4200, 3560], { fontSize: 17 }),
  empty(),
  body([{ text: "Salvaguardas: ", bold: true }, { text: "scripts de aplicación con dry-run por defecto, guard anti-PROD, confirmación explícita (--prod-confirm), backup del estado previo y verificación post-escritura. Cada update se confirmó releyendo el dato. Las 23 fichas se generaron con gpt-4o y se revisaron: se corrigió una invención del modelo ('madre con Alzheimer' en Daniela, dato no presente en su material)." }]),
  body([{ text: "Reversión: ", bold: true }, { text: "scripts/prod-backup-*.json y scripts/prod-ficha-backup-*.json contienen el estado previo exacto de cada paciente." }]),

  pageBreak(),
  h1("7. Lecciones y trabajo pendiente"),
  bullet([{ text: "La rúbrica sirve para cribar, no para decidir. ", bold: true }, { text: "Una rúbrica baja señala candidatos, pero la decisión de reescribir conducta debe confirmarse con la prueba conductual + lectura humana." }]),
  bullet([{ text: "Las métricas automáticas tienen sesgos opuestos. ", bold: true }, { text: "El juez LLM premia el drama; el índice de diferenciación penaliza las defensas que no ceden. Conviene usarlas como señales, no como veredicto." }]),
  bullet([{ text: "Validación humana en plataforma: ", bold: true }, { text: "conversar con Carlos, Andrés, Sofía y Gabriel (los reescritos) para confirmar la mejora en uso real." }]),
  bullet([{ text: "Escalado de conducta caso a caso: ", bold: true }, { text: "si al usar la plataforma se detecta algún paciente de los 23 que 'responde igual a todo', aplicar la reescritura quirúrgica de su prompt." }]),
  bullet([{ text: "Prueba multi-sesión: ", bold: true }, { text: "el harness comprime en una sesión un timing marcado como 'sesión 3+'. Una prueba con memoria cross-sesión sería aún más fiel para los núcleos tardíos." }]),

  h1("8. Citas y referencias"),
  body([{ text: "Documentos hermanos:", bold: true }]),
  bullet("INF-2026-049 — Enriquecimiento del prompt de Diego (caso piloto)."),
  bullet("INF-2026-050 — Enriquecimiento masivo de los 34 pacientes (4 bloques)."),
  bullet("INF-2026-051 — Despliegue INF-050 a PROD + tuning clínico de 9 pacientes."),
  body([{ text: "Artefactos reproducibles (commit ", }, { text: "9146569", mono: true }, { text: "):" }]),
  bullet([{ text: "score-richness.js", mono: true }, { text: " — rúbrica de riqueza de 8 ejes." }]),
  bullet([{ text: "pilot-enriched.js / pilot-enriched-batch2.js", mono: true }, { text: " — prompts enriquecidos." }]),
  bullet([{ text: "ab-test.js / ab-rejudge.js / ab-conductual.js", mono: true }, { text: " — harness A/B (calor + diferenciación)." }]),
  bullet([{ text: "gen-ficha.js / ficha-23.json", mono: true }, { text: " — generación de fichas de los 23." }]),
  bullet([{ text: "apply-enriched.js / apply-ficha.js", mono: true }, { text: " — aplicación a staging/PROD con backup." }]),
  body([{ text: "Memorias aplicadas:", bold: true }]),
  bullet([{ text: "feedback_cuidado_no_romper", italic: true }, { text: " — dry-run, backup y confirmación antes de tocar PROD." }]),
  bullet([{ text: "feedback_supabase_link", italic: true }, { text: " — guard del project-ref (anti-PROD por defecto)." }]),
  bullet([{ text: "feedback_informes_pdf / feedback_pdf_logo", italic: true }, { text: " — INF-YYYY-NNN, Calibri, logo GlorIA." }]),
  bullet([{ text: "project_emotional_heat_sandbox", italic: true }, { text: " — el harness reutiliza el clasificador de calor de la rama." }]),
];

const doc = new Document({
  styles: { default: { document: { run: { font: "Calibri", size: 22, color: DARK } } } },
  sections: [
    { properties: { page: { size: { width: PAGE_W, height: 15840 }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } }, children: cover },
    { properties: { page: { size: { width: PAGE_W, height: 15840 }, margin: { top: MARGIN, right: MARGIN, bottom: 1080, left: MARGIN } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "INF-2026-060 — Enriquecimiento clínico de pacientes IA", size: 16, font: "Calibri", color: GREY, italics: true })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: "GlorIA · Universidad Gabriela Mistral · Página ", size: 16, font: "Calibri", color: GREY }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Calibri", color: GREY }),
        new TextRun({ text: " · 2026-06-16", size: 16, font: "Calibri", color: GREY }),
      ] })] }) },
      children: main },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = "informes/investigacion/INF-2026-060_enriquecimiento-clinico-pacientes-piloto-conductual.docx";
  fs.writeFileSync(out, buf);
  console.log(`Generado: ${out} — ${(buf.length / 1024).toFixed(1)} KB`);
});
