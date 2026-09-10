import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType, PageNumber,
} from "docx";
import { GLORIA_LOGO_PNG } from "@/lib/branding-logo";
import type { WeeklyReportData } from "./weekly-report-data";

/**
 * El .docx del informe semanal.
 *
 * Es el mismo diseño de los informes que se venían escribiendo a mano para
 * UPC, con dos diferencias que conviene tener presentes: la prosa se deriva de
 * los datos (ver elegirTitular en weekly-report-data) en vez de escribirse cada
 * semana, y las secciones que no tienen datos suficientes se omiten en vez de
 * mostrarse vacías. Una tabla longitudinal con dos alumnos no informa: engaña.
 *
 * No consulta la base: recibe los datos ya calculados. Así el documento y la
 * foto guardada en report_runs.snapshot son necesariamente lo mismo.
 */

const INDIGO = "4A55A2", DARK = "1A1A1A", GREY = "55555F", FAINT = "86868F",
      BOX = "F0F2FA", BORDE = "D8DAE8", ZEBRA = "F7F8FC", ALERTA = "B3402B", VERDE = "2E6B4F";

const PAGE_W = 12240, MARGIN = 1080;
const W = PAGE_W - 2 * MARGIN;

const nb = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const nbs = { top: nb, bottom: nb, left: nb, right: nb, insideHorizontal: nb, insideVertical: nb };
const linea = { style: BorderStyle.SINGLE, size: 2, color: "EFEFF1" } as const;

type RunOpts = { bold?: boolean; italic?: boolean; color?: string; size?: number; caps?: boolean; mono?: boolean };
const txt = (t: string, o: RunOpts = {}) => new TextRun({
  text: t, bold: !!o.bold, italics: !!o.italic, color: o.color || DARK,
  size: o.size || 19, font: o.mono ? "Consolas" : "Calibri",
  allCaps: !!o.caps, characterSpacing: o.caps ? 20 : undefined,
});

type POpts = { before?: number; after?: number; line?: number; keepNext?: boolean };
const p = (k: TextRun | TextRun[], o: POpts = {}) => new Paragraph({
  children: Array.isArray(k) ? k : [k],
  spacing: { before: o.before || 0, after: o.after === undefined ? 80 : o.after, line: o.line || 245 },
  keepNext: o.keepNext,
});

const h2 = (t: string) => new Paragraph({
  spacing: { before: 200, after: 60, line: 220 }, keepNext: true,
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDE, space: 5 } },
  children: [txt(t, { color: FAINT, size: 15, bold: true, caps: true })],
});

const num = (n: number, dec = 0) =>
  n.toLocaleString("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec });

/** Barra proporcional sobre la escala completa (0 a 4), dibujada con bloques. */
const barra = (v: number) => {
  // Sin el mínimo de 1 bloque, un 0,52 se veía como 3 bloques igual que un 0,15.
  // Con él, un 0,0 se vería como algo. Se dibuja lo proporcional y punto: si es
  // cero, no hay barra.
  const n = Math.round((v / 4) * 20);
  return n <= 0 ? "·" : "█".repeat(n);
};

type TablaOpts = { izquierda?: number[]; color?: (fila: string[], col: number) => string | null };

const tabla = (cabs: string[], filas: string[][], pesos: number[], opts: TablaOpts = {}) => {
  const anchos = pesos.map((x) => Math.round(W * x));
  const celda = (t: string, i: number, cab: boolean, zebra: boolean, color?: string | null) =>
    new TableCell({
      width: { size: anchos[i], type: WidthType.DXA },
      margins: { top: 24, bottom: 24, left: 110, right: 110 },
      shading: zebra ? { type: ShadingType.CLEAR, fill: ZEBRA, color: "auto" } : undefined,
      borders: { top: nb, bottom: linea, left: nb, right: nb },
      children: [new Paragraph({
        spacing: { before: 0, after: 0, line: 202 },
        alignment: (i === 0 || (opts.izquierda || []).includes(i)) ? AlignmentType.LEFT : AlignmentType.RIGHT,
        children: [txt(t, cab
          ? { size: 14, bold: true, color: FAINT, caps: true }
          : { size: 17, color: color || (i === 0 ? DARK : GREY), bold: !!color,
              mono: i > 0 && !(opts.izquierda || []).includes(i) })],
      })],
    });
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: anchos, borders: nbs,
    rows: [
      new TableRow({ tableHeader: true, children: cabs.map((t, i) => celda(t, i, true, false)) }),
      ...filas.map((f, r) => new TableRow({
        children: f.map((t, i) => celda(String(t), i, false, r % 2 === 1, opts.color?.(f, i))),
      })),
    ],
  });
};

export async function buildWeeklyReportDocx(d: WeeklyReportData): Promise<Buffer> {
  const fecha = new Date(d.generadoEl).toLocaleDateString("es-CL", {
    timeZone: "America/Santiago", day: "numeric", month: "long", year: "numeric",
  });

  const cuerpo: (Paragraph | Table)[] = [
    p(txt(`${d.establecimiento} · Informe semanal de uso`, { color: INDIGO, size: 14, bold: true, caps: true }), { after: 50 }),
    p(txt("Uso de GlorIA", { bold: true, size: 34 }), { after: 70, line: 280 }),
    p(txt(`Corte al ${fecha}. ${d.totales.sesionesUltimos7} sesiones nuevas en los últimos siete días.`,
          { color: GREY, size: 18 }), { after: 110, line: 220 }),

    // Recuadro con el titular derivado de los datos
    new Table({
      width: { size: W, type: WidthType.DXA }, columnWidths: [W],
      borders: { ...nbs, left: { style: BorderStyle.SINGLE, size: 18, color: INDIGO } },
      rows: [new TableRow({ children: [new TableCell({
        width: { size: W, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: BOX, color: "auto" },
        margins: { top: 150, bottom: 150, left: 220, right: 220 },
        borders: { top: nb, bottom: nb, right: nb, left: { style: BorderStyle.SINGLE, size: 18, color: INDIGO } },
        children: [
          p(txt("Lo más accionable", { color: INDIGO, size: 14, bold: true, caps: true }), { after: 60 }),
          p(txt(d.titular.texto, { bold: true, size: 21 }), { after: 70, line: 270 }),
          p(txt(d.titular.detalle, { color: GREY, size: 17 }), { after: 0, line: 220 }),
        ],
      })] })],
    }),
  ];

  if (!d.hayActividad) {
    cuerpo.push(h2("Sin actividad esta semana"));
    cuerpo.push(p(txt(
      "No se registraron sesiones en el período. Este informe se envía igual: un correo que no llega es ambiguo — no se distingue entre \"no hubo actividad\" y \"algo falló\".",
      { color: GREY, size: 17 }), { after: 0, line: 220 }));
    return Buffer.from(await Packer.toBuffer(armar(cuerpo, d)));
  }

  // ── Participación ──────────────────────────────────────────────────────────
  cuerpo.push(h2("Participación por sección"));
  const filasSec = d.secciones.map((s) => [
    s.nombre, String(s.alumnos), String(s.ingresaron), String(s.practicaron),
    String(s.sesiones), num(s.minutosMediana, 1), String(s.mensajesMediana), String(s.conDevolucion),
  ]);
  const t = d.totales;
  filasSec.push(["Total", String(t.alumnos), String(t.ingresaron), String(t.practicaron),
    String(t.sesiones), num(t.minutosMediana, 1), String(t.mensajesMediana), String(t.conDevolucion)]);
  cuerpo.push(tabla(
    ["Sección", "Alumnos", "Ingresó", "Practicó", "Sesiones", "Min. med.", "Mensajes", "Con devolución"],
    filasSec, [0.18, 0.10, 0.12, 0.12, 0.10, 0.09, 0.10, 0.15],
    { color: (f) => (f[0] === "Total" ? DARK : null) },
  ));
  cuerpo.push(p(txt(
    `Las sesiones duran una mediana de ${num(t.minutosMediana, 1)} minutos y ${t.mensajesMediana} mensajes. En total, ${num(t.horasTotales, 1)} horas de práctica clínica acumuladas.`,
    { color: GREY, size: 17 }), { before: 90, after: 0, line: 220 }));

  // ── Competencias ───────────────────────────────────────────────────────────
  const conDatos = d.competencias.filter((c) => c.n > 0);
  if (conDatos.length) {
    cuerpo.push(h2("Perfil de competencias de la cohorte"));
    cuerpo.push(p(txt(
      `${t.evaluaciones} sesiones evaluadas, sobre el marco de 10 competencias de Valdés y Gómez, en escala de 0 a 4. La columna n son las sesiones donde la competencia era evaluable; las que no aplicaban quedan fuera del promedio. Un cero no significa "no se midió": significa que había oportunidad y no se tomó.`,
      { color: GREY, size: 17 }), { after: 80, line: 220 }));
    const mejor = conDatos[0], peor = conDatos[conDatos.length - 1];
    cuerpo.push(tabla(
      ["Competencia", "Promedio", "n", ""],
      conDatos.map((c) => [c.label, num(c.promedio, 2), String(c.n), barra(c.promedio)]),
      [0.30, 0.14, 0.08, 0.48],
      { izquierda: [3],
        color: (f) => (f[0] === mejor.label ? VERDE : f[0] === peor.label ? ALERTA : null) },
    ));
    cuerpo.push(p([
      txt("Fortaleza y debilidad. ", { bold: true, size: 18 }),
      txt(`Lo más alto de la cohorte es ${mejor.label.toLowerCase()} (${num(mejor.promedio, 2)}, n=${mejor.n}); lo más bajo, ${peor.label.toLowerCase()} (${num(peor.promedio, 2)}, n=${peor.n}). Son los dos lugares donde una indicación en clase rinde más, porque el promedio de la cohorte se mueve entero.`,
        { color: GREY, size: 17 }),
    ], { before: 90, after: 0, line: 220 }));
  }

  // ── Ciclo de devolución ────────────────────────────────────────────────────
  if (d.devolucion.length) {
    cuerpo.push(h2("El ciclo de devolución"));
    cuerpo.push(p(txt(
      "GlorIA propone una evaluación al terminar la sesión, pero el estudiante no la ve hasta que su docente la revisa y la aprueba.",
      { color: GREY, size: 17 }), { after: 80, line: 220 }));
    cuerpo.push(tabla(
      ["Sección", "Docente", "Evaluaciones", "Aprobadas", "Pendientes", "Días (mediana)"],
      d.devolucion.map((x) => [x.seccion, x.docente, String(x.evaluaciones), String(x.aprobadas),
        String(x.pendientes), x.diasMediana === null ? "—" : num(x.diasMediana, 1)]),
      [0.20, 0.30, 0.13, 0.12, 0.12, 0.13],
      { color: (f, i) => (i === 4 && Number(f[4]) > 0 ? ALERTA : null) },
    ));
    const ed = d.edicionDocente;
    if (ed.evaluaciones > 0) {
      cuerpo.push(p([
        txt(`De ${ed.evaluaciones} evaluaciones, ${ed.notasAjustadas === 0 ? "ninguna nota propuesta fue modificada" : `${ed.notasAjustadas} tuvieron alguna nota ajustada`}`, { bold: true, size: 18 }),
        txt(` por el docente, y se escribieron ${ed.comentarios} comentarios de supervisión propios. Coincidir no es lo mismo que aprobar sin mirar: el dato que lo distingue es el tiempo entre aprobaciones, que se revisa aparte.`,
          { color: GREY, size: 17 }),
      ], { before: 90, after: 0, line: 220 }));
    }
  }

  // ── Longitudinal ───────────────────────────────────────────────────────────
  const L = d.longitudinal;
  if (L.alumnos >= 3 && L.filas.length) {
    cuerpo.push(h2("Mirada longitudinal"));
    cuerpo.push(p([
      txt(`${L.alumnos} estudiantes tienen dos sesiones evaluadas. ${L.mejoraron} mejoraron, ${L.empeoraron} bajaron.`, { bold: true, size: 18 }),
      txt(` La mediana de variación es de ${L.medianaCambio >= 0 ? "+" : ""}${num(L.medianaCambio, 2)} puntos en el promedio general.${L.alumnos < 15 ? " Con esta cantidad de casos es una señal temprana, no una conclusión." : ""}`,
        { color: GREY, size: 17 }),
    ], { after: 80, line: 220 }));
    cuerpo.push(tabla(
      ["Competencia", "1.ª sesión", "2.ª sesión", "Cambio", "n"],
      L.filas.map((f) => [f.label, num(f.primera, 2), num(f.segunda, 2),
        `${f.cambio >= 0 ? "+" : ""}${num(f.cambio, 2)}`, String(f.n)]),
      [0.36, 0.16, 0.16, 0.16, 0.16],
      { color: (f, i) => (i === 3 ? (f[3].startsWith("+") ? VERDE : ALERTA) : null) },
    ));
    cuerpo.push(p(txt(
      "Solo se tabulan las competencias con al menos tres pares comparables. Con menos, el promedio habla más del azar que del aprendizaje.",
      { color: GREY, size: 17 }), { before: 90, after: 0, line: 220 }));
  }

  cuerpo.push(p([
    txt("Nota metodológica. ", { bold: true, size: 15, color: FAINT }),
    txt("Datos de producción al momento de generar este documento. El tiempo se acota por conversación para que una pestaña olvidada no infle el registro. Los promedios excluyen las sesiones sin evidencia suficiente: es una línea base, no un diagnóstico de los estudiantes.",
      { size: 15, color: FAINT }),
  ], { before: 200, after: 0, line: 216 }));

  return Buffer.from(await Packer.toBuffer(armar(cuerpo, d)));
}

function armar(cuerpo: (Paragraph | Table)[], d: WeeklyReportData): Document {
  return new Document({
    creator: "GlorIA",
    title: `Uso de GlorIA — ${d.establecimiento}`,
    styles: { default: { document: { run: { font: "Calibri", size: 19, color: DARK } } } },
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: 15840 },
        margin: { top: MARGIN, bottom: 700, left: MARGIN, right: MARGIN } } },
      headers: { default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT, spacing: { after: 0 },
        children: [new ImageRun({ type: "png", data: GLORIA_LOGO_PNG, transformation: { width: 100, height: 23 } })],
      })] }) },
      footers: { default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { before: 120 },
        children: [
          txt("GlorIA — Página ", { size: 14, color: FAINT }),
          new TextRun({ children: [PageNumber.CURRENT], size: 14, color: FAINT, font: "Calibri" }),
          txt(" de ", { size: 14, color: FAINT }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: FAINT, font: "Calibri" }),
        ],
      })] }) },
      children: cuerpo,
    }],
  });
}

/** Nombre del archivo adjunto: legible y ordenable en la bandeja. */
export function weeklyReportFilename(d: WeeklyReportData): string {
  const slug = (s: string) => (s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 40) || "institucion";
  const dia = new Date(d.generadoEl).toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
  return `gloria-informe-${slug(d.establecimiento)}-${dia}.docx`;
}
