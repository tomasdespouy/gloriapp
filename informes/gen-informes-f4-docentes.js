/**
 * Genera 3 informes clínicos en formato docente, uno por nivel de estudiante
 * (Básico / Medio / Avanzado), basados en las conversaciones de F4 con
 * Diego Fuentes. Cada informe contiene la transcripción completa y la
 * evaluación comparativa V3 actual + PECT-extendido lado a lado por
 * competencia.
 *
 * Solo copia local. NO se sube a supradmin.
 *
 * Inputs: C:/tmp/projection/{conversation,eval-v3,eval-pect}-{level}.json
 * Outputs: informes/desarrollo/F4-sesion-docente-{level}.docx
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
const STUDENT_BG = "E8EAF6";
const PATIENT_BG = "FFF8E1";
const NV_GREY = "9E9E9E";

const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };
const PAGE_W = 12240, MARGIN = 1080;
const CONTENT_W = PAGE_W - 2 * MARGIN;

// ─── Mapeos de nombres y escalas ────────────────────────────────────
const COMP_LABELS_V3 = {
  setting_terapeutico:    "Setting terapéutico",
  motivo_consulta:        "Motivo de consulta",
  datos_contextuales:     "Datos contextuales",
  objetivos:              "Objetivos",
  escucha_activa:         "Escucha activa",
  actitud_no_valorativa:  "Actitud no valorativa",
  optimismo:              "Optimismo terapéutico",
  presencia:              "Presencia (aquí y ahora)",
  conducta_no_verbal:     "Conducta no verbal",
  contencion_afectos:     "Contención de afectos",
};

const PECT_LABELS = {
  setting_comunicado:    "Comunicar y mantener el setting",
  setting_modificado:    "Modificar el setting de ser necesario",
  motivo_consulta:       "Identificar el motivo de consulta",
  datos_contextuales:    "Considerar datos contextuales del paciente",
  objetivos:             "Acordar objetivos con el paciente",
  plan_de_trabajo:       "Diseñar y comunicar un plan de trabajo",
  modifica_tareas_metas: "Modificar tareas y metas de ser necesario",
  cierre:                "Realizar un adecuado cierre",
  escucha_activa:        "Mostrar escucha activa",
  actitud_no_valorativa: "Mostrar actitud no valorativa",
  optimismo:             "Mostrar optimismo al paciente",
  presencia:             "Estar presente (aquí y ahora)",
  conducta_no_verbal:    "Atender la conducta no verbal",
  contencion_afectos:    "Contener los afectos del paciente",
  curiosidad_cordialidad:"Mostrar curiosidad, cordialidad y sensibilidad",
  espontaneidad:         "Mostrar espontaneidad en la sesión",
  manejo_silencios:      "Manejar los silencios del paciente",
  actitud_etica:         "Demostrar actitud ética",
  timing:                "Intervenir en el momento oportuno (timing)",
  desarrollo_vinculo:    "Realizar acciones para desarrollar el vínculo",
  identifica_tensiones:  "Identificar tensiones en el vínculo",
  repara_tensiones:      "Intentar reparar tensiones en el vínculo",
  monitoreo_avance:      "Monitorear y dar cuenta del avance terapéutico",
  explorar_contenidos:   "Realizar exploración de contenidos",
  sintonia_paciente:     "Mostrar sintonía con el paciente",
  apoyar:                "Ofrecer apoyo al paciente",
  resignificar:          "Facilitar la resignificación de contenidos",
};

const TECH_LABELS = {
  tec_argumentacion:   "Argumentación",
  tec_autorrevelacion: "Autorrevelación",
  tec_clarificacion:   "Clarificación",
  tec_confrontacion:   "Confrontación",
  tec_consejo:         "Consejo",
  tec_focalizacion:    "Focalización",
  tec_imaginacion:     "Imaginación",
  tec_informacion:     "Información (psicoeducación)",
  tec_interpretacion:  "Interpretación",
  tec_metafora:        "Metáfora",
  tec_paradoja:        "Paradoja",
  tec_parafrasis:      "Paráfrasis",
  tec_reflejo:         "Reflejo",
  tec_refuerzo:        "Refuerzo",
  tec_resumen:         "Resumen",
  tec_role_playing:    "Role playing",
  tec_tareas:          "Asignación de tareas",
};

// Mapeo 1-a-1 V3 ↔ PECT-ext (todas las 10 V3 tienen su equivalente PECT)
const V3_TO_PECT = {
  setting_terapeutico: "setting_comunicado",
  motivo_consulta:     "motivo_consulta",
  datos_contextuales:  "datos_contextuales",
  objetivos:           "objetivos",
  escucha_activa:      "escucha_activa",
  actitud_no_valorativa:"actitud_no_valorativa",
  optimismo:           "optimismo",
  presencia:           "presencia",
  conducta_no_verbal:  "conducta_no_verbal",
  contencion_afectos:  "contencion_afectos",
};

const SECTION_LABELS = {
  estructura_terapeutica: "Estructura terapéutica",
  diseno_plan:            "Diseño y comunicación del plan",
  actitud_terapeuta:      "Actitud de la terapeuta",
  evaluacion_proceso:     "Evaluación del proceso",
  intervenciones:         "Tipos de intervención principales",
  tecnicas:               "Técnicas terapéuticas específicas",
};

const V3_LEVEL_LABEL = {
  null: "NA — No aplicaba",
  "0": "0 — Omitido (debió desplegarse y no se hizo)",
  "1": "1 — Deficiente",
  "2": "2 — Básico / parcial",
  "3": "3 — Adecuado",
  "4": "4 — Excelente / integrado",
};

const PECT_LEVEL_LABEL = {
  "0": "0 — No aplica",
  "1": "1 — Ausente",
  "2": "2 — Insuficiente",
  "3": "3 — Buena",
  "4": "4 — Excelente",
};

const LEVEL_INFO = {
  basico:    { display: "Básico",    color: "C77600", desc: "Pregunta cerrada, no refleja, juzga, da consejos prematuros, ignora lo no verbal." },
  medio:     { display: "Medio",     color: "4A55A2", desc: "Cubre lo básico, refleja contenido sin emoción, evita silencios, no detecta lo no verbal." },
  avanzado:  { display: "Avanzado",  color: "2E7D32", desc: "Integra dimensiones, usa silencios funcionales, refleja contenido+emoción, co-construye objetivos." },
};

// ─── Helpers de párrafo / tabla ──────────────────────────────────────
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
  children: [new TextRun({
    text, font: "Calibri", size: 21, color: opts.color || DARK,
    italics: !!opts.italic, bold: !!opts.bold,
  })],
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

// Bloque de cita (cita textual del estudiante)
const quote = (text, turn) => new Paragraph({
  spacing: { after: 80, before: 60 },
  indent: { left: 480, right: 240 },
  children: [
    new TextRun({ text: `Turno ${turn} — `, font: "Calibri", size: 19, color: INDIGO, bold: true }),
    new TextRun({ text: `«${text}»`, font: "Calibri", size: 20, color: DARK, italics: true }),
  ],
});

// Tabla genérica
function makeTable(headers, rows, colWidths, opts = {}) {
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
      const text = typeof cell === "string" ? cell : String(cell ?? "");
      return new TableCell({
        borders,
        width: { size: colWidths[ci], type: WidthType.DXA },
        shading: { fill: bg, type: ShadingType.CLEAR },
        margins: cellMargins,
        verticalAlign: "top",
        children: [new Paragraph({
          alignment: opts.center?.includes(ci) ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [new TextRun({ text, font: "Calibri", size: opts.fontSize || 18, color: DARK })],
        })],
      });
    }),
  }));
  return new Table({
    width: { size: colWidths.reduce((a,b)=>a+b,0), type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows],
  });
}

// Bloque de turno de transcripción
function turnBlock(turn, role, content) {
  const isStudent = role === "student";
  const label = isStudent ? "ESTUDIANTE" : "PACIENTE";
  const bg = isStudent ? STUDENT_BG : PATIENT_BG;
  const color = isStudent ? INDIGO : "8B6E00";

  // Separar contenido en partes verbales y no-verbales (entre corchetes)
  const parts = [];
  const regex = /(\[[^\]]+\])/g;
  let lastIdx = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: "verbal", text: content.slice(lastIdx, match.index) });
    }
    parts.push({ type: "nonverbal", text: match[1] });
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < content.length) {
    parts.push({ type: "verbal", text: content.slice(lastIdx) });
  }

  const runs = [
    new TextRun({ text: `T${String(turn).padStart(2, "0")} · ${label}: `, bold: true, color, font: "Calibri", size: 19 }),
    ...parts.map((p) => p.type === "nonverbal"
      ? new TextRun({ text: p.text, italics: true, color: NV_GREY, font: "Calibri", size: 19 })
      : new TextRun({ text: p.text, color: DARK, font: "Calibri", size: 19 })),
  ];

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [new TableRow({
      children: [new TableCell({
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.SINGLE, size: 12, color }, right: { style: BorderStyle.NONE } },
        width: { size: CONTENT_W, type: WidthType.DXA },
        shading: { fill: bg, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 160, right: 160 },
        children: [new Paragraph({ children: runs })],
      })],
    })],
  });
}

// ─── Construcción del documento por nivel ────────────────────────────
function buildDocForLevel(level) {
  const conv = JSON.parse(fs.readFileSync(`C:/tmp/projection/conversation-${level}.json`, "utf8"));
  const evalV3 = JSON.parse(fs.readFileSync(`C:/tmp/projection/eval-v3-${level}.json`, "utf8"));
  const evalPECT = JSON.parse(fs.readFileSync(`C:/tmp/projection/eval-pect-${level}.json`, "utf8"));

  const info = LEVEL_INFO[level];
  const v3 = evalV3.normalized;
  const pect = evalPECT.raw;

  // ─── 1. Encabezado y datos de la sesión ─────────────────────────
  const header = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [new TextRun({
        text: "Informe clínico de sesión — Proyección F4",
        color: INDIGO, bold: true, size: 18, font: "Calibri",
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [new TextRun({
        text: `Sesión con paciente IA Diego Fuentes — estudiante de nivel ${info.display}`,
        color: INDIGO, bold: true, size: 30, font: "Calibri",
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 100 },
      children: [new TextRun({
        text: "Evaluación comparada: motor V3 actual frente a evaluador PECT-extendido (44 ítems)",
        color: DARK, size: 22, font: "Calibri",
      })],
    }),
  ];

  // Tabla de datos administrativos
  const adminData = [
    ["Paciente", "Diego Fuentes — paciente IA, 19 años, chileno, motivo: malestar emocional difuso, dificultades en la universidad"],
    ["Estudiante (simulado)", `Perfil ${info.display}. ${info.desc}`],
    ["Fecha de la sesión", "18 de mayo de 2026"],
    ["Modalidad", "Chat de texto — sesión simulada con paciente IA"],
    ["Duración", `${conv.turns} turnos (~60 minutos equivalente)`],
    ["Evaluadores", "Motor V3 actual (gpt-4o, 10 competencias) + PECT-extendido (gpt-4o, 44 ítems · 6 dimensiones del libro Valdés & Gómez 2023)"],
    ["Promedio overall V3", `${v3.overall_score_v2.toFixed(2)} / 4,00`],
    ["Promedio overall PECT-ext", `${evalPECT.overall.toFixed(2)} / 4,00`],
    ["Brecha PECT − V3", `${(evalPECT.overall - v3.overall_score_v2).toFixed(2)} puntos`],
  ];

  // ─── 2. Transcripción ─────────────────────────────────────────
  const transcriptParas = [];
  let currentTurn = null;
  for (const t of conv.transcript) {
    if (t.turn !== currentTurn) {
      currentTurn = t.turn;
      if (t.turn > 1) transcriptParas.push(empty(40));
    }
    transcriptParas.push(turnBlock(t.turn, t.role, t.content));
    transcriptParas.push(empty(20));
  }

  // ─── 3. Evaluación comparada por competencia ───────────────────
  const compSections = [];
  for (const compKey of Object.keys(COMP_LABELS_V3)) {
    const pectKey = V3_TO_PECT[compKey];
    const v3Score = v3.scores[compKey];
    const pectScore = pect.scores[pectKey];
    const evidenceV3 = v3.evidence?.[compKey] || [];
    const evidencePECT = pect.evidence?.[pectKey] || "";

    const v3Label = v3Score === null ? V3_LEVEL_LABEL.null : V3_LEVEL_LABEL[String(v3Score)];
    const pectLabel = PECT_LEVEL_LABEL[String(pectScore)] || `${pectScore}`;
    const naJust = v3.na_justifications?.[compKey];

    compSections.push(h3(`${COMP_LABELS_V3[compKey]}`));

    // Tabla de scores
    compSections.push(makeTable(
      ["Evaluador", "Score", "Significado"],
      [
        ["Motor V3 actual", v3Score === null ? "NA" : String(v3Score), v3Label],
        ["PECT-extendido (libro)", String(pectScore), pectLabel],
      ],
      [3000, 1200, CONTENT_W - 3000 - 1200],
      { center: [1] },
    ));
    compSections.push(empty(80));

    // Justificación NA si aplica
    if (naJust) {
      compSections.push(small(`Justificación NA del motor V3: ${naJust}`, { italic: true }));
      compSections.push(empty(60));
    }

    // Evidencia V3 (citas estructuradas con turno + observación + polaridad)
    if (evidenceV3.length > 0) {
      compSections.push(body("Evidencia documentada por el motor V3:", { bold: true }));
      for (const ev of evidenceV3) {
        compSections.push(quote(ev.quote, ev.turn));
        const polarityLabel = ev.polarity === "fortaleza" ? "Fortaleza" : "Oportunidad de mejora";
        compSections.push(new Paragraph({
          spacing: { after: 80 },
          indent: { left: 480, right: 240 },
          children: [
            new TextRun({ text: `${polarityLabel}: `, bold: true, color: ev.polarity === "fortaleza" ? "2E7D32" : "C77600", font: "Calibri", size: 19 }),
            new TextRun({ text: ev.observation, font: "Calibri", size: 19, color: DARK }),
          ],
        }));
      }
    } else if (v3Score !== null) {
      compSections.push(small("El motor V3 asignó un puntaje numérico pero no devolvió citas textuales que lo justifiquen — bandera de calidad para esta sesión.", { italic: true }));
      compSections.push(empty(60));
    }

    // Cita PECT-ext (más breve)
    if (evidencePECT && evidencePECT.length > 0) {
      compSections.push(body("Cita usada por PECT-extendido:", { bold: true }));
      compSections.push(new Paragraph({
        spacing: { after: 100, before: 40 },
        indent: { left: 480, right: 240 },
        children: [new TextRun({ text: `«${evidencePECT}»`, font: "Calibri", size: 20, color: DARK, italics: true })],
      }));
    }

    // Lectura comparada (cuando hay divergencia)
    if (v3Score !== null && Math.abs(pectScore - v3Score) >= 1) {
      const dir = pectScore > v3Score ? "más alto" : "más bajo";
      const diff = Math.abs(pectScore - v3Score);
      compSections.push(small(`Lectura comparada: PECT-extendido asignó un puntaje ${dir} (${pectScore} vs ${v3Score}, diferencia ${diff} ${diff === 1 ? "punto" : "puntos"}). Esta divergencia puede deberse a la escala distinta o al criterio del evaluador.`, { italic: true }));
      compSections.push(empty(80));
    } else if (v3Score === null) {
      compSections.push(small(`Lectura comparada: el motor V3 marcó NA mientras que PECT-extendido sí asignó un puntaje (${pectScore}). Esta es una de las banderas amarillas identificadas en F4: el motor V3 tiende a usar NA como escape route en competencias como objetivos y optimismo.`, { italic: true }));
      compSections.push(empty(80));
    }

    compSections.push(empty(120));
  }

  // ─── 4. Dimensiones adicionales (V4 candidate) ──────────────────
  const extraItems = [];
  for (const [key, label] of Object.entries(PECT_LABELS)) {
    // Saltear las 10 ya cubiertas por V3
    if (Object.values(V3_TO_PECT).includes(key)) continue;
    const score = pect.scores[key];
    const evidence = pect.evidence?.[key] || "";
    extraItems.push([
      label,
      String(score),
      PECT_LEVEL_LABEL[String(score)] || `${score}`,
      evidence || "(sin cita)",
    ]);
  }

  // Técnicas
  const techItems = [];
  for (const [key, label] of Object.entries(TECH_LABELS)) {
    const score = pect.scores[key];
    if (score === undefined) continue;
    const evidence = pect.evidence?.[key] || "";
    techItems.push([
      label,
      String(score),
      PECT_LEVEL_LABEL[String(score)] || `${score}`,
      evidence || "(no se observó la técnica en esta sesión)",
    ]);
  }

  // ─── 5. Síntesis ──────────────────────────────────────────────
  const synthSection = [
    h1("4. Síntesis del docente"),

    h2("4.1 Promedio global"),
    makeTable(
      ["Evaluador", "Promedio overall", "Lectura"],
      [
        ["Motor V3 actual", v3.overall_score_v2.toFixed(2), v3.overall_score_v2 < 1.5 ? "Por debajo del nivel esperado" : v3.overall_score_v2 < 2.5 ? "Nivel intermedio con áreas a mejorar" : v3.overall_score_v2 < 3.5 ? "Nivel adecuado, con oportunidades de profundización" : "Nivel avanzado / integrado"],
        ["PECT-extendido", evalPECT.overall.toFixed(2), evalPECT.overall < 1.5 ? "Por debajo del nivel esperado" : evalPECT.overall < 2.5 ? "Nivel intermedio con áreas a mejorar" : evalPECT.overall < 3.5 ? "Nivel adecuado, con oportunidades de profundización" : "Nivel avanzado / integrado"],
      ],
      [3000, 2000, CONTENT_W - 3000 - 2000],
      { center: [1] },
    ),
    empty(),

    h2("4.2 Comentario del motor V3"),
    body(v3.commentary || "(sin comentario)"),

    h2("4.3 Comentario del PECT-extendido"),
    body(pect.commentary || "(sin comentario)"),

    h2("4.4 Fortalezas observadas (V3)"),
    ...(v3.strengths || []).map((s) => bullet(s)),

    h2("4.5 Áreas de mejora (V3)"),
    ...(v3.areas_to_improve || []).map((a) => bullet(a)),

    h2("4.6 Fortalezas observadas (PECT-extendido)"),
    ...(pect.strengths || []).map((s) => bullet(s)),

    h2("4.7 Áreas de mejora (PECT-extendido)"),
    ...(pect.areas_to_improve || []).map((a) => bullet(a)),
  ];

  // ─── 6. Promedios por sección PECT-ext ────────────────────────
  const sectStatsRows = Object.entries(evalPECT.section_stats || {}).map(([sec, st]) => [
    SECTION_LABELS[sec] || sec,
    String(st.total),
    String(st.na),
    String(st.count),
    st.avg !== undefined ? st.avg.toFixed(2) : "—",
  ]);

  // ─── 7. Nota metodológica ─────────────────────────────────────
  const methodNote = [
    h1("Nota metodológica"),
    body("Este informe documenta una sesión simulada generada dentro del experimento F4 (proyección empírica V3 vs PECT-extendido), con fines de validación interna del motor de retroalimentación de GlorIA. El estudiante NO es una persona real: es un agente conversacional (gpt-4o-mini, T=0,7) instruido para representar un perfil de pericia clínica determinado. El paciente Diego Fuentes es un paciente IA enriquecido (INF-2026-050 y tuning INF-2026-051) ejecutado en el ambiente de staging."),
    body("Los puntajes y comentarios provienen de dos evaluadores LLM corriendo en paralelo sobre la misma transcripción: el motor V3 actual de GlorIA (con su prompt y rúbrica de 10 competencias) y un evaluador PECT-extendido construido específicamente para F4, que cubre los 44 ítems evaluables vía chat del instrumento original de Valdés Sánchez & Gómez Gallo (2023). Ambos usan gpt-4o como modelo evaluador."),
    body("Limitaciones que conviene tener presente al leer este informe:"),
    bullet("N=1: una sola sesión, un solo paciente, un solo evaluador por enfoque. La concordancia inter-evaluador no se midió; convendría replicar con 2-3 corridas por nivel y promediar."),
    bullet("Estudiante simulado: un LLM imitando «estudiante avanzado» puede producir un avanzado arquetípico, más limpio que el real."),
    bullet("Las escalas V3 y PECT no son idénticas: V3 usa NA(null) + 0-4 (seis niveles), PECT usa 0-4 con 0=NA (cinco niveles). Las cifras de promedio no son directamente intercambiables, aunque la dirección de la señal sí lo es."),
    bullet("Las citas devueltas por el evaluador PECT-extendido son más breves que las del motor V3 (que requiere ≥2 citas por competencia). En algunos casos puede haber items sin cita aunque tengan puntaje numérico."),
    body("Fuentes y trazabilidad: INF-2026-054 (análisis crítico motor V3 vs PECT, Anexo B con resultados F4). Script de simulación, evaluación y análisis en scripts/research/projection-f4/* (rama feat/empirical-projection-f4). Artefactos crudos del experimento en C:/tmp/projection/ (no commiteado por contener identificadores del paciente IA en staging)."),
  ];

  // ─── 8. Ensamblaje del contenido ──────────────────────────────
  const content = [
    ...header,
    h1("1. Datos de la sesión"),
    makeTable(
      ["Campo", "Valor"],
      adminData,
      [3000, CONTENT_W - 3000],
      { fontSize: 18 },
    ),
    empty(),

    h1("2. Transcripción completa"),
    body("Se transcriben los 25 turnos en orden secuencial. El texto entre corchetes («[ ]») corresponde a conducta no verbal del paciente IA (gestos, mirada, postura) tal como fueron generados por el modelo durante la simulación.", { italic: true }),
    empty(),
    ...transcriptParas,

    h1("3. Evaluación comparada por competencia"),
    body("Para cada una de las 10 competencias evaluadas por el motor V3 actual, se presenta el puntaje paralelo del evaluador PECT-extendido junto con la cita textual y observación que cada uno usó como justificación. Esto permite observar dónde V3 y la pauta original coinciden y dónde divergen."),
    empty(),
    ...compSections,

    h1("Anexo I — Dimensiones adicionales evaluadas por PECT-extendido"),
    body("Estas son competencias que el instrumento PECT incluye y que el motor V3 no cubre. Aparecen en F4 como candidatas a incorporar en V4."),
    h2("Sección 2 — Diseño y comunicación del plan (extras)"),
    makeTable(
      ["Competencia", "Score", "Significado", "Cita / Observación"],
      extraItems.filter((r) => ["Diseñar y comunicar un plan de trabajo", "Modificar tareas y metas de ser necesario", "Realizar un adecuado cierre"].includes(r[0])),
      [3600, 800, 2000, CONTENT_W - 3600 - 800 - 2000],
      { center: [1], fontSize: 17 },
    ),
    empty(),
    h2("Sección 1 — Estructura terapéutica (extras)"),
    makeTable(
      ["Competencia", "Score", "Significado", "Cita / Observación"],
      extraItems.filter((r) => r[0].startsWith("Modificar el setting")),
      [3600, 800, 2000, CONTENT_W - 3600 - 800 - 2000],
      { center: [1], fontSize: 17 },
    ),
    empty(),
    h2("Sección 3 — Actitud de la terapeuta (extras)"),
    makeTable(
      ["Competencia", "Score", "Significado", "Cita / Observación"],
      extraItems.filter((r) => ["Mostrar curiosidad, cordialidad y sensibilidad", "Mostrar espontaneidad en la sesión", "Manejar los silencios del paciente", "Demostrar actitud ética"].includes(r[0])),
      [3600, 800, 2000, CONTENT_W - 3600 - 800 - 2000],
      { center: [1], fontSize: 17 },
    ),
    empty(),
    h2("Sección 6 — Evaluación del proceso"),
    makeTable(
      ["Competencia", "Score", "Significado", "Cita / Observación"],
      extraItems.filter((r) => ["Intervenir en el momento oportuno (timing)", "Realizar acciones para desarrollar el vínculo", "Identificar tensiones en el vínculo", "Intentar reparar tensiones en el vínculo", "Monitorear y dar cuenta del avance terapéutico"].includes(r[0])),
      [3600, 800, 2000, CONTENT_W - 3600 - 800 - 2000],
      { center: [1], fontSize: 17 },
    ),
    empty(),
    h2("Sección 7 — Tipos de intervención principales"),
    makeTable(
      ["Competencia", "Score", "Significado", "Cita / Observación"],
      extraItems.filter((r) => ["Realizar exploración de contenidos", "Mostrar sintonía con el paciente", "Ofrecer apoyo al paciente", "Facilitar la resignificación de contenidos"].includes(r[0])),
      [3600, 800, 2000, CONTENT_W - 3600 - 800 - 2000],
      { center: [1], fontSize: 17 },
    ),
    empty(),

    h1("Anexo II — Técnicas terapéuticas específicas (17 del libro)"),
    body("El PECT enumera 17 técnicas terapéuticas concretas en su sección 7. F4 mostró que 6 de ellas concentran la mayor capacidad discriminadora entre niveles de pericia (paráfrasis, reflejo, focalización, clarificación, argumentación, asignación de tareas). Las otras 11 mostraron uso bajo o nulo en el experimento, lo cual es información en sí mismo."),
    empty(),
    makeTable(
      ["Técnica", "Score", "Significado", "Cita / Observación"],
      techItems,
      [2600, 800, 2000, CONTENT_W - 2600 - 800 - 2000],
      { center: [1], fontSize: 17 },
    ),
    empty(),

    h1("Anexo III — Promedios por sección del PECT"),
    makeTable(
      ["Sección del libro", "Total ítems", "Marcados NA", "Evaluados", "Promedio"],
      sectStatsRows,
      [3800, 1300, 1500, 1400, CONTENT_W - 3800 - 1300 - 1500 - 1400],
      { center: [1, 2, 3, 4], fontSize: 17 },
    ),
    empty(),

    ...synthSection,

    ...methodNote,
  ];

  // ─── 9. Header / Footer del documento ─────────────────────────
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
        new TextRun({ text: `GlorIA — F4 sesión docente · Nivel ${info.display} · Página `, size: 18, font: "Calibri", color: GREY }),
        new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Calibri", color: GREY }),
        new TextRun({ text: " de ", size: 18, font: "Calibri", color: GREY }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Calibri", color: GREY }),
      ],
    })],
  });

  return new Document({
    creator: "GlorIA",
    title: `F4 — Sesión docente nivel ${info.display}`,
    description: `Informe clínico de la sesión simulada del experimento F4, nivel ${info.display}. Evaluación comparada V3 vs PECT-extendido sobre Diego Fuentes.`,
    styles: { default: { document: { run: { font: "Calibri", size: 21 } } } },
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
}

// ─── Ejecución ──────────────────────────────────────────────────────
(async () => {
  for (const level of ["basico", "medio", "avanzado"]) {
    const doc = buildDocForLevel(level);
    const buf = await Packer.toBuffer(doc);
    const out = `informes/desarrollo/F4-sesion-docente-${level}.docx`;
    fs.writeFileSync(out, buf);
    console.log(`OK -> ${out}  (${(buf.length / 1024).toFixed(1)} KB)`);
  }
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
