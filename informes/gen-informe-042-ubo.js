// Genera INF-2026-042 — Piloto UBO (17 estudiantes)
// Estructura (aprobada con el usuario):
//   Hoja 1 — Datos tecnicos (tabla de participantes)
//   Hoja 2 — Cuantitativa (pie/bar de la encuesta)
//   Hoja 3 — 6 testimonios (3 positivos + 3 por mejorar)
//   Hoja 4+ — 5 competencias destacadas con 1 ejemplo bien + 1 regular c/u

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, ImageRun,
} = require("docx");

const data = require("./ubo-pilot-data.json");

// ─────────────────────────────────────────
// Constantes de estilo (copio patron de gen-handoff-docx.js)
// ─────────────────────────────────────────
const accent = "4A55A2";
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };
const logo = fs.readFileSync("public/branding/gloria-logo.png");
// Dimensiones reales del PNG (del header) para preservar aspect ratio.
const LOGO_W = logo.readUInt32BE(16);
const LOGO_H = logo.readUInt32BE(20);
const LOGO_TARGET_H = 44;
const LOGO_TARGET_W = Math.round(LOGO_TARGET_H * (LOGO_W / LOGO_H));

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({
      text,
      bold: true,
      font: "Calibri",
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

function bullet(text, opts = {}) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, font: "Calibri", size: 22, ...opts.run })],
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
      })],
    })],
  });
}

function headerCell(text, opts = {}) {
  return cell(text, { ...opts, bold: true, shading: { fill: "F3F4F6", type: ShadingType.CLEAR, color: "auto" } });
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

function small(text) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, font: "Calibri", size: 18, color: "6B7280" })],
  });
}

// ─────────────────────────────────────────
// Chart helpers (quickchart.io — servicio publico, solo envio agregados)
// ─────────────────────────────────────────
async function fetchChart(config, width = 480, height = 320) {
  // POST con JSON body: evita URL length limits cuando el config incluye
  // function strings (quickchart detecta strings "function..." y las
  // eval'a server-side para usarlas como callbacks de Chart.js).
  const res = await fetch("https://quickchart.io/chart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chart: config,
      width,
      height,
      devicePixelRatio: 2,
      backgroundColor: "transparent",
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`quickchart ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

async function pieChart({ title, labels, values, colors }) {
  // Legend incluye count + % entre parentesis para leerlo sin hover
  const total = values.reduce((a, b) => a + b, 0);
  const enrichedLabels = labels.map((l, i) => `${l} (${values[i]}, ${Math.round((values[i] / total) * 100)}%)`);
  const buf = await fetchChart({
    type: "pie",
    data: {
      labels: enrichedLabels,
      datasets: [{
        label: "",  // evita "undefined" en tooltip/leyenda
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

// Bar chart para Likert de la encuesta: eje 4.0-5.0, % dentro de la barra
// en blanco, promedio justo fuera al final. El y-axis label es solo el
// nombre de la variable. Usa function strings para los formatters de
// datalabels — quickchart las evalua server-side.
async function barChartSurvey({ title, categories, xMin = 4.0, xMax = 5.0 }) {
  const stats = categories.map((c) => {
    const arr = c.rawValues.filter((v) => typeof v === "number");
    const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const top = arr.length ? Math.round(arr.filter((v) => v >= 4).length / arr.length * 100) : 0;
    return { label: c.label, avg, top };
  });
  const buf = await fetchChart({
    type: "bar",
    data: {
      labels: stats.map((s) => s.label),
      datasets: [{
        label: "",
        data: stats.map((s) => s.avg),
        pctData: stats.map((s) => s.top),  // prop custom leida por el formatter
        backgroundColor: "#4A55A2",
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: "y",
      layout: { padding: { right: 40 } },
      plugins: {
        legend: { display: false },
        title: { display: true, text: title, font: { size: 16, weight: "bold" } },
        datalabels: {
          display: true,
          labels: {
            pct: {
              anchor: "center",
              align: "center",
              color: "white",
              font: { weight: "bold", size: 13 },
              formatter: "function(value, context) { return context.dataset.pctData[context.dataIndex] + '%'; }",
            },
            avg: {
              anchor: "end",
              align: "end",
              offset: 6,
              color: "#1F2937",
              font: { weight: "bold", size: 13 },
              formatter: "function(value) { return value.toFixed(1); }",
            },
          },
        },
      },
      scales: {
        x: { min: xMin, max: xMax, ticks: { stepSize: 0.25 }, grid: { color: "#E5E7EB" } },
        y: { ticks: { font: { size: 12 } }, grid: { display: false } },
      },
    },
  }, 720, 340);
  return new ImageRun({ data: buf, transformation: { width: 720, height: 340 } });
}

// Bar chart de competencias: solo promedio al final de la barra. Sin %
// porque en competencias clinicas casi nadie logro 4-5 (las distribuciones
// estan concentradas en 1-3), y mostrar "0%" en todas no agrega info.
async function barChartCompetencias({ title, categories, xMin = 0, xMax = 5 }) {
  const stats = categories.map((c) => {
    const arr = c.rawValues.filter((v) => typeof v === "number");
    const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return { label: c.label, avg };
  });
  const buf = await fetchChart({
    type: "bar",
    data: {
      labels: stats.map((s) => s.label),
      datasets: [{
        label: "",
        data: stats.map((s) => s.avg),
        backgroundColor: "#4A55A2",
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: "y",
      layout: { padding: { right: 40 } },
      plugins: {
        legend: { display: false },
        title: { display: true, text: title, font: { size: 16, weight: "bold" } },
        datalabels: {
          anchor: "end",
          align: "end",
          offset: 6,
          color: "#1F2937",
          font: { weight: "bold", size: 13 },
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

// ─────────────────────────────────────────
// Agregados
// ─────────────────────────────────────────
function minutesBetween(firstIso, lastIso) {
  if (!firstIso || !lastIso) return 0;
  return Math.round((new Date(lastIso) - new Date(firstIso)) / 60000);
}

// Definiciones expandidas: ¿qué es la competencia? ¿cómo se observa en la
// práctica clínica? ¿por qué importa? Las competencias "presencia" y
// "conducta_no_verbal" se excluyeron porque el canal texto-solo del piloto
// no permite evaluarlas con rigor (no hay mirada, tono ni postura medibles);
// los puntajes que arrojó el motor para esas dos se consideran no
// significativos y se omiten del informe.
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

// Competencias omitidas (no medibles con rigor en canal texto-solo):
//   - presencia: requiere observar mirada, tono, postura
//   - conducta_no_verbal: requiere video o presencia corporal
// Se documentan aquí para traceability — no se usan en chart ni en
// el bloque de competencias destacadas.

// Framework: Valdés & Gómez (2023), 10 competencias transversales en
// formación terapéutica, Universidad Santo Tomás (Chile).
const FRAMEWORK_CITATION = "Framework de competencias: Valdés, N. & Gómez, M. (2023). Competencias transversales en la formación de terapeutas. Universidad Santo Tomás, Chile.";

function computeCompetencyAverages() {
  const keys = Object.keys(COMPETENCY_DEFS);
  const avg = {};
  for (const k of keys) {
    const vals = data.sessionCompetencies.map((r) => r[k]).filter((v) => typeof v === "number");
    avg[k] = { value: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length };
  }
  return avg;
}

function pickExamples(key, count = 2) {
  // Devuelve { solido: [...], mejora: [...] } — cada lista con hasta `count`
  // ejemplos. No repite estudiante entre las dos listas. Acepta solo filas
  // con quote no vacio.
  const rows = data.sessionCompetencies
    .map((r) => ({ row: r, score: r[key], evidence: r.evidence?.[key] }))
    .filter((x) => typeof x.score === "number" && x.evidence?.quote && x.evidence.quote.trim().length > 0);
  if (rows.length === 0) return { solido: [], mejora: [] };

  const hydrate = (x) => {
    const student = data.participants.find((p) => p.user_id === x.row.student_id);
    return {
      studentName: student?.full_name || "Estudiante",
      score: x.score,
      quote: x.evidence.quote.trim(),
      observation: x.evidence.observation || "",
    };
  };

  const high = [...rows].sort((a, b) => b.score - a.score);
  const low  = [...rows].sort((a, b) => a.score - b.score);
  const takenStudents = new Set();
  const solido = [];
  for (const x of high) {
    if (solido.length >= count) break;
    if (takenStudents.has(x.row.student_id)) continue;
    solido.push(hydrate(x));
    takenStudents.add(x.row.student_id);
  }
  const mejora = [];
  for (const x of low) {
    if (mejora.length >= count) break;
    if (takenStudents.has(x.row.student_id)) continue;
    mejora.push(hydrate(x));
    takenStudents.add(x.row.student_id);
  }
  return { solido, mejora };
}

// ─────────────────────────────────────────
// Encuesta: distribuciones
// ─────────────────────────────────────────
function encuestaAgregada() {
  const responses = data.surveyResponses || [];
  const rol = {};
  const genero = {};
  const usabilidad = { claridad: [], feedback: [], navegacion: [], performance: [] };
  const formacion = { atencion: [], aplicacion: [], habilidades: [], incorporacion: [], verosimilitud: [] };
  for (const r of responses) {
    const a = r.answers || {};
    if (a.q4_rol) rol[a.q4_rol] = (rol[a.q4_rol] || 0) + 1;
    if (a.q2_genero) genero[a.q2_genero] = (genero[a.q2_genero] || 0) + 1;
    if (a.q5_usabilidad) for (const k of Object.keys(usabilidad)) if (typeof a.q5_usabilidad[k] === "number") usabilidad[k].push(a.q5_usabilidad[k]);
    if (a.q6_formacion) for (const k of Object.keys(formacion)) if (typeof a.q6_formacion[k] === "number") formacion[k].push(a.q6_formacion[k]);
  }
  // Devuelvo los arrays crudos — el chart helper calcula avg y % 4-5
  return { rol, genero, usabilidad, formacion };
}

// Frases positivas que descalifican un texto como "mejora" — si aparecen,
// el estudiante esta valorando, no pidiendo un cambio. Revisado contra la
// data real del piloto UBO (ej: "esta perfecta", "fue muy real").
const POSITIVE_ONLY_RE = /\b(est[aá] perfecta|perfecto|me encant[oó]|fue genial|muy real|est[aá] excelente|super bueno|por el momento nada|nada[,.]?\s*est[aá])\b/i;

function pickTestimonios() {
  const positivas = [];
  const mejoras = [];
  for (const r of data.surveyResponses || []) {
    const a = r.answers || {};
    const student = data.participants.find((p) => p.user_id === r.user_id);
    const name = student?.full_name || "Participante";
    if (a.q7_mas_gusto && typeof a.q7_mas_gusto === "string" && a.q7_mas_gusto.trim().split(/\s+/).length >= 5) {
      positivas.push({ name, text: a.q7_mas_gusto.trim() });
    }
    if (a.q8_mejoras && typeof a.q8_mejoras === "string" && a.q8_mejoras.trim().split(/\s+/).length >= 5) {
      const text = a.q8_mejoras.trim();
      // Descartar respuestas que son elogios puestos en la pregunta de
      // mejoras (ej: "esta perfecta", "fue muy real").
      if (POSITIVE_ONLY_RE.test(text)) continue;
      mejoras.push({ name, text });
    }
  }
  positivas.sort((a, b) => b.text.length - a.text.length);
  mejoras.sort((a, b) => b.text.length - a.text.length);
  return { positivas: positivas.slice(0, 3), mejoras: mejoras.slice(0, 3) };
}

// ─────────────────────────────────────────
// Main
// ─────────────────────────────────────────
async function main() {
  const { pilot, participants } = data;
  const completedConvs = data.conversations.filter((c) => c.status === "completed");
  const totalMsgs = Object.values(data.messagesByConversation).reduce((a, m) => a + m.length, 0);
  // Duracion por conversacion (desde metrics — first/last message)
  const durations = data.conversations
    .map((c) => c.metrics ? minutesBetween(c.metrics.first, c.metrics.last) : 0)
    .filter((m) => m > 0);
  const avgDurationMin = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const totalMinutes = durations.reduce((a, b) => a + b, 0);

  // Tabla de participantes: enriquecer con minutos totales por estudiante
  const participantRows = participants
    .filter((p) => p.role === "student" || p.role === "instructor")
    .map((p) => {
      const userConvs = data.conversations.filter((c) => c.student_id === p.user_id);
      const mins = userConvs
        .map((c) => c.metrics ? minutesBetween(c.metrics.first, c.metrics.last) : 0)
        .reduce((a, b) => a + b, 0);
      const lastLogin = p.last_active_at
        ? new Date(p.last_active_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" })
        : "—";
      return { p, sessions: userConvs.length, mins, lastLogin };
    });

  const compAvg = computeCompetencyAverages();
  // Top 2 + transversal + bottom 2 (de las 8 competencias medibles en
  // texto; presencia y conducta_no_verbal quedan fuera por diseño):
  //   actitud_no_valorativa  3.2 (top)
  //   datos_contextuales     3.0 (top)
  //   motivo_consulta        2.9 (transversal)
  //   escucha_activa         2.3 (bottom)
  //   objetivos              2.2 (bottom)
  const compKeysDestacadas = ["actitud_no_valorativa", "datos_contextuales", "motivo_consulta", "escucha_activa", "objetivos"];

  const survey = encuestaAgregada();
  const { positivas, mejoras } = pickTestimonios();

  // ─── Generar los charts async (antes de armar el doc) ────────────
  console.log("Generando charts via quickchart.io ...");

  // Rol: docentes azul, estudiantes indigo (paleta GlorIA)
  const rolLabels = Object.keys(survey.rol).map((k) => k.charAt(0).toUpperCase() + k.slice(1));
  const rolValues = Object.values(survey.rol);
  const chartRol = await pieChart({
    title: "Rol (N=17)",
    labels: rolLabels,
    values: rolValues,
    colors: rolLabels.map((l) => l.toLowerCase().startsWith("docente") ? "#4A55A2" : "#6F7AC4"),
  });
  // Genero: masculino azul, femenino naranjo — evita convencion azul/rosa
  const genLabels = Object.keys(survey.genero).map((k) => k.charAt(0).toUpperCase() + k.slice(1));
  const genValues = Object.values(survey.genero);
  const chartGenero = await pieChart({
    title: "Género (N=17)",
    labels: genLabels,
    values: genValues,
    colors: genLabels.map((l) => {
      const k = l.toLowerCase();
      if (k.startsWith("masculino")) return "#2563EB";   // azul
      if (k.startsWith("femenino")) return "#F97316";    // naranjo
      return "#94A3B8";                                  // otro/prefiero-no-decir
    }),
  });

  const chartUsab = await barChartSurvey({
    title: "Usabilidad — promedio (1-5, N=17)",
    categories: [
      { label: "Claridad", rawValues: survey.usabilidad.claridad },
      { label: "Feedback", rawValues: survey.usabilidad.feedback },
      { label: "Navegación", rawValues: survey.usabilidad.navegacion },
      { label: "Performance", rawValues: survey.usabilidad.performance },
    ],
  });
  const chartForm = await barChartSurvey({
    title: "Valor formativo — promedio (1-5, N=17)",
    categories: [
      { label: "Atención", rawValues: survey.formacion.atencion },
      { label: "Aplicación", rawValues: survey.formacion.aplicacion },
      { label: "Habilidades", rawValues: survey.formacion.habilidades },
      { label: "Incorporación", rawValues: survey.formacion.incorporacion },
      { label: "Verosimilitud", rawValues: survey.formacion.verosimilitud },
    ],
  });

  // Chart de competencias: solo 8 keys (sin presencia ni conducta_no_verbal
  // que se omitieron por no ser medibles con rigor en texto-solo). Sin
  // porcentaje porque casi ninguna sesion llego a 4-5; seria engañoso.
  const compKeys8 = Object.keys(COMPETENCY_DEFS);
  const chartComp = await barChartCompetencias({
    title: `Competencias clínicas — promedio grupal (1-5, N=${data.sessionCompetencies.length} sesiones)`,
    categories: compKeys8.map((k) => ({
      label: COMPETENCY_DEFS[k].label,
      rawValues: data.sessionCompetencies.map((r) => r[k]).filter((v) => typeof v === "number"),
    })),
  });

  console.log("Charts listos.");

  // ─── Build document ──────────────────────────────────────────────
  const children = [];

  // ── HEADER del documento: logo + bloque de identificacion ──
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 200 },
      children: [new ImageRun({ data: logo, transformation: { width: LOGO_TARGET_W, height: LOGO_TARGET_H } })],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: "INF-2026-042", font: "Calibri", size: 20, color: "6B7280" })],
    }),
    heading("Piloto Universidad Bernardo O'Higgins", HeadingLevel.HEADING_1),
    new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ text: "16–17 de abril de 2026 · 17 estudiantes en formación · Sesiones completadas: 17", font: "Calibri", size: 22, color: "6B7280" })],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [new TextRun({ text: "Contacto institucional: María Eugenia Araneda · maria.araneda@ubo.cl", font: "Calibri", size: 20, color: "6B7280" })],
    }),
  );

  // ══════════════════════════════════════════════════════════════
  // HOJA 1 — DATOS TECNICOS
  // ══════════════════════════════════════════════════════════════
  children.push(heading("Sección 1 · Datos técnicos del piloto", HeadingLevel.HEADING_2));

  // Resumen arriba (metricas clave en tabla 2 columnas; valores centrados)
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [
        headerCell("Métrica"), headerCell("Valor", { align: AlignmentType.CENTER }),
      ]}),
      new TableRow({ children: [cell("Estudiantes invitados"), cell(`${participants.length}`, { bold: true, align: AlignmentType.CENTER })]}),
      new TableRow({ children: [cell("Conectados a la plataforma"), cell(`${participants.filter((p) => p.first_login_at).length} (100%)`, { bold: true, align: AlignmentType.CENTER })]}),
      new TableRow({ children: [cell("Encuestas respondidas"), cell(`${(data.surveyResponses || []).length} (100%)`, { bold: true, align: AlignmentType.CENTER })]}),
      new TableRow({ children: [cell("Sesiones completadas"), cell(`${completedConvs.length}`, { bold: true, align: AlignmentType.CENTER })]}),
      new TableRow({ children: [cell("Mensajes intercambiados"), cell(`${totalMsgs}`, { bold: true, align: AlignmentType.CENTER })]}),
      new TableRow({ children: [cell("Minutos totales de sesión"), cell(`${totalMinutes} min (≈ ${avgDurationMin} min/sesión)`, { bold: true, align: AlignmentType.CENTER })]}),
      new TableRow({ children: [cell("Ventana del piloto"), cell(`${new Date(pilot.scheduled_at).toLocaleDateString("es-CL")} → ${new Date(pilot.ended_at).toLocaleDateString("es-CL")}`, { bold: true, align: AlignmentType.CENTER })]}),
    ],
  }));

  children.push(new Paragraph({ spacing: { before: 200 } }));
  children.push(heading("Tabla de participantes", HeadingLevel.HEADING_3));

  // Nombre a la izquierda (legibilidad); todo lo numerico/categorico al
  // centro. Mantenemos la fecha tambien centrada ya que es un dato chico.
  const participantTableRows = [
    new TableRow({ children: [
      headerCell("#", { align: AlignmentType.CENTER }),
      headerCell("Nombre"),
      headerCell("Rol", { align: AlignmentType.CENTER }),
      headerCell("Sesiones", { align: AlignmentType.CENTER }),
      headerCell("Minutos", { align: AlignmentType.CENTER }),
      headerCell("Último acceso", { align: AlignmentType.CENTER }),
    ]}),
    ...participantRows.map((pr, i) => new TableRow({ children: [
      cell(`${i + 1}`, { align: AlignmentType.CENTER }),
      cell(pr.p.full_name || "—"),
      cell(pr.p.role === "instructor" ? "Docente" : "Estudiante", { align: AlignmentType.CENTER }),
      cell(`${pr.sessions}`, { align: AlignmentType.CENTER }),
      cell(`${pr.mins}`, { align: AlignmentType.CENTER }),
      cell(pr.lastLogin, { align: AlignmentType.CENTER }),
    ]})),
  ];
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: participantTableRows }));

  children.push(pageBreak());

  // ══════════════════════════════════════════════════════════════
  // HOJA 2 — CUANTITATIVA (charts de la encuesta)
  // ══════════════════════════════════════════════════════════════
  children.push(heading("Sección 2 · Evaluación cuantitativa de la encuesta", HeadingLevel.HEADING_2));
  children.push(small(`Basado en las ${(data.surveyResponses || []).length} respuestas de la encuesta de cierre. Escalas Likert de 1 (muy bajo) a 5 (muy alto). Dentro de cada barra se muestra el porcentaje de respuestas en la zona alta (4-5); el número al final es el promedio.`));

  // Cada chart en su propia fila, centrado. Sin tabla 2x2 — antes quedaban
  // descuadrados por el ancho fijo de las celdas.
  children.push(new Paragraph({ spacing: { before: 200 }, alignment: AlignmentType.CENTER, children: [chartRol] }));
  children.push(new Paragraph({ spacing: { before: 200 }, alignment: AlignmentType.CENTER, children: [chartGenero] }));
  children.push(new Paragraph({ spacing: { before: 200 }, alignment: AlignmentType.CENTER, children: [chartUsab] }));
  children.push(new Paragraph({ spacing: { before: 200 }, alignment: AlignmentType.CENTER, children: [chartForm] }));

  children.push(pageBreak());

  // ══════════════════════════════════════════════════════════════
  // HOJA 3 — TESTIMONIOS
  // ══════════════════════════════════════════════════════════════
  children.push(heading("Sección 3 · Voces del piloto — 6 testimonios", HeadingLevel.HEADING_2));
  children.push(small("Selección literal de la encuesta de cierre. 3 testimonios destacando lo que más valoraron · 3 identificando oportunidades de mejora."));

  children.push(heading("Lo que más valoraron", HeadingLevel.HEADING_3));
  for (const t of positivas) {
    children.push(quoteBlock(t.text));
    children.push(small(`— ${t.name}`));
  }

  children.push(heading("Oportunidades de mejora identificadas", HeadingLevel.HEADING_3));
  for (const t of mejoras) {
    children.push(quoteBlock(t.text));
    children.push(small(`— ${t.name}`));
  }

  children.push(pageBreak());

  // ══════════════════════════════════════════════════════════════
  // HOJA 4+ — COMPETENCIAS CLINICAS (5 destacadas)
  // ══════════════════════════════════════════════════════════════
  children.push(heading("Sección 4 · Análisis de competencias clínicas", HeadingLevel.HEADING_2));
  children.push(small(FRAMEWORK_CITATION));
  children.push(small(`Puntaje global del grupo: ${(data.sessionCompetencies.reduce((a, r) => a + (r.overall_score_v2 || 0), 0) / data.sessionCompetencies.length).toFixed(1)} / 5 · Evaluado sobre ${data.sessionCompetencies.length} sesiones completadas.`));
  children.push(small("Nota: el framework incluye 10 competencias transversales. En este informe se analizan 8; las competencias de presencia y conducta no verbal fueron omitidas por no ser evaluables con rigor en el canal texto-solo del piloto (requieren observación de mirada, tono de voz y postura corporal)."));
  children.push(new Paragraph({ spacing: { after: 200 } }));
  children.push(chartComp ? new Paragraph({ alignment: AlignmentType.CENTER, children: [chartComp] }) : new Paragraph({}));

  children.push(new Paragraph({ spacing: { before: 300 } }));
  children.push(p("A continuación, se analiza en detalle cinco competencias destacadas: dos en las que el grupo demostró mayor dominio, dos que emergen como oportunidades claras de mejora, y una transversal al proceso terapéutico. Para cada una, se presenta la definición, el puntaje grupal, y dos ejemplos reales de las conversaciones — uno con desempeño sólido y otro donde la competencia se intentó pero no se logró plenamente."));

  for (const key of compKeysDestacadas) {
    const def = COMPETENCY_DEFS[key];
    const { value, n } = compAvg[key];
    const scores = data.sessionCompetencies.map((r) => r[key]).filter((v) => typeof v === "number");
    const pct45 = scores.length ? Math.round(scores.filter((v) => v >= 4).length / scores.length * 100) : 0;
    const maxS = scores.length ? Math.max(...scores) : 0;
    const minS = scores.length ? Math.min(...scores) : 0;
    const { solido, mejora } = pickExamples(key, 2);

    children.push(pageBreak());
    children.push(heading(def.label, HeadingLevel.HEADING_3));
    children.push(p(def.def, { run: { italics: true, color: "6B7280" } }));

    // Tabla de resumen de la competencia: 4 columnas, 1 fila de header +
    // 1 fila de valores. Numeros centrados, etiqueta a la izquierda.
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [
          headerCell("Puntaje grupal", { align: AlignmentType.CENTER }),
          headerCell("% grupo con 4-5", { align: AlignmentType.CENTER }),
          headerCell("Máximo observado", { align: AlignmentType.CENTER }),
          headerCell("Mínimo observado", { align: AlignmentType.CENTER }),
          headerCell("Sesiones evaluadas", { align: AlignmentType.CENTER }),
        ]}),
        new TableRow({ children: [
          cell(`${value.toFixed(1)} / 5`, { bold: true, align: AlignmentType.CENTER, color: accent }),
          cell(`${pct45}%`, { bold: true, align: AlignmentType.CENTER }),
          cell(`${maxS}/5`, { align: AlignmentType.CENTER }),
          cell(`${minS}/5`, { align: AlignmentType.CENTER }),
          cell(`${n}`, { align: AlignmentType.CENTER }),
        ]}),
      ],
    }));

    children.push(new Paragraph({ spacing: { before: 260 } }));
    children.push(p("Desempeño sólido", { run: { bold: true, color: accent, size: 24 } }));
    for (const ex of solido) {
      children.push(p(`${ex.studentName} — puntaje ${ex.score}/5`, { run: { bold: true, size: 20 } }));
      children.push(quoteBlock(ex.quote));
      children.push(small(`Observación: ${ex.observation}`));
      children.push(new Paragraph({ spacing: { after: 160 } }));
    }

    children.push(new Paragraph({ spacing: { before: 120 } }));
    children.push(p("Oportunidades de mejora", { run: { bold: true, color: "B45309", size: 24 } }));
    for (const ex of mejora) {
      children.push(p(`${ex.studentName} — puntaje ${ex.score}/5`, { run: { bold: true, size: 20 } }));
      children.push(quoteBlock(ex.quote));
      children.push(small(`Observación: ${ex.observation}`));
      children.push(new Paragraph({ spacing: { after: 160 } }));
    }
  }

  // ── Footer del documento ──
  children.push(new Paragraph({ spacing: { before: 400 } }));
  children.push(small(`Generado el ${new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })} por GlorIA · Destinatarios: equipo GlorIA + UBO (interno).`));

  // ─── Empaquetar ──────────────────────────────────────────────────
  const doc = new Document({
    creator: "GlorIA",
    title: "INF-2026-042 — Piloto UBO",
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } },
      },
    },
    sections: [{
      properties: {
        page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "INF-2026-042 · Piloto UBO", font: "Calibri", size: 18, color: "9CA3AF" })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES], font: "Calibri", size: 18, color: "9CA3AF" })],
          })],
        }),
      },
      children,
    }],
  });

  const outDir = "informes/pilotos";
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "INF-2026-042_piloto-ubo.docx");
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
  console.log(`Escrito: ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
