// Genera INF-2026-044 — Piloto UCSP Arequipa (consolidado de dos cohortes).
//
// Estructura (basada en INF-042 UBO + adaptaciones para consolidado):
//   1 · Datos tecnicos: cuadro-resumen consolidado + comparativo + tabla
//       de participantes anonimizada (Estudiante NN, cohorte, edad).
//   2 · Encuesta cuantitativa: pies (rol, genero) + bar dual-cohort de
//       los 5 Likert + tabla detallada con las 25 sub-dimensiones.
//   3 · 6 testimonios (3 positivos + 3 mejoras) con etiqueta de cohorte.
//   4 · Competencias clinicas Valdes-Gomez 2023: bar dual-cohort + 5
//       destacadas (2 fortalezas + 1 transversal + 2 mejoras) con
//       definicion + tabla + 2 ejemplos solidos + 2 ejemplos mejora.
//   5 · Comparacion entre cohortes (nueva): diferencias destacadas y
//       placeholder para contexto operativo manual.
//
// Output: informes/pilotos/INF-2026-044_piloto-ucsp-consolidado.docx
// (en .gitignore por PII; subir manualmente segun protocolo de informes).

const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, ImageRun,
} = require("docx");

const data = require("./ucsp-pilot-data.json");

// ─────────────────────────────────────────
// Constantes de estilo (mismas del INF-042)
// ─────────────────────────────────────────
const accent = "4A55A2";
const accentSecondary = "F97316";  // naranjo para cohorte 2 en charts dual
const amber = "B45309";
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };
const logo = fs.readFileSync("public/branding/gloria-logo.png");
const LOGO_W = logo.readUInt32BE(16);
const LOGO_H = logo.readUInt32BE(20);
const LOGO_TARGET_H = 44;
const LOGO_TARGET_W = Math.round(LOGO_TARGET_H * (LOGO_W / LOGO_H));

const COHORT_COLOR = { 1: "#4A55A2", 2: "#F97316" };

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

// Bar chart dual-cohort para Likert de la encuesta. Eje 1-5 (rango
// completo porque los Likert UCSP son menos concentrados que UBO).
// Cohorte 1 azul indigo, cohorte 2 naranjo. Promedio al final de cada
// barra.
async function barChartDualSurvey({ title, categories, c1Values, c2Values, xMin = 1, xMax = 5 }) {
  const buf = await fetchChart({
    type: "bar",
    data: {
      labels: categories,
      datasets: [
        { label: "Cohorte 1", data: c1Values, backgroundColor: COHORT_COLOR[1], borderRadius: 4 },
        { label: "Cohorte 2", data: c2Values, backgroundColor: COHORT_COLOR[2], borderRadius: 4 },
      ],
    },
    options: {
      indexAxis: "y",
      layout: { padding: { right: 50 } },
      plugins: {
        legend: { display: true, position: "top", labels: { font: { size: 12 } } },
        title: { display: true, text: title, font: { size: 16, weight: "bold" } },
        datalabels: {
          anchor: "end",
          align: "end",
          offset: 6,
          color: "#1F2937",
          font: { weight: "bold", size: 11 },
          formatter: "function(value) { return value.toFixed(1); }",
        },
      },
      scales: {
        x: { min: xMin, max: xMax, ticks: { stepSize: 1 }, grid: { color: "#E5E7EB" } },
        y: { ticks: { font: { size: 12 } }, grid: { display: false } },
      },
    },
  }, 720, 360);
  return new ImageRun({ data: buf, transformation: { width: 720, height: 360 } });
}

// Bar chart dual-cohort de competencias (rango 0-5).
async function barChartDualCompetencias({ title, categories, c1Values, c2Values }) {
  return barChartDualSurvey({ title, categories, c1Values, c2Values, xMin: 0, xMax: 5 });
}

// ─────────────────────────────────────────
// Anonimizacion + indices auxiliares
// ─────────────────────────────────────────
const anonByUserId = new Map();
function buildAnonIds() {
  for (const cohort of [1, 2]) {
    const sorted = data.participants
      .filter((p) => p.cohort === cohort)
      .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "", "es"));
    sorted.forEach((p, i) => {
      anonByUserId.set(p.user_id, {
        cohort,
        num: String(i + 1).padStart(2, "0"),
        label: `Estudiante ${String(i + 1).padStart(2, "0")}`,
        labelWithCohort: `Estudiante ${String(i + 1).padStart(2, "0")} (Cohorte ${cohort})`,
      });
    });
  }
}

function anonOf(userId) {
  return anonByUserId.get(userId) || { cohort: null, num: "??", label: "Estudiante", labelWithCohort: "Estudiante" };
}

const edadByUserId = new Map();
const carreraByUserId = new Map();
function buildSurveyIndexes() {
  for (const r of data.surveyResponses || []) {
    if (r.status !== "completed" || !r.answers) continue;
    if (typeof r.answers.q3_edad === "number") edadByUserId.set(r.user_id, r.answers.q3_edad);
    if (typeof r.answers.q1_carrera === "string" && r.answers.q1_carrera.trim()) {
      carreraByUserId.set(r.user_id, r.answers.q1_carrera.trim());
    }
  }
}

function edadOf(userId) {
  return edadByUserId.get(userId) ?? null;
}

// ─────────────────────────────────────────
// Agregados de metricas
// ─────────────────────────────────────────
function minutesBetween(firstIso, lastIso) {
  if (!firstIso || !lastIso) return 0;
  return Math.round((new Date(lastIso) - new Date(firstIso)) / 60000);
}

function statsForCohort(cohort) {
  const parts = data.participants.filter((p) => cohort === "all" ? true : p.cohort === cohort);
  const userIds = new Set(parts.map((p) => p.user_id).filter(Boolean));
  const convs = data.conversations.filter((c) => userIds.has(c.student_id));
  const completed = convs.filter((c) => c.status === "completed");
  let totalMsgs = 0;
  let totalMin = 0;
  for (const c of convs) {
    if (c.metrics) {
      totalMsgs += c.metrics.msgs;
      totalMin += minutesBetween(c.metrics.first, c.metrics.last);
    }
  }
  const responses = (data.surveyResponses || []).filter(
    (r) => userIds.has(r.user_id) && r.status === "completed",
  );
  return {
    invitados: parts.length,
    conectados: parts.filter((p) => p.first_login_at || p.user_id).length,
    encuestas: responses.length,
    sesionesTotales: convs.length,
    sesionesCompletadas: completed.length,
    mensajes: totalMsgs,
    minutos: totalMin,
  };
}

function pilotWindow(cohort) {
  const pilot = data.pilots.find((p) => p.cohort === cohort);
  if (!pilot) return "—";
  const fmt = (iso) => {
    if (!iso) return "—";
    return new Intl.DateTimeFormat("es-CL", {
      timeZone: "America/Santiago",
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  };
  return `${fmt(pilot.scheduled_at)} → ${fmt(pilot.ended_at)}`;
}

// Por participante: sesiones, minutos, ultimo acceso (para tabla).
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

// ─────────────────────────────────────────
// Encuesta: agregaciones
// ─────────────────────────────────────────
const LIKERT_DEFS = {
  q7_usabilidad:    { label: "Usabilidad",    subkeys: ["dialogo", "general", "registro", "navegacion", "inicio_sesion"] },
  q8_realismo:      { label: "Realismo",      subkeys: ["emocional", "respuestas", "comprension", "sesion_real", "personalidad"] },
  q9_pertinencia:   { label: "Pertinencia",   subkeys: ["lenguaje", "tematica", "estereotipos", "experiencias", "sensibilidad"] },
  q10_diseno:       { label: "Diseño",        subkeys: ["visual", "fluidez", "adaptacion", "informacion", "interactivos"] },
  q11_satisfaccion: { label: "Satisfacción",  subkeys: ["recomendar", "volver_usar", "satisfaccion", "tiempo_valio", "incorporacion"] },
};

const SUBKEY_LABELS = {
  // q7_usabilidad
  dialogo: "Diálogo natural",
  general: "Experiencia general",
  registro: "Registro/inscripción",
  navegacion: "Navegación",
  inicio_sesion: "Inicio de sesión",
  // q8_realismo
  emocional: "Conexión emocional",
  respuestas: "Calidad de respuestas",
  comprension: "Comprensión del relato",
  sesion_real: "Similitud a sesión real",
  personalidad: "Personalidad del paciente",
  // q9_pertinencia
  lenguaje: "Lenguaje culturalmente adecuado",
  tematica: "Pertinencia temática",
  estereotipos: "Sin estereotipos",
  experiencias: "Experiencias representativas",
  sensibilidad: "Sensibilidad cultural",
  // q10_diseno
  visual: "Estética visual",
  fluidez: "Fluidez de uso",
  adaptacion: "Adaptación a dispositivos",
  informacion: "Claridad de información",
  interactivos: "Elementos interactivos",
  // q11_satisfaccion
  recomendar: "Recomendaría a colegas",
  volver_usar: "Volvería a usar",
  satisfaccion: "Satisfacción global",
  tiempo_valio: "El tiempo valió la pena",
  incorporacion: "Incorporación a malla curricular",
};

function avgOf(arr) {
  const xs = arr.filter((v) => typeof v === "number");
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function likertAvgsByCohort() {
  // Devuelve { cohort: { qKey: { sub: avg, _overall: avg } } }
  const result = { 1: {}, 2: {} };
  for (const cohort of [1, 2]) {
    const responses = (data.surveyResponses || []).filter(
      (r) => r.cohort === cohort && r.status === "completed",
    );
    for (const [qKey, def] of Object.entries(LIKERT_DEFS)) {
      const subAvgs = {};
      const overallSamples = [];
      for (const sub of def.subkeys) {
        const vals = responses
          .map((r) => r.answers?.[qKey]?.[sub])
          .filter((v) => typeof v === "number");
        const avg = avgOf(vals);
        subAvgs[sub] = avg;
        if (avg !== null) overallSamples.push(...vals);
      }
      subAvgs._overall = avgOf(overallSamples);
      result[cohort][qKey] = subAvgs;
    }
  }
  return result;
}

function rolGeneroByCohort() {
  // Para los pies: consolidados (suma de las dos cohortes).
  const rol = {};
  const genero = {};
  for (const r of data.surveyResponses || []) {
    if (r.status !== "completed") continue;
    const a = r.answers || {};
    if (a.q4_rol) rol[a.q4_rol] = (rol[a.q4_rol] || 0) + 1;
    if (a.q2_genero) genero[a.q2_genero] = (genero[a.q2_genero] || 0) + 1;
  }
  return { rol, genero };
}

// ─────────────────────────────────────────
// Testimonios
// ─────────────────────────────────────────
const POSITIVE_ONLY_RE = /\b(est[aá] perfect[oa]|me encant[oó]|fue genial|muy real|est[aá] excelente|super bueno|nada[,.]?\s*est[aá])\b/i;

function pickTestimonios() {
  const positivas = [];
  const mejoras = [];
  for (const r of data.surveyResponses || []) {
    if (r.status !== "completed" || !r.answers) continue;
    const anon = anonOf(r.user_id);
    const cohort = r.cohort;

    const pos = (r.answers.q12_mas_gusto || "").trim();
    if (pos && pos.split(/\s+/).length >= 5) {
      positivas.push({ text: pos, anon, cohort });
    }
    // Para mejoras: q13_menos_gusto principal, fallback q14_cambio.
    let mej = (r.answers.q13_menos_gusto || "").trim();
    if (!mej || mej.split(/\s+/).length < 5) {
      mej = (r.answers.q14_cambio || "").trim();
    }
    if (mej && mej.split(/\s+/).length >= 5 && !POSITIVE_ONLY_RE.test(mej)) {
      mejoras.push({ text: mej, anon, cohort });
    }
  }
  // Top 3 mas largos.
  positivas.sort((a, b) => b.text.length - a.text.length);
  mejoras.sort((a, b) => b.text.length - a.text.length);
  return {
    positivas: positivas.slice(0, 3),
    mejoras: mejoras.slice(0, 3),
  };
}

// ─────────────────────────────────────────
// Competencias (Valdes-Gomez 2023). Mismo set que UBO; presencia y
// conducta_no_verbal excluidas por canal texto-solo.
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

function competencyAvgsByCohort() {
  const keys = Object.keys(COMPETENCY_DEFS);
  const result = { 1: {}, 2: {} };
  for (const cohort of [1, 2]) {
    const rows = (data.sessionCompetencies || []).filter((r) => r.cohort === cohort);
    for (const k of keys) {
      const vals = rows.map((r) => r[k]).filter((v) => typeof v === "number");
      result[cohort][k] = {
        avg: avgOf(vals),
        n: vals.length,
        pctTop: vals.length ? Math.round(vals.filter((v) => v >= 4).length / vals.length * 100) : 0,
        max: vals.length ? Math.max(...vals) : null,
        min: vals.length ? Math.min(...vals) : null,
      };
    }
  }
  return result;
}

function pickCompetencyExamples(key, count = 2) {
  // Solido + mejora, sin repetir estudiante. Devuelve nombres anonimizados
  // con etiqueta de cohorte.
  const rows = (data.sessionCompetencies || [])
    .map((r) => ({
      row: r, score: r[key], cohort: r.cohort, evidence: r.evidence?.[key],
    }))
    .filter((x) => typeof x.score === "number" && x.evidence?.quote && x.evidence.quote.trim().length > 0);
  if (rows.length === 0) return { solido: [], mejora: [] };

  const hydrate = (x) => {
    const anon = anonOf(x.row.student_id);
    return {
      label: anon.labelWithCohort,
      score: x.score,
      cohort: x.cohort,
      quote: x.evidence.quote.trim(),
      observation: x.evidence.observation || "",
    };
  };

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

function buildSection1() {
  const out = [];
  out.push(heading("1. Datos técnicos del piloto"));

  const all = statsForCohort("all");
  const c1 = statsForCohort(1);
  const c2 = statsForCohort(2);

  // Cuadro consolidado
  out.push(p("Resumen consolidado (ambas cohortes):", { run: { bold: true } }));
  out.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      [["Invitados (total)", all.invitados], ["Conectados", all.conectados]],
      [["Encuestas respondidas", all.encuestas], ["Sesiones completadas", all.sesionesCompletadas]],
      [["Mensajes intercambiados", all.mensajes], ["Minutos totales", all.minutos]],
    ].map((row) => new TableRow({
      children: row.flatMap(([k, v]) => [
        cell(k, { width: { size: 30, type: WidthType.PERCENTAGE } }),
        cell(String(v), { align: AlignmentType.CENTER, bold: true, width: { size: 20, type: WidthType.PERCENTAGE } }),
      ]),
    })),
  }));
  out.push(p(""));

  // Cuadro comparativo lado a lado
  out.push(p("Comparativo entre cohortes:", { run: { bold: true } }));
  out.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          headerCell("Métrica", { width: { size: 40, type: WidthType.PERCENTAGE } }),
          headerCell("Cohorte 1", { align: AlignmentType.CENTER, width: { size: 30, type: WidthType.PERCENTAGE } }),
          headerCell("Cohorte 2", { align: AlignmentType.CENTER, width: { size: 30, type: WidthType.PERCENTAGE } }),
        ],
      }),
      ...[
        ["Ventana de acceso", pilotWindow(1), pilotWindow(2)],
        ["Invitados", c1.invitados, c2.invitados],
        ["Conectados", c1.conectados, c2.conectados],
        ["Encuestas respondidas", c1.encuestas, c2.encuestas],
        ["Sesiones completadas", c1.sesionesCompletadas, c2.sesionesCompletadas],
        ["Mensajes", c1.mensajes, c2.mensajes],
        ["Minutos totales", c1.minutos, c2.minutos],
      ].map((row) => new TableRow({
        children: [
          cell(row[0]),
          cell(String(row[1]), { align: AlignmentType.CENTER }),
          cell(String(row[2]), { align: AlignmentType.CENTER }),
        ],
      })),
    ],
  }));
  out.push(p(""));

  // Tabla de participantes anonimizada
  const participantsSorted = data.participants
    .filter((p) => p.user_id)
    .sort((a, b) => {
      if (a.cohort !== b.cohort) return a.cohort - b.cohort;
      return (a.full_name || "").localeCompare(b.full_name || "", "es");
    });

  out.push(p("Tabla de participantes (anonimizados):", { run: { bold: true } }));
  out.push(small("Numeración por cohorte. Edad reportada en encuesta de cierre — quienes no la completaron quedan con \"—\"."));
  out.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          headerCell("#", { align: AlignmentType.CENTER, width: { size: 5, type: WidthType.PERCENTAGE } }),
          headerCell("Estudiante", { width: { size: 22, type: WidthType.PERCENTAGE } }),
          headerCell("Cohorte", { align: AlignmentType.CENTER, width: { size: 11, type: WidthType.PERCENTAGE } }),
          headerCell("Edad", { align: AlignmentType.CENTER, width: { size: 10, type: WidthType.PERCENTAGE } }),
          headerCell("Sesiones", { align: AlignmentType.CENTER, width: { size: 12, type: WidthType.PERCENTAGE } }),
          headerCell("Minutos", { align: AlignmentType.CENTER, width: { size: 12, type: WidthType.PERCENTAGE } }),
          headerCell("Último acceso", { align: AlignmentType.CENTER, width: { size: 28, type: WidthType.PERCENTAGE } }),
        ],
      }),
      ...participantsSorted.map((p, i) => {
        const m = perParticipantMetrics(p.user_id);
        const anon = anonOf(p.user_id);
        const edad = edadOf(p.user_id);
        return new TableRow({
          children: [
            cell(String(i + 1), { align: AlignmentType.CENTER }),
            cell(anon.label),
            cell(String(p.cohort), { align: AlignmentType.CENTER }),
            cell(edad !== null ? String(edad) : "—", { align: AlignmentType.CENTER }),
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
  out.push(small(`Encuestas completadas: ${(data.surveyResponses || []).filter((r) => r.status === "completed").length} de ${data.participants.length} participantes.`));

  // Pies (consolidados)
  const { rol, genero } = rolGeneroByCohort();
  const rolLabels = Object.keys(rol);
  const rolValues = rolLabels.map((k) => rol[k]);
  out.push(p("Distribución por rol (consolidado):", { run: { bold: true } }));
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [await pieChart({ title: "Rol — ambas cohortes", labels: rolLabels.map(capitalize), values: rolValues })],
  }));

  // Genero — colores fijos
  const generoLabelsRaw = Object.keys(genero);
  const generoColors = generoLabelsRaw.map((k) => {
    const norm = k.toLowerCase();
    if (norm.includes("mascul")) return "#2563EB";
    if (norm.includes("femen")) return "#F97316";
    return "#94A3B8";
  });
  out.push(p("Distribución por género (consolidado):", { run: { bold: true } }));
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [await pieChart({
      title: "Género — ambas cohortes",
      labels: generoLabelsRaw.map(capitalize),
      values: generoLabelsRaw.map((k) => genero[k]),
      colors: generoColors,
    })],
  }));

  // Bar dual cohorte: 5 grandes Likert
  out.push(p("Likert por dimensión, comparado entre cohortes:", { run: { bold: true } }));
  const likerts = likertAvgsByCohort();
  const cats = Object.entries(LIKERT_DEFS).map(([qKey, def]) => def.label);
  const c1Vals = Object.entries(LIKERT_DEFS).map(([qKey]) => likerts[1][qKey]?._overall ?? 0);
  const c2Vals = Object.entries(LIKERT_DEFS).map(([qKey]) => likerts[2][qKey]?._overall ?? 0);
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [await barChartDualSurvey({
      title: "Promedio por dimensión (1–5)",
      categories: cats,
      c1Values: c1Vals,
      c2Values: c2Vals,
      xMin: 1, xMax: 5,
    })],
  }));

  // Tabla detallada de las 25 sub-dimensiones
  out.push(pageBreak());
  out.push(heading("Detalle por sub-dimensión", HeadingLevel.HEADING_2));
  out.push(small("Avg cohorte 1 / cohorte 2 / diferencia (positiva = mejor en cohorte 2)."));

  const detailRows = [
    new TableRow({
      children: [
        headerCell("Dimensión", { width: { size: 22, type: WidthType.PERCENTAGE } }),
        headerCell("Sub-dimensión", { width: { size: 38, type: WidthType.PERCENTAGE } }),
        headerCell("Cohorte 1", { align: AlignmentType.CENTER, width: { size: 13, type: WidthType.PERCENTAGE } }),
        headerCell("Cohorte 2", { align: AlignmentType.CENTER, width: { size: 13, type: WidthType.PERCENTAGE } }),
        headerCell("Δ", { align: AlignmentType.CENTER, width: { size: 14, type: WidthType.PERCENTAGE } }),
      ],
    }),
  ];
  for (const [qKey, def] of Object.entries(LIKERT_DEFS)) {
    def.subkeys.forEach((sub, i) => {
      const a1 = likerts[1][qKey]?.[sub];
      const a2 = likerts[2][qKey]?.[sub];
      const delta = (typeof a1 === "number" && typeof a2 === "number") ? (a2 - a1) : null;
      const fmt = (v) => v === null || v === undefined ? "—" : v.toFixed(2);
      const fmtDelta = (v) => {
        if (v === null) return "—";
        const sign = v > 0 ? "+" : "";
        return `${sign}${v.toFixed(2)}`;
      };
      detailRows.push(new TableRow({
        children: [
          cell(i === 0 ? def.label : "", { italics: true }),
          cell(SUBKEY_LABELS[sub] || sub),
          cell(fmt(a1), { align: AlignmentType.CENTER }),
          cell(fmt(a2), { align: AlignmentType.CENTER }),
          cell(fmtDelta(delta), {
            align: AlignmentType.CENTER,
            bold: true,
            color: delta === null ? undefined : (delta > 0.3 ? "059669" : delta < -0.3 ? "B91C1C" : undefined),
          }),
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
  out.push(small("Citas literales de la encuesta. Filtradas por longitud mínima (≥ 5 palabras) y tomadas las más sustantivas."));

  const t = pickTestimonios();

  out.push(heading("Lo que más gustó", HeadingLevel.HEADING_2));
  for (const it of t.positivas) {
    out.push(quoteBlock(it.text));
    out.push(small(`— ${it.anon.labelWithCohort}`, "4A55A2"));
  }

  out.push(heading("Lo que mejoraría", HeadingLevel.HEADING_2));
  for (const it of t.mejoras) {
    out.push(quoteBlock(it.text));
    out.push(small(`— ${it.anon.labelWithCohort}`, "B45309"));
  }

  return out;
}

async function buildSection4() {
  const out = [];
  out.push(pageBreak());
  out.push(heading("4. Análisis de competencias clínicas"));
  out.push(small(FRAMEWORK_CITATION));
  out.push(small("Las competencias \"presencia\" y \"conducta no verbal\" del framework original se excluyen porque el canal texto-solo de la sesión no permite evaluarlas con rigor (no hay mirada, tono ni postura medibles)."));

  const avgs = competencyAvgsByCohort();
  const keys = Object.keys(COMPETENCY_DEFS);
  const cats = keys.map((k) => COMPETENCY_DEFS[k].label);
  const c1 = keys.map((k) => avgs[1][k]?.avg ?? 0);
  const c2 = keys.map((k) => avgs[2][k]?.avg ?? 0);

  out.push(p(`N evaluaciones — Cohorte 1: ${(data.sessionCompetencies || []).filter((r) => r.cohort === 1).length} · Cohorte 2: ${(data.sessionCompetencies || []).filter((r) => r.cohort === 2).length}`));
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [await barChartDualCompetencias({
      title: "Competencias — promedio por cohorte (0–5)",
      categories: cats,
      c1Values: c1,
      c2Values: c2,
    })],
  }));

  // Pick destacadas: 2 fortalezas (mejor avg consolidado), 1 transversal,
  // 2 mejoras (peor avg consolidado).
  const consolidatedAvg = keys.map((k) => {
    const a1 = avgs[1][k]?.avg ?? null;
    const a2 = avgs[2][k]?.avg ?? null;
    const both = [a1, a2].filter((v) => v !== null);
    return { key: k, avg: both.length ? both.reduce((a, b) => a + b, 0) / both.length : 0 };
  });
  const sortedDesc = [...consolidatedAvg].sort((a, b) => b.avg - a.avg);
  const fortalezas = sortedDesc.slice(0, 2);
  const mejoras = sortedDesc.slice(-2).reverse();
  // Transversal: escucha_activa si existe, sino la del medio.
  const transversal = consolidatedAvg.find((c) => c.key === "escucha_activa") ||
    sortedDesc[Math.floor(sortedDesc.length / 2)];

  const destacadas = [
    ...fortalezas.map((c) => ({ ...c, kind: "Fortaleza" })),
    { ...transversal, kind: "Transversal" },
    ...mejoras.map((c) => ({ ...c, kind: "Oportunidad de mejora" })),
  ];

  for (const d of destacadas) {
    if (d.key === transversal.key && fortalezas.some((f) => f.key === d.key)) continue; // evita duplicados
    out.push(pageBreak());
    out.push(heading(`${COMPETENCY_DEFS[d.key].label} — ${d.kind}`, HeadingLevel.HEADING_2));
    out.push(p(COMPETENCY_DEFS[d.key].def, { run: { italics: true, color: "374151" } }));

    // Tabla resumen 5 columnas, ambas cohortes
    out.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            headerCell(""),
            headerCell("Promedio", { align: AlignmentType.CENTER }),
            headerCell("% en 4–5", { align: AlignmentType.CENTER }),
            headerCell("Máximo", { align: AlignmentType.CENTER }),
            headerCell("Mínimo", { align: AlignmentType.CENTER }),
            headerCell("Sesiones evaluadas", { align: AlignmentType.CENTER }),
          ],
        }),
        ...[1, 2].map((c) => {
          const x = avgs[c][d.key];
          return new TableRow({
            children: [
              cell(`Cohorte ${c}`, { bold: true }),
              cell(x.avg !== null ? x.avg.toFixed(2) : "—", { align: AlignmentType.CENTER }),
              cell(`${x.pctTop}%`, { align: AlignmentType.CENTER }),
              cell(x.max !== null ? String(x.max) : "—", { align: AlignmentType.CENTER }),
              cell(x.min !== null ? String(x.min) : "—", { align: AlignmentType.CENTER }),
              cell(String(x.n), { align: AlignmentType.CENTER }),
            ],
          });
        }),
      ],
    }));
    out.push(p(""));

    // Ejemplos
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

function buildSection5() {
  const out = [];
  out.push(pageBreak());
  out.push(heading("5. Comparación entre cohortes"));
  out.push(small("Diferencias destacadas entre la primera y segunda cohorte. Lecciones operativas (qué cambió en la plataforma, en el setup logístico o en los pacientes disponibles) deben agregarse manualmente al final."));

  // Diffs en encuesta: ítems con |Δ| > 0.5
  const likerts = likertAvgsByCohort();
  const survDiffs = [];
  for (const [qKey, def] of Object.entries(LIKERT_DEFS)) {
    for (const sub of def.subkeys) {
      const a1 = likerts[1][qKey]?.[sub];
      const a2 = likerts[2][qKey]?.[sub];
      if (typeof a1 === "number" && typeof a2 === "number") {
        const delta = a2 - a1;
        if (Math.abs(delta) >= 0.5) {
          survDiffs.push({ dim: def.label, sub: SUBKEY_LABELS[sub] || sub, a1, a2, delta });
        }
      }
    }
  }
  survDiffs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  out.push(heading("Encuesta — sub-dimensiones con diferencia ≥ 0,5", HeadingLevel.HEADING_2));
  if (survDiffs.length === 0) {
    out.push(p("No hubo diferencias mayores a 0,5 puntos entre cohortes en ninguna sub-dimensión: la percepción fue muy consistente."));
  } else {
    out.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            headerCell("Dimensión"),
            headerCell("Sub-dimensión"),
            headerCell("Cohorte 1", { align: AlignmentType.CENTER }),
            headerCell("Cohorte 2", { align: AlignmentType.CENTER }),
            headerCell("Δ", { align: AlignmentType.CENTER }),
          ],
        }),
        ...survDiffs.map((d) => new TableRow({
          children: [
            cell(d.dim, { italics: true }),
            cell(d.sub),
            cell(d.a1.toFixed(2), { align: AlignmentType.CENTER }),
            cell(d.a2.toFixed(2), { align: AlignmentType.CENTER }),
            cell((d.delta > 0 ? "+" : "") + d.delta.toFixed(2), {
              align: AlignmentType.CENTER, bold: true,
              color: d.delta > 0 ? "059669" : "B91C1C",
            }),
          ],
        })),
      ],
    }));
  }
  out.push(p(""));

  // Diffs en competencias: |Δ| > 0.3
  const compAvgs = competencyAvgsByCohort();
  const compDiffs = [];
  for (const k of Object.keys(COMPETENCY_DEFS)) {
    const a1 = compAvgs[1][k]?.avg;
    const a2 = compAvgs[2][k]?.avg;
    if (typeof a1 === "number" && typeof a2 === "number") {
      const delta = a2 - a1;
      if (Math.abs(delta) >= 0.3) {
        compDiffs.push({ comp: COMPETENCY_DEFS[k].label, a1, a2, delta });
      }
    }
  }
  compDiffs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  out.push(heading("Competencias — diferencias ≥ 0,3", HeadingLevel.HEADING_2));
  if (compDiffs.length === 0) {
    out.push(p("Las competencias fueron muy consistentes entre cohortes (sin diferencias ≥ 0,3 puntos)."));
  } else {
    out.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            headerCell("Competencia"),
            headerCell("Cohorte 1", { align: AlignmentType.CENTER }),
            headerCell("Cohorte 2", { align: AlignmentType.CENTER }),
            headerCell("Δ", { align: AlignmentType.CENTER }),
          ],
        }),
        ...compDiffs.map((d) => new TableRow({
          children: [
            cell(d.comp),
            cell(d.a1.toFixed(2), { align: AlignmentType.CENTER }),
            cell(d.a2.toFixed(2), { align: AlignmentType.CENTER }),
            cell((d.delta > 0 ? "+" : "") + d.delta.toFixed(2), {
              align: AlignmentType.CENTER, bold: true,
              color: d.delta > 0 ? "059669" : "B91C1C",
            }),
          ],
        })),
      ],
    }));
  }
  out.push(p(""));

  // Placeholder para contexto manual
  out.push(heading("Contexto operativo entre cohortes", HeadingLevel.HEADING_2));
  out.push(p("[Esta sección se completa manualmente.] Razones del primer piloto registrado como cancelado, ajustes operativos entre la primera y la segunda cohorte (cambios de plataforma, prompts, pacientes disponibles, soporte, conexión, etc.), y lecciones aprendidas que conviene capturar de cara a próximos pilotos.", { run: { color: "9CA3AF", italics: true } }));

  return out;
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ─────────────────────────────────────────
// Main
// ─────────────────────────────────────────
async function main() {
  buildAnonIds();
  buildSurveyIndexes();

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
    children: [new TextRun({ text: "INF-2026-044", font: "Calibri", size: 28, bold: true, color: accent })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: "Piloto UCSP Arequipa", font: "Calibri", size: 44, bold: true })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
    children: [new TextRun({ text: "Análisis consolidado de dos cohortes", font: "Calibri", size: 28, color: "6B7280" })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: `${data.participants.length} participantes · ${data.conversations.length} sesiones · ${(data.surveyResponses || []).filter((r) => r.status === "completed").length} encuestas`,
      font: "Calibri", size: 22, color: "374151",
    })],
  }));

  children.push(...buildSection1());
  children.push(...await buildSection2());
  children.push(...buildSection3());
  children.push(...await buildSection4());
  children.push(...buildSection5());

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
              new TextRun({ text: "INF-2026-044 · Piloto UCSP Arequipa · GlorIA  ·  ", font: "Calibri", size: 18, color: "9CA3AF" }),
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
  const outPath = `${outDir}/INF-2026-044_piloto-ucsp-consolidado.docx`;
  fs.writeFileSync(outPath, buf);
  console.log(`\n✓ Escrito: ${outPath} (${(buf.length / 1024).toFixed(1)} KB)`);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
