// Genera INF-2026-042 — Piloto UBO (Universidad Bernardo O'Higgins).
//
// Formato heredado del INF-2026-044 (UCSP) en su version 2: schema-driven,
// charts redondeados a 1 decimal, % top-2-box en titulos de Likert,
// tabla detallada con avg (pct%), testimonios y ejemplos clinicos
// despersonalizados por rol. Adaptaciones para UBO:
//   · Schema v1 (q5_usabilidad + q6_formacion + q7-q10) en vez de v2_pilot.
//   · Un solo piloto (no comparativo entre cohortes).
//   · Sin Seccion 5: la comparacion entre cohortes solo aplica a consolidados.
//   · Sin columnas Cohorte/Edad (el v1 no las captura).
//   · Testimonios firmados por rol (Estudiante / Docente).
//
// Output: informes/pilotos/INF-2026-042_piloto-ubo.docx
// (en .gitignore por PII; subir manualmente segun protocolo de informes).

const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, ImageRun,
} = require("docx");

const data = require("./ubo-pilot-data.json");

// ─────────────────────────────────────────
// Constantes de estilo
// ─────────────────────────────────────────
const accent = "4A55A2";
const amber = "B45309";
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };
const logo = fs.readFileSync("public/branding/gloria-logo.png");
const LOGO_W = logo.readUInt32BE(16);
const LOGO_H = logo.readUInt32BE(20);
const LOGO_TARGET_H = 44;
const LOGO_TARGET_W = Math.round(LOGO_TARGET_H * (LOGO_W / LOGO_H));

// ─────────────────────────────────────────
// Helpers de doc
// ─────────────────────────────────────────
function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({
      text, bold: true, font: "Calibri",
      size: level === HeadingLevel.HEADING_1 ? 32 : level === HeadingLevel.HEADING_2 ? 26 : 22,
      color: accent,
    })],
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    ...opts,
    children: [new TextRun({ text, font: "Calibri", size: 22, ...opts.run })],
  });
}

function small(text, color = "6B7280") {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, font: "Calibri", size: 18, color })],
  });
}

function cell(text, opts = {}) {
  return new TableCell({
    borders,
    margins: cellMargins,
    shading: opts.shading,
    width: opts.width,
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: [new TextRun({
        text: String(text ?? ""),
        font: "Calibri",
        size: 20,
        bold: opts.bold,
        color: opts.color,
        italics: opts.italics,
      })],
    })],
  });
}

function headerCell(text, opts = {}) {
  return cell(text, {
    ...opts, bold: true,
    shading: { fill: "F3F4F6", type: ShadingType.CLEAR, color: "auto" },
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function quoteBlock(text) {
  return new Paragraph({
    spacing: { before: 100, after: 100 },
    indent: { left: 400 },
    border: { left: { style: BorderStyle.SINGLE, size: 16, color: accent, space: 8 } },
    children: [new TextRun({ text: `"${text}"`, font: "Calibri", size: 22, italics: true, color: "4B5563" })],
  });
}

// ─────────────────────────────────────────
// Charts (quickchart.io)
// ─────────────────────────────────────────
async function fetchChart(config, width = 480, height = 320) {
  const res = await fetch("https://quickchart.io/chart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chart: config, width, height, devicePixelRatio: 2, backgroundColor: "transparent" }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`quickchart ${res.status}: ${errBody.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function pieChart({ title, labels, values, colors }) {
  const total = values.reduce((a, b) => a + b, 0);
  const enrichedLabels = labels.map((l, i) =>
    `${l} (${values[i]}, ${total > 0 ? Math.round((values[i] / total) * 100) : 0}%)`,
  );
  const buf = await fetchChart({
    type: "pie",
    data: {
      labels: enrichedLabels,
      datasets: [{
        label: "",
        data: values,
        backgroundColor: colors || ["#4A55A2", "#6F7AC4", "#B5BEE3", "#E0E4F3", "#94A3B8"],
      }],
    },
    options: {
      plugins: {
        legend: { position: "right", labels: { font: { size: 13 } } },
        title: { display: true, text: title, font: { size: 16, weight: "bold" } },
        datalabels: { display: false },
      },
    },
  }, 600, 360);
  return new ImageRun({ data: buf, transformation: { width: 600, height: 360 } });
}

// Bar chart single para Likert de la encuesta. Eje 1-5. Promedio al
// final de cada barra. Los valores del dataset vienen ya redondeados a
// 1 decimal porque quickchart.io no evalua los formatter inline (los
// recibe como string y los ignora).
async function barChartSurvey({ title, categories, values, xMin = 1, xMax = 5 }) {
  const buf = await fetchChart({
    type: "bar",
    data: {
      labels: categories,
      datasets: [{ label: "", data: values, backgroundColor: "#4A55A2", borderRadius: 4 }],
    },
    options: {
      indexAxis: "y",
      layout: { padding: { right: 50 } },
      plugins: {
        legend: { display: false },
        title: { display: true, text: title, font: { size: 16, weight: "bold" } },
        datalabels: {
          anchor: "end", align: "end", offset: 6,
          color: "#1F2937",
          font: { weight: "bold", size: 12 },
        },
      },
      scales: {
        x: { min: xMin, max: xMax, ticks: { stepSize: 1 }, grid: { color: "#E5E7EB" } },
        y: { ticks: { font: { size: 12 } }, grid: { display: false } },
      },
    },
  }, 720, 340);
  return new ImageRun({ data: buf, transformation: { width: 720, height: 340 } });
}

// Bar chart single de competencias (rango 0-5).
async function barChartCompetencias({ title, categories, values }) {
  return barChartSurvey({ title, categories, values, xMin: 0, xMax: 5 });
}

// ─────────────────────────────────────────
// Helpers numericos
// ─────────────────────────────────────────
function avgOf(arr) {
  const xs = arr.filter((v) => typeof v === "number");
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function round1(v) {
  if (v === null || v === undefined || typeof v !== "number") return null;
  return Math.round(v * 10) / 10;
}

function pctTopOf(arr) {
  const xs = arr.filter((v) => typeof v === "number");
  if (xs.length === 0) return null;
  return Math.round((xs.filter((v) => v >= 4).length / xs.length) * 100);
}

// ─────────────────────────────────────────
// Schema v1 (legacy UBO/UGM) — replicado de src/lib/survey-schema.ts
// ─────────────────────────────────────────
const SURVEY_SCHEMA_V1 = {
  formVersion: "v1",
  shortLabel: "v1",
  likertGroups: [
    {
      answersKey: "q5_usabilidad",
      title: "Usabilidad",
      number: 1,
      items: [
        { key: "navegacion", label: "Navegar por la plataforma me resultó intuitivo y cómodo." },
        { key: "performance", label: "El tiempo de carga y funcionamiento general fue adecuado." },
        { key: "claridad", label: "La plataforma explica claramente su propósito." },
        { key: "feedback", label: "La retroalimentación del sistema fue comprensible y útil." },
      ],
    },
    {
      answersKey: "q6_formacion",
      title: "Formación",
      number: 2,
      items: [
        { key: "aplicacion", label: "Me permitió aplicar conocimientos propios de mi formación." },
        { key: "habilidades", label: "Podría contribuir al desarrollo de habilidades profesionales." },
        { key: "incorporacion", label: "Debería incorporarse regularmente en los cursos." },
        { key: "verosimilitud", label: "El escenario simulado fue verosímil y coherente." },
        { key: "atencion", label: "Logró mantener mi atención durante toda la actividad." },
      ],
    },
  ],
};

function isV1Response(r) {
  if (!r || r.status !== "completed" || !r.answers) return false;
  // El v1 no tenia form_version; consideramos que un response es v1 si
  // tiene q5_usabilidad o q6_formacion (no las claves v2).
  if (typeof r.answers.q5_usabilidad === "object" && r.answers.q5_usabilidad !== null) return true;
  if (typeof r.answers.q6_formacion === "object" && r.answers.q6_formacion !== null) return true;
  return false;
}

let v1Responses = [];
function buildV1Responses() {
  v1Responses = (data.surveyResponses || []).filter(isV1Response);
}

// ─────────────────────────────────────────
// Indices auxiliares (rol por user_id)
// ─────────────────────────────────────────
const rolByUserId = new Map();
function buildSurveyIndexes() {
  for (const r of v1Responses) {
    if (typeof r.answers.q4_rol === "string") {
      rolByUserId.set(r.user_id, r.answers.q4_rol);
    }
  }
}

// Etiqueta por rol — "Estudiante" / "Docente" / "Participante" si no
// hay rol declarado. Sirve para testimonios y ejemplos clinicos.
function despersonalizedLabel(userId) {
  const rol = rolByUserId.get(userId);
  if (!rol) return "Participante";
  if (rol === "estudiante") return "Estudiante";
  if (rol === "docente" || rol === "instructor") return "Docente";
  return "Participante";
}

// ─────────────────────────────────────────
// Agregaciones de encuesta y metricas
// ─────────────────────────────────────────
function minutesBetween(firstIso, lastIso) {
  if (!firstIso || !lastIso) return 0;
  return Math.round((new Date(lastIso) - new Date(firstIso)) / 60000);
}

function statsConsolidado() {
  const userIds = new Set(data.participants.map((p) => p.user_id).filter(Boolean));
  const convs = data.conversations.filter((c) => userIds.has(c.student_id));
  const completed = convs.filter((c) => c.status === "completed");
  let totalMin = 0;
  for (const c of convs) {
    if (c.metrics) totalMin += minutesBetween(c.metrics.first, c.metrics.last);
  }
  return {
    invitados: data.participants.length,
    conectados: data.participants.filter((p) => p.first_login_at || p.user_id).length,
    encuestas: v1Responses.length,
    sesionesTotales: convs.length,
    sesionesCompletadas: completed.length,
    minutos: totalMin,
  };
}

function pilotWindow() {
  const fmt = (iso) => {
    if (!iso) return "—";
    return new Intl.DateTimeFormat("es-CL", {
      timeZone: "America/Santiago",
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  };
  return `${fmt(data.pilot.scheduled_at)} → ${fmt(data.pilot.ended_at)}`;
}

function perParticipantMetrics(userId) {
  const convs = data.conversations.filter((c) => c.student_id === userId);
  let mins = 0;
  let last = null;
  for (const c of convs) {
    if (c.metrics) {
      mins += minutesBetween(c.metrics.first, c.metrics.last);
      if (!last || c.metrics.last > last) last = c.metrics.last;
    }
  }
  return { sesiones: convs.length, minutos: mins, ultimo: last };
}

function likertAvgs() {
  // Devuelve { answersKey: { [itemKey]: {avg, pctTop, n}, _overall: {...} } }
  const result = {};
  for (const group of SURVEY_SCHEMA_V1.likertGroups) {
    const groupResult = {};
    const overallSamples = [];
    for (const item of group.items) {
      const vals = v1Responses
        .map((r) => r.answers?.[group.answersKey]?.[item.key])
        .filter((v) => typeof v === "number");
      groupResult[item.key] = {
        avg: avgOf(vals),
        pctTop: pctTopOf(vals),
        n: vals.length,
      };
      overallSamples.push(...vals);
    }
    groupResult._overall = {
      avg: avgOf(overallSamples),
      pctTop: pctTopOf(overallSamples),
      n: overallSamples.length,
    };
    result[group.answersKey] = groupResult;
  }
  return result;
}

function rolGenero() {
  const rol = {};
  const genero = {};
  for (const r of v1Responses) {
    const a = r.answers || {};
    if (a.q4_rol) rol[a.q4_rol] = (rol[a.q4_rol] || 0) + 1;
    if (a.q2_genero) genero[a.q2_genero] = (genero[a.q2_genero] || 0) + 1;
  }
  return { rol, genero };
}

// ─────────────────────────────────────────
// Testimonios
// ─────────────────────────────────────────
const POSITIVE_ONLY_RE = /\b(est[aá] perfect[oa]|me encant[oó]|fue genial|muy real|est[aá] excelente|super bueno|por el momento nada|nada[,.]?\s*est[aá])\b/i;

function pickTestimonios() {
  const positivas = [];
  const mejoras = [];
  for (const r of v1Responses) {
    const label = despersonalizedLabel(r.user_id);
    const pos = (r.answers.q7_mas_gusto || "").trim();
    if (pos && pos.split(/\s+/).length >= 5) {
      positivas.push({ text: pos, label });
    }
    const mej = (r.answers.q8_mejoras || "").trim();
    if (mej && mej.split(/\s+/).length >= 5 && !POSITIVE_ONLY_RE.test(mej)) {
      mejoras.push({ text: mej, label });
    }
  }
  positivas.sort((a, b) => b.text.length - a.text.length);
  mejoras.sort((a, b) => b.text.length - a.text.length);
  return { positivas: positivas.slice(0, 3), mejoras: mejoras.slice(0, 3) };
}

// ─────────────────────────────────────────
// Competencias clinicas (Valdes-Gomez 2023). Excluyen presencia y
// conducta_no_verbal porque no son medibles con rigor en texto-solo.
// ─────────────────────────────────────────
const COMPETENCY_DEFS = {
  setting_terapeutico: {
    label: "Setting terapéutico",
    def: "Capacidad para establecer un encuadre terapéutico claro desde el inicio: recibir al paciente, explicitar el propósito del espacio, las reglas implícitas (confidencialidad, duración, frecuencia) y los límites del rol. En la práctica se observa cuando el terapeuta abre la sesión con una orientación explícita, sostiene el marco ante intentos de ruptura, y cierra la sesión con claridad. Importa porque el encuadre es la condición que hace posible el trabajo clínico: sin él, la intervención pierde contención simbólica.",
  },
  motivo_consulta: {
    label: "Motivo de consulta",
    def: "Capacidad para explorar y comprender tanto el motivo manifiesto (lo que el paciente dice que le pasa) como el motivo latente (lo que sostiene el malestar a nivel más profundo). En la práctica se observa cuando el terapeuta va más allá de la queja explícita, formula hipótesis sobre el trasfondo, y las contrasta con el paciente sin imponerlas. Importa porque dirigir la terapia al motivo manifiesto solamente suele producir alivio sintomático pero no cambio estructural.",
  },
  datos_contextuales: {
    label: "Datos contextuales",
    def: "Capacidad para integrar información biográfica, familiar, social, laboral y cultural del paciente en la comprensión de su problemática. En la práctica se observa cuando el terapeuta pregunta activamente por redes de apoyo, historia vincular, contexto sociocultural, y usa esa información para iluminar el malestar presente. Importa porque un síntoma siempre ocurre en un contexto: sin él, la intervención se vuelve abstracta y descontextualizada.",
  },
  objetivos: {
    label: "Objetivos terapéuticos",
    def: "Capacidad para co-construir con el paciente objetivos terapéuticos claros, consensuados, alcanzables y orientados al cambio. En la práctica se observa cuando el terapeuta devuelve al paciente una formulación del trabajo a hacer, chequea si resuena con lo que el paciente busca, y revisa esos objetivos a lo largo del proceso. Importa porque una terapia sin objetivos acordados tiende a la dispersión o al vínculo sin dirección, y el paciente pierde referencia sobre su propio avance.",
  },
  escucha_activa: {
    label: "Escucha activa",
    def: "Capacidad para atender plenamente al contenido verbal y paraverbal del paciente, y responder con comprensión que demuestre que lo dicho fue efectivamente recibido. En la práctica se observa cuando el terapeuta parafrasea, reformula, resume y valida aspectos centrales del discurso del paciente antes de intervenir. Importa porque la escucha activa es el sustrato sobre el cual se construye la alianza: sin ella, cualquier intervención se percibe como impuesta o desconectada de la experiencia del consultante.",
  },
  actitud_no_valorativa: {
    label: "Actitud no valorativa",
    def: "Capacidad para sostener una aceptación incondicional del paciente, sin emitir juicios morales sobre su experiencia, decisiones o emociones. En la práctica se observa cuando el terapeuta valida afectos difíciles (enojo, vergüenza, ambivalencia) sin intentar reformarlos, y cuando evita señalar directamente si algo está bien o mal. Importa porque el paciente sólo puede mostrar lo más vulnerable de sí si confía en que no será evaluado; el juicio moral cierra la puerta a lo que estaba por emerger.",
  },
  optimismo: {
    label: "Optimismo",
    def: "Capacidad para transmitir esperanza realista sobre las posibilidades de cambio, sin minimizar el sufrimiento ni forzar una lectura positiva prematura. En la práctica se observa cuando el terapeuta reconoce la dificultad del momento y, simultáneamente, sostiene la posibilidad de que algo distinto es posible. Importa porque el paciente que llega en crisis suele haber perdido la capacidad de imaginar un futuro: esa capacidad se le presta desde el vínculo terapéutico antes de poder reconstruirla por sí mismo.",
  },
  contencion_afectos: {
    label: "Contención de afectos",
    def: "Capacidad para sostener emocionalmente al paciente en momentos de intensidad afectiva (angustia, llanto, rabia, desborde), sin retirarse del vínculo ni invadirlo con técnicas. En la práctica se observa cuando el terapeuta baja el ritmo, se queda presente, nombra el afecto, y genera condiciones para que la emoción pueda ser procesada en vez de evacuada. Importa porque lo que no se contiene se reprime o actúa: la contención es la matriz básica que hace posible el trabajo con la emocionalidad.",
  },
};

const FRAMEWORK_CITATION = "Framework de competencias: Valdés, N. & Gómez, M. (2023). Competencias transversales en la formación de terapeutas. Universidad Santo Tomás, Chile.";

function competencyAvgs() {
  const keys = Object.keys(COMPETENCY_DEFS);
  const result = {};
  const rows = data.sessionCompetencies || [];
  for (const k of keys) {
    const vals = rows.map((r) => r[k]).filter((v) => typeof v === "number");
    result[k] = {
      avg: avgOf(vals),
      pctTop: pctTopOf(vals),
      n: vals.length,
      max: vals.length ? Math.max(...vals) : null,
      min: vals.length ? Math.min(...vals) : null,
    };
  }
  return result;
}

function pickCompetencyExamples(key, count = 2) {
  const rows = (data.sessionCompetencies || [])
    .map((r) => ({ row: r, score: r[key], evidence: r.evidence?.[key] }))
    .filter((x) => typeof x.score === "number" && x.evidence?.quote && x.evidence.quote.trim().length > 0);
  if (rows.length === 0) return { solido: [], mejora: [] };

  const hydrate = (x) => ({
    label: despersonalizedLabel(x.row.student_id),
    score: x.score,
    quote: x.evidence.quote.trim(),
    observation: x.evidence.observation || "",
  });

  const high = [...rows].sort((a, b) => b.score - a.score);
  const low = [...rows].sort((a, b) => a.score - b.score);
  const taken = new Set();
  const solido = [];
  for (const x of high) {
    if (solido.length >= count) break;
    if (taken.has(x.row.student_id)) continue;
    solido.push(hydrate(x));
    taken.add(x.row.student_id);
  }
  const mejora = [];
  for (const x of low) {
    if (mejora.length >= count) break;
    if (taken.has(x.row.student_id)) continue;
    mejora.push(hydrate(x));
    taken.add(x.row.student_id);
  }
  return { solido, mejora };
}

// ─────────────────────────────────────────
// Builders de secciones
// ─────────────────────────────────────────
function fmtIso(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(iso));
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function buildSection1() {
  const out = [];
  out.push(heading("1. Datos técnicos del piloto"));

  const all = statsConsolidado();
  const { rol } = rolGenero();
  const estudiantes = (rol.estudiante || 0);
  const docentes = (rol.docente || 0) + (rol.instructor || 0);

  out.push(p("Resumen del piloto:", { run: { bold: true } }));
  out.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      [["Institución", data.pilot.institution || "—"], ["País", data.pilot.country || "—"]],
      [["Ventana de acceso", pilotWindow()], ["Estado", data.pilot.status || "—"]],
      [["Invitados", all.invitados], ["Conectados", all.conectados]],
      [["Encuestas respondidas", all.encuestas], ["Sesiones completadas", all.sesionesCompletadas]],
      [["Minutos totales", all.minutos], ["Estudiantes / Docentes", `${estudiantes} / ${docentes}`]],
    ].map((row) => new TableRow({
      children: row.flatMap(([k, v]) => [
        cell(k, { width: { size: 30, type: WidthType.PERCENTAGE } }),
        cell(String(v), { align: AlignmentType.CENTER, bold: true, width: { size: 20, type: WidthType.PERCENTAGE } }),
      ]),
    })),
  }));
  out.push(p(""));

  // Tabla de participantes con nombres reales (los unicos lugares con
  // nombres reales en este informe; el resto va anonimizado por rol).
  const participantsSorted = data.participants
    .filter((p) => p.user_id)
    .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "", "es"));

  out.push(p("Tabla de participantes:", { run: { bold: true } }));
  out.push(small("Esta es la única sección con nombres reales; testimonios y ejemplos clínicos van anonimizados por rol (Estudiante / Docente)."));
  out.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          headerCell("#", { align: AlignmentType.CENTER, width: { size: 5, type: WidthType.PERCENTAGE } }),
          headerCell("Nombre", { width: { size: 35, type: WidthType.PERCENTAGE } }),
          headerCell("Rol", { align: AlignmentType.CENTER, width: { size: 14, type: WidthType.PERCENTAGE } }),
          headerCell("Sesiones", { align: AlignmentType.CENTER, width: { size: 12, type: WidthType.PERCENTAGE } }),
          headerCell("Minutos", { align: AlignmentType.CENTER, width: { size: 11, type: WidthType.PERCENTAGE } }),
          headerCell("Último acceso", { align: AlignmentType.CENTER, width: { size: 23, type: WidthType.PERCENTAGE } }),
        ],
      }),
      ...participantsSorted.map((part, i) => {
        const m = perParticipantMetrics(part.user_id);
        const rolLabel = part.role === "instructor" ? "Docente"
          : part.role === "student" ? "Estudiante"
          : capitalize(part.role || "—");
        return new TableRow({
          children: [
            cell(String(i + 1), { align: AlignmentType.CENTER }),
            cell(part.full_name || "(sin nombre)"),
            cell(rolLabel, { align: AlignmentType.CENTER }),
            cell(String(m.sesiones), { align: AlignmentType.CENTER }),
            cell(String(m.minutos), { align: AlignmentType.CENTER }),
            cell(fmtIso(m.ultimo), { align: AlignmentType.CENTER }),
          ],
        });
      }),
    ],
  }));

  return out;
}

async function buildSection2() {
  const out = [];
  out.push(pageBreak());
  out.push(heading("2. Evaluación cuantitativa de la encuesta"));
  out.push(small(`Encuestas completadas (v1): ${v1Responses.length} de ${data.participants.length} participantes.`));

  const { rol, genero } = rolGenero();

  // Pies (rol, genero)
  const rolLabels = Object.keys(rol);
  if (rolLabels.length > 0) {
    out.push(p("Distribución por rol:", { run: { bold: true } }));
    out.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [await pieChart({
        title: "Rol",
        labels: rolLabels.map(capitalize),
        values: rolLabels.map((k) => rol[k]),
      })],
    }));
  }

  const generoLabels = Object.keys(genero);
  if (generoLabels.length > 0) {
    const generoColors = generoLabels.map((k) => {
      const norm = k.toLowerCase();
      if (norm.includes("mascul")) return "#2563EB";
      if (norm.includes("femen")) return "#F97316";
      return "#94A3B8";
    });
    out.push(p("Distribución por género:", { run: { bold: true } }));
    out.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [await pieChart({
        title: "Género",
        labels: generoLabels.map(capitalize),
        values: generoLabels.map((k) => genero[k]),
        colors: generoColors,
      })],
    }));
  }

  // Bar single con las 2 dimensiones grandes.
  const likerts = likertAvgs();
  out.push(p("Likert por dimensión:", { run: { bold: true } }));
  const cats = SURVEY_SCHEMA_V1.likertGroups.map((g) => {
    const pct = likerts[g.answersKey]?._overall?.pctTop;
    return pct !== null && pct !== undefined ? `${g.title} (${pct}%)` : g.title;
  });
  const vals = SURVEY_SCHEMA_V1.likertGroups.map((g) => round1(likerts[g.answersKey]?._overall?.avg) ?? 0);
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [await barChartSurvey({
      title: "Promedio por dimensión (1–5)",
      categories: cats,
      values: vals,
      xMin: 1, xMax: 5,
    })],
  }));
  out.push(small("El porcentaje entre paréntesis representa la proporción de respuestas en categorías 4 (de acuerdo) o 5 (muy de acuerdo) sobre el total de respuestas válidas en esa dimensión."));

  // Tabla detallada con las 9 sub-dimensiones.
  out.push(pageBreak());
  out.push(heading("Detalle por sub-dimensión", HeadingLevel.HEADING_2));
  out.push(small("Cada celda muestra el promedio (1–5) y entre paréntesis el porcentaje de respuestas en zona alta (4 o 5)."));

  const detailRows = [
    new TableRow({
      children: [
        headerCell("Dimensión", { width: { size: 22, type: WidthType.PERCENTAGE } }),
        headerCell("Sub-dimensión", { width: { size: 56, type: WidthType.PERCENTAGE } }),
        headerCell("Promedio (% en 4–5)", { align: AlignmentType.CENTER, width: { size: 22, type: WidthType.PERCENTAGE } }),
      ],
    }),
  ];
  for (const group of SURVEY_SCHEMA_V1.likertGroups) {
    group.items.forEach((item, i) => {
      const s = likerts[group.answersKey]?.[item.key];
      const txt = (!s || s.avg === null) ? "—"
        : `${s.avg.toFixed(1)} (${s.pctTop !== null ? s.pctTop : "—"}%)`;
      detailRows.push(new TableRow({
        children: [
          cell(i === 0 ? group.title : "", { italics: true }),
          cell(item.label),
          cell(txt, { align: AlignmentType.CENTER }),
        ],
      }));
    });
  }
  out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: detailRows }));

  return out;
}

function buildSection3() {
  const out = [];
  out.push(pageBreak());
  out.push(heading("3. Testimonios textuales"));
  out.push(small("Citas literales de la encuesta, filtradas por longitud mínima (≥ 5 palabras) y tomadas las más sustantivas. Firmadas por el rol declarado en la encuesta."));

  const t = pickTestimonios();

  out.push(heading("Lo que más gustó", HeadingLevel.HEADING_2));
  for (const it of t.positivas) {
    out.push(quoteBlock(it.text));
    out.push(small(`— ${it.label}`, "4A55A2"));
  }

  out.push(heading("Lo que mejoraría", HeadingLevel.HEADING_2));
  for (const it of t.mejoras) {
    out.push(quoteBlock(it.text));
    out.push(small(`— ${it.label}`, "B45309"));
  }

  return out;
}

async function buildSection4() {
  const out = [];
  out.push(pageBreak());
  out.push(heading("4. Análisis de competencias clínicas"));
  out.push(small(FRAMEWORK_CITATION));
  out.push(small("Las competencias \"presencia\" y \"conducta no verbal\" del framework original se excluyen porque el canal texto-solo de la sesión no permite evaluarlas con rigor (no hay mirada, tono ni postura medibles)."));

  const avgs = competencyAvgs();
  const keys = Object.keys(COMPETENCY_DEFS);
  const cats = keys.map((k) => COMPETENCY_DEFS[k].label);
  const values = keys.map((k) => round1(avgs[k]?.avg) ?? 0);
  const totalEvaluations = (data.sessionCompetencies || []).length;
  out.push(p(`N evaluaciones: ${totalEvaluations}`));
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [await barChartCompetencias({
      title: "Competencias — promedio del grupo (0–5)",
      categories: cats,
      values,
    })],
  }));

  // Pick destacadas: 2 fortalezas + 1 transversal (escucha_activa) + 2 mejoras
  const sortedDesc = keys
    .map((k) => ({ key: k, avg: avgs[k]?.avg ?? 0 }))
    .sort((a, b) => b.avg - a.avg);
  const fortalezas = sortedDesc.slice(0, 2);
  const mejoras = sortedDesc.slice(-2).reverse();
  const transversal = sortedDesc.find((c) => c.key === "escucha_activa") ||
    sortedDesc[Math.floor(sortedDesc.length / 2)];

  const destacadas = [
    ...fortalezas.map((c) => ({ ...c, kind: "Fortaleza" })),
    { ...transversal, kind: "Transversal" },
    ...mejoras.map((c) => ({ ...c, kind: "Oportunidad de mejora" })),
  ];

  const seen = new Set();
  for (const d of destacadas) {
    if (seen.has(d.key)) continue;
    seen.add(d.key);
    out.push(pageBreak());
    out.push(heading(`${COMPETENCY_DEFS[d.key].label} — ${d.kind}`, HeadingLevel.HEADING_2));
    out.push(p(COMPETENCY_DEFS[d.key].def, { run: { italics: true, color: "374151" } }));

    const x = avgs[d.key];
    out.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            headerCell("Promedio", { align: AlignmentType.CENTER }),
            headerCell("% en 4–5", { align: AlignmentType.CENTER }),
            headerCell("Máximo", { align: AlignmentType.CENTER }),
            headerCell("Mínimo", { align: AlignmentType.CENTER }),
            headerCell("Sesiones evaluadas", { align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          children: [
            cell(x.avg !== null ? x.avg.toFixed(1) : "—", { align: AlignmentType.CENTER }),
            cell(`${x.pctTop !== null ? x.pctTop : "—"}%`, { align: AlignmentType.CENTER }),
            cell(x.max !== null ? String(x.max) : "—", { align: AlignmentType.CENTER }),
            cell(x.min !== null ? String(x.min) : "—", { align: AlignmentType.CENTER }),
            cell(String(x.n), { align: AlignmentType.CENTER }),
          ],
        }),
      ],
    }));
    out.push(p(""));

    const ex = pickCompetencyExamples(d.key, 2);
    if (ex.solido.length > 0) {
      out.push(p("Ejemplos de desempeño sólido:", { run: { bold: true, color: accent } }));
      for (const e of ex.solido) {
        out.push(p(`${e.label} · puntaje ${e.score}`, { run: { bold: true } }));
        out.push(quoteBlock(e.quote));
        if (e.observation) out.push(small(`Observación: ${e.observation}`));
      }
    }
    if (ex.mejora.length > 0) {
      out.push(p("Ejemplos con oportunidad de mejora:", { run: { bold: true, color: amber } }));
      for (const e of ex.mejora) {
        out.push(p(`${e.label} · puntaje ${e.score}`, { run: { bold: true } }));
        out.push(quoteBlock(e.quote));
        if (e.observation) out.push(small(`Observación: ${e.observation}`));
      }
    }
  }

  return out;
}

// ─────────────────────────────────────────
// Main
// ─────────────────────────────────────────
async function main() {
  buildV1Responses();
  buildSurveyIndexes();
  console.log(`Responses v1 detectadas: ${v1Responses.length}/${(data.surveyResponses || []).length}`);

  const children = [];

  // Portada
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 1200, after: 300 },
    children: [new ImageRun({ data: logo, transformation: { width: LOGO_TARGET_W * 2, height: LOGO_TARGET_H * 2 } })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: "INF-2026-042", font: "Calibri", size: 28, bold: true, color: accent })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: data.pilot.name || "Piloto UBO", font: "Calibri", size: 44, bold: true })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
    children: [new TextRun({ text: data.pilot.institution || "Universidad Bernardo O'Higgins", font: "Calibri", size: 28, color: "6B7280" })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: `${data.participants.length} participantes · ${data.conversations.length} sesiones · ${v1Responses.length} encuestas`,
      font: "Calibri", size: 22, color: "374151",
    })],
  }));

  children.push(...buildSection1());
  children.push(...await buildSection2());
  children.push(...buildSection3());
  children.push(...await buildSection4());

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{
      properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new ImageRun({ data: logo, transformation: { width: LOGO_TARGET_W, height: LOGO_TARGET_H } })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `INF-2026-042 · ${data.pilot.name || "Piloto UBO"} · GlorIA  ·  `, font: "Calibri", size: 18, color: "9CA3AF" }),
              new TextRun({ children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES], font: "Calibri", size: 18, color: "9CA3AF" }),
            ],
          })],
        }),
      },
      children,
    }],
  });

  const buf = await Packer.toBuffer(doc);
  const outDir = "informes/pilotos";
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = `${outDir}/INF-2026-042_piloto-ubo.docx`;
  fs.writeFileSync(outPath, buf);
  console.log(`\n✓ Escrito: ${outPath} (${(buf.length / 1024).toFixed(1)} KB)`);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
