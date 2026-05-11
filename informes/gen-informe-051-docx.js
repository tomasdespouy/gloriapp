/**
 * INF-2026-051 .docx — Despliegue INF-050 a PROD + tuning clínico de 9 pacientes
 */
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageBreak, PageNumber
} = require("docx");

const gloriaLogo = fs.readFileSync("public/branding/gloria-logo.png");
const ugmLogo = fs.readFileSync("public/branding/ugm-logo.png");
const PATIENTS = JSON.parse(fs.readFileSync("C:/tmp/patients-clinical-summary.json", "utf8"));

const INDIGO = "4A55A2", DARK = "1A1A1A", LIGHT_BG = "F0F2FA", CODE_BG = "F7F7F9";
const GREEN_BG = "E8F5E9", ORANGE_BG = "FFF3E0", RED_BG = "FFEBEE";
const WHITE = "FFFFFF", GREY = "666666", GREEN = "2E7D32", BORDER = "CCCCCC";

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

function dataTable(rows, colWidths, opts = {}) {
  const t_rows = rows.map((row, ri) => new TableRow({
    tableHeader: ri === 0,
    children: row.map((cell, ci) => {
      const isHeader = ri === 0;
      const text = typeof cell === "string" ? cell : "";
      const bg = isHeader ? INDIGO :
        (opts.highlightRow && opts.highlightRow.includes(ri)) ? RED_BG :
        (ri % 2 === 0 ? LIGHT_BG : WHITE);
      return new TableCell({
        borders, width: { size: colWidths[ci], type: WidthType.DXA },
        shading: { fill: bg, type: ShadingType.CLEAR },
        margins: cellMargins, verticalAlign: "top",
        children: [new Paragraph({ children: [new TextRun({
          text, bold: isHeader, color: isHeader ? WHITE : DARK,
          font: "Calibri", size: opts.fontSize || 19,
        })] })]
      });
    })
  }));
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: colWidths, rows: t_rows });
}

// ─── Lógica de tabla descriptora (idéntica al gen-informe-051.py) ────
const STYLE_MAP = {
  "guarded_but_willing": ["Cauta inicialmente, se disculpa al emocionarse", "Negación parcial, autodisculpa"],
  "deflects_with_humor": ["Esquiva con humor (\"yo no estoy loco\")", "Humor evitativo"],
  "monosyllabic_initially": ["Monosilábico al inicio; silencios largos; \"no sé\"", "Aislamiento, retracción"],
  "articulate_and_challenging": ["Articulada, desafiante, pone a prueba al terapeuta", "Intelectualización, control"],
  "formal_and_brief": ["Formal y factual; \"Bien, gracias, doctor\"", "Formación reactiva, distanciamiento"],
  "anxious_but_open": ["Habla rápido cuando ansiosa, autoexigente, llanto fácil", "Perfeccionismo, autocrítica"],
  "factual_and_flat": ["Tono plano, no nombra emociones, responde con datos", "Alexitimia, racionalización"],
  "uses_clinical_jargon": ["Intelectualiza con jerga clínica para no sentir", "Intelectualización extrema"],
  "submissive_and_justifying": ["Minimiza la situación, justifica al agresor", "Minimización, identificación con agresor"],
  "monosyllabic": ["Pocas palabras, distante, no se queja", "Negación, masculinidad rígida"],
  "articulate_but_trapped": ["Articulada y paralizada; ambivalente", "Ambivalencia paralizante, sumisión"],
  "fragmented_when_triggered": ["Habla fluida hasta que el trauma aparece", "Disociación, evitación"],
  "cheerful_surface": ["Fachada alegre que se quiebra con validación", "Negación maníaca, sobreadaptación"],
  "insightful_but_stuck": ["Tiene insight pero no logra actuar", "Racionalización, parálisis afectiva"],
  "self_aware_but_stuck": ["Conoce su patrón, no logra cambiarlo", "Intelectualización defensiva"],
  "cauteloso": ["Cauteloso al inicio; se abre con escucha sin juicio", "Evitación, contención"],
  "direct_and_colloquial": ["Directo, coloquial, lenguaje de la calle", "Negación masculina, humor"],
  "cynical_and_articulate": ["Cínico, sarcástico, articulado; ataca el setting", "Sarcasmo, racionalización"],
  "sarcastic_defense": ["Sarcasmo como escudo; \"da igual\"", "Sarcasmo defensivo"],
  "emotional_and_narrative": ["Cuenta historias largas, se desborda emocionalmente", "Somatización, rumiación narrativa"],
  "religious_framework": ["Encuadra todo en términos religiosos; \"voluntad de Dios\"", "Resignación espiritual, sublimación"],
  "quiet_and_hesitant": ["Voz baja, dudosa, pide permiso para hablar", "Inhibición, sumisión"],
  "storytelling": ["Narra anécdotas como evitación de emoción presente", "Distanciamiento narrativo"],
  "formal_and_measured": ["Formal y medido; \"don\" / \"señor\"; sopesa cada palabra", "Formación reactiva, contención"],
};

function inferFromProblem(presenting, tags) {
  const t = (tags || []).join(" ").toLowerCase() + " " + (presenting || "").toLowerCase();
  if (/duelo paterno/.test(t)) return ["Cambia de tema o broma cuando el padre aparece", "Humor evitativo, racionalización"];
  if (/duelo|duelo-hermano/.test(t)) return ["Habla del fallecido en presente; defensa con \"ya pa' qué\"", "Negación, idealización"];
  if (/p[aá]nico|ansiedad/.test(t)) return ["Hipervigilancia, taquicardia narrada", "Evitación, hipercontrol"];
  if (/burnout/.test(t)) return ["Agotamiento, cinismo, \"no doy más\"", "Sobreadaptación al rol cuidador"];
  if (/trauma|ptsd|estr[eé]s post/.test(t)) return ["Sobresaltos, evitación, fragmentación al trauma", "Disociación, evitación"];
  if (/codepende|violencia/.test(t)) return ["Justifica al agresor, minimiza", "Identificación con agresor"];
  if (/depresi[oó]n/.test(t)) return ["Anhedonia, enlentecimiento", "Inhibición, retraimiento"];
  if (/impostor|perfeccionismo/.test(t)) return ["Relaja con logros, se evade con lo personal", "Perfeccionismo defensivo, intelectualización"];
  if (/crisis vital|mediana edad|transici[oó]n/.test(t)) return ["Cuestionamiento existencial, metáforas (musicales/laborales)", "Sublimación, humor melancólico"];
  if (/ira|explosivo/.test(t)) return ["Aprieta mandíbula, rechazo del setting, frases breves", "Externalización, masculinidad rígida"];
  if (/vincular|pareja|post-ruptura/.test(t)) return ["Vacila al hablar de la pareja, compara con ex", "Evitación del deseo propio"];
  if (/migraci[oó]n|cuidadora/.test(t)) return ["Activa rol cuidadora con el terapeuta, busca aprobación", "Sobreadaptación, religiosidad de contención"];
  if (/autolesi[oó]n|cutting/.test(t)) return ["Sarcasmo defensivo; remisión ambivalente", "Sarcasmo, fantasía de escape"];
  if (/familia|paterno|conflicto/.test(t)) return ["Resentimiento contenido, lealtades en conflicto", "Represión, lealtades inconscientes"];
  if (/aislamiento/.test(t)) return ["Retraimiento social, evitación de contacto", "Evitación, retracción"];
  if (/autoestima/.test(t)) return ["Autocrítica, comparaciones desfavorables", "Autoexigencia, devaluación"];
  return ["—", "—"];
}

function category(tags, presenting) {
  const tagSet = new Set((tags || []).map(t => t.toLowerCase()));
  const t = [...tagSet].join(" ") + " " + (presenting || "").toLowerCase();
  if (/impostor/.test(t)) return "Impostor / Perfeccionismo";
  if (/trauma|ptsd/.test(t)) return "Trauma / TEPT";
  if (/duelo/.test(t)) return "Duelo";
  if (/ideacion|ideación|suicid/.test(t)) return "Riesgo / Depresión grave";
  if (tagSet.has("ansiedad") || /p[aá]nico|ansiedad/.test(t)) return "Ansiedad";
  if (/depresi[oó]n/.test(t)) return "Depresión";
  if (/burnout/.test(t)) return "Burnout";
  if (tagSet.has("personalidad")) return "Rasgos de personalidad";
  if (/ira|explosivo/.test(t)) return "Trastorno explosivo";
  if (/mediana edad|transici[oó]n|crisis vital/.test(t)) return "Crisis vital / Mediana edad";
  if (tagSet.has("familia") || tagSet.has("dependencia") || /vincul|pareja/.test(t)) return "Vínculos / Familia";
  if (tagSet.has("identidad") || tagSet.has("adaptación")) return "Identidad / Crisis";
  if (tagSet.has("autoestima")) return "Autoestima";
  if (tagSet.has("masculinidad")) return "Masculinidad";
  if (/autolesi[oó]n/.test(t)) return "Autolesión / Regulación";
  return "Otro";
}

// ─── Cover ───────────────────────────────────────────────────────
const cover = [
  empty(), empty(), empty(), empty(),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new ImageRun({ type: "png", data: gloriaLogo, transformation: { width: 130, height: 130 },
      altText: { title: "GlorIA", description: "Logo GlorIA", name: "gloria-logo" } })] }),
  empty(),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "INF-2026-051", color: INDIGO, bold: true, size: 22, font: "Calibri" })] }),
  empty(),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
    children: [new TextRun({ text: "Despliegue INF-050 a producción", bold: true, size: 42, font: "Calibri", color: INDIGO })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
    children: [new TextRun({ text: "y tuning clínico de 9 pacientes", size: 32, font: "Calibri", color: DARK })] }),
  empty(),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: "Reporte de un día completo · 2026-05-11",
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

// ─── Construir filas de la tabla descriptora ─────────────────────
const patientTableData = [["#", "Paciente", "País/Dif/Edad", "Cuadro · presenting_problem", "Signos observables", "Defensa"]];
for (let i = 0; i < PATIENTS.length; i++) {
  const p = PATIENTS[i];
  const country = Array.isArray(p.country) ? p.country[0] : p.country;
  const cs = p.personality_traits?.communication_style;
  let [signs, defense] = STYLE_MAP[cs] || ["", ""];
  if (!signs || signs === "—") [signs, defense] = inferFromProblem(p.presenting_problem, p.tags);
  if (cs === "cauteloso") {
    const [extra, extraDef] = inferFromProblem(p.presenting_problem, p.tags);
    if (extra && extra !== "—") {
      signs = `Cauteloso al inicio; ${extra.toLowerCase()}`;
      if (extraDef !== "—") defense = extraDef;
    }
  }
  const cat = category(p.tags, p.presenting_problem);
  let consulta = p.presenting_problem || "";
  if (consulta.length > 80) consulta = consulta.slice(0, 80) + "…";
  const tuned = p.enrichment_version >= 2 ? " *" : "";
  patientTableData.push([
    String(i + 1),
    `${p.name}${tuned}`,
    `${country} · ${p.difficulty_level.slice(0, 3)} · ${p.age}`,
    `${cat} — ${consulta}`,
    signs,
    defense,
  ]);
}

// ─── Distribución por categoría ──────────────────────────────────
const catCount = {};
for (const p of PATIENTS) {
  const c = category(p.tags, p.presenting_problem);
  catCount[c] = (catCount[c] || 0) + 1;
}
const catRows = [["Categoría diagnóstica", "Cantidad"]];
for (const [k, v] of Object.entries(catCount).sort((a, b) => b[1] - a[1])) {
  catRows.push([k, String(v)]);
}

// ─── Contenido principal ─────────────────────────────────────────
const main = [
  h1("Metadatos del informe"),
  kvTable([
    ["Número", "INF-2026-051"],
    ["Fecha", "2026-05-11"],
    ["Categoría", "Despliegue + Investigación clínica"],
    ["Prioridad", "Alta"],
    ["Sujeto del estudio", "Despliegue de INF-2026-050 a PROD + tuning clínico de 9 pacientes"],
    ["Documentos hermanos", [
      { text: "INF-2026-047, 048, 049 + " },
      { text: "INF-2026-050 (enriquecimiento masivo 34 pacientes)", bold: true }
    ]],
    ["Estado final del INF-050 en PROD", [
      { text: "34 / 34", bold: true },
      { text: " pacientes enriquecidos, " },
      { text: "172", bold: true },
      { text: " filas en enrichment_history, " },
      { text: "9", bold: true },
      { text: " con tuning clínico, " },
      { text: "0", bold: true },
      { text: " errores acumulados" }
    ]],
    ["Commits del día", "5dd4530 · a6f55ba · e402c72 · b7851fd · 34f45a1 · b24661e"],
    ["Costo total de API", "≈ USD 0,75"],
  ]),
  empty(),
  h2("Resumen ejecutivo"),
  body("Este informe documenta una jornada completa de despliegue y refinamiento clínico. En la mañana se aplicó el INF-2026-050 (enriquecimiento de los 34 pacientes con 4 bloques nuevos) a producción, tras la validación previa en staging. En la tarde, a partir de la tabla descriptora clínica de los 34 pacientes, se identificaron dos categorías de problemas: (a) pacientes con cuadros demasiado genéricos que no aprovechaban el material biográfico disponible, y (b) pacientes con contenido clínicamente riesgoso para un contexto pedagógico de pregrado. Se aplicó tuning clínico a 9 pacientes en dos batches secuenciales — primero los 5 más urgentes (riesgo + 2 enriquecimientos), luego los 4 cuadros genéricos restantes — siempre en staging primero, validados con E2E contra el LLM real, y replicados a PROD solo tras coherencia confirmada."),
  body([
    { text: "Resultado: ", bold: true },
    { text: "los 34 pacientes ahora tienen bloques de enriquecimiento activos en producción, los 9 con cuadros genéricos o riesgosos quedaron correctamente tipificados clínicamente, y la atenuación crítica de Alejandro Vega (ideación suicida activa con plan → ideación pasiva fugaz sin plan ni medios) redujo el riesgo iatrogénico inmediato para los estudiantes que conversan con él. La aplicación se hizo exclusivamente vía API REST tras un incidente menor con el SQL Editor (5 duplicados huérfanos creados por ejecución accidental del seed inicial, todos eliminados sin afectar conversaciones reales)." }
  ]),

  pageBreak(),

  h1("1. Línea de tiempo del día (2026-05-11)"),
  dataTable([
    ["Hora UTC", "Hito", "Resultado"],
    ["~11:30", "Verificación post-incidente Supabase (resuelto)", "Banner naranja desapareció; staging respondiendo OK"],
    ["12:00–12:30", "Apply REST de los 34 bloques a STAGING (batch 1)", "23/23 aplicados; 11 saltados (no estaban en staging)"],
    ["12:45", "Sembrado de los 11 pacientes faltantes en STAGING desde PROD", "11 INSERTs preservando UUIDs originales"],
    ["13:00", "Re-apply de los 34 bloques en STAGING", "34/34 aplicados, 136 filas history"],
    ["13:15", "E2E con LLM real (3 representativos)", "Andrés, Yesenia, Diego activando bloques"],
    ["14:30", "Schema en PROD via SQL Editor", "INCIDENTE: usuario aplicó también el seed inicial → 5 duplicados huérfanos"],
    ["14:45", "Limpieza: DELETE de los 5 duplicados", "PROD vuelve a 34 únicos; 0 conversaciones afectadas"],
    ["15:00", "Apply REST de los 34 bloques a PROD", "34/34 aplicados, 136 filas history"],
    ["15:15", "Smoke test PROD: Diego enriquecido", "system_prompt 2.505 → 4.599 chars"],
    ["15:30–16:00", "Generación tabla descriptora + análisis", "Identificados 9 pacientes a tunear"],
    ["16:00–16:45", "Tuning batch 1 STAGING + E2E (5 pacientes)", "5/5 OK. Alejandro: 'No mames, si tuviera un plan...'"],
    ["16:45", "Tuning batch 1 PROD + E2E", "5/5 OK"],
    ["17:15–17:45", "Tuning batch 2 STAGING + E2E (4 pacientes)", "4/4 OK. Rafael con metáforas musicales"],
    ["17:45", "Tuning batch 2 PROD + E2E", "4/4 OK"],
    ["18:00", "Generación INF-2026-051", "Reporte consolidado del día"],
  ], [1500, 4500, 9360], { highlightRow: [6], fontSize: 18 }),

  pageBreak(),

  h1("2. Despliegue de INF-2026-050 a producción"),
  h2("2.1 Schema aplicado"),
  body([
    { text: "El SQL del schema (4 columnas JSONB en ai_patients + tabla enrichment_history con RLS + índice por patient_id + check constraint sobre block_name) se aplicó manualmente en el SQL Editor de Supabase Studio sobre el proyecto ndwmnxlwbfqfwwtekjun (PROD). Migración idempotente con " },
    { text: "IF NOT EXISTS", mono: true },
    { text: " y reversible vía DROP COLUMN documentado en el header." }
  ]),
  h2("2.2 Aplicación de los 34 bloques vía REST"),
  body("Tras descartar el SQL Editor para los datos (por el incidente del 8-may con Supabase + tamaño del archivo de 221 KB), se aplicaron los 34 bloques vía API REST. Match por NAME, no por ID, porque las UUIDs no son consistentes entre bases."),
  kvTable([
    ["Pacientes procesados", "34"],
    ["Bloques aplicados", "136 (34 × 4)"],
    ["Filas en enrichment_history", "136"],
    ["Tiempo total de aplicación", "≈ 25 segundos"],
    ["Errores", "0"],
    ["Verificación smoke test", "✓ Diego: system_prompt 2.505 → 4.599 chars, bloques en posiciones canónicas"],
  ]),

  h1("3. Incidente del día: duplicados accidentales en PROD"),
  body([
    { text: "Durante el despliegue del schema, el usuario aplicó por error en el SQL Editor también el archivo " },
    { text: "20260313203745_seed_ai_patients.sql", mono: true },
    { text: " — un seed inicial del proyecto que contiene INSERT sin ON CONFLICT. Esto creó 5 nuevas filas con UUIDs nuevos:" }
  ]),
  dataTable([
    ["Nombre", "ID original (mantenido)", "ID duplicado (a eliminar)"],
    ["Marcos Herrera", "f9517a4b…", "7df0a337…"],
    ["Roberto Salas", "4de02b24…", "9d30051c…"],
    ["Carmen Torres", "e6e6f099…", "e50618c6…"],
    ["Diego Fuentes", "9ed3247f…", "ab3f92c1…"],
    ["Lucia Mendoza", "190feafa…", "0bba8312…"],
  ], [3500, 5430, 5430]),
  empty(),
  h2("3.1 Verificación de impacto y resolución"),
  body("Antes de cualquier acción destructiva, se verificó que los 5 duplicados estuvieran completamente huérfanos: 0 conversaciones, 0 asignaciones a establecimientos. DELETE seguro sin pérdida de datos. Ejecutado vía REST API con re-verificación pre-flight. PROD volvió a 34 pacientes únicos en menos de 5 minutos desde la detección."),
  h2("3.2 Lessons learned"),
  body([
    { text: "• ", bold: true },
    { text: "El SQL Editor ejecuta cualquier archivo pegado. ", bold: true },
    { text: "No tiene contexto sobre qué migraciones ya están aplicadas. La defensa es la convención: aplicar solo migraciones nuevas y nunca re-aplicar seeds iniciales." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "La aplicación vía REST API resultó más segura ", bold: true },
    { text: "que el SQL Editor para datos masivos: idempotente, con verificaciones pre-flight, sin riesgo de tamaño/timeout." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "INSERT con WHERE EXISTS ", bold: true },
    { text: "evitó cascada de fallos del FK constraint en staging. Patrón reutilizable para migraciones entre ambientes asincronizados." }
  ]),

  pageBreak(),

  h1("4. Tuning clínico de 9 pacientes"),
  body("La tabla descriptora reveló dos categorías que requerían atención: (A) cuadros riesgosos para pregrado y (B) cuadros demasiado genéricos."),
  h2("4.1 Batch 1: atenuación de riesgo + 2 enriquecimientos"),
  dataTable([
    ["Paciente", "Cambio aplicado", "Verificación E2E"],
    ["Alejandro Vega (MX)",
      "Ideación activa con plan ('estrellar mi carro' + medios + cocaína semanal) → ideación pasiva fugaz, sin plan, cocaína recreacional. Padre suicidado reservado a sesión 4+.",
      "'No mames, si tuviera un plan ya no estaría aquí, ¿no? No hay plan, solo ese cansancio.'"],
    ["Altagracia Marte (RD)",
      "Abandono de quimio: secreto profundo → contenido revelable en sesión 2+. Mantiene ideación pasiva.",
      "'Prefiero que crean que sigo con el tratamiento, así ellos están tranquilos.'"],
    ["Jimena Ramírez (MX)",
      "Difficulty beginner → intermediate. Cutting activo → en remisión 6 meses. Fantasías de escape, no suicidas.",
      "'Hace como seis meses que no, pero a veces siento que extraño esa forma de desahogarme.'"],
    ["Valentina Ospina (CO)",
      "'Problemas de pareja' → 'Crisis decisión vincular post-ruptura + perfeccionismo + presión familiar'.",
      "Vacila al hablar de Tomás, lo compara con Daniel (ex), menciona la presión materna."],
    ["Yamilet Pérez (RD→Chile)",
      "'Dependencia emocional' → 'Dependencia + duelo migratorio + culpa religioso-familiar + cuidadora'.",
      "Activa rol cuidadora con terapeuta ('¿Y usted cómo está?'), menciona crucifijo, hermanas allá."],
  ], [3300, 6500, 6560], { fontSize: 17 }),
  empty(),
  h2("4.2 Batch 2: 4 cuadros enriquecidos"),
  dataTable([
    ["Paciente", "Cuadro nuevo", "Verificación E2E"],
    ["Mateo Giménez (AR)",
      "Duelo paterno no resuelto + ansiedad ocupacional + conflicto matrimonial por carga laboral.",
      "'Mi viejo se fue cuando yo tenía 15. Mejor cambiamos de tema, que me pongo medio denso.'"],
    ["Jorge Ramírez (MX)",
      "Trastorno explosivo + duelo del hermano (Tonio) + masculinidad rígida + aislamiento post-divorcio.",
      "'Ya pa' qué hablar de eso, joven.' Dialecto popular mexicano consistente."],
    ["Mariana Sánchez (MX)",
      "Síndrome del impostor + perfeccionismo paralizante + identidad calcada del padre.",
      "Se relaja al hablar de logros, se evade en lo personal. Padre socio en despacho aparece."],
    ["Rafael Santos (RD)",
      "Crisis mediana edad + duelo del éxito no alcanzado + fracaso paterno (hijos a EE.UU.) + ambivalencia vocacional.",
      "'Toco la misma nota sin que nadie me escuche, y eso pesa en el alma.' Metáforas musicales."],
  ], [3300, 6500, 6560], { fontSize: 17 }),
  empty(),
  h2("4.3 Pipeline aplicado"),
  body([
    { text: "Para cada paciente del tuning, el script " },
    { text: "docs/apply-clinical-tuning.js [target] [batch]", mono: true },
    { text: " ejecuta: (1) PATCH metadata; (2) re-generación de los 4 bloques con gpt-4o T=0.7 usando el NUEVO prompt; (3) PATCH bloques + bump enrichment_version (v1 → v2); (4) reset enrichment_history." }
  ]),
  body([
    { text: "El meta-prompt incluye una regla dura adicional: " },
    { text: "'NUNCA agregues elementos clínicos nuevos que cambien el cuadro (especialmente: NO agregar ideación suicida, plan, medios o autolesión activa si el prompt no los menciona o los atenúa)'", italic: true },
    { text: ". Esto previene que el modelo re-introduzca contenido riesgoso." }
  ]),

  pageBreak(),

  h1("5. Tabla descriptora clínica de los 34 pacientes"),
  body("Tras el tuning del día. Las filas con * fueron tuneadas hoy (v=2)."),
  empty(),
  dataTable(patientTableData, [600, 2400, 2000, 4000, 3500, 2860], { fontSize: 15 }),
  small("* tuneado en este día (batch 1 o batch 2). Los 9 ahora tienen enrichment_version=2."),
  empty(),
  h2("5.1 Distribución por categoría diagnóstica"),
  dataTable(catRows, [9000, 6360]),
  empty(),
  h2("5.2 Casos de mayor cuidado clínico (post-atenuación)"),
  body([
    { text: "• ", bold: true },
    { text: "Alejandro Vega: ", bold: true },
    { text: "depresión existencial + duelo paterno + sustancias. Ideación pasiva fugaz sin plan ni medios (atenuada desde activa)." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Altagracia Marte: ", bold: true },
    { text: "ideación pasiva en duelo + cáncer + abandono de quimio. Bandera roja médica explícita ahora." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Jimena Ramírez: ", bold: true },
    { text: "autolesión en remisión 6 meses + fantasías de escape no suicidas. Subida a intermediate." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Jorge Ramírez: ", bold: true },
    { text: "trastorno explosivo + duelo no resuelto del hermano. Alta carga emocional sin riesgo auto-lesivo." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Lorena Gutiérrez: ", bold: true },
    { text: "TEPT activo. Sin tuning hoy, pero evitar gatillos del trauma en sesiones tempranas." }
  ]),

  pageBreak(),

  h1("6. Decisiones técnicas relevantes"),
  body("Cinco decisiones técnicas merecen registro para referencia futura:"),
  h3("Aplicación vía REST API en lugar de SQL Editor"),
  body("Tras el incidente Supabase del 8-may + tamaño del archivo seed de 221 KB, se descartó pegar el SQL completo en el editor. La aplicación REST con verificaciones pre-flight resultó más segura, rastreable y reversible."),
  h3("Match por NAME en lugar de por ID"),
  body("Las UUIDs no son consistentes entre staging y prod (cada base genera las suyas). El script de apply hace match por name normalizado y, ante duplicados, elige el row con system_prompt más largo (versión 'moderna')."),
  h3("INSERT history con WHERE EXISTS"),
  body([
    { text: "Patrón defensivo: " },
    { text: "INSERT INTO enrichment_history SELECT ... WHERE EXISTS (SELECT 1 FROM ai_patients WHERE id='...')", mono: true },
    { text: ". Permite el mismo SQL en staging (23 pac) y prod (34 pac) sin saltos." }
  ]),
  h3("Composición runtime via build-system-prompt.ts"),
  body([
    { text: "Los 4 bloques se inyectan al VUELO al system_prompt original mediante " },
    { text: "buildEnrichedPrompt(patient)", mono: true },
    { text: ". Feature flag " },
    { text: "ENABLE_ENRICHMENT_BLOCKS=false", mono: true },
    { text: " permite rollback instantáneo sin tocar BD." }
  ]),
  h3("Re-generación con regla anti-introducción de riesgo"),
  body("El meta-prompt incluye explícitamente: 'NUNCA agregues ideación suicida, plan, medios o autolesión activa si el prompt no los menciona o los atenúa'. Previene que gpt-4o vuelva a introducir contenido riesgoso."),

  pageBreak(),

  h1("7. Métricas finales del día"),
  dataTable([
    ["Métrica", "Antes del día", "Después del día"],
    ["Pacientes en PROD con bloques enriquecidos", "0", "34 / 34"],
    ["Filas en enrichment_history (PROD)", "0", "172"],
    ["Pacientes con cuadro clínico genérico", "9", "0"],
    ["Pacientes con riesgo iatrogénico alto", "3 (Alejandro, Jimena, Altagracia)", "Todos atenuados / contenidos"],
    ["Pacientes con tuning clínico aplicado", "0", "9 (5 batch 1 + 4 batch 2)"],
    ["Conversaciones afectadas por el incidente", "—", "0 (duplicados huérfanos eliminados)"],
    ["Errores acumulados en aplicación", "—", "0"],
    ["Commits del día", "—", "6"],
    ["Costo total API", "—", "≈ USD 0,75"],
  ], [6500, 4500, 4360]),

  h1("8. Estado de adopción"),
  body([
    { text: "Conversaciones nuevas ", bold: true },
    { text: "iniciadas a partir de ahora: el " },
    { text: "prompt_snapshot", mono: true },
    { text: " se guardará con los bloques inyectados — el paciente activa el material biográfico durante toda la sesión." }
  ]),
  body([
    { text: "Conversaciones activas previas: ", bold: true },
    { text: "mantienen su prompt_snapshot anterior (sin bloques) por decisión clínica explícita — no interrumpir la coherencia de sesiones en curso." }
  ]),
  body([
    { text: "Rollback: ", bold: true },
    { text: "si se detecta cualquier regresión, activar ENABLE_ENRICHMENT_BLOCKS=false en Vercel — reversión instantánea sin tocar BD. Para revertir los tunings específicos: consultar enrichment_history (audit trail) y aplicar UPDATE con contenido v=1." }
  ]),

  h1("9. Trabajo pendiente / oportunidades"),
  body([
    { text: "• ", bold: true },
    { text: "Validación clínica con docentes UGM: ", bold: true },
    { text: "la atenuación de Alejandro y los enriquecimientos fueron validados por E2E automatizado, no por un docente. La validación humana es el siguiente paso." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Documentación del módulo de creación de pacientes: ", bold: true },
    { text: "el UI editor (EnrichmentEditor.tsx) ya está deployed pero el equipo académico no fue capacitado. Manual breve + sesión de 30 min cerraría la adopción." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Sincronización staging ↔ prod: ", bold: true },
    { text: "staging tiene 28 filas (23 modernos + 5 duplicados viejos del seed); convendría limpiarlos." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Re-sync de prompt_snapshot: ", bold: true },
    { text: "para que sesiones activas vean los bloques, decisión clínica (no técnica)." }
  ]),
  body([
    { text: "• ", bold: true },
    { text: "Monitoreo 48-72h: ", bold: true },
    { text: "revisar evaluaciones docentes, reportes de bugs, comportamientos inusuales con los prompts más largos." }
  ]),

  empty(),

  h1("10. Citas y referencias"),
  body([{ text: "Documentos hermanos:", bold: true }]),
  body("• INF-2026-047 — Caso clínico Alejandro López (GlorIA 1.0)."),
  body("• INF-2026-048 — Caso clínico Diego Fuentes (GlorIA 5.0)."),
  body("• INF-2026-049 — Propuesta enriquecimiento prompt de Diego (caso piloto)."),
  body("• INF-2026-050 — Enriquecimiento masivo de los 34 pacientes."),
  body("• INF-2026-037 — Upgrade pacientes legacy con remoción de ideación (precedente)."),
  body([{ text: "Commits del día:", bold: true }]),
  body([{ text: "• " }, { text: "5dd4530", mono: true }, { text: " — INF-050 código + migraciones." }]),
  body([{ text: "• " }, { text: "a6f55ba", mono: true }, { text: " — Script REST + smoke test STAGING." }]),
  body([{ text: "• " }, { text: "e402c72", mono: true }, { text: " — Cobertura completa 34/34 staging + E2E LLM." }]),
  body([{ text: "• " }, { text: "b7851fd", mono: true }, { text: " — INF-050 desplegado a PROD." }]),
  body([{ text: "• " }, { text: "34f45a1", mono: true }, { text: " — Tuning batch 1 en PROD." }]),
  body([{ text: "• " }, { text: "b24661e", mono: true }, { text: " — Tuning batch 2 en PROD." }]),
  body([{ text: "Scripts reproducibles del día (en docs/):", bold: true }]),
  body([{ text: "• " }, { text: "apply-enrichment-prod.js", mono: true }, { text: " — apply de los 34 bloques iniciales." }]),
  body([{ text: "• " }, { text: "apply-clinical-tuning.js [target] [batch]", mono: true }, { text: " — script de tuning." }]),
  body([{ text: "• " }, { text: "clinical-tuning-data.js / clinical-tuning-batch2.js", mono: true }, { text: " — fuente reproducible." }]),
  body([{ text: "• " }, { text: "e2e-tuning-prod.js / e2e-batch2.js", mono: true }, { text: " — tests E2E con LLM real." }]),
  body([{ text: "• " }, { text: "smoke-test-050-prod.js", mono: true }, { text: " — smoke test composición prompt." }]),
  body([{ text: "• " }, { text: "gen-clinical-table.js", mono: true }, { text: " — generador de la tabla descriptora." }]),
  body([{ text: "Memorias relevantes:", bold: true }]),
  body([{ text: "• " }, { text: "feedback_cuidado_no_romper", italic: true }, { text: " — aplicado: verificación pre-flight + rollback documentado." }]),
  body([{ text: "• " }, { text: "feedback_supabase_link", italic: true }, { text: " — aplicado: assertion del project-ref en cada script." }]),
  body([{ text: "• " }, { text: "feedback_informes_pdf", italic: true }, { text: " — aplicado: INF-YYYY-NNN, Calibri, logos." }]),
];

const doc = new Document({
  styles: { default: { document: { run: { font: "Calibri", size: 22, color: DARK } } } },
  sections: [
    { properties: { page: { size: { width: PAGE_W, height: 15840 }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
      children: cover },
    { properties: { page: { size: { width: PAGE_W, height: 15840 }, margin: { top: MARGIN, right: MARGIN, bottom: 1080, left: MARGIN } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "INF-2026-051 — Despliegue INF-050 + tuning clínico", size: 16, font: "Calibri", color: GREY, italics: true })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "GlorIA · Universidad Gabriela Mistral · ", size: 16, font: "Calibri", color: GREY }),
          new TextRun({ text: "Página ", size: 16, font: "Calibri", color: GREY }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Calibri", color: GREY }),
          new TextRun({ text: " · 2026-05-11", size: 16, font: "Calibri", color: GREY }),
        ] })] }) },
      children: main },
  ],
});

Packer.toBuffer(doc).then(buf => {
  const out = "informes/investigacion/INF-2026-051_despliegue-inf050-y-tuning-clinico.docx";
  fs.writeFileSync(out, buf);
  console.log(`Generado: ${out} — ${(buf.length / 1024).toFixed(1)} KB`);
});
