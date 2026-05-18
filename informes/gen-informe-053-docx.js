/**
 * INF-2026-053 .docx — Análisis crítico del motor de retroalimentación V3
 * frente a la PECT (Pauta de Evaluación de Competencias Psicoterapéuticas)
 * de Valdés Sánchez & Gómez Gallo (2023).
 *
 * Documenta: cobertura, divergencia de escala, descriptores inventados,
 * metadata incorrecta y plan de remediación por fases.
 *
 * Solo copia local por defecto (a confirmar con el usuario antes de subir
 * a supradmin/reportes@).
 *
 * Fuentes: C:/tmp/valdes-cap2-ocr.txt + C:/tmp/valdes-anexo-b-ocr.txt
 * (OCR del libro físico vía OpenAI Vision).
 */
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber,
} = require("docx");

const gloriaLogo = fs.readFileSync("public/branding/gloria-logo.png");

// ─── Estilo ──────────────────────────────────────────────────────────
const INDIGO = "4A55A2", DARK = "1A1A1A", LIGHT_BG = "F0F2FA";
const WHITE = "FFFFFF", GREY = "666666", BORDER = "CCCCCC";
const RED = "B23A48", AMBER = "C77600", GREEN = "2E7D32";

const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };
const PAGE_W = 12240, MARGIN = 1080;
const CONTENT_W = PAGE_W - 2 * MARGIN;

// ─── Helpers ─────────────────────────────────────────────────────────
const empty = (sz) => new Paragraph({ spacing: { after: sz || 60 }, children: [] });

const h1 = (t) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 280, after: 140 },
  children: [new TextRun({ text: t, color: INDIGO, bold: true, size: 32, font: "Calibri" })],
});

const h2 = (t) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 220, after: 110 },
  children: [new TextRun({ text: t, color: INDIGO, bold: true, size: 26, font: "Calibri" })],
});

const h3 = (t) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  spacing: { before: 160, after: 80 },
  children: [new TextRun({ text: t, color: DARK, bold: true, size: 22, font: "Calibri" })],
});

const body = (text, opts = {}) => new Paragraph({
  spacing: { after: 100 },
  alignment: opts.alignment || AlignmentType.JUSTIFIED,
  children: [new TextRun({ text, font: "Calibri", size: 21, color: DARK, italics: !!opts.italic, bold: !!opts.bold })],
});

const bullet = (text) => new Paragraph({
  spacing: { after: 60 },
  bullet: { level: 0 },
  children: [new TextRun({ text, font: "Calibri", size: 21, color: DARK })],
});

const small = (text, opts = {}) => new Paragraph({
  spacing: { after: 60 },
  alignment: opts.alignment || AlignmentType.LEFT,
  children: [new TextRun({ text, size: 18, font: "Calibri", color: GREY, italics: !!opts.italic })],
});

const quote = (text) => new Paragraph({
  spacing: { after: 100, before: 100 },
  indent: { left: 480, right: 240 },
  children: [new TextRun({
    text: `«${text}»`, font: "Calibri", size: 20, color: DARK, italics: true,
  })],
});

// Tabla genérica con encabezado indigo
function makeTable(headers, rows, colWidths, opts = {}) {
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      borders,
      width: { size: colWidths[i], type: WidthType.DXA },
      shading: { fill: INDIGO, type: ShadingType.CLEAR },
      margins: cellMargins,
      verticalAlign: "center",
      children: [new Paragraph({
        children: [new TextRun({ text: h, bold: true, color: WHITE, font: "Calibri", size: 19 })],
      })],
    })),
  });
  const dataRows = rows.map((r, ri) => new TableRow({
    children: r.map((cell, ci) => {
      const bg = ri % 2 === 0 ? LIGHT_BG : WHITE;
      const text = typeof cell === "string" ? cell : (cell?.text ?? "");
      const color = (typeof cell === "object" && cell?.color) || DARK;
      const bold = (typeof cell === "object" && cell?.bold) || false;
      return new TableCell({
        borders,
        width: { size: colWidths[ci], type: WidthType.DXA },
        shading: { fill: bg, type: ShadingType.CLEAR },
        margins: cellMargins,
        verticalAlign: "top",
        children: [new Paragraph({
          alignment: opts.center?.includes(ci) ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [new TextRun({ text, font: "Calibri", size: opts.fontSize || 18, color, bold })],
        })],
      });
    }),
  }));
  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows],
  });
}

// ─── Datos ───────────────────────────────────────────────────────────
// Tabla de cobertura por dimensión PECT vs V3 actual
const COBERTURA_ROWS = [
  ["2.1 Estructura de la sesión", "12", "4", "Cubre setting, motivo, datos contextuales, objetivos. Faltan: consentimiento informado, elementos institucionales, modificar setting, plan de trabajo, modificar tareas, derivaciones, cierre, informes."],
  ["2.2 Actitudes de la terapeuta", "10", "6", "Cubre escucha, no valorativa, optimismo, presencia, no verbal, contención. Faltan: curiosidad/cordialidad, espontaneidad/humor, manejo de silencios, actitud ética."],
  ["2.3 Características de la terapeuta", "8", "0", "No evaluables vía chat (autocuidado, prosodia, historia personal, apariencia)."],
  ["2.4 Conceptualización del caso", "5", "0", "No evaluables vía chat (psicopatología, desarrollo, trauma, proceso de cambio)."],
  ["2.5 Monitoreando evolución de la terapia", "6", "0", "Faltan: timing, vínculo, rupturas, reparación, monitoreo, supervisión."],
  ["2.6 Intervenciones y técnicas", "4 + 17", "0", "Faltan: explorar, sintonizar, resignificar, apoyar + 17 técnicas (focalización, clarificación, confrontación, paráfrasis, reflejo, reframing, metáfora, imaginería, etc.)."],
];

// Escala PECT vs V3
const ESCALA_ROWS = [
  ["NA — No aplicaba", "0 = No aplica", "NA (null) = No aplica"],
  ["Mínimo", "1 = Ausente / No desplegada (pudiendo hacerlo)", "0 = Omitido + 1 = Deficiente (V3 desdobla en 2)"],
  ["Parcial", "2 = Insuficiente", "2 = Básico/parcial"],
  ["Adecuado", "3 = Suficiente / Buena", "3 = Adecuado"],
  ["Óptimo", "4 = Excelente", "4 = Excelente/integrado"],
];

// 10 competencias V3 — mapeo abreviado a PECT
const MAPEO_10_ROWS = [
  ["setting_terapeutico", "2.1 Comunicar y mantener el setting terapéutico", "✓"],
  ["motivo_consulta", "2.1 Identificar un motivo de consulta", "✓"],
  ["datos_contextuales", "2.1 Considerar los datos contextuales del paciente", "✓"],
  ["objetivos", "2.1 Acordar objetivos junto con el paciente", "✓"],
  ["escucha_activa", "2.2 Mostrar una actitud de escucha activa", "✓"],
  ["actitud_no_valorativa", "2.2 Mostrar una actitud no valorativa del paciente", "✓"],
  ["optimismo", "2.2 Mostrar optimismo al paciente", "✓"],
  ["presencia", "2.2 Estar presente aquí y ahora", "✓"],
  ["conducta_no_verbal", "2.2 Prestar atención a la conducta no verbal", "✓"],
  ["contencion_afectos", "2.2 Contener los afectos del paciente", "✓"],
];

// Brechas críticas evaluables vía chat
const BRECHAS_EVALUABLES = [
  "Manejo de silencios del paciente (sec. 2.2)",
  "Actitud ética (sec. 2.2)",
  "Espontaneidad / humor en la sesión (sec. 2.2)",
  "Curiosidad, cordialidad y sensibilidad (sec. 2.2)",
  "Modificar el setting de ser necesario (sec. 2.1)",
  "Solicitar consentimientos informados (sec. 2.1)",
  "Diseñar y comunicar el plan de trabajo / metas (sec. 2.1)",
  "Modificar tareas y metas de ser necesario (sec. 2.1)",
  "Comunicar y realizar derivaciones adecuadamente (sec. 2.1)",
  "Realizar un adecuado cierre de sesión y de proceso (sec. 2.1)",
  "Intervenir en el momento oportuno — timing (sec. 2.5)",
  "Realizar acciones para desarrollar el vínculo (sec. 2.5)",
  "Identificar tensiones o problemas en el vínculo (sec. 2.5)",
  "Intentar reparar problemas en el vínculo (sec. 2.5)",
  "Monitorear y dar cuenta del avance terapéutico (sec. 2.5)",
  "Realizar exploración de contenidos (sec. 2.6)",
  "Mostrar sintonía con el paciente (sec. 2.6)",
  "Ofrecer apoyo al paciente (sec. 2.6)",
  "Facilitar la resignificación de contenidos (sec. 2.6)",
  "Reconocer y emplear técnicas terapéuticas (sec. 2.6) — 17 sub-técnicas: focalización, clarificación, confrontación, argumentación, interpretación, paráfrasis, reflejo, información, refuerzo, consejo, resumen, imaginería, rol playing, asignación de tareas, paradoja, metáfora, autorrevelación.",
];

const BRECHAS_NO_EVALUABLES = [
  "Características de la terapeuta (sec. 2.3) — 8 competencias evaluadas en supervisión presencial: autoevaluación, conducta no verbal propia, reacciones fisiológicas, regulación de afectos propios, apariencia, prosodia, historia personal, autocuidado.",
  "Conceptualización del caso (sec. 2.4) — 5 competencias evaluadas en presentación oral o informes: psicopatología, desarrollo, trauma y EAT, particularidades del caso, proceso de cambio.",
  "Aplicar sugerencias de supervisión (parte de sec. 2.5) — requiere contexto de supervisión.",
];

// Plan de fases
const FASES_ROWS = [
  ["F1", "Informe INF-2026-053 con análisis V3 vs PECT", "Este documento", "Sí (en curso)", "—"],
  ["F2", "Fixes inmediatos de metadata (autores, instrumento PECT, ISBN, marco MSC-VF)", "evaluation-prompt.ts, headers de archivos, INF-052", "Pendiente", "Bajo"],
  ["F3", "Reemplazo de anclas conductuales por texto literal del libro + glosa V3", "competency-rubric.ts (10 competencias)", "Hecho en rama fix/v3-fidelity-pect", "Medio"],
  ["F4", "Proyección empírica en staging: 3 conversaciones × 3 niveles de estudiante × evaluación V3 + PECT-extendido", "scripts/research/projection-f4/*", "En curso", "Alto"],
  ["F5", "Diseño V4 expandido con cobertura de competencias evaluables vía chat", "Documento de diseño + propuesta de schema", "Pendiente", "Alto"],
  ["F6", "Validación con la Escuela de Psicología UGM", "Envío de informe + diseño + ejemplos", "Pendiente", "—"],
];

// ─── Header con logo ────────────────────────────────────────────────
const docHeader = new Header({
  children: [new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [new ImageRun({
      type: "png",
      data: gloriaLogo,
      transformation: { width: 56, height: 56 },
      altText: { title: "GlorIA", description: "Logo GlorIA", name: "gloria-logo" },
    })],
  })],
});

const docFooter = new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: "GlorIA — INF-2026-053 — Página ", size: 18, font: "Calibri", color: GREY }),
      new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Calibri", color: GREY }),
      new TextRun({ text: " de ", size: 18, font: "Calibri", color: GREY }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Calibri", color: GREY }),
    ],
  })],
});

// ─── Contenido del informe ───────────────────────────────────────────
const content = [
  // Encabezado compacto
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 40 },
    children: [new TextRun({
      text: "INF-2026-053 · Análisis técnico-clínico",
      color: INDIGO, bold: true, size: 18, font: "Calibri",
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 40 },
    children: [new TextRun({
      text: "Análisis crítico del motor de retroalimentación V3 frente a la PECT (Valdés & Gómez, 2023)",
      color: INDIGO, bold: true, size: 30, font: "Calibri",
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 100 },
    children: [new TextRun({
      text: "Hallazgos, brechas de cobertura y plan de remediación por fases",
      color: DARK, size: 22, font: "Calibri",
    })],
  }),
  small("Fecha de elaboración: 18 de mayo de 2026 · Elaborado por: equipo GlorIA · Distribución: copia local (a confirmar antes de subir a supradmin)"),

  // Resumen ejecutivo
  h1("1. Resumen ejecutivo"),
  body("El motor de retroalimentación V3 de GlorIA evalúa al estudiante de psicología en diez competencias clínicas, agrupadas en dos dominios («Estructura» y «Actitudes»), citando como base la pauta de Valdés & Gómez (2023). Una revisión exhaustiva del libro fuente — Capítulo 2 y Anexo B — realizada el 18 de mayo de 2026 mediante OCR del PDF original revela cuatro hallazgos críticos:"),
  bullet("Cobertura limitada: las diez competencias evaluadas por V3 representan aproximadamente el 22 % del instrumento original. La pauta PECT contiene cuarenta y seis ítems (más diecisiete sub-técnicas en una sección específica) agrupados en seis dimensiones."),
  bullet("Escala divergente: V3 utiliza una escala de seis niveles (NA, 0, 1, 2, 3, 4) mientras que la PECT usa cinco (0=No aplica, 1=Ausente, 2=Insuficiente, 3=Buena, 4=Excelente). La distinción entre «NA» y «omitido» que V3 enfatiza no existe como tal en el instrumento original."),
  bullet("Descriptores inventados: las anclas conductuales por nivel que V3 inyecta al modelo evaluador eran interpretaciones propias del equipo, no textos del libro fuente, a pesar de que el libro sí provee descriptores conductuales literales para cada competencia."),
  bullet("Metadata incorrecta: el prompt inyectado al modelo evaluador citaba autores sin nombres («Valdés & Gómez») y un subtítulo ligeramente impreciso del instrumento. El nombre completo del instrumento es PECT (Pauta de Evaluación de Competencias Psicoterapéuticas para el trabajo con Adultos), publicado en el libro «Supervisión clínica para estudiantes de Psicología: Un modelo de competencias psicoterapéuticas genéricas básicas» (Ediciones UST / RIL Editores, ISBN 978-956-01-1601-7), de los autores Nelson Valdés Sánchez y Diana Marcela Gómez Gallo, basado en el modelo MSC-VF (Modelo de Supervisión Clínica con Videofeedback)."),
  body("A partir de estos hallazgos, se diseñó un plan de remediación por fases — descrito en la sección 7 — que combina correcciones inmediatas en código y un experimento empírico controlado en ambiente de staging."),

  // Sección 2
  h1("2. Identificación correcta del instrumento"),
  body("El instrumento que GlorIA toma como referencia se denomina formalmente:"),
  quote("PECT — Pauta de Evaluación de Competencias Psicoterapéuticas para el trabajo con Adultos"),
  body("Aparece publicado como Anexo B del libro:"),
  quote("Valdés Sánchez, N. & Gómez Gallo, D. (2023). Supervisión clínica para estudiantes de Psicología: Un modelo de competencias psicoterapéuticas genéricas básicas. Ediciones Universidad Santo Tomás / RIL Editores. ISBN 978-956-01-1601-7."),
  body("Los autores son académicos chilenos de la Universidad Santo Tomás:"),
  bullet("Nelson Valdés Sánchez — PhD en Psicoterapia (Pontificia Universidad Católica de Chile / Universidad de Heidelberg). Director del Doctorado en Estudios Psicológicos y Sociales del Bienestar, UST. Investigador adjunto MIDAP."),
  bullet("Diana Marcela Gómez Gallo — PhD en Psicoterapia (Pontificia Universidad Católica de Chile). Psicóloga clínica infanto-juvenil, UST."),
  body("La pauta se enmarca en el modelo MSC-VF (Modelo de Supervisión Clínica con Videofeedback), desarrollado por los autores en el proyecto de investigación 2019-2020 titulado «Modelo de supervisión clínica para el fortalecimiento de competencias psicoterapéuticas básicas de los estudiantes de psicología a través de la técnica de videofeedback», a cargo del profesor Nelson Valdés Sánchez en la Facultad de Ciencias Sociales y Comunicación de la UST."),

  // Sección 3
  h1("3. Cobertura comparada"),
  body("La pauta PECT está organizada en seis dimensiones macro, cada una con un número variable de competencias. La tabla siguiente resume la cobertura del motor V3 actual sobre el instrumento completo."),
  empty(),
  makeTable(
    ["Dimensión PECT", "Competencias", "Cubiertas en V3", "Observaciones"],
    COBERTURA_ROWS,
    [3200, 1100, 1300, CONTENT_W - 3200 - 1100 - 1300],
    { center: [1, 2] },
  ),
  empty(),
  body("La cobertura total es de diez de cuarenta y seis ítems principales (aproximadamente 22 %). Si se incluyen las diecisiete sub-técnicas de la dimensión 2.6, la cobertura efectiva baja a cerca de 16 %."),

  // Sección 4
  h1("4. Divergencia de escala"),
  body("V3 desdobla en seis niveles lo que el instrumento PECT codifica en cinco. La tabla siguiente compara ambas escalas."),
  empty(),
  makeTable(
    ["Significado", "PECT (libro)", "V3 actual"],
    ESCALA_ROWS,
    [2400, 4400, CONTENT_W - 2400 - 4400],
    {},
  ),
  empty(),
  body("Implicancias prácticas:"),
  bullet("Los puntajes V3 no son numéricamente equivalentes a los del PECT. Un estudiante con puntaje promedio 2,5 en V3 no equivale a un puntaje 2,5 en PECT."),
  bullet("La distinción «NA = no aplicaba» frente a «0 = omitido pudiendo hacerlo» que V3 considera una mejora pedagógica es, en realidad, una invención propia: en la PECT, ambos casos colapsan en el nivel 0 (No aplica) o en el nivel 1 (Ausente)."),
  bullet("Para mantener la trazabilidad histórica con el motor V3 actual sin migrar la base de datos, se opta por conservar la escala V3 y documentar el desfase. La fidelidad textual se introduce a nivel de los descriptores conductuales por nivel (fase F3)."),

  // Sección 5
  h1("5. Mapeo de las 10 competencias V3 al PECT"),
  body("Las diez competencias V3 corresponden de manera unívoca a diez ítems específicos del PECT, todos contenidos en las dimensiones 2.1 (Estructura) y 2.2 (Actitudes)."),
  empty(),
  makeTable(
    ["Clave V3", "Competencia PECT correspondiente", "Mapeo"],
    MAPEO_10_ROWS,
    [2800, CONTENT_W - 2800 - 800, 800],
    { center: [2] },
  ),
  empty(),
  body("Los descriptores conductuales por nivel — utilizados como anclas para guiar al modelo evaluador — han sido reescritos en la fase F3 para incorporar el texto literal del Cap. 2 del libro fuente, manteniendo además una glosa operacional propia para apoyar la observación en sesiones simuladas estudiante × paciente IA. El cambio vive en la rama fix/v3-fidelity-pect, commit f3bd674.", { italic: true }),

  // Sección 6
  h1("6. Brechas críticas pendientes de cobertura"),
  body("Las treinta y seis competencias del PECT no cubiertas por V3 pueden clasificarse en dos grupos según su evaluabilidad en el contexto de chat con paciente IA."),

  h2("6.1 Competencias evaluables vía chat (pendientes de incorporar)"),
  body("Las siguientes competencias del PECT son observables a partir de la transcripción de una sesión simulada y representan oportunidades concretas de expansión del motor:"),
  ...BRECHAS_EVALUABLES.map((b) => bullet(b)),

  h2("6.2 Competencias NO evaluables vía chat (fuera del alcance)"),
  body("Las siguientes dimensiones requieren contextos de supervisión presencial, observación longitudinal o presentación oral, y no son evaluables desde una transcripción de chat:"),
  ...BRECHAS_NO_EVALUABLES.map((b) => bullet(b)),
  body("Estas dimensiones deberán mantenerse fuera del scope del motor automatizado y, eventualmente, capturarse mediante mecanismos complementarios (reflexión post-sesión estructurada del estudiante, presentaciones a docentes en supervisión, evaluación par-a-par, etc.)."),

  // Sección 7
  h1("7. Plan de remediación por fases"),
  body("El plan de remediación se organiza en seis fases secuenciales, con dependencias claras entre ellas."),
  empty(),
  makeTable(
    ["#", "Descripción", "Artefacto principal", "Estado", "Riesgo"],
    FASES_ROWS,
    [500, 4400, 3000, 1500, CONTENT_W - 500 - 4400 - 3000 - 1500],
    { center: [0, 3, 4], fontSize: 17 },
  ),
  empty(),
  body("La fase F1 corresponde a este informe. La fase F3 fue ejecutada y vive en una rama no mergeada (commit f3bd674 en fix/v3-fidelity-pect). La fase F4 está en curso al momento de redactar este documento; sus resultados serán incorporados como anexo en una versión posterior. Las fases F2, F5 y F6 quedan pendientes y deben ser validadas por la Escuela de Psicología de la Universidad Gabriela Mistral antes de afectar el motor en producción."),

  // Sección 8
  h1("8. Próximos pasos"),
  bullet("Ejecutar F2 (corrección de metadata) sobre el motor actual o aprovechar la rama fix/v3-fidelity-pect que ya incluye los fixes principales (commit f3bd674)."),
  bullet("Esperar resultados de F4 (proyección empírica) para incorporar al presente informe como Anexo A."),
  bullet("Iniciar conversación con la Escuela de Psicología UGM para validar el alcance del rediseño V4."),
  bullet("Coordinar acceso al libro físico de Valdés & Gómez para verificar los pasajes del OCR que quedaron con menor confianza (en particular el nivel 3 de la competencia «presencia», donde el escaneo quedó parcialmente dañado)."),
  bullet("Considerar contactar directamente a Nelson Valdés (UST) para validar la pauta PECT extendida que se utilizará en F4 y para acordar atribución académica adecuada en futuras publicaciones de GlorIA."),

  // Anexo
  h1("Anexo A — Fuentes y trazabilidad"),
  body("OCR de las fuentes utilizadas en el análisis:"),
  bullet("C:/tmp/valdes-cap2-ocr.txt — transcripción OCR del Capítulo 2 del libro (57 páginas, ~123 mil caracteres). Método: render PDF a PNG con pdf-to-png-converter parchado para Windows + OCR con OpenAI gpt-4o (vision, detail=high) en lotes paralelos. Costo: USD 0,47."),
  bullet("C:/tmp/valdes-anexo-b-ocr.txt — transcripción OCR del Anexo B (PECT completa, 3 páginas). Método: dos pasadas de OCR consolidadas. Output: 8,4 KB."),
  bullet("Scripts utilizados: scripts/research/ocr-anexob.js, scripts/research/ocr-anexob-refine-all.js, scripts/research/ocr-anexob-p2-refine.js. Commit 1eb821c en master."),
  body("Limitaciones del OCR: el escaneo del libro físico introduce errores menores en algunas celdas de tabla, particularmente en la transición entre páginas. Las citas textuales utilizadas en el informe y en el motor V3 (rama fix/v3-fidelity-pect) han sido revisadas manualmente. Los pasajes con menor confianza están explícitamente marcados como «reconstrucción aproximada» en el código de competency-rubric.ts."),
];

// ─── Documento ───────────────────────────────────────────────────────
const doc = new Document({
  creator: "GlorIA",
  title: "INF-2026-053 — Análisis crítico motor V3 vs PECT",
  description: "Hallazgos, brechas de cobertura y plan de remediación del motor de retroalimentación V3 frente a la pauta PECT de Valdés & Gómez (2023).",
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 21 } },
    },
  },
  sections: [{
    properties: {
      page: {
        size: { width: PAGE_W, height: 15840 },
        margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, header: 360, footer: 360 },
      },
    },
    headers: { default: docHeader },
    footers: { default: docFooter },
    children: content,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const out = "informes/desarrollo/INF-2026-053_analisis-motor-v3-vs-pect.docx";
  fs.writeFileSync(out, buf);
  console.log(`OK -> ${out}  (${(buf.length / 1024).toFixed(1)} KB)`);
});
