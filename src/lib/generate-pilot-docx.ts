/**
 * DOCX generator for the pilot report.
 *
 * Pure: takes a fully-materialised PilotReportData + variant flag and
 * returns a Buffer. All data fetching lives in pilot-report-data.ts.
 * The only side-effect is the final `Packer.toBuffer(doc)` call.
 *
 * Variant:
 *   'named'     — participant names are shown in testimonials + annex.
 *   'anonymous' — names are replaced with P-001, P-002, ... in the order
 *                 they appear in data.students.
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
} from "docx";
import {
  type PilotReportData,
  type CompetencyKey,
  COMPETENCY_KEYS,
  formatDuration,
  formatDateShort,
  formatDateTime,
  V2_ITEM_LABELS,
  V2_SECTION_LABELS,
  TESTIMONIAL_LABELS,
} from "./pilot-report-data";

const ACCENT = "4A55A2";
const MUTED = "6B7280";
const BAR_GRAY = "E5E7EB";

type Variant = "named" | "anonymous";

// ─── Small helpers ────────────────────────────────────────────────────

function para(text: string, opts: { bold?: boolean; color?: string; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new Paragraph({
    alignment: opts.align,
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        color: opts.color,
        size: opts.size, // half-points
      }),
    ],
  });
}

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
  return new Paragraph({
    heading: level,
    children: [new TextRun({ text, bold: true, color: ACCENT })],
  });
}

function spacer(lines = 1) {
  return Array.from({ length: lines }, () => new Paragraph({ children: [] }));
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function kpiCell(label: string, value: string, subtitle?: string) {
  return new TableCell({
    margins: { top: 200, bottom: 200, left: 200, right: 200 },
    shading: { type: ShadingType.CLEAR, color: "auto", fill: "F8F9FB" },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: label.toUpperCase(), size: 16, color: MUTED, bold: true })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: value, size: 48, color: ACCENT, bold: true })],
      }),
      ...(subtitle
        ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: subtitle, size: 16, color: MUTED })],
            }),
          ]
        : []),
    ],
  });
}

function kpiGrid(cells: Array<{ label: string; value: string; subtitle?: string }>) {
  const rows: TableRow[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    const pair = cells.slice(i, i + 2);
    const tableRow = new TableRow({
      children: pair.map((c) => kpiCell(c.label, c.value, c.subtitle)),
    });
    rows.push(tableRow);
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "auto" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
      left: { style: BorderStyle.NONE, size: 0, color: "auto" },
      right: { style: BorderStyle.NONE, size: 0, color: "auto" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
    },
    rows,
  });
}

// ASCII-ish progress bar rendered as a TextRun (keeps it editable as plain
// text; if the admin wants a visual chart they can swap it for a real
// image inside Word).
function scoreBar(score: number, max: number, width = 20): string {
  const filled = Math.round((score / max) * width);
  return "█".repeat(Math.max(0, filled)) + "░".repeat(Math.max(0, width - filled));
}

// ─── Section: Portada ─────────────────────────────────────────────────

function sectionCover(data: PilotReportData, variant: Variant) {
  const range =
    data.pilot.scheduled_at && data.pilot.ended_at
      ? `${formatDateShort(data.pilot.scheduled_at)}  —  ${formatDateShort(data.pilot.ended_at)}`
      : "Fechas no registradas";
  return [
    ...spacer(6),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "INFORME DE EXPERIENCIA PILOTO", bold: true, color: ACCENT, size: 32 })],
    }),
    ...spacer(1),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: data.pilot.name, bold: true, size: 36 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: data.pilot.institution, size: 24 })],
    }),
    ...(data.pilot.country
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: data.pilot.country, size: 22, color: MUTED })],
          }),
        ]
      : []),
    ...spacer(2),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: range, size: 22, color: MUTED })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${data.kpis.total_students} estudiantes participantes`,
          size: 22,
          color: MUTED,
        }),
      ],
    }),
    ...spacer(6),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Generado el ${formatDateTime(data.generated_at)}`,
          size: 18,
          color: MUTED,
          italics: true,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: variant === "anonymous" ? "Versión anonimizada" : "Versión con nombres",
          size: 18,
          color: MUTED,
          italics: true,
        }),
      ],
    }),
    pageBreak(),
  ];
}

// ─── Section: Resumen ejecutivo ───────────────────────────────────────

function sectionExecutiveSummary() {
  return [
    heading("Resumen ejecutivo", HeadingLevel.HEADING_1),
    ...spacer(),
    heading("¿Qué es GlorIA?", HeadingLevel.HEADING_2),
    para(
      "GlorIA es una plataforma de entrenamiento clínico con inteligencia artificial, diseñada para que estudiantes de psicología practiquen entrevistas con pacientes virtuales y reciban retroalimentación inmediata sobre sus competencias terapéuticas.",
    ),
    para(
      "Inspirada en el caso Gloria (Shostrom, 1965), donde tres psicoterapeutas pioneros — Carl Rogers, Fritz Perls y Albert Ellis — compararon sus enfoques con una misma paciente, GlorIA extiende esa tradición al siglo XXI usando IA para ofrecer práctica clínica segura, sin riesgo para personas reales.",
    ),
    ...spacer(),
    heading("Marco teórico de evaluación", HeadingLevel.HEADING_2),
    para(
      "Las 10 competencias evaluadas provienen del Manual de Evaluación de Competencias Psicoterapéuticas de Valdés & Gómez (2023), Universidad Santo Tomás, organizadas en dos dominios: Estructura de la sesión y Actitudes terapéuticas.",
    ),
    ...spacer(),
    heading("Objetivos del piloto", HeadingLevel.HEADING_2),
    new Paragraph({
      bullet: { level: 0 },
      children: [new TextRun("Validar la usabilidad de la plataforma en un entorno formativo real.")],
    }),
    new Paragraph({
      bullet: { level: 0 },
      children: [new TextRun("Medir el desarrollo de competencias clínicas a través de práctica con IA.")],
    }),
    new Paragraph({
      bullet: { level: 0 },
      children: [new TextRun("Recoger retroalimentación estructurada sobre el producto.")],
    }),
    new Paragraph({
      bullet: { level: 0 },
      children: [new TextRun("Evaluar la pertinencia para integración curricular.")],
    }),
    pageBreak(),
  ];
}

// ─── Section: KPIs ────────────────────────────────────────────────────

function sectionKPIs(data: PilotReportData) {
  const k = data.kpis;
  const cells: Array<{ label: string; value: string; subtitle?: string }> = [
    { label: "Participantes", value: String(k.total_students), subtitle: "estudiantes invitados" },
    {
      label: "Tasa de conexión",
      value: `${Math.round(k.connection_rate * 100)}%`,
      subtitle: `${k.total_connected} de ${k.total_invited} ingresaron`,
    },
    {
      label: "Sesiones completadas",
      value: String(k.completed_sessions),
      subtitle: `${k.total_sessions} totales`,
    },
    {
      label: "Tiempo promedio por sesión",
      value: formatDuration(k.avg_seconds_per_session),
      subtitle: "duración activa",
    },
    {
      label: "Sesiones evaluadas",
      value: String(k.total_evaluated_sessions),
      subtitle: "con retroalimentación IA",
    },
    {
      label: "Puntaje general",
      value: k.pilot_overall_avg > 0 ? `${k.pilot_overall_avg.toFixed(1)} / 4` : "—",
      subtitle: "promedio de competencias",
    },
    {
      label: "Encuestas respondidas",
      value:
        k.total_students > 0
          ? `${k.survey_responses_count} / ${k.total_students}`
          : String(k.survey_responses_count),
      subtitle:
        k.total_students > 0
          ? `${Math.round((k.survey_responses_count / k.total_students) * 100)}% de respuesta`
          : undefined,
    },
    {
      label: "Estado del piloto",
      value: k.pilot_overall_avg > 0 ? "Activo con evaluación" : "Sin evaluaciones aún",
    },
  ];
  return [
    heading("Indicadores clave", HeadingLevel.HEADING_1),
    ...spacer(),
    kpiGrid(cells),
    pageBreak(),
  ];
}

// ─── Section: Competencies with definitions ───────────────────────────

function sectionCompetencies(data: PilotReportData) {
  const blocks: Paragraph[] = [
    heading("Competencias clínicas", HeadingLevel.HEADING_1),
    new Paragraph({
      children: [
        new TextRun({
          text: "Promedios calculados sobre las sesiones evaluadas (escala 0–4). Cada competencia incluye su definición teórica según Valdés & Gómez (2023).",
          italics: true,
          color: MUTED,
          size: 20,
        }),
      ],
    }),
    ...spacer(),
  ];

  const byDomain: Record<string, CompetencyKey[]> = { estructura: [], actitudes: [] };
  for (const k of COMPETENCY_KEYS) {
    byDomain[data.competency_info[k].domain].push(k);
  }
  const domainTitle: Record<string, string> = {
    estructura: "Estructura de la sesión",
    actitudes: "Actitudes terapéuticas",
  };

  let idx = 1;
  for (const domain of ["estructura", "actitudes"] as const) {
    blocks.push(heading(domainTitle[domain], HeadingLevel.HEADING_2));
    for (const key of byDomain[domain]) {
      const info = data.competency_info[key];
      const avg = data.competency_averages[key].avg;
      const n = data.competency_averages[key].count;
      blocks.push(
        new Paragraph({
          spacing: { before: 200 },
          children: [
            new TextRun({ text: `${idx}. ${info.name}`, bold: true, size: 24 }),
            new TextRun({
              text: `    ${avg > 0 ? avg.toFixed(1) + " / 4" : "sin datos"}`,
              color: avg >= 3 ? "16A34A" : avg >= 2 ? "D97706" : avg > 0 ? "DC2626" : MUTED,
              bold: true,
              size: 24,
            }),
          ],
        }),
      );
      if (avg > 0) {
        blocks.push(
          new Paragraph({
            children: [
              new TextRun({ text: scoreBar(avg, 4, 25), color: avg >= 3 ? "16A34A" : avg >= 2 ? "D97706" : "DC2626", font: "Consolas" }),
              new TextRun({ text: `   (${n} sesiones)`, color: MUTED, size: 18 }),
            ],
          }),
        );
      }
      blocks.push(
        new Paragraph({
          children: [new TextRun({ text: info.definition, size: 20 })],
        }),
      );
      idx++;
    }
  }

  // Top fortalezas / áreas
  if (data.top_strengths.length > 0 || data.top_areas.length > 0) {
    blocks.push(...spacer());
    blocks.push(heading("Fortalezas y áreas más citadas por la evaluación IA", HeadingLevel.HEADING_2));
  }
  if (data.top_strengths.length > 0) {
    blocks.push(para("Fortalezas recurrentes:", { bold: true }));
    for (const s of data.top_strengths) {
      blocks.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun(`${s.text}  (${s.count} menciones)`)],
        }),
      );
    }
  }
  if (data.top_areas.length > 0) {
    blocks.push(para("Áreas de mejora recurrentes:", { bold: true }));
    for (const a of data.top_areas) {
      blocks.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun(`${a.text}  (${a.count} menciones)`)],
        }),
      );
    }
  }

  blocks.push(
    new Paragraph({
      spacing: { before: 300 },
      children: [
        new TextRun({
          text: "Valdés, A., & Gómez, P. (2023). Manual de Evaluación de Competencias Psicoterapéuticas. Universidad Santo Tomás.",
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

// ─── Section: Survey (likert) ─────────────────────────────────────────

function sectionSurvey(data: PilotReportData) {
  const blocks: Paragraph[] = [
    heading("Encuesta de satisfacción", HeadingLevel.HEADING_1),
    new Paragraph({
      children: [
        new TextRun({
          text: `n = ${data.survey.n} respuestas de ${data.kpis.total_students} estudiantes invitados (${data.kpis.total_students > 0 ? Math.round((data.survey.n / data.kpis.total_students) * 100) : 0}% de respuesta).`,
          italics: true,
          color: MUTED,
          size: 20,
        }),
      ],
    }),
  ];
  if (data.survey.n === 0) {
    blocks.push(
      para("Aún no hay respuestas registradas. Esta sección se completará cuando los estudiantes respondan la encuesta.", { color: MUTED }),
    );
    blocks.push(pageBreak());
    return blocks;
  }

  const sectionKeys = ["q7_usabilidad", "q8_realismo", "q9_pertinencia", "q10_diseno", "q11_satisfaccion"] as const;
  for (const k of sectionKeys) {
    const section = data.survey.likert[k];
    blocks.push(...spacer());
    blocks.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun({ text: V2_SECTION_LABELS[k], bold: true, color: ACCENT }),
          new TextRun({
            text: `     ${section.overall > 0 ? section.overall.toFixed(1) + " / 5" : "—"}`,
            bold: true,
            color: section.overall >= 4 ? "16A34A" : section.overall >= 3 ? "D97706" : section.overall > 0 ? "DC2626" : MUTED,
          }),
        ],
      }),
    );
    for (const [itemKey, label] of Object.entries(V2_ITEM_LABELS[k])) {
      const val = section.items[itemKey] || 0;
      blocks.push(
        new Paragraph({
          children: [
            new TextRun({ text: `  ${label.padEnd(40, " ")}`, font: "Consolas", size: 20 }),
            new TextRun({ text: `  ${scoreBar(val, 5, 15)}`, font: "Consolas", size: 20 }),
            new TextRun({ text: `  ${val > 0 ? val.toFixed(1) : "—"}`, font: "Consolas", size: 20 }),
          ],
        }),
      );
    }
  }
  blocks.push(pageBreak());
  return blocks;
}

// ─── Section: Testimonials ────────────────────────────────────────────

function sectionTestimonials(data: PilotReportData, variant: Variant, anonMap: Map<string, string>) {
  const blocks: Paragraph[] = [
    heading("Testimonios", HeadingLevel.HEADING_1),
    new Paragraph({
      children: [
        new TextRun({
          text:
            variant === "anonymous"
              ? "Respuestas abiertas anonimizadas — los nombres han sido reemplazados por identificadores (P-001, P-002, ...)."
              : "Respuestas abiertas con nombre completo del autor.",
          italics: true,
          color: MUTED,
          size: 20,
        }),
      ],
    }),
  ];
  if (data.survey.n === 0) {
    blocks.push(para("Aún no hay testimonios. Esta sección se completará cuando los estudiantes respondan la encuesta.", { color: MUTED }));
    blocks.push(pageBreak());
    return blocks;
  }
  const keys = ["q12_mas_gusto", "q13_menos_gusto", "q14_cambio", "q15_incomodidad", "q16_comentarios"] as const;
  for (const k of keys) {
    const items = data.testimonials[k];
    if (items.length === 0) continue;
    blocks.push(...spacer());
    blocks.push(heading(TESTIMONIAL_LABELS[k], HeadingLevel.HEADING_2));
    for (const t of items) {
      const attribution =
        variant === "anonymous" ? anonMap.get(t.user_id) || "Estudiante" : t.full_name;
      blocks.push(
        new Paragraph({
          spacing: { before: 150 },
          indent: { left: 400 },
          children: [new TextRun({ text: `“${t.text}”`, italics: true, size: 22 })],
        }),
      );
      blocks.push(
        new Paragraph({
          indent: { left: 400 },
          children: [new TextRun({ text: `— ${attribution}`, color: MUTED, size: 18 })],
        }),
      );
    }
  }
  blocks.push(pageBreak());
  return blocks;
}

// ─── Section: Annex — participant list ────────────────────────────────

function sectionAnnex(data: PilotReportData, variant: Variant, anonMap: Map<string, string>) {
  const header = new TableRow({
    tableHeader: true,
    children: ["#", "Nombre", "Rol", "Primera sesión", "Última actividad", "Sesiones", "Encuesta"].map(
      (h) =>
        new TableCell({
          shading: { type: ShadingType.CLEAR, color: "auto", fill: "E5E7EB" },
          children: [
            new Paragraph({
              children: [new TextRun({ text: h, bold: true, size: 18 })],
            }),
          ],
        }),
    ),
  });
  const rows = data.students.map((s, i) => {
    const name =
      variant === "anonymous" && s.role === "student"
        ? anonMap.get(s.id) || "—"
        : s.full_name;
    return new TableRow({
      children: [
        new TableCell({ children: [para(String(i + 1), { size: 18 })] }),
        new TableCell({ children: [para(name, { size: 18 })] }),
        new TableCell({ children: [para(s.role === "student" ? "Estudiante" : "Docente", { size: 18 })] }),
        new TableCell({ children: [para(formatDateShort(s.first_login_at), { size: 18 })] }),
        new TableCell({ children: [para(formatDateShort(s.last_active_at), { size: 18 })] }),
        new TableCell({ children: [para(String(s.total_sessions), { size: 18 })] }),
        new TableCell({ children: [para(s.responded_survey ? "Sí" : "—", { size: 18 })] }),
      ],
    });
  });
  return [
    heading("Anexo: Participantes", HeadingLevel.HEADING_1),
    new Paragraph({
      children: [
        new TextRun({
          text:
            variant === "anonymous"
              ? "Lista anonimizada — los nombres de estudiantes han sido reemplazados por identificadores."
              : "Lista completa de participantes con datos de actividad.",
          italics: true,
          color: MUTED,
          size: 20,
        }),
      ],
    }),
    ...spacer(),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: BAR_GRAY },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: BAR_GRAY },
        left: { style: BorderStyle.SINGLE, size: 4, color: BAR_GRAY },
        right: { style: BorderStyle.SINGLE, size: 4, color: BAR_GRAY },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: BAR_GRAY },
        insideVertical: { style: BorderStyle.SINGLE, size: 2, color: BAR_GRAY },
      },
      rows: [header, ...rows],
    }),
    ...spacer(2),
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
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "GlorIA 5.0 · reporte generado automáticamente",
          italics: true,
          color: MUTED,
          size: 18,
        }),
      ],
    }),
  ];
}

// ─── Public entrypoint ────────────────────────────────────────────────

export async function generatePilotDocx(
  data: PilotReportData,
  variant: Variant,
): Promise<Buffer> {
  // Assign anonymised IDs deterministically in the order students appear.
  const anonMap = new Map<string, string>();
  let counter = 1;
  for (const s of data.students) {
    if (s.role === "student") {
      anonMap.set(s.id, `P-${String(counter).padStart(3, "0")}`);
      // Also key by user_id so testimonials (which carry user_id not
      // participant_id) can resolve the same alias.
      counter++;
    }
  }
  // Reconcile: anonMap for testimonials is keyed by user_id, not participant id.
  // Build a parallel map keyed by user_id for testimonials.
  const anonByUserId = new Map<string, string>();
  let c2 = 1;
  for (const s of data.students) {
    if (s.role === "student") {
      // Find user_id from students list — we stored only participant id earlier,
      // but data.students entries map directly to participants by construction.
      // The user_id isn't on students; re-derive via survey testimonials' user_id
      // ↔ full_name pairing is unreliable. Safest: keep map by full_name.
      anonByUserId.set(s.full_name, `P-${String(c2).padStart(3, "0")}`);
      c2++;
    }
  }
  // For testimonials we actually have user_id in the raw record. Build a
  // direct user_id→alias map from testimonials themselves, in order of first
  // appearance, to guarantee stable labelling even when the annex order
  // differs from testimonial order.
  const seenUserIds = new Set<string>();
  const testimonialAnonMap = new Map<string, string>();
  let c3 = 1;
  const allTestimonials = [
    ...data.testimonials.q12_mas_gusto,
    ...data.testimonials.q13_menos_gusto,
    ...data.testimonials.q14_cambio,
    ...data.testimonials.q15_incomodidad,
    ...data.testimonials.q16_comentarios,
  ];
  for (const t of allTestimonials) {
    if (!seenUserIds.has(t.user_id)) {
      seenUserIds.add(t.user_id);
      testimonialAnonMap.set(t.user_id, `P-${String(c3).padStart(3, "0")}`);
      c3++;
    }
  }

  const doc = new Document({
    creator: "GlorIA",
    title: `Informe ${data.pilot.name}`,
    description: `Informe del piloto ${data.pilot.name} — ${data.pilot.institution}`,
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } },
        },
        children: [
          ...sectionCover(data, variant),
          ...sectionExecutiveSummary(),
          ...sectionKPIs(data),
          ...sectionCompetencies(data),
          ...sectionSurvey(data),
          ...sectionTestimonials(data, variant, testimonialAnonMap),
          ...sectionAnnex(data, variant, anonMap),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
