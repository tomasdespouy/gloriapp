/**
 * INF-2026-055 .docx — Diseño técnico V4 del motor de retroalimentación
 * de GlorIA, basado en la evidencia empírica F4 (INF-054, Anexo B).
 *
 * Solo copia local. NO subir a supradmin sin validación clínica previa.
 *
 * Fuente: docs/design-v4-feedback-engine.md (rama feat/v4-design).
 */
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber,
} = require("docx");

const gloriaLogo = fs.readFileSync("public/branding/gloria-logo.png");

const INDIGO = "4A55A2", DARK = "1A1A1A", LIGHT_BG = "F0F2FA";
const WHITE = "FFFFFF", GREY = "666666", BORDER = "CCCCCC";
const CODE_BG = "F5F5F5";

const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };
const PAGE_W = 12240, MARGIN = 1080;
const CONTENT_W = PAGE_W - 2 * MARGIN;

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

// Bloque de código pre-formateado (monoespaciado con fondo gris)
const codeBlock = (lines, lang) => {
  const codeLines = Array.isArray(lines) ? lines : lines.split("\n");
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [new TableRow({
      children: [new TableCell({
        borders,
        width: { size: CONTENT_W, type: WidthType.DXA },
        shading: { fill: CODE_BG, type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 180, right: 180 },
        children: [
          ...(lang ? [new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({ text: lang, font: "Consolas", size: 16, color: GREY, italics: true })],
          })] : []),
          ...codeLines.map((line) => new Paragraph({
            spacing: { after: 20 },
            children: [new TextRun({ text: line || " ", font: "Consolas", size: 17, color: DARK })],
          })),
        ],
      })],
    })],
  });
};

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
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows],
  });
}

// ─── DATOS ──────────────────────────────────────────────────────────

const RESUMEN_CAMBIOS = [
  ["1. Expandir cobertura de 10 a 35 ítems observables vía chat (de 6 dimensiones del libro)", "Bandera roja 1: subcobertura del PECT (V3 cubre ~22 %)."],
  ["2. Incorporar dimensión de Técnicas (sección 7) con 6 técnicas de alta señal", "Bandera naranja: Δ=+2 en técnicas entre Básico y Avanzado, ignoradas por V3."],
  ["3. Anclas conductuales fieles al Cap. 2 del libro + glosa GlorIA", "Bandera roja 2: anclas V3 inventadas, no diferenciables Medio/Avanzado."],
  ["4. Reglas anti-NA estrictas por competencia y contexto de sesión", "Bandera amarilla: objetivos/optimismo recibieron NA sistemáticamente."],
  ["5. Evaluador en cascada (pasada PECT-ext → agregado UI)", "Mantiene UI manejable sin sacrificar granularidad evaluativa."],
  ["6. Schema retrocompatible — V3 sigue funcionando, V4 vive en columnas nuevas", "Migración progresiva sin romper sesiones históricas."],
];

const COBERTURA_V3_V4 = [
  ["1. Estructura terapéutica", "7", "5", "4", "5", "Agrega modifica_setting. Excluye consentimientos_informados y elementos_institucionales (fuera del flujo de chat)."],
  ["2. Diseño y comunicación del plan", "5", "3", "0", "3", "Agrega plan_de_trabajo, modifica_tareas_metas, cierre. F4 muestra Δ=+1 entre Básico y Avanzado. Excluye derivaciones e informes."],
  ["3. Actitud de la terapeuta", "10", "10", "6", "10", "Agrega curiosidad_cordialidad, espontaneidad, manejo_silencios, actitud_etica. F4 muestra Δ=+2 en curiosidad y silencios."],
  ["4. Características de la terapeuta", "8", "0", "0", "0", "Excluida por completo. Requiere observación presencial. No observable en chat."],
  ["5. Conceptualización del caso", "5", "0", "0", "0", "Excluida por completo. El libro indica supervisión escrita/oral."],
  ["6. Evaluación del proceso", "6", "5", "0", "5", "Agrega timing, desarrollo_vinculo, identifica_tensiones, repara_tensiones, monitoreo_avance. F4 muestra Δ=+2 en identifica_tensiones."],
  ["7. Tipos de intervención y técnicas", "5 + 17", "4 + 6", "0", "4 + 6", "Agrega 4 intervenciones principales y 6 técnicas con señal F4: paráfrasis, reflejo, focalización, clarificación, argumentación, asignación de tareas."],
  ["TOTAL", "46 + 17", "35", "10 (22 %)", "35 (76 %) + 6 técnicas", ""],
];

const DOMINIOS_UI_V4 = [
  ["Estructura y plan", "1 + 2", "8 (5 + 3)", "Púrpura"],
  ["Actitudes terapéuticas", "3", "10", "Índigo"],
  ["Proceso y vínculo", "6", "5", "Cian"],
  ["Intervenciones y técnicas", "7 (principales + 6 técnicas)", "4 + 6", "Ámbar"],
];

const REGLAS_ANTI_NA = [
  ["setting_comunicado", "Sólo si sesión 2+ y no hay quiebre de encuadre.", "Primera sesión SIEMPRE evaluable (NA prohibido)."],
  ["motivo_consulta", "Sólo si sesión 2+ y no emerge nuevo motivo.", "Primera sesión SIEMPRE evaluable."],
  ["datos_contextuales", "Sólo si sesión 2+ y la red contextual ya está mapeada.", "Primera sesión SIEMPRE evaluable."],
  ["objetivos", "Sólo si la sesión fue exploración inicial Y duración < 20 min.", "Si la sesión > 30 min y aún no se abrieron objetivos → 0 (omitido), NO NA."],
  ["optimismo", "Sólo si hubo crisis aguda, duelo intenso o ideación suicida.", "Si la sesión transcurrió «normal», optimismo NO es NA."],
  ["manejo_silencios", "Sólo si el paciente no produjo silencios significativos.", "Si hubo silencios > 5 s y el estudiante los ignoró → 1, NO NA."],
  ["actitud_etica", "Casi nunca NA.", "Cualquier sesión ofrece oportunidades éticas mínimas."],
  ["repara_tensiones", "NA si nunca se detectó tensión.", "Si se detectó tensión y no se intentó reparar → 0, NO NA."],
  ["monitoreo_avance", "NA en primera sesión.", "Sesión 2+ con avance ya pactado: evaluable."],
  ["Técnicas (genérico)", "NA permitido si el contexto no demandaba esa técnica.", "Si demandaba la técnica y NO se usó → 1, NO NA."],
];

const ROLLOUT_PLAN = [
  ["F5.1", "Implementación V4 en rama feat/v4-feedback-engine", "Tests unitarios + 1 sesión sintética", "PR review"],
  ["F5.2", "Despliegue a staging con feature flag FEEDBACK_ENGINE_V4=true", "Smoke test con 5 sesiones reales del piloto interno", "Approve por dueño técnico"],
  ["F5.3", "Activación gradual en PROD: 10 % del tráfico durante 1 semana", "Monitoreo de tasa de NA, distribución de scores, costo en tokens", "Dashboard de salud V4"],
  ["F5.4", "100 % en PROD", "Sesiones V4 corren en paralelo con V3 históricas", "—"],
  ["F6", "Validación con Escuela de Psicología UGM", "Sesión de revisión clínica con 3 docentes UGM + Nelson Valdés (UST si disponible)", "Ajustes finales antes de marcar V4 estable"],
];

const RIESGOS_TECNICOS = [
  ["Output del LLM alucina 52 scores", "Media", "Alta", "Validar shape; fallback a V3 si parseo falla; log de fallos."],
  ["Costo en tokens 2×", "Alta (cierto)", "Media", "Prompt caching ~40 %; dentro del presupuesto institucional."],
  ["Latencia aumentada (más output)", "Media", "Baja", "Stream del LLM; mostrar UI parcial mientras llega el resto."],
  ["LLM evalúa técnicas como NA en masa", "Media", "Alta", "Reglas anti-NA específicas para técnicas + post-procesamiento que detecta NA sistemático."],
];

const RIESGOS_PEDAGOGICOS = [
  ["Estudiante se siente sobre-evaluado", "Media", "Alta", "UI con detalle colapsado; radar V2 sigue siendo la imagen central."],
  ["Estudiante interpreta mal los nuevos ítems", "Alta", "Media", "Tooltips clínicos (CompetencyTooltip existente); validar lenguaje con UGM."],
  ["Docente sobrecarga al editar 52 scores", "Media", "Alta", "Vista del docente con scores LLM precargados; edición opcional, no requerida."],
];

const RIESGOS_CLINICOS = [
  ["LLM evalúa una técnica como adecuada cuando no lo es (falso positivo)", "Alta", "Media", "Evidencia textual obligatoria; el docente puede invalidar."],
  ["LLM no detecta riesgo clínico (suicidalidad, crisis)", "Baja", "Crítica", "V4 NO reemplaza el flujo de alertas de chat (chat_alerts cubre esto)."],
  ["Sobre-confianza en el score numérico", "Alta", "Alta", "UI muestra «evaluación automática preliminar — revisión docente recomendada»."],
];

const CROSSWALK = [
  ["setting_terapeutico", "setting_comunicado", "1", "+2", "Sí"],
  ["—", "setting_modificado", "1", "0", "No (solo BD)"],
  ["motivo_consulta", "motivo_consulta", "1", "+2", "Sí"],
  ["datos_contextuales", "datos_contextuales", "1", "+2", "Sí"],
  ["objetivos", "objetivos", "1", "+1", "Sí"],
  ["—", "plan_de_trabajo", "2", "+1", "No"],
  ["—", "modifica_tareas_metas", "2", "0", "No"],
  ["—", "cierre", "2", "+1", "No"],
  ["escucha_activa", "escucha_activa", "3", "+2", "Sí"],
  ["actitud_no_valorativa", "actitud_no_valorativa", "3", "+2", "Sí"],
  ["optimismo", "optimismo", "3", "+1", "Sí"],
  ["presencia", "presencia", "3", "+2", "Sí"],
  ["conducta_no_verbal", "conducta_no_verbal", "3", "+3", "Sí"],
  ["contencion_afectos", "contencion_afectos", "3", "+2", "Sí"],
  ["—", "curiosidad_cordialidad", "3", "+2", "No"],
  ["—", "espontaneidad", "3", "+1", "No"],
  ["—", "manejo_silencios", "3", "+2", "No"],
  ["—", "actitud_etica", "3", "+1", "No"],
  ["—", "timing", "6", "+1", "No"],
  ["—", "desarrollo_vinculo", "6", "+1", "No"],
  ["—", "identifica_tensiones", "6", "+2", "No"],
  ["—", "repara_tensiones", "6", "0", "No"],
  ["—", "monitoreo_avance", "6", "0", "No"],
  ["—", "explorar_contenidos", "7", "+2", "No"],
  ["—", "sintonia_paciente", "7", "+2", "No"],
  ["—", "apoyar", "7", "+2", "No"],
  ["—", "resignificar", "7", "+2", "No"],
  ["—", "tec_parafrasis", "7", "+2", "Bloque técnicas"],
  ["—", "tec_reflejo", "7", "+2", "Bloque técnicas"],
  ["—", "tec_focalizacion", "7", "+2", "Bloque técnicas"],
  ["—", "tec_clarificacion", "7", "+2", "Bloque técnicas"],
  ["—", "tec_argumentacion", "7", "+2", "Bloque técnicas"],
  ["—", "tec_tareas", "7", "+2", "Bloque técnicas"],
];

// SQL bloque
const SQL_MIGRACION = `-- Feedback Engine V4 — Schema additive
-- V4 expande la cobertura PECT de 10 a 35 ítems + 17 técnicas.
-- Mantiene session_competencies intacta (las 10 V2/V3 siguen vivas).

-- 1) Ítems PECT extendidos
CREATE TABLE IF NOT EXISTS public.session_pect_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id),
  item_key TEXT NOT NULL,
  section TEXT NOT NULL,
  score INTEGER,
  evidence JSONB DEFAULT '[]'::jsonb,
  na_justification TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (conversation_id, item_key)
);

-- 2) Técnicas terapéuticas (17 del libro, evaluadas todas)
CREATE TABLE IF NOT EXISTS public.session_techniques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id),
  technique_key TEXT NOT NULL,
  score INTEGER,
  evidence JSONB DEFAULT '[]'::jsonb,
  shown_to_student BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (conversation_id, technique_key)
);

-- 3) Dominios agregados (denormalizado para queries de dashboard)
ALTER TABLE public.session_competencies
  ADD COLUMN IF NOT EXISTS dominio_estructura_plan NUMERIC(3, 1),
  ADD COLUMN IF NOT EXISTS dominio_actitudes NUMERIC(3, 1),
  ADD COLUMN IF NOT EXISTS dominio_proceso_vinculo NUMERIC(3, 1),
  ADD COLUMN IF NOT EXISTS dominio_intervenciones NUMERIC(3, 1),
  ADD COLUMN IF NOT EXISTS overall_score_v4 NUMERIC(3, 1);`;

const JSON_OUTPUT = `{
  "scores": {
    "setting_comunicado": 3,
    "setting_modificado": "NA",
    "motivo_consulta": 3,
    "datos_contextuales": 2,
    "objetivos": 2,
    "plan_de_trabajo": 2,
    "cierre": 3,
    "escucha_activa": 3,
    "actitud_no_valorativa": 4,
    "optimismo": 3,
    "presencia": 3,
    "conducta_no_verbal": 3,
    "contencion_afectos": 3,
    "curiosidad_cordialidad": 3,
    "espontaneidad": 3,
    "manejo_silencios": 3,
    "actitud_etica": 4,
    "timing": 3,
    "desarrollo_vinculo": 3,
    "identifica_tensiones": 2,
    "explorar_contenidos": 3,
    "sintonia_paciente": 3,
    "apoyar": 3,
    "resignificar": 2,
    "tec_parafrasis": 3,
    "tec_reflejo": 3,
    "tec_focalizacion": 2,
    "tec_tareas": 2
  },
  "dominio_scores": {
    "estructura_plan": 2.6,
    "actitudes": 3.1,
    "proceso_vinculo": 2.5,
    "intervenciones": 2.8
  },
  "overall_score_v4": 2.75,
  "na_justifications": { "setting_modificado": "..." },
  "commentary": "...",
  "strengths": [...],
  "areas_to_improve": [...],
  "evidence": { "item_key": [...] }
}`;

const MOCKUP_UI = `┌────────────────────────────────────────────────┐
│  RADAR DE COMPETENCIAS (sin cambios)           │
│  [radar V2 con 10 ejes]                        │
└────────────────────────────────────────────────┘

▼ Detalle por dominio  (colapsado por defecto)

  ESTRUCTURA Y PLAN  ●●●○ 2.6/4
    Setting terapéutico:     3
    Motivo de consulta:      3
    Datos contextuales:      2
    Objetivos:               2
    Plan de trabajo:         2
    Cierre:                  3

  ACTITUDES TERAPÉUTICAS  ●●●● 3.1/4
    Escucha activa:          3
    Actitud no valorativa:   4
    Optimismo:               3
    Presencia:               3
    Conducta no verbal:      3
    Contención de afectos:   3
    Curiosidad/cordialidad:  3      ← nuevo V4
    Espontaneidad:           3      ← nuevo V4
    Manejo de silencios:     3      ← nuevo V4
    Actitud ética:           4      ← nuevo V4

  PROCESO Y VÍNCULO  ●●○○ 2.5/4   ← nuevo dominio V4
    Timing:                  3
    Desarrollo del vínculo:  3
    Identifica tensiones:    2
    Repara tensiones:        N/A
    Monitorea avance:        N/A

  INTERVENCIONES Y TÉCNICAS  ●●●○ 2.8/4   ← nuevo dominio V4
    Explorar contenidos:     3
    Sintonía con paciente:   3
    Ofrecer apoyo:           3
    Resignificación:         2

    Técnicas observadas:
      Paráfrasis:    3   "Entiendo que sientes..."
      Reflejo:       3   "Te veo desganado..."
      Focalización:  2   "Volvamos a lo que..."

▼ Lo que NO se evaluó automáticamente
  · Tu autocuidado y manejo de afectos propios
  · Tu conceptualización del caso
  · Tu apariencia y conducta no verbal de ti misma
  (se trabajan en supervisión presencial)`;

// ─── Header / Footer ───────────────────────────────────────────────
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
      new TextRun({ text: "GlorIA — INF-2026-055 — Página ", size: 18, font: "Calibri", color: GREY }),
      new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Calibri", color: GREY }),
      new TextRun({ text: " de ", size: 18, font: "Calibri", color: GREY }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Calibri", color: GREY }),
    ],
  })],
});

// ─── CONTENIDO ──────────────────────────────────────────────────────
const content = [
  // Encabezado
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 40 },
    children: [new TextRun({
      text: "INF-2026-055 · Diseño técnico-clínico",
      color: INDIGO, bold: true, size: 18, font: "Calibri",
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 40 },
    children: [new TextRun({
      text: "Diseño V4 del motor de retroalimentación de GlorIA",
      color: INDIGO, bold: true, size: 30, font: "Calibri",
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 100 },
    children: [new TextRun({
      text: "Expansión de cobertura PECT, anclas conductuales fieles y evaluador en cascada",
      color: DARK, size: 22, font: "Calibri",
    })],
  }),
  small("Fecha de elaboración: 18 de mayo de 2026 · Estado: borrador para revisión humana · Validación pendiente: Escuela de Psicología UGM (F6) · Distribución: copia local"),
  small("Base empírica: F4 — Proyección con 3 estudiantes × 3 niveles (INF-2026-054, Anexo B). Fuente clínica: Valdés Sánchez & Gómez Gallo (2023), Supervisión clínica para estudiantes de Psicología, Cap. 2 + Anexo B (PECT). Ediciones UST / RIL Editores. ISBN 978-956-01-1601-7."),

  // SECCIÓN 1 — Resumen ejecutivo
  h1("1. Resumen ejecutivo"),
  body("V3 mide un fragmento limitado del PECT (10 competencias sobre 46 ítems + 17 técnicas) y, según la proyección empírica F4, no logra discriminar pericia técnica entre estudiantes nivel Medio y Avanzado (Δ = +0,1 en V3 frente a Δ = +0,43 en PECT-extendido, con la sección 7 — Técnicas — alcanzando Δ = +2,0)."),
  body("V4 propone seis cambios fundamentales respecto de V3:"),
  empty(),
  makeTable(
    ["Cambio", "Resuelve"],
    RESUMEN_CAMBIOS,
    [6800, CONTENT_W - 6800],
    {},
  ),
  empty(),
  body("V4 no es una refundación sino una expansión disciplinada: mantiene la unidad pedagógica que ya funciona (rúbrica conductual, evidencia, NA explícito) y la extiende a la pauta completa que el libro ya provee."),

  // SECCIÓN 2 — Cobertura
  h1("2. Cobertura ampliada"),
  h2("2.1 Mapa de cobertura V3 → V4"),
  body("El libro tiene 7 secciones / 46 ítems + 17 sub-técnicas. V3 cubre 10 ítems (~22 %). V4 cubre 35 ítems observables vía chat (~76 %) más 6 técnicas con señal empírica probada."),
  empty(),
  makeTable(
    ["Sección PECT", "Ítems totales", "Evaluables vía chat", "V3 cubre", "V4 cubre", "Justificación"],
    COBERTURA_V3_V4,
    [2400, 900, 1100, 900, 1300, CONTENT_W - 2400 - 900 - 1100 - 900 - 1300],
    { center: [1, 2, 3, 4], fontSize: 16 },
  ),
  empty(),

  h2("2.2 Justificación empírica por competencia agregada"),
  body("Cada agregado de V4 está respaldado por la proyección F4. Las Δ son entre Básico (B) y Avanzado (A) del evaluador PECT-extendido."),
  body("Sección 2 — Diseño y comunicación del plan:", { bold: true }),
  bullet("plan_de_trabajo — Δ=+1 (1→2). Ítem discriminador en niveles intermedios."),
  bullet("cierre — Δ=+1 (2→3). Detecta calidad del cierre de sesión."),
  body("Sección 3 — Actitud de la terapeuta (agregados V4):", { bold: true }),
  bullet("curiosidad_cordialidad — Δ=+2 (2→4). Ítem de alta discriminación."),
  bullet("manejo_silencios — Δ=+2 (1→3). El silencio funcional es un marcador clínico clásico."),
  bullet("actitud_etica — Δ=+1 (3→4). Baja discriminación pero alto valor formativo."),
  bullet("espontaneidad — Δ=+1 (2→3)."),
  body("Sección 6 — Evaluación del proceso:", { bold: true }),
  bullet("identifica_tensiones — Δ=+2 (1→3). Marcador empírico fuerte de pericia avanzada."),
  bullet("timing — Δ=+1."),
  bullet("desarrollo_vinculo — Δ=+1."),
  bullet("monitoreo_avance y repara_tensiones — Δ=0 en F4, pero su ausencia es diagnóstica."),
  body("Sección 7 — Intervenciones principales:", { bold: true }),
  bullet("explorar_contenidos, sintonia_paciente, apoyar, resignificar — todas con Δ=+2."),
  body("Sección 7 — Técnicas específicas (6 con señal):", { bold: true }),
  bullet("tec_parafrasis, tec_reflejo, tec_focalizacion, tec_clarificacion, tec_argumentacion, tec_tareas — todas con Δ=+2 (1→3)."),
  body("Técnicas excluidas de evaluación V4 (11 técnicas restantes): autorrevelación, confrontación, consejo, imaginación, información, interpretación, metáfora, paradoja, refuerzo, resumen, role playing. Estas técnicas mostraron Δ=0 en F4. V4 puede detectarlas pasivamente (campos en BD) pero NO penaliza su ausencia ni las muestra como déficit hasta que F5/F6 demuestren uso real con más estudiantes.", { italic: true }),

  h2("2.3 Dimensiones del libro NO evaluables vía chat"),
  body("Tres áreas permanecen fuera del alcance de V4 y de cualquier evaluación automática:"),
  bullet("Sección 4 (Características de la terapeuta): apariencia, autocuidado, conciencia de reacciones fisiológicas propias. Requiere co-presencia o autoinforme."),
  bullet("Sección 5 (Conceptualización del caso): teoría psicopatológica, del desarrollo, del trauma. Requiere informe escrito o supervisión oral."),
  bullet("Sub-ítems específicos: consentimientos informados (UI), derivaciones, informes de caso, aplicación de sugerencias de supervisión."),
  body("Decisión: estas dimensiones NO entran en V4 ni como flag ni como métrica. Se documenta en la UI del estudiante una nota: «Esta evaluación cubre los aspectos observables en la conversación. Las dimensiones de Conceptualización del caso y Características personales se trabajan en supervisión presencial.»"),

  // SECCIÓN 3 — Estructura de evaluación
  h1("3. Estructura de evaluación propuesta"),
  h2("3.1 Dominios visibles para el estudiante: de 2 a 4"),
  body("V3 muestra 2 dominios en la UI (Estructura + Actitudes). V4 expande a 4 dominios visibles, que mapean directamente a las 6 secciones del libro evaluables vía chat:"),
  empty(),
  makeTable(
    ["Dominio UI V4", "Secciones libro", "# Ítems V4", "Color"],
    DOMINIOS_UI_V4,
    [3000, 2200, 2000, CONTENT_W - 3000 - 2200 - 2000],
    { center: [1, 2, 3] },
  ),
  empty(),
  body("Razón de agrupar Estructura + Plan: ambas son pre-sesión / arranque y la separación didáctica es escasa en una sola sesión. Razón de mantener Intervenciones como dominio propio: la dimensión técnica fue la más invisible en V3 y merece visibilidad propia."),

  h2("3.2 Las 17 técnicas: evaluadas todas, mostradas selectivamente"),
  body("Evaluación interna: el LLM evalúa las 17 técnicas del libro como ítems independientes (compatibilidad total con la pauta). Esto evita perder señal si una técnica empieza a aparecer con uso real."),
  body("Presentación al estudiante: se muestran solo las 6 técnicas con señal empírica F4 (paráfrasis, reflejo, focalización, clarificación, argumentación, asignación de tareas), con su score 0-4 y al menos una cita textual."),
  body("Las 11 técnicas restantes se guardan en BD pero NO aparecen en la UI hasta que F5/F6 demuestren que algún estudiante las usa con regularidad. Esto evita ruido visual y la sensación de «11 ítems vacíos»."),

  h2("3.3 Evaluador en cascada (dos pasadas en un único call)"),
  body("Para preservar la UI familiar V3 sin sacrificar la granularidad PECT, V4 usa un único call al LLM que devuelve dos shapes:"),
  bullet("Pasada PECT-ext (interna): 35 ítems + 17 técnicas → 52 scores con evidencia. Es el output crudo, persistido en session_techniques y session_pect_items."),
  bullet("Pasada agregada (UI): 4 dominios + 10 competencias derivadas (compatibles con el radar V2). La agregación se hace en código (no en el LLM) usando reglas determinísticas — esto evita drift de un call a otro."),
  body("Regla de agregación dominio → competencia V2:"),
  codeBlock([
    "overall_dominio = promedio de ítems del dominio con score numérico (0-4),",
    "                  excluyendo \"NA\". Si todos NA → null.",
  ]),
  empty(),
  body("Las 10 competencias V3 sobreviven como «vista legacy» en el radar, proyectadas 1-a-1 sin reinterpretación: setting_terapeutico ↔ setting_comunicado, motivo_consulta, datos_contextuales, objetivos, escucha_activa, actitud_no_valorativa, optimismo, presencia, conducta_no_verbal y contencion_afectos se mantienen idénticas. Las nuevas 25 competencias + 17 técnicas viven como capa adicional."),

  // SECCIÓN 4 — Schema BD
  h1("4. Schema de base de datos"),
  h2("4.1 Filosofía"),
  body("V3 modificó session_competencies con na_justifications JSONB y ai_original JSONB. V4 sigue el mismo principio (additive, retrocompatible) pero agrega dos tablas hijas para no inflar la fila central."),
  h2("4.2 Nueva migración: 20260520120000_feedback_engine_v4.sql"),
  empty(),
  codeBlock(SQL_MIGRACION, "SQL — migración propuesta"),
  empty(),

  h2("4.3 Backward compat con V3"),
  bullet("session_competencies se mantiene intacta. Sus 10 columnas V2/V3 siguen siendo la fuente para el radar."),
  bullet("eval_version sigue siendo 2 (no se incrementa). La distinción V3/V4 se hace por ai_original.rubric_version."),
  bullet("Sesiones históricas V3 (rubric_version=\"v3.0\") seguirán funcionando sin cambios en la UI."),
  bullet("Sesiones V4 (rubric_version=\"v4.0\") tendrán datos adicionales en las dos tablas hijas. La UI detecta su presencia y muestra los dominios extendidos."),

  h2("4.4 Estimación de costo en tokens"),
  bullet("Prompt V3 actual: ~16k chars (~4 000 tokens)."),
  bullet("Prompt V4: ~28k chars (~7 000 tokens) — duplica el rubric con 25 ítems extra + 17 técnicas + reglas anti-NA expandidas."),
  bullet("Output V3: ~1,5k tokens. Output V4: ~2,5k tokens (52 scores + evidencia mínima)."),
  bullet("Costo por sesión estimado: ~USD 0,10 con gpt-4o frente a ~USD 0,06 actual. Incremento ~67 %. Cache hit típico ~40 %, costo efectivo ~USD 0,07."),
  bullet("Aceptable: GlorIA cobra licencia institucional, no por sesión. El costo unitario es marginal."),

  // SECCIÓN 5 — Prompt LLM
  h1("5. Prompt al LLM evaluador V4"),
  h2("5.1 Estructura del prompt"),
  body("El prompt V4 mantiene la estructura V3 pero expande tres bloques:"),
  codeBlock([
    "SECCIÓN 0 — Contexto de sesión (igual que V3, con buildUserMessage)",
    "SECCIÓN 1 — Escala PECT (literal del libro: 0=NA, 1=Ausente, 2=Insuf., 3=Buena, 4=Excelente)",
    "SECCIÓN 2 — Reglas críticas anti-NA por contexto (expandidas — ver §5.2)",
    "SECCIÓN 3 — Rúbrica conductual por competencia (35 ítems × 4 niveles + descriptor NA)",
    "SECCIÓN 4 — 17 técnicas (descriptor breve + ejemplos del libro)",
    "SECCIÓN 5 — Evidencia obligatoria (≥2 citas para scores 1-4 en los 10 ítems V3, 1 cita para los 25 ítems nuevos)",
    "SECCIÓN 6 — Formato JSON estricto (52 scores + evidencia + commentary + strengths + areas_to_improve)",
  ]),
  empty(),

  h2("5.2 Reglas anti-NA por contexto"),
  body("V3 sufrió de NA sistemático en objetivos y optimismo. V4 codifica reglas explícitas por contexto:"),
  empty(),
  makeTable(
    ["Competencia", "NA permitido", "NA prohibido (auto-rechazo del LLM)"],
    REGLAS_ANTI_NA,
    [2800, 4000, CONTENT_W - 2800 - 4000],
    { fontSize: 17 },
  ),
  empty(),

  h2("5.3 Manejo de evidencia múltiple"),
  body("V3 ya requiere ≥ 2 citas por competencia con score numérico. V4 lo mantiene solo para las 10 competencias V3 (las dimensiones centrales del radar). Para los 25 ítems agregados y las 17 técnicas basta 1 cita mínima. Razón: si pedimos 2 citas para 52 ítems, el output supera los 3 500 tokens y empieza a alucinar."),
  body("Las citas viven en evidence: {item_key: [{quote, turn, observation, polarity}, …]} con el mismo shape V3."),

  h2("5.4 Output esperado (JSON)"),
  empty(),
  codeBlock(JSON_OUTPUT, "JSON — output del LLM"),
  empty(),
  body("Importante: dominio_scores y overall_score_v4 SE CALCULAN EN CÓDIGO desde scores; no se confía en el LLM (V3 ya mostró que el LLM redondea inconsistentemente).", { italic: true }),

  // SECCIÓN 6 — UI
  h1("6. Cambios en UI"),
  h2("6.1 Vista del estudiante (ReviewClient.tsx)"),
  body("La UI V4 se sirve con un toggle interno que detecta rubric_version:"),
  codeBlock([
    "if (rubric_version === \"v4.0\"):",
    "  Mostrar radar V2 (10 competencias, igual que ahora)",
    "  + Bloque expansible \"Detalle por dominio\" con los 4 dominios y sus ítems",
    "  + Bloque expansible \"Técnicas observadas\" con las 6 técnicas con señal",
    "elif (rubric_version === \"v3.0\" || legacy):",
    "  Mostrar UI V3 actual (sin cambios)",
  ]),
  empty(),

  h2("6.2 Mockup textual del nuevo bloque"),
  empty(),
  codeBlock(MOCKUP_UI, "Mockup ASCII"),
  empty(),

  h2("6.3 Radar V2 — ¿sobrevive?"),
  body("Sí. El radar V2 con 10 ejes se mantiene intacto. Razón: es la imagen central de retroalimentación, los estudiantes ya lo conocen, y los 10 ejes mapean a las 10 competencias V3 (las más visibles del libro). El detalle V4 vive como información secundaria expandible, no reemplaza el radar.", { bold: true }),
  body("Alternativa rechazada: radar con 35 ejes. Es ilegible y satura visualmente. La granularidad PECT vive en la lista expandible, no en el SVG.", { italic: true }),

  h2("6.4 Vista del docente (TeacherReviewClient)"),
  body("El docente ve todos los 52 scores sin colapsar, en una tabla. Puede editar cualquiera, con la edición persistida en session_pect_items o session_techniques. La fila V2 en session_competencies se recalcula automáticamente al editar un ítem de su dominio (vía trigger SQL o lógica en route handler — pendiente de definir)."),

  // SECCIÓN 7 — Migración
  h1("7. Migración V3 → V4"),
  h2("7.1 Datos históricos"),
  body("Decisión: las sesiones V3 NO se re-evalúan retroactivamente con V4. Razones:", { bold: true }),
  bullet("Cada re-evaluación cuesta ~USD 0,10. Con ~3 000 sesiones históricas estaríamos en USD 300 + 3 horas de cómputo."),
  bullet("El valor pedagógico es bajo: los estudiantes que vieron una sesión V3 ya internalizaron la retroalimentación recibida."),
  bullet("La fidelidad histórica es importante: cambiar retroactivamente las evaluaciones podría confundir a estudiantes que comparan sesiones."),
  body("Lo que SÍ se hace: las sesiones V3 conviven con sesiones V4 sin fricción. El radar de progreso del estudiante muestra ambas en el mismo gráfico (las 10 competencias V2 son comunes). El bloque «Detalle por dominio» aparece solo en sesiones V4."),

  h2("7.2 Plan de rollout"),
  empty(),
  makeTable(
    ["Fase", "Etapa", "Validación", "Decisión gate"],
    ROLLOUT_PLAN,
    [800, 4400, 3800, CONTENT_W - 800 - 4400 - 3800],
    { center: [0], fontSize: 17 },
  ),
  empty(),

  h2("7.3 Feature flag"),
  empty(),
  codeBlock([
    "// src/lib/feature-flags.ts",
    "export const FEEDBACK_ENGINE_VERSION =",
    "  process.env.FEEDBACK_ENGINE_V4 === \"true\" ? \"v4\" : \"v3\";",
  ], "TypeScript"),
  empty(),
  bullet("Default: v3 (estado actual)."),
  bullet("Override por institución / piloto: posible vía columna en profiles o institutions."),
  bullet("Rollback inmediato: cambiar env var, no requiere redeploy de migración."),

  h2("7.4 Riesgos del rollout"),
  bullet("Inconsistencia visual: un estudiante con sesiones V3 y V4 verá el bloque expandible solo en algunas. Mitigación: nota informativa «Detalle ampliado disponible desde mayo 2026»."),
  bullet("Costo runaway: si el flag se activa global de golpe en una institución con 200 estudiantes/día, el costo en LLM se duplica. Mitigación: rollout 10 % → 30 % → 100 % en una semana, monitorear factura diaria."),

  // SECCIÓN 8 — Validación UGM
  h1("8. Validación esperada con UGM (F6)"),
  body("V4 es un diseño técnico, no clínico. Necesita validación de la Escuela de Psicología antes de marcarse como estable."),

  h2("8.1 Preguntas para Nelson Valdés Sánchez (UST, co-autor de la PECT)"),
  bullet("¿Es legítimo evaluar la PECT a partir de una transcripción de chat sin video/audio? La PECT fue diseñada para sesiones presenciales con observación. ¿Qué validez y limitaciones implica reducir el canal?"),
  bullet("Las 4 técnicas excluidas por baja señal F4 (autorrevelación, confrontación, paradoja, role playing): ¿son centrales para el modelo de competencias o periféricas? Si son centrales, ¿cómo deberíamos forzar su detección?"),
  bullet("Las anclas conductuales por nivel (heredadas de fix/v3-fidelity-pect): ¿son fieles al espíritu del Cap. 2 del libro o requieren ajuste?"),
  bullet("Escala 0=NA vs 0=Omitido: el libro define 0=NA. V3 inventó la distinción NA(null)/Omitido(0). ¿Es una innovación útil o se aparta del instrumento?"),
  bullet("Validez del evaluador LLM: ¿UST tiene experiencia (o interés) en estudios de concordancia inter-evaluador entre supervisores humanos y LLMs?"),

  h2("8.2 Preguntas para la Escuela de Psicología UGM"),
  bullet("Adopción curricular: ¿los 4 dominios V4 (Estructura+Plan, Actitudes, Proceso+Vínculo, Intervenciones) son legibles para una estudiante de 3° año?"),
  bullet("Carga cognitiva: ¿35 ítems + 6 técnicas mostradas es demasiado o útil?"),
  bullet("Lenguaje de la rúbrica: las anclas usan vocabulario técnico (ej. «co-construcción explícita», «resignificación»). ¿Necesita glosa pedagógica adicional?"),
  bullet("Dimensiones excluidas: ¿la Escuela está de acuerdo con que Conceptualización del caso y Características de la terapeuta vivan fuera del chat y se evalúen en supervisión presencial?"),
  bullet("Sesgo del paciente IA: Diego Fuentes en F4 puede no haber generado todos los gatillos esperables. ¿La Escuela puede aportar 2-3 casos clínicos arquetípicos para diseñar pacientes IA que estresen las 35 dimensiones?"),

  h2("8.3 Decisiones que requieren validación clínica antes de implementar"),
  bullet("Anclas conductuales finales por nivel (35 ítems × 4 niveles = 140 descriptores). Es el bloque más caro de validar pero el más sensible."),
  bullet("Reglas anti-NA por competencia. Las que propone V4 son inferidas; necesitan revisión clínica."),
  bullet("Pesos en el overall_score_v4. El borrador V4 usa promedio simple. ¿Algunas dimensiones (Actitud Ética, Repara Tensiones) deberían pesar más?"),

  // SECCIÓN 9 — Riesgos
  h1("9. Riesgos y trade-offs"),

  h2("9.1 Riesgo técnico"),
  empty(),
  makeTable(
    ["Riesgo", "Probabilidad", "Impacto", "Mitigación"],
    RIESGOS_TECNICOS,
    [4000, 1600, 1400, CONTENT_W - 4000 - 1600 - 1400],
    { center: [1, 2], fontSize: 17 },
  ),
  empty(),

  h2("9.2 Riesgo pedagógico"),
  empty(),
  makeTable(
    ["Riesgo", "Probabilidad", "Impacto", "Mitigación"],
    RIESGOS_PEDAGOGICOS,
    [4000, 1600, 1400, CONTENT_W - 4000 - 1600 - 1400],
    { center: [1, 2], fontSize: 17 },
  ),
  empty(),

  h2("9.3 Riesgo clínico"),
  empty(),
  makeTable(
    ["Riesgo", "Probabilidad", "Impacto", "Mitigación"],
    RIESGOS_CLINICOS,
    [4000, 1600, 1400, CONTENT_W - 4000 - 1600 - 1400],
    { center: [1, 2], fontSize: 17 },
  ),
  empty(),

  h2("9.4 Trade-off central"),
  body("V4 sacrifica simplicidad por fidelidad al instrumento. V3 era didácticamente más limpio (10 competencias) pero clínicamente incompleto (cubría 22 % del PECT). V4 acepta la complejidad de 35+6 ítems para honrar el instrumento de Valdés Sánchez & Gómez Gallo. La justificación es ética: si GlorIA dice citar la PECT, debe cubrirla.", { bold: true }),
  body("Salvaguarda contra complejidad: la UI mantiene la jerarquía de información (radar V2 prominente, detalle V4 colapsado). El estudiante no se enfrenta a 35 ítems al abrir la página."),

  // SECCIÓN 10 — Próximos pasos
  h1("10. Próximos pasos (post-aprobación)"),
  bullet("Sub-diseño detallado: docs/v4/anclas-conductuales.md con las 35 × 4 = 140 anclas. Heredar de fix/v3-fidelity-pect para las 10 V3; redactar las 25 nuevas."),
  bullet("Sub-diseño detallado: docs/v4/migracion-data.md con plan de rollout granular y queries de verificación."),
  bullet("Implementación: rama feat/v4-feedback-engine (separada de feat/v4-design), commits atómicos por componente (schema → prompt → parseo → UI)."),
  bullet("Smoke test: repetir F4 con V4 implementado y comparar contra PECT-extendido. Esperar que V4 cierre el gap de 0,43 → ~0,1."),
  bullet("Validación humana: F6 con UGM + Nelson Valdés (UST)."),

  // APÉNDICE A — Crosswalk
  h1("Apéndice A — Crosswalk completo V3 ↔ V4 ↔ PECT-libro"),
  empty(),
  makeTable(
    ["Ítem V3 (10)", "Ítem V4 (35)", "Sección PECT", "Δ B→A en F4", "En radar V2"],
    CROSSWALK,
    [3000, 3400, 1500, 1500, CONTENT_W - 3000 - 3400 - 1500 - 1500],
    { center: [2, 3, 4], fontSize: 16 },
  ),
  empty(),

  // APÉNDICE B — Referencias
  h1("Apéndice B — Referencias"),
  bullet("Valdés Sánchez, N. & Gómez Gallo, D. (2023). Supervisión clínica para estudiantes de Psicología: Un modelo de competencias psicoterapéuticas genéricas básicas. Cap. 2 + Anexo B. Ediciones Universidad Santo Tomás / RIL Editores. ISBN 978-956-01-1601-7."),
  bullet("F4 — Proyección Empírica V3 vs PECT-extendido (2026-05-18). C:/tmp/projection/analysis.md."),
  bullet("INF-2026-054 — Análisis crítico motor V3 vs PECT (incluye Anexo B con resultados F4). informes/desarrollo/INF-2026-054_analisis-motor-v3-vs-pect.docx."),
  bullet("INF-2026-052 — Definición de las 10 competencias del motor V3."),
  bullet("Rama fix/v3-fidelity-pect (commit f3bd674) — anclas conductuales fieles al libro, NO mergeada a master al momento de este diseño."),
  bullet("Fuente primaria de este diseño: docs/design-v4-feedback-engine.md (rama feat/v4-design, commit e6615bd)."),
];

const doc = new Document({
  creator: "GlorIA",
  title: "INF-2026-055 — Diseño V4 del motor de retroalimentación",
  description: "Diseño técnico-clínico de V4: expansión de cobertura PECT, anclas conductuales fieles, evaluador en cascada y plan de validación con UGM.",
  styles: {
    default: { document: { run: { font: "Calibri", size: 21 } } },
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
  const out = "informes/desarrollo/INF-2026-055_diseno-motor-v4.docx";
  fs.writeFileSync(out, buf);
  console.log(`OK -> ${out}  (${(buf.length / 1024).toFixed(1)} KB)`);
});
