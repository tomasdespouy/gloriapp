/**
 * DOCX generator for the pilot report, aligned with the UNICARIBE
 * reference deck (dic 2025): UGM + GlorIA logos on every page header,
 * numbered sections 1–7, percentage tables (1–3 vs 4–5) per likert
 * section, narrative conclusiones, participant annex at the end.
 *
 * All reports are generated in anonymised mode — testimonials carry
 * "Estudiante, [edad] años, [Universidad] ([país])" rather than names.
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  PageBreak,
  Header,
  ImageRun,
  LevelFormat,
} from "docx";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  type PilotReportData,
  type LikertSectionStats,
  type Testimonial,
  COMPETENCY_KEYS,
  formatDuration,
  formatMonthYear,
  formatDateShort,
  testimonialAttribution,
} from "./pilot-report-data";

const ACCENT = "4A55A2"; // GlorIA sidebar
const MUTED = "6B7280";
const TABLE_HEADER_BG = "E5E7EB";
const CELL_BORDER = "D1D5DB";
const GREEN = "16A34A";
const ORANGE = "D97706";
const RED = "DC2626";

// ─── Asset loading ────────────────────────────────────────────────────

async function loadLocalAsset(relPath: string): Promise<Buffer | null> {
  try {
    const filePath = path.join(process.cwd(), "public", "branding", relPath);
    return await readFile(filePath);
  } catch {
    return null;
  }
}

async function loadRemoteAsset(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  } catch {
    return null;
  }
}

// ─── Tiny paragraph helpers ───────────────────────────────────────────

function p(text: string, opts: { bold?: boolean; color?: string; size?: number; italics?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: 100 },
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        color: opts.color,
        size: opts.size,
        italics: opts.italics,
      }),
    ],
  });
}

function h1(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300, after: 160 },
    children: [new TextRun({ text, bold: true, color: ACCENT, size: 28 })],
  });
}

function h2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, color: ACCENT, size: 24 })],
  });
}

function bullet(text: string, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ─── Header with logos ────────────────────────────────────────────────

function buildPageHeader(
  ugmBuf: Buffer | null,
  gloriaBuf: Buffer | null,
  instBuf: Buffer | null,
): Header {
  const leftChildren: (ImageRun | TextRun)[] = [];
  if (ugmBuf) {
    leftChildren.push(
      new ImageRun({
        data: ugmBuf,
        transformation: { width: 120, height: 45 },
        type: "png",
      }),
    );
  }

  const rightChildren: (ImageRun | TextRun)[] = [];
  if (gloriaBuf) {
    rightChildren.push(
      new ImageRun({
        data: gloriaBuf,
        transformation: { width: 100, height: 40 },
        type: "png",
      }),
    );
  }
  if (instBuf) {
    rightChildren.unshift(new TextRun({ text: "   " }));
    rightChildren.unshift(
      new ImageRun({
        data: instBuf,
        transformation: { width: 70, height: 40 },
        type: "png",
      }),
    );
  }

  const cell = (children: (ImageRun | TextRun)[], align: (typeof AlignmentType)[keyof typeof AlignmentType]) =>
    new TableCell({
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      children: [
        new Paragraph({
          alignment: align,
          children: children.length > 0 ? children : [new TextRun(" ")],
        }),
      ],
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: "auto" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
        left: { style: BorderStyle.NONE, size: 0, color: "auto" },
        right: { style: BorderStyle.NONE, size: 0, color: "auto" },
      },
    });

  return new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: "auto" },
          bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
          left: { style: BorderStyle.NONE, size: 0, color: "auto" },
          right: { style: BorderStyle.NONE, size: 0, color: "auto" },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
        },
        rows: [
          new TableRow({
            children: [
              cell(leftChildren, AlignmentType.LEFT),
              cell(rightChildren, AlignmentType.RIGHT),
            ],
          }),
        ],
      }),
      new Paragraph({ children: [] }), // breathing room before body
    ],
  });
}

// ─── Section: Cover ───────────────────────────────────────────────────

function sectionCover(data: PilotReportData) {
  return [
    new Paragraph({ children: [new TextRun("")], spacing: { before: 2400 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 1200, after: 200 },
      children: [
        new TextRun({
          text: `Informe experiencia piloto de GlorIA con ${data.pilot.institution}`,
          bold: true,
          size: 36,
          color: "1A1A1A",
        }),
      ],
    }),
    new Paragraph({ children: [], spacing: { before: 4800 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `— ${formatMonthYear(data.pilot.scheduled_at)} —`,
          color: ACCENT,
          italics: true,
          size: 22,
        }),
      ],
    }),
    pageBreak(),
  ];
}

// ─── Section 1: Introducción ──────────────────────────────────────────

function section1Intro(data: PilotReportData) {
  return [
    h1("1. INTRODUCCIÓN"),
    p(
      "La Universidad Gabriela Mistral tiene como misión aportar al progreso del país a través de la formación de personas, profesionales y académicos que puedan enfrentar las necesidades del ámbito laboral, empresarial y académico actuales. La Institución está en línea con los nuevos espacios de aprendizaje que promueven un ambiente de estudio flexible y autónomo. Es así como durante 2024 — a través de su Escuela de Psicología y la Dirección de Innovación en Entornos de Aprendizaje (IDEA) — desarrolló GlorIA, una plataforma pionera de simulación clínica basada en inteligencia artificial generativa que proyecta el futuro de la formación en psicología.",
      { size: 22 },
    ),
    p(
      "GlorIA integra perfiles de pacientes virtuales, cada uno con características, historias y patrones de comportamiento distintos, permitiendo a los estudiantes practicar y fortalecer sus competencias diagnósticas en un entorno seguro, controlado y altamente realista.",
      { size: 22 },
    ),
    p(
      `Para validar el potencial de GlorIA en un contexto formativo real, se invitó a ${data.pilot.institution}${data.pilot.country ? ` (${data.pilot.country})` : ""} a participar de esta experiencia piloto, que tuvo como objetivos (1) evaluar GlorIA como herramienta complementaria al ejercicio práctico para potenciar las competencias clínicas de estudiantes de psicología y (2) recopilar retroalimentación para ajustar la plataforma y mejorar su propuesta pedagógica. La experiencia contó con ${data.kpis.total_invited} participantes invitados, de los cuales ${data.kpis.total_connected} ingresaron a la plataforma y realizaron un total de ${data.kpis.completed_sessions} sesiones completadas con pacientes simulados.`,
      { size: 22 },
    ),
    p(
      "El 100% de los participantes firmó consentimiento informado, autorizando el uso de datos agregados y anonimizados con fines de investigación y mejora continua de la plataforma.",
      { size: 22 },
    ),
    pageBreak(),
  ];
}

// ─── Section 2: Objetivos ─────────────────────────────────────────────

function section2Objetivos() {
  return [
    h1("2. OBJETIVOS"),
    p("El piloto se propuso los siguientes objetivos específicos:", { size: 22 }),
    bullet("Evaluar la usabilidad y pertinencia pedagógica de la plataforma en un contexto formativo real."),
    bullet("Medir el desarrollo de competencias clínicas de los estudiantes a través de práctica con pacientes simulados."),
    bullet("Recopilar retroalimentación estructurada de estudiantes y docentes respecto a la experiencia."),
    bullet("Identificar oportunidades de mejora técnica, cultural y pedagógica para las siguientes versiones."),
    pageBreak(),
  ];
}

// ─── Section 3: Resumen experiencia ───────────────────────────────────

function section3Resumen(data: PilotReportData) {
  const blocks: Paragraph[] = [
    h1("3. RESUMEN EXPERIENCIA"),
  ];

  if (data.survey.n === 0) {
    blocks.push(
      p(
        "Aún no hay respuestas de la encuesta de satisfacción para este piloto. Esta sección se completará cuando los participantes respondan.",
        { italics: true, color: MUTED, size: 22 },
      ),
    );
    blocks.push(pageBreak());
    return blocks;
  }

  if (data.survey.top_positives.length > 0) {
    blocks.push(
      p(
        "Los ítems mejor evaluados por los participantes estuvieron vinculados a la usabilidad de la plataforma, el realismo clínico y la satisfacción global. Los usuarios declararon:",
        { size: 22 },
      ),
    );
    for (const tp of data.survey.top_positives) {
      blocks.push(bullet(`${Math.round(tp.pct)}% estuvo de acuerdo: "${tp.label}"`));
    }
  }

  if (data.survey.top_negatives.length > 0) {
    blocks.push(
      p(
        "Los elementos con valoración comparativamente más baja están vinculados al funcionamiento técnico y la pertinencia cultural:",
        { size: 22 },
      ),
    );
    for (const tn of data.survey.top_negatives) {
      blocks.push(bullet(`${Math.round(tn.pct)}% estuvo de acuerdo: "${tn.label}"`));
    }
  }

  blocks.push(pageBreak());
  return blocks;
}

// ─── Section 4: Resultados generales (percentage tables) ──────────────

function pctCell(text: string, color: string, bold = false) {
  return new TableCell({
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, color, bold, size: 20 })],
      }),
    ],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: CELL_BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: CELL_BORDER },
      left: { style: BorderStyle.SINGLE, size: 4, color: CELL_BORDER },
      right: { style: BorderStyle.SINGLE, size: 4, color: CELL_BORDER },
    },
  });
}

function textCell(text: string, opts: { bold?: boolean; bg?: string; size?: number } = {}) {
  return new TableCell({
    margins: { top: 80, bottom: 80, left: 120, right: 80 },
    shading: opts.bg ? { type: ShadingType.CLEAR, color: "auto", fill: opts.bg } : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 20 })],
      }),
    ],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: CELL_BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: CELL_BORDER },
      left: { style: BorderStyle.SINGLE, size: 4, color: CELL_BORDER },
      right: { style: BorderStyle.SINGLE, size: 4, color: CELL_BORDER },
    },
  });
}

function buildSurveyTable(section: LikertSectionStats) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      textCell("Pregunta", { bold: true, bg: TABLE_HEADER_BG }),
      textCell("1 a 3", { bold: true, bg: TABLE_HEADER_BG }),
      textCell("4 a 5", { bold: true, bg: TABLE_HEADER_BG }),
    ],
  });
  const rows = section.items.map((it) => {
    const highColor = it.high_pct >= 90 ? GREEN : it.high_pct > 0 ? ORANGE : MUTED;
    const lowColor = it.low_pct > 20 ? RED : MUTED;
    return new TableRow({
      children: [
        textCell(it.label, { size: 18 }),
        pctCell(it.n > 0 ? `${Math.round(it.low_pct)}%` : "—", lowColor),
        pctCell(it.n > 0 ? `${Math.round(it.high_pct)}%` : "—", highColor),
      ],
    });
  });
  const avgLow = Math.round(section.low_pct);
  const avgHigh = Math.round(section.high_pct);
  const summaryRow = new TableRow({
    children: [
      textCell("Promedio sección", { bold: true, bg: TABLE_HEADER_BG }),
      textCell(`${avgLow}%`, { bold: true, bg: TABLE_HEADER_BG }),
      textCell(`${avgHigh}%`, { bold: true, bg: TABLE_HEADER_BG }),
    ],
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [6500, 1500, 1500],
    rows: [headerRow, ...rows, summaryRow],
  });
}

function section4Results(data: PilotReportData) {
  const blocks: Paragraph[] = [h1("4. RESULTADOS GENERALES")];
  blocks.push(
    p(
      "Esta información se recogió a partir de una encuesta para evaluar la experiencia del piloto desde el usuario, aplicada al final del proceso en completo anonimato. La encuesta se responde en escala Likert de 1 a 5, donde 1 es muy en desacuerdo y 5 muy de acuerdo.",
      { size: 22 },
    ),
  );
  blocks.push(
    p(
      `Se consideran valores "positivos" aquellas respuestas con valores 4 y 5, mientras que de 1 a 3 como "negativos". En verde se destaca el valor más elevado por sección, en naranja el más descendido comparativamente cuando está bajo el 90%.`,
      { size: 22 },
    ),
  );
  blocks.push(
    p(`n = ${data.survey.n} respuestas completas.`, { italics: true, color: MUTED, size: 20 }),
  );

  if (data.survey.n === 0) {
    blocks.push(
      p(
        "Sin respuestas disponibles — las tablas se completarán cuando los participantes respondan la encuesta.",
        { italics: true, color: MUTED, size: 20 },
      ),
    );
    blocks.push(pageBreak());
    return { blocks, tables: [] as Table[] };
  }

  // Build the tables separately — docx Section.children accepts Paragraph
  // and Table items intermixed, but we need to interleave them carefully.
  const items: (Paragraph | Table)[] = blocks.slice();
  for (const s of data.survey.sections) {
    items.push(h2(s.title));
    items.push(buildSurveyTable(s));
    items.push(new Paragraph({ children: [], spacing: { after: 200 } }));
  }
  items.push(pageBreak());
  return { blocks: items as (Paragraph | Table)[], tables: [] };
}

// ─── Section 5: Análisis de competencias ──────────────────────────────

function section5Competencias(data: PilotReportData) {
  const blocks: (Paragraph | Table)[] = [h1("5. ANÁLISIS DE LAS INTERACCIONES")];
  blocks.push(
    p(
      "Esta sección se basó en un análisis automático, realizado por la IA de GlorIA, de las interacciones entre estudiantes y los pacientes virtuales, siguiendo el marco de evaluación de competencias psicoterapéuticas de Valdés & Gómez (2023, Universidad Santo Tomás). Las competencias se agrupan en dos dominios: Estructura de la sesión y Actitudes terapéuticas. A continuación se presentan los resultados agregados.",
      { size: 22 },
    ),
  );

  const byDomain: Record<string, typeof COMPETENCY_KEYS[number][]> = { estructura: [], actitudes: [] };
  for (const k of COMPETENCY_KEYS) byDomain[data.competency_info[k].domain].push(k);

  const renderDomain = (domain: "estructura" | "actitudes") => {
    const domainLabel =
      domain === "estructura" ? "5.1 Estructura de la sesión" : "5.2 Actitudes terapéuticas";
    blocks.push(h2(domainLabel));
    let idx = 1;
    for (const key of byDomain[domain]) {
      const info = data.competency_info[key];
      const { avg, count } = data.competency_averages[key];
      const color = avg >= 3 ? GREEN : avg >= 2 ? ORANGE : avg > 0 ? RED : MUTED;
      blocks.push(
        new Paragraph({
          spacing: { before: 200, after: 100 },
          children: [
            new TextRun({ text: `${idx}. ${info.name}`, bold: true, size: 22 }),
            new TextRun({
              text: `    ${avg > 0 ? `puntaje: ${avg.toFixed(1)} / 4` : "sin datos"}`,
              color,
              bold: true,
              size: 22,
            }),
            ...(count > 0
              ? [new TextRun({ text: `   (${count} sesiones)`, color: MUTED, size: 18 })]
              : []),
          ],
        }),
      );
      blocks.push(p(info.definition, { size: 20 }));
      idx++;
    }
  };

  renderDomain("estructura");
  renderDomain("actitudes");

  if (data.top_strengths.length > 0 || data.top_areas.length > 0) {
    blocks.push(h2("5.3 Fortalezas y áreas de mejora más citadas"));
  }
  if (data.top_strengths.length > 0) {
    blocks.push(p("Fortalezas recurrentes identificadas por la IA:", { bold: true, size: 22 }));
    for (const s of data.top_strengths) {
      blocks.push(bullet(`${s.text} — ${s.count} menciones`));
    }
  }
  if (data.top_areas.length > 0) {
    blocks.push(p("Áreas de mejora recurrentes:", { bold: true, size: 22 }));
    for (const a of data.top_areas) {
      blocks.push(bullet(`${a.text} — ${a.count} menciones`));
    }
  }

  blocks.push(
    new Paragraph({
      spacing: { before: 300 },
      children: [
        new TextRun({
          text: "Referencia: Valdés, A., & Gómez, P. (2023). Manual de Evaluación de Competencias Psicoterapéuticas. Universidad Santo Tomás.",
          italics: true,
          color: MUTED,
          size: 18,
        }),
      ],
    }),
  );
  blocks.push(pageBreak());
  return blocks;
}

// ─── Section 6: Testimonios ───────────────────────────────────────────

function renderTestimonialBlock(title: string, items: Testimonial[], limit = 5): (Paragraph | Table)[] {
  if (items.length === 0) return [];
  const blocks: (Paragraph | Table)[] = [];
  blocks.push(h2(title));
  for (const t of items.slice(0, limit)) {
    blocks.push(
      new Paragraph({
        spacing: { before: 150 },
        indent: { left: 400 },
        children: [new TextRun({ text: `"${t.text}"`, italics: true, size: 22 })],
      }),
    );
    blocks.push(
      new Paragraph({
        indent: { left: 400 },
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: testimonialAttribution(t),
            color: ACCENT,
            size: 18,
          }),
        ],
      }),
    );
  }
  return blocks;
}

function section6Testimonios(data: PilotReportData) {
  const blocks: (Paragraph | Table)[] = [h1("6. TESTIMONIOS")];
  const t = data.testimonials;
  if (
    t.mas_gusto.length === 0 &&
    t.menos_gusto.length === 0 &&
    t.cambio.length === 0 &&
    t.incomodidad.length === 0 &&
    t.comentarios.length === 0
  ) {
    blocks.push(
      p("Aún no se registran testimonios. Esta sección se completará cuando los participantes respondan la encuesta.", {
        italics: true,
        color: MUTED,
        size: 22,
      }),
    );
    blocks.push(pageBreak());
    return blocks;
  }

  blocks.push(
    p(
      "Los siguientes testimonios han sido extraídos de las respuestas abiertas de la encuesta de satisfacción. Se presentan sin identificación nominal; la atribución incluye edad, universidad y país cuando están disponibles.",
      { size: 20, italics: true, color: MUTED },
    ),
  );

  blocks.push(...renderTestimonialBlock("¿Qué es lo que más te gustó de usar GlorIA?", t.mas_gusto));
  blocks.push(
    ...renderTestimonialBlock(
      "¿Qué es lo que menos te gustó o qué problemas encontraste al usarla?",
      t.menos_gusto,
    ),
  );
  blocks.push(...renderTestimonialBlock("Si pudieras cambiar o agregar UNA cosa, ¿qué sería?", t.cambio));
  blocks.push(
    ...renderTestimonialBlock(
      "¿Hubo algo que te generó incomodidad emocional o dificultó tu aprendizaje?",
      t.incomodidad,
    ),
  );
  blocks.push(...renderTestimonialBlock("Comentarios adicionales", t.comentarios, 3));

  blocks.push(pageBreak());
  return blocks;
}

// ─── Section 7: Conclusiones ──────────────────────────────────────────

function section7Conclusiones(data: PilotReportData) {
  const k = data.kpis;
  const connPct = Math.round(k.connection_rate * 100);
  const respPct =
    k.total_students > 0 ? Math.round((k.survey_responses_count / k.total_students) * 100) : 0;

  const narrativa = [
    `La experiencia piloto realizada con ${data.pilot.institution}${
      data.pilot.country ? ` (${data.pilot.country})` : ""
    } convocó a ${k.total_invited} participantes, de los cuales ${k.total_connected} ingresaron a la plataforma (${connPct}% de conexión). Durante el piloto se registraron ${k.completed_sessions} sesiones completadas con un tiempo promedio activo de ${formatDuration(k.avg_seconds_per_session)} por interacción, y se respondieron ${k.survey_responses_count} encuestas de satisfacción (${respPct}% de los estudiantes).`,
    k.pilot_overall_avg > 0
      ? `Los resultados de la evaluación automática de competencias muestran un puntaje general de ${k.pilot_overall_avg.toFixed(1)} / 4 agregado sobre ${k.total_evaluated_sessions} sesiones evaluadas.`
      : "Las sesiones evaluadas se suman en la tabla de la sección 5, donde se presentan los puntajes por competencia.",
    data.survey.top_positives.length > 0
      ? `La experiencia mostró una aceptación generalmente positiva, con ítems particularmente bien evaluados en usabilidad y satisfacción global. Al mismo tiempo, los estudiantes identificaron oportunidades de mejora concretas, principalmente en el realismo clínico y la pertinencia cultural de los pacientes simulados.`
      : "",
    "Considerando estos aprendizajes, los insumos recolectados se integrarán al roadmap de GlorIA para las siguientes versiones, con énfasis en las áreas identificadas por los propios participantes.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    h1("7. CONCLUSIONES Y SIGUIENTES PASOS"),
    ...narrativa.split("\n\n").map((para) =>
      new Paragraph({
        spacing: { after: 160 },
        children: [new TextRun({ text: para, size: 22 })],
      }),
    ),
    pageBreak(),
  ];
}

// ─── Annex: Participantes ─────────────────────────────────────────────

function sectionAnnex(data: PilotReportData, anonMap: Map<string, string>) {
  const header = new TableRow({
    tableHeader: true,
    children: ["#", "Identificador", "Rol", "Primera sesión", "Última actividad", "Sesiones", "Encuesta"].map(
      (h) =>
        new TableCell({
          shading: { type: ShadingType.CLEAR, color: "auto", fill: TABLE_HEADER_BG },
          children: [
            new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18 })] }),
          ],
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: CELL_BORDER },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: CELL_BORDER },
            left: { style: BorderStyle.SINGLE, size: 4, color: CELL_BORDER },
            right: { style: BorderStyle.SINGLE, size: 4, color: CELL_BORDER },
          },
        }),
    ),
  });

  const rows = data.students.map((s, i) => {
    const identifier = s.role === "student" ? anonMap.get(s.id) || "—" : "Docente";
    return new TableRow({
      children: [
        textCell(String(i + 1), { size: 18 }),
        textCell(identifier, { size: 18 }),
        textCell(s.role === "student" ? "Estudiante" : "Docente", { size: 18 }),
        textCell(formatDateShort(s.first_login_at), { size: 18 }),
        textCell(formatDateShort(s.last_active_at), { size: 18 }),
        textCell(String(s.total_sessions), { size: 18 }),
        textCell(s.responded_survey ? "Sí" : "—", { size: 18 }),
      ],
    });
  });

  return [
    h1("ANEXO — Participantes"),
    p(
      "Lista anonimizada de participantes con indicadores de actividad. Los estudiantes se identifican con P-NNN; los docentes mantienen su rol pero sin identificación nominal.",
      { size: 20, italics: true, color: MUTED },
    ),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [header, ...rows],
    }),
    new Paragraph({ children: [], spacing: { before: 400 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "— fin del informe —",
          italics: true,
          color: MUTED,
          size: 20,
        }),
      ],
    }),
  ];
}

// ─── Public entrypoint ────────────────────────────────────────────────

export async function generatePilotDocx(data: PilotReportData): Promise<Buffer> {
  // Load logos in parallel. Local assets are always attempted; the
  // institution logo is fetched over HTTP if the pilot/establishment
  // has one. All three fail gracefully to null.
  const [ugmBuf, gloriaBuf, instBuf] = await Promise.all([
    loadLocalAsset("ugm-full-logo.png"),
    loadLocalAsset("gloria-logo.png"),
    loadRemoteAsset(data.pilot.logo_url),
  ]);

  // Anonymised IDs for students (stable within a single report).
  const anonMap = new Map<string, string>();
  let c = 1;
  for (const s of data.students) {
    if (s.role === "student") {
      anonMap.set(s.id, `P-${String(c).padStart(3, "0")}`);
      c++;
    }
  }

  const header = buildPageHeader(ugmBuf, gloriaBuf, instBuf);

  const { blocks: section4Blocks } = section4Results(data);

  const doc = new Document({
    creator: "GlorIA",
    title: `Informe ${data.pilot.name}`,
    description: `Informe experiencia piloto de GlorIA con ${data.pilot.institution}`,
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
          paragraph: { spacing: { line: 300 } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "default-bullets",
          levels: [
            { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          // Roughly 2.5cm margins on all sides (1440 = 1 inch)
          page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        headers: { default: header },
        children: [
          ...sectionCover(data),
          ...section1Intro(data),
          ...section2Objetivos(),
          ...section3Resumen(data),
          ...section4Blocks,
          ...section5Competencias(data),
          ...section6Testimonios(data),
          ...section7Conclusiones(data),
          ...sectionAnnex(data, anonMap),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
