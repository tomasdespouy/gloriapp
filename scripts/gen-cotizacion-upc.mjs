/**
 * Generador standalone de la cotización para UPC (Universidad Peruana de
 * Ciencias Aplicadas) — 1.800 licencias GlorIA.
 *
 * Valores NETOS en USD. La Universidad asume el Impuesto a la Renta de No
 * Domiciliados (Perú) y los gastos de transferencia interbancaria/internacional.
 *
 * Uso: node scripts/gen-cotizacion-upc.mjs
 * Salida: cotizaciones/Cotizacion-UPC-1800-licencias.docx
 */
import fs from "node:fs";
import path from "node:path";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  ImageRun,
  HeadingLevel,
} from "docx";

// ─── Estilo (idéntico al de los informes) ─────────────────────────────
const ACCENT = "4A55A2";
const INK = "1A1A1A";
const MUTED = "6B7280";
const TABLE_HEADER_BG = "4A55A2";
const ZEBRA_BG = "F3F4F6";
const CELL_BORDER = "D1D5DB";

// ─── Parámetros de la cotización (EDITABLES) ──────────────────────────
const COT = {
  numero: "COT-2026-001",
  fecha: "30 de junio de 2026",
  validezDias: 30,
  cliente: "Universidad Peruana de Ciencias Aplicadas (UPC)",
  pais: "Perú",
  contacto: "[Nombre del contacto / Dirección de carrera]",
  // Ítems
  licencias: 1800,
  valorLicencia: 10, // USD neto, nominal, por estudiante, por semestre
  capacitacion: 2000, // USD neto (sugerido)
  acompHoras: 20, // horas (sugerido)
  acompTarifa: 60, // USD/hora (valor referencial)
};

const subLicencias = COT.licencias * COT.valorLicencia; // 18.000
const valorAcompRef = COT.acompHoras * COT.acompTarifa; // 1.200 (referencial)
const totalNeto = subLicencias + COT.capacitacion + 0; // acompañamiento = 0

const usd = (n) =>
  "USD " +
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n) => n.toLocaleString("es-CL");

// ─── Helpers de assets / texto ────────────────────────────────────────
function loadAsset(rel) {
  try {
    return fs.readFileSync(path.join(process.cwd(), "public", "branding", rel));
  } catch {
    return null;
  }
}

function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.after ?? 120, before: opts.before ?? 0 },
    children: Array.isArray(text)
      ? text
      : [new TextRun({ text, bold: opts.bold, italics: opts.italics, color: opts.color ?? INK, size: opts.size ?? 22 })],
  });
}

function bullet(text, opts = {}) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 21, color: opts.color ?? INK })],
  });
}

function h(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 120 },
    children: [new TextRun({ text, bold: true, color: ACCENT, size: 26 })],
  });
}

// ─── Tabla de cotización ──────────────────────────────────────────────
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: CELL_BORDER };
const allBorders = {
  top: cellBorder,
  bottom: cellBorder,
  left: cellBorder,
  right: cellBorder,
};

function tcell(content, { header = false, align = AlignmentType.LEFT, bg, bold = false, color } = {}) {
  const runs = Array.isArray(content)
    ? content
    : [new TextRun({ text: content, bold: header || bold, color: color ?? (header ? "FFFFFF" : INK), size: header ? 20 : 20 })];
  return new TableCell({
    borders: allBorders,
    shading: bg ? { type: ShadingType.CLEAR, color: "auto", fill: bg } : undefined,
    margins: { top: 80, bottom: 80, left: 110, right: 110 },
    children: [new Paragraph({ alignment: align, children: runs })],
  });
}

function quoteTable() {
  const header = new TableRow({
    tableHeader: true,
    children: [
      tcell("Concepto", { header: true, bg: TABLE_HEADER_BG }),
      tcell("Detalle", { header: true, bg: TABLE_HEADER_BG }),
      tcell("Cant.", { header: true, bg: TABLE_HEADER_BG, align: AlignmentType.CENTER }),
      tcell("V. unitario", { header: true, bg: TABLE_HEADER_BG, align: AlignmentType.RIGHT }),
      tcell("Subtotal neto", { header: true, bg: TABLE_HEADER_BG, align: AlignmentType.RIGHT }),
    ],
  });

  const rowLic = new TableRow({
    children: [
      tcell("Licencia nominal GlorIA", { bold: true }),
      tcell("Acceso individual por estudiante, por un (1) semestre académico"),
      tcell(num(COT.licencias), { align: AlignmentType.CENTER }),
      tcell(usd(COT.valorLicencia), { align: AlignmentType.RIGHT }),
      tcell(usd(subLicencias), { align: AlignmentType.RIGHT, bold: true }),
    ],
  });

  const rowCap = new TableRow({
    children: [
      tcell("Capacitación docente", { bold: true, bg: ZEBRA_BG }),
      tcell("Programa de formación para el cuerpo docente (ver detalle)", { bg: ZEBRA_BG }),
      tcell("1", { align: AlignmentType.CENTER, bg: ZEBRA_BG }),
      tcell(usd(COT.capacitacion), { align: AlignmentType.RIGHT, bg: ZEBRA_BG }),
      tcell(usd(COT.capacitacion), { align: AlignmentType.RIGHT, bold: true, bg: ZEBRA_BG }),
    ],
  });

  const rowAcomp = new TableRow({
    children: [
      tcell("Acompañamiento disciplinar", { bold: true }),
      tcell([
        new TextRun({ text: `${COT.acompHoras} h con especialista durante el semestre. `, size: 20 }),
        new TextRun({ text: `Valor referencial ${usd(valorAcompRef)}, bonificado 100%.`, size: 20, italics: true, color: MUTED }),
      ]),
      tcell(`${COT.acompHoras} h`, { align: AlignmentType.CENTER }),
      tcell("Bonificado", { align: AlignmentType.RIGHT, color: MUTED }),
      tcell(usd(0), { align: AlignmentType.RIGHT, bold: true }),
    ],
  });

  const rowTotal = new TableRow({
    children: [
      new TableCell({
        borders: allBorders,
        columnSpan: 4,
        shading: { type: ShadingType.CLEAR, color: "auto", fill: "EEF0F8" },
        margins: { top: 90, bottom: 90, left: 110, right: 110 },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "TOTAL NETO (USD)", bold: true, color: ACCENT, size: 22 })] })],
      }),
      new TableCell({
        borders: allBorders,
        shading: { type: ShadingType.CLEAR, color: "auto", fill: "EEF0F8" },
        margins: { top: 90, bottom: 90, left: 110, right: 110 },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: usd(totalNeto), bold: true, color: ACCENT, size: 24 })] })],
      }),
    ],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [2100, 3600, 900, 1500, 1700],
    rows: [header, rowLic, rowCap, rowAcomp, rowTotal],
  });
}

// ─── Documento ────────────────────────────────────────────────────────
async function build() {
  const logo = loadAsset("gloria-logo.png"); // 215x49

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: `${COT.numero} · GlorIA · Documento confidencial  ·  `, size: 16, color: "9CA3AF" }),
          new TextRun({ children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES], size: 16, color: "9CA3AF" }),
        ],
      }),
    ],
  });

  const cover = [];
  if (logo) {
    cover.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 240 },
        children: [new ImageRun({ data: logo, transformation: { width: 200, height: 46 }, type: "png" })],
      }),
    );
  }
  cover.push(
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: "COTIZACIÓN", bold: true, color: ACCENT, size: 40 })],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({ text: `${COT.numero}`, color: MUTED, size: 22 }),
        new TextRun({ text: `     ·     ${COT.fecha}`, color: MUTED, size: 22 }),
        new TextRun({ text: `     ·     Validez: ${COT.validezDias} días`, color: MUTED, size: 22 }),
      ],
    }),
  );

  // Bloque "Dirigido a"
  const dirigido = [
    p([new TextRun({ text: "Dirigido a", bold: true, color: ACCENT, size: 22 })], { after: 40 }),
    p(COT.cliente, { bold: true }),
    p(`${COT.contacto} — ${COT.pais}`, { color: MUTED, after: 200 }),
  ];

  const intro = p(
    "GlorIA es una plataforma de simulación clínica con pacientes de inteligencia artificial " +
      "para que estudiantes de Psicología practiquen entrevistas y desarrollen competencias " +
      "terapéuticas, con retroalimentación automática basada en una rúbrica conductual. La " +
      "presente cotización detalla el alcance y los valores para la implementación con 1.800 " +
      "estudiantes durante un semestre académico.",
    { after: 220 },
  );

  const detalle = [
    h("Detalle de los componentes"),
    p([new TextRun({ text: "1. Licencia nominal GlorIA — ", bold: true }), new TextRun({ text: `${usd(COT.valorLicencia)} por estudiante / semestre.`, })]),
    bullet("Acceso individual y nominal para cada uno de los 1.800 estudiantes."),
    bullet("Catálogo de pacientes IA por nivel de dificultad (principiante, intermedio, avanzado)."),
    bullet("Retroalimentación automática por sesión y reflexión guiada del estudiante."),
    bullet("Panel docente: seguimiento de avance, transcripciones y métricas por sección."),
    p([new TextRun({ text: "2. Capacitación docente — ", bold: true }), new TextRun({ text: `${usd(COT.capacitacion)} (programa).`, })], { before: 120 }),
    bullet("Cuatro (4) sesiones síncronas en línea de 90 minutos (6 horas efectivas)."),
    bullet("Materiales descargables y grabaciones de las sesiones."),
    bullet("Cobertura para hasta 40 docentes (ampliable según necesidad)."),
    p([new TextRun({ text: "3. Acompañamiento disciplinar — ", bold: true }), new TextRun({ text: `bonificado (valor referencial ${usd(valorAcompRef)}).`, })], { before: 120 }),
    bullet(`${COT.acompHoras} horas de acompañamiento con un(a) especialista disciplinar durante el semestre (reuniones quincenales).`),
    bullet(`Tarifa referencial de ${usd(COT.acompTarifa)}/hora, bonificada al 100% como cortesía de implementación; se refleja como descuento total en esta cotización.`),
  ];

  const condiciones = [
    h("Condiciones comerciales"),
    bullet("Moneda: dólares estadounidenses (USD). Todos los valores indicados son NETOS para GlorIA."),
    bullet(
      "Tributos y transferencia: en caso de aplicar, el Impuesto a la Renta de No Domiciliados en " +
        "el Perú (retención sobre pagos al exterior) y los gastos de transferencia interbancaria / " +
        "internacional serán de cargo de la Universidad, de modo que el monto neto efectivamente " +
        "recibido por GlorIA corresponda al aquí cotizado.",
    ),
    bullet("Periodo: un (1) semestre académico, contado desde la habilitación de las licencias."),
    bullet(`Vigencia de esta oferta: ${COT.validezDias} días desde la fecha de emisión.`),
    bullet("Forma de pago: a convenir (p. ej., contra orden de compra al inicio del semestre)."),
  ];

  const cierre = [
    new Paragraph({ spacing: { before: 320, after: 60 }, children: [new TextRun({ text: "Quedamos atentos a sus comentarios.", italics: true, color: MUTED, size: 22 })] }),
    p([new TextRun({ text: "GlorIA", bold: true, color: ACCENT, size: 24 })], { before: 120, after: 20 }),
    p("[Razón social / RUC o ID tributario]", { color: MUTED, size: 20, after: 20 }),
    p("[Representante comercial] · [correo] · [teléfono] · www.glor-ia.com", { color: MUTED, size: 20 }),
  ];

  const doc = new Document({
    creator: "GlorIA",
    title: `Cotización ${COT.numero} — UPC`,
    description: "Cotización GlorIA para UPC — 1.800 licencias",
    styles: { default: { document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: { line: 300 } } } } },
    numbering: { config: [{ reference: "default-bullets", levels: [{ level: 0, format: "bullet", text: "•", alignment: AlignmentType.LEFT }] }] },
    sections: [
      {
        properties: { page: { margin: { top: 1100, right: 1200, bottom: 1200, left: 1200 } } },
        footers: { default: footer },
        children: [
          ...cover,
          ...dirigido,
          intro,
          quoteTable(),
          new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: `Equivalente a ${usd(totalNeto / COT.licencias)} por estudiante (total) · ${usd(COT.valorLicencia)} por licencia.`, italics: true, color: MUTED, size: 20 })] }),
          ...detalle,
          ...condiciones,
          ...cierre,
        ],
      },
    ],
  });

  const outDir = path.join(process.cwd(), "cotizaciones");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "Cotizacion-UPC-1800-licencias.docx");
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buf);
  console.log("OK ->", outPath);
  console.log(`Subtotal licencias: ${usd(subLicencias)} | Capacitación: ${usd(COT.capacitacion)} | Acompañamiento: ${usd(0)} (ref. ${usd(valorAcompRef)})`);
  console.log(`TOTAL NETO: ${usd(totalNeto)}`);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
