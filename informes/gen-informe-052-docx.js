/**
 * INF-2026-052 .docx — Definicion de las 10 competencias evaluadas
 * por el motor de retroalimentacion de GlorIA 5.0.
 *
 * Breve (2 paginas). Solo copia local, no se sube a supradmin.
 * Fuente: src/lib/competency-definitions.ts + src/lib/competency-rubric.ts.
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

const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };
const PAGE_W = 12240, MARGIN = 1080;
const CONTENT_W = PAGE_W - 2 * MARGIN;

const empty = () => new Paragraph({ spacing: { after: 60 }, children: [] });
const h2 = (t) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 200, after: 100 },
  children: [new TextRun({ text: t, color: INDIGO, bold: true, size: 26, font: "Calibri" })],
});
const body = (text, opts = {}) => new Paragraph({
  spacing: { after: 100 },
  alignment: opts.alignment || AlignmentType.JUSTIFIED,
  children: [new TextRun({ text, font: "Calibri", size: 21, color: DARK, italics: !!opts.italic })],
});
const small = (text, opts = {}) => new Paragraph({
  spacing: { after: 60 },
  alignment: opts.alignment || AlignmentType.LEFT,
  children: [new TextRun({ text, size: 18, font: "Calibri", color: GREY, italics: !!opts.italic })],
});

// ─── Tabla de competencias: 3 columnas (#, Nombre, Definicion) ────────
function competencyTable(rows) {
  const cols = [600, 2900, CONTENT_W - 600 - 2900];
  const header = new TableRow({
    tableHeader: true,
    children: ["#", "Competencia", "Definicion"].map((h, i) => new TableCell({
      borders,
      width: { size: cols[i], type: WidthType.DXA },
      shading: { fill: INDIGO, type: ShadingType.CLEAR },
      margins: cellMargins,
      verticalAlign: "center",
      children: [new Paragraph({
        children: [new TextRun({ text: h, bold: true, color: WHITE, font: "Calibri", size: 20 })],
      })],
    })),
  });
  const dataRows = rows.map((r, ri) => new TableRow({
    children: r.map((cell, ci) => new TableCell({
      borders,
      width: { size: cols[ci], type: WidthType.DXA },
      shading: { fill: ri % 2 === 0 ? LIGHT_BG : WHITE, type: ShadingType.CLEAR },
      margins: cellMargins,
      verticalAlign: "top",
      children: [new Paragraph({
        alignment: ci === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({
          text: cell,
          bold: ci === 1,
          color: DARK,
          font: "Calibri",
          size: 19,
        })],
      })],
    })),
  }));
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: cols,
    rows: [header, ...dataRows],
  });
}

// ─── Tabla de escala (Codigo / Significado / Cuando se aplica) ───────
function scaleTable() {
  const cols = [1200, 2400, CONTENT_W - 1200 - 2400];
  const data = [
    ["NA", "No aplicaba", "La situacion clinica de la sesion no permitia desplegar la competencia (p.ej. setting terapeutico en sesion de continuidad sin rupturas). Score = null, con justificacion obligatoria."],
    ["0", "Omitida", "La situacion clinica requeria la competencia y el estudiante no la desplego."],
    ["1", "Insuficiente", "Conducta opuesta o ausente: interrumpe, juzga, ignora senales relevantes."],
    ["2", "Inicial", "Conducta presente pero parcial o literal: refleja sin matiz, propone sin co-construir."],
    ["3", "Competente", "Conducta integrada y sostenida: refleja contenido y emocion, co-construye, valida sin aprobar."],
    ["4", "Avanzada", "Conducta fluida y matizada: integra niveles, modula segun la fase, nombra el aqui y ahora cuando es util."],
  ];
  const header = new TableRow({
    tableHeader: true,
    children: ["Codigo", "Significado", "Descriptor conductual"].map((h, i) => new TableCell({
      borders,
      width: { size: cols[i], type: WidthType.DXA },
      shading: { fill: INDIGO, type: ShadingType.CLEAR },
      margins: cellMargins,
      verticalAlign: "center",
      children: [new Paragraph({
        children: [new TextRun({ text: h, bold: true, color: WHITE, font: "Calibri", size: 20 })],
      })],
    })),
  });
  const dataRows = data.map((r, ri) => new TableRow({
    children: r.map((cell, ci) => new TableCell({
      borders,
      width: { size: cols[ci], type: WidthType.DXA },
      shading: { fill: ri % 2 === 0 ? LIGHT_BG : WHITE, type: ShadingType.CLEAR },
      margins: cellMargins,
      verticalAlign: "top",
      children: [new Paragraph({
        alignment: ci === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({
          text: cell,
          bold: ci === 0 || ci === 1,
          color: ci === 0 ? INDIGO : DARK,
          font: "Calibri",
          size: 19,
        })],
      })],
    })),
  }));
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: cols,
    rows: [header, ...dataRows],
  });
}

// ─── Datos: 10 competencias, 2 dominios ─────────────────────────────
const ESTRUCTURA = [
  ["1", "Setting terapéutico", "Capacidad de explicitar el encuadre terapéutico (duración, confidencialidad, roles) y aclarar dudas del paciente al inicio y durante la sesión."],
  ["2", "Motivo de consulta", "Capacidad de indagar e integrar el motivo manifiesto y latente de consulta, explorando los recursos y la perspectiva del paciente."],
  ["3", "Datos contextuales", "Capacidad de entrevistar e integrar información de contextos relevantes: familia, trabajo, salud, relaciones y entorno sociocultural."],
  ["4", "Objetivos", "Capacidad de construir objetivos terapéuticos de forma colaborativa con el paciente, alineados con el motivo de consulta."],
];
const ACTITUDES = [
  ["5", "Escucha activa", "Atención coherente a la comunicación verbal y no verbal del paciente, respondiendo en congruencia con lo expresado."],
  ["6", "Actitud no valorativa", "Aceptación incondicional del paciente sin juicios explícitos ni implícitos, independiente de sus valores, creencias o conductas."],
  ["7", "Optimismo terapéutico", "Transmisión proactiva de esperanza y optimismo integrado con intervenciones técnicas, sin minimizar el sufrimiento del paciente."],
  ["8", "Presencia", "Atención sostenida, flexibilidad y sintonía emocional con el paciente. Estar genuinamente presente en el aquí y ahora de la sesión."],
  ["9", "Conducta no verbal", "Atención a lo no verbal del paciente (gestos, postura, tono, silencios) e integración de estas señales con el contenido verbal."],
  ["10", "Contención de afectos", "Contención emocional del paciente con presencia, calidez, empatía y validación. Capacidad de sostener momentos de alta intensidad emocional."],
];

// ─── Header con logo y footer con paginacion ────────────────────────
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
      new TextRun({ text: "GlorIA — Página ", size: 18, font: "Calibri", color: GREY }),
      new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Calibri", color: GREY }),
      new TextRun({ text: " de ", size: 18, font: "Calibri", color: GREY }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Calibri", color: GREY }),
    ],
  })],
});

// ─── Contenido ───────────────────────────────────────────────────────
const content = [
  // Encabezado del informe (compacto, no pagina de portada completa)
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 40 },
    children: [new TextRun({
      text: "INF-2026-052 · Documentación técnico-clínica",
      color: INDIGO, bold: true, size: 18, font: "Calibri",
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 40 },
    children: [new TextRun({
      text: "Definición de las 10 competencias evaluadas",
      color: INDIGO, bold: true, size: 32, font: "Calibri",
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 100 },
    children: [new TextRun({
      text: "Motor de retroalimentación GlorIA 5.0 — versión V3",
      color: DARK, size: 22, font: "Calibri",
    })],
  }),
  small("Fecha de elaboración: 14 de mayo de 2026 · Elaborado por: equipo GlorIA"),

  // Introduccion breve
  h2("Contexto"),
  body("El motor de retroalimentación de GlorIA 5.0 evalúa el desempeño del estudiante en una sesión simulada con un paciente de inteligencia artificial. Tras finalizar la conversación, el motor analiza la transcripción completa y emite un puntaje conductual entre 1 y 4 por cada una de las diez competencias clínicas básicas, con la posibilidad de marcar una competencia como «No Aplicaba» (NA) u «Omitida» cuando corresponde, asegurando una evaluación honesta y no inflada artificialmente."),
  body("Las diez competencias se agrupan en dos grandes dominios: cuatro competencias de Estructura, que organizan el proceso de la sesión, y seis competencias de Actitudes, que regulan la relación terapéutica."),

  // Competencias - dominio 1
  h2("Dominio 1 — Estructura"),
  competencyTable(ESTRUCTURA),
  empty(),

  // Competencias - dominio 2
  h2("Dominio 2 — Actitudes"),
  competencyTable(ACTITUDES),
  empty(),

  // Escala
  h2("Escala de evaluación"),
  body("Cada competencia recibe uno de los siguientes códigos. El uso de NA y de 0 requiere justificación textual con evidencia de la sesión, de modo que el estudiante pueda revisar la decisión del motor en su retroalimentación."),
  empty(),
  scaleTable(),
  empty(),

  // Fuente
  h2("Fuente y validación"),
  body("Las definiciones que utiliza el motor están basadas en la PECT — Pauta de Evaluación de Competencias Psicoterapéuticas para el trabajo con Adultos — publicada como Anexo B del libro: Valdés Sánchez, N. & Gómez Gallo, D. (2023). Supervisión clínica para estudiantes de Psicología: Un modelo de competencias psicoterapéuticas genéricas básicas. Ediciones Universidad Santo Tomás / RIL Editores. ISBN 978-956-01-1601-7. La pauta forma parte del modelo MSC-VF (Modelo de Supervisión Clínica con Videofeedback) de los autores."),
  body("Los descriptores conductuales por nivel se inyectan al prompt del LLM evaluador para reducir la inferencia y mejorar la consistencia inter-evaluador. La rúbrica vive en src/lib/competency-rubric.ts y los textos públicos para tooltips y retroalimentación al estudiante en src/lib/competency-definitions.ts. Validación pendiente por la Escuela de Psicología de la Universidad Gabriela Mistral.", { italic: true }),
];

const doc = new Document({
  creator: "GlorIA",
  title: "INF-2026-052 — Definicion de competencias",
  description: "Definicion de las 10 competencias evaluadas por el motor GlorIA 5.0",
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
  const out = "informes/desarrollo/INF-2026-052_definicion-competencias-motor.docx";
  fs.writeFileSync(out, buf);
  console.log(`OK -> ${out}  (${(buf.length / 1024).toFixed(1)} KB)`);
});
