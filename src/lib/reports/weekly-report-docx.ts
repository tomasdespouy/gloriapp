import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType, PageNumber, PageBreak,
} from "docx";
import { GLORIA_LOGO_PNG } from "@/lib/branding-logo";
import { COMPETENCY_INFO } from "@/lib/competency-definitions";
import { COMPETENCY_RUBRIC } from "@/lib/competency-rubric";
import { plural, REGLAS, type WeeklyReportData } from "./weekly-report-data";

/**
 * El .docx del informe semanal (versión 2).
 *
 * No consulta la base: recibe los datos ya calculados, así el documento y la
 * foto guardada en report_runs.snapshot son necesariamente lo mismo.
 *
 * Todo el texto que aparece acá es plantilla con cifras, salvo `lectura`: la
 * lectura pedagógica de la semana la escribe o aprueba una persona y entra
 * como parámetro. Si no viene, esa sección no se imprime — nunca se rellena
 * con frases fijas que la semana siguiente ya no son ciertas.
 *
 * Las secciones sin datos suficientes se omiten con una línea que lo dice, en
 * vez de mostrar una tabla que engaña: un perfil de cohorte con una sola
 * evaluación son las notas de una persona.
 */

export type WeeklyReportOptions = {
  /** Lectura de la semana, escrita o aprobada por una persona. */
  lectura?: { parrafos: string[]; firma?: string };
  /** Recuadro que explica el cambio de método respecto de envíos anteriores. */
  avisoCambioMetodo?: boolean;
};

const INDIGO = "4A55A2", DARK = "1A1A1A", GREY = "55555F", FAINT = "86868F",
      BOX = "F0F2FA", BORDE = "D8DAE8", ZEBRA = "F7F8FC", ALERTA = "B3402B", VERDE = "2E6B4F",
      AVISO = "FFF8E6", AVISO_BORDE = "C9A227";

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

type POpts = { before?: number; after?: number; line?: number; keepNext?: boolean; indent?: number };
const p = (k: TextRun | TextRun[], o: POpts = {}) => new Paragraph({
  children: Array.isArray(k) ? k : [k],
  spacing: { before: o.before || 0, after: o.after === undefined ? 80 : o.after, line: o.line || 245 },
  keepNext: o.keepNext,
  indent: o.indent ? { left: o.indent, hanging: 260 } : undefined,
});

const nota = (t: string, o: POpts = {}) => p(txt(t, { color: GREY, size: 17 }), { after: 0, line: 220, ...o });
const letraChica = (t: string, o: POpts = {}) => p(txt(t, { size: 15, color: FAINT }), { before: 60, after: 0, line: 210, ...o });

const h2 = (t: string) => new Paragraph({
  spacing: { before: 240, after: 70, line: 220 }, keepNext: true,
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDE, space: 5 } },
  children: [txt(t, { color: FAINT, size: 15, bold: true, caps: true })],
});

const num = (n: number, dec = 0) =>
  n.toLocaleString("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const opt = (n: number | null, dec = 0) => (n === null ? "—" : num(n, dec));
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
const conPct = (a: number, b: number) => `${a}  (${pct(a, b)}%)`;
const signo = (x: number, dec = 2) => `${x > 0 ? "+" : ""}${num(x, dec)}`;

const fechaLarga = (iso: string) => new Date(iso).toLocaleDateString("es-CL", {
  timeZone: "America/Santiago", day: "numeric", month: "long", year: "numeric",
});
const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString("es-CL", {
  timeZone: "America/Santiago", day: "numeric", month: "long",
});

/** "14 al 21 de septiembre", o "28 de agosto al 4 de septiembre" si cambia el mes. */
const rango = (desde: string, hasta: string) => {
  const d = fechaCorta(desde), h = fechaCorta(hasta);
  const [dn, ...dm] = d.split(" de "), [, ...hm] = h.split(" de ");
  return dm.join(" de ") === hm.join(" de ") ? `${dn} al ${h}` : `${d} al ${h}`;
};

/** Barra proporcional sobre la escala completa (0 a 4). Un cero no dibuja nada. */
const barra = (v: number) => {
  const n = Math.round((v / 4) * 20);
  return n <= 0 ? "·" : "█".repeat(n);
};

type TablaOpts = { izquierda?: number[]; color?: (fila: string[], col: number) => string | null };

const tabla = (cabs: string[], filas: string[][], pesos: number[], opts: TablaOpts = {}) => {
  const anchos = pesos.map((x) => Math.round(W * x));
  const izq = (i: number) => i === 0 || (opts.izquierda || []).includes(i);
  const celda = (t: string, i: number, cab: boolean, zebra: boolean, color?: string | null) =>
    new TableCell({
      width: { size: anchos[i], type: WidthType.DXA },
      margins: { top: 30, bottom: 30, left: 110, right: 110 },
      shading: zebra ? { type: ShadingType.CLEAR, fill: ZEBRA, color: "auto" } : undefined,
      borders: { top: nb, bottom: linea, left: nb, right: nb },
      children: [new Paragraph({
        spacing: { before: 0, after: 0, line: 210 },
        alignment: izq(i) ? AlignmentType.LEFT : AlignmentType.RIGHT,
        children: [txt(t, cab
          ? { size: 14, bold: true, color: FAINT, caps: true }
          : { size: 17, color: color || (i === 0 ? DARK : GREY), bold: !!color, mono: !izq(i) })],
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

/** Recuadro con borde a la izquierda: titular o aviso. */
const recuadro = (hijos: Paragraph[], fondo = BOX, borde = INDIGO) => new Table({
  width: { size: W, type: WidthType.DXA }, columnWidths: [W],
  borders: { ...nbs, left: { style: BorderStyle.SINGLE, size: 18, color: borde } },
  rows: [new TableRow({ children: [new TableCell({
    width: { size: W, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: fondo, color: "auto" },
    margins: { top: 140, bottom: 140, left: 220, right: 220 },
    borders: { top: nb, bottom: nb, right: nb, left: { style: BorderStyle.SINGLE, size: 18, color: borde } },
    children: hijos,
  })] })],
});

/** Cifras grandes en una fila. */
const cifras = (items: { valor: string; rotulo: string; sub: string }[]) => {
  const ancho = Math.round(W / items.length);
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: items.map(() => ancho), borders: nbs,
    rows: [new TableRow({ children: items.map((it) => new TableCell({
      width: { size: ancho, type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      borders: { top: nb, bottom: nb, left: nb, right: nb },
      children: [
        p(txt(it.rotulo, { size: 13, bold: true, color: FAINT, caps: true }), { after: 20 }),
        p(txt(it.valor, { size: 30, bold: true, color: DARK }), { after: 10, line: 300 }),
        p(txt(it.sub, { size: 15, color: GREY }), { after: 0, line: 200 }),
      ],
    })) })],
  });
};

const vineta = (t: string) => p(txt(`•  ${t}`, { size: 17, color: GREY }), { after: 30, line: 220, indent: 260 });

export async function buildWeeklyReportDocx(
  d: WeeklyReportData,
  opts: WeeklyReportOptions = {},
): Promise<Buffer> {
  const t = d.totales;
  const cuerpo: (Paragraph | Table)[] = [];
  const cambio = d.rubrica.cambios[0];

  // ── Cabecera ───────────────────────────────────────────────────────────────
  cuerpo.push(
    p(txt(`${d.establecimiento} · Informe semanal de uso`, { color: INDIGO, size: 14, bold: true, caps: true }), { after: 50 }),
    p(txt("Uso de GlorIA", { bold: true, size: 34 }), { after: 60, line: 280 }),
    p(txt(`${d.cursos.length ? `${d.cursos.join(" · ")} · ` : ""}Corte al ${fechaLarga(d.generadoEl)}`,
      { color: GREY, size: 18 }), { after: 30, line: 220 }),
    p(txt(`Últimos siete días (${rango(d.ventana.desde, d.ventana.hasta)}): ${plural(t.sesionesUltimos7, "sesión nueva", "sesiones nuevas")}. La semana anterior: ${t.sesionesSemanaAnterior}.`,
      { color: GREY, size: 17 }), { after: 140, line: 220 }),
  );

  if (opts.avisoCambioMetodo) {
    cuerpo.push(recuadro([
      p(txt("Qué cambió en este informe", { color: "8A6D12", size: 14, bold: true, caps: true }), { after: 60 }),
      p(txt("Desde esta semana el informe se genera con una versión nueva, más completa, que reúne en un solo documento lo que antes llegaba por separado. Estos cambios pueden hacer que algunas cifras no coincidan con envíos anteriores:", { size: 17 }), { after: 50, line: 220 }),
      ...(cambio ? [vineta(`${cambio.label}: su escala se precisó el ${fechaLarga(cambio.fecha)}. Sus promedios usan solo evaluaciones desde esa fecha, porque las anteriores no son comparables.`)] : []),
      vineta("Las sesiones que se aprobaron sin haber sido evaluadas por GlorIA ya no se cuentan como evaluaciones con nota cero."),
      vineta(`La comparación entre la primera y la última sesión de cada estudiante exige al menos ${REGLAS.MIN_MENSAJES_COMPARABLE} mensajes en cada una, para no comparar contra sesiones abandonadas a los pocos minutos.`),
      vineta(`Los promedios y medianas se muestran desde ${REGLAS.MIN_N} casos. Con menos, la cifra refleja a muy pocas personas y no a un grupo.`),
      p(txt("•  La supervisión de cada sección incluye ahora a los docentes asignados a toda la asignatura, que antes no se mostraban.", { size: 17, color: GREY }), { after: 0, line: 220, indent: 260 }),
    ], AVISO, AVISO_BORDE));
    cuerpo.push(p(txt(""), { after: 100 }));
  }

  // ── Lo más accionable ──────────────────────────────────────────────────────
  cuerpo.push(recuadro([
    p(txt("Lo más accionable", { color: INDIGO, size: 14, bold: true, caps: true }), { after: 60 }),
    p(txt(d.titular.texto, { bold: true, size: 21 }), { after: 70, line: 270 }),
    p(txt(d.titular.detalle, { color: GREY, size: 17 }), { after: 0, line: 220 }),
  ]));

  cuerpo.push(p(txt(""), { after: 80 }));
  cuerpo.push(cifras([
    { rotulo: "Practicaron", valor: `${t.practicaron} de ${t.alumnos}`, sub: `${pct(t.practicaron, t.alumnos)}% del curso` },
    { rotulo: "Sesiones", valor: num(t.sesiones), sub: `${t.sesionesUltimos7} en los últimos 7 días` },
    { rotulo: "Con devolución", valor: num(t.conDevolucion), sub: `de ${t.practicaron} que practicaron` },
    { rotulo: "Por revisar", valor: num(t.pendientes), sub: t.pendientes === 1 ? "evaluación" : "evaluaciones" },
  ]));

  // ── Lectura de la semana (escrita por una persona) ─────────────────────────
  if (opts.lectura?.parrafos.length) {
    cuerpo.push(h2("Lectura de la semana"));
    const ult = opts.lectura.parrafos.length - 1;
    opts.lectura.parrafos.forEach((par, i) =>
      cuerpo.push(p(txt(par, { size: 18 }), { after: i === ult ? 40 : 90, line: 250 })));
    if (opts.lectura.firma) cuerpo.push(p(txt(opts.lectura.firma, { size: 15, color: FAINT, italic: true }), { after: 0 }));
  }

  // ── Próximos pasos (reglas sobre los datos) ────────────────────────────────
  if (d.proximosPasos.length) {
    cuerpo.push(h2("Qué destrabaría el avance"));
    d.proximosPasos.forEach((paso, i) =>
      cuerpo.push(p([txt(`${i + 1}.  `, { bold: true, color: INDIGO, size: 18 }), txt(paso, { size: 18 })],
        { after: 70, line: 240, indent: 300 })));
  }

  // ── Embudo ─────────────────────────────────────────────────────────────────
  cuerpo.push(h2("Del acceso a la práctica"));
  cuerpo.push(nota("Cada fila es una etapa del recorrido del estudiante. La distancia entre dos filas muestra dónde se están quedando.", { after: 80 }));
  cuerpo.push(embudo(d));

  if (!d.hayActividad) {
    cuerpo.push(notaMetodologica(d));
    cuerpo.push(...anexo(d));
    return Buffer.from(await Packer.toBuffer(armar(cuerpo, d)));
  }

  // ── Participación por sección ──────────────────────────────────────────────
  if (d.secciones.length > 1) {
    cuerpo.push(h2("Participación por sección"));
    const filas = d.secciones.map((s) => [
      s.nombre, String(s.alumnos), conPct(s.ingresaron, s.alumnos), conPct(s.practicaron, s.alumnos),
      conPct(s.conDevolucion, s.alumnos), String(s.sesiones), String(s.sesionesSemana),
    ]);
    filas.push(["Total", String(t.alumnos), conPct(t.ingresaron, t.alumnos), conPct(t.practicaron, t.alumnos),
      conPct(t.conDevolucion, t.alumnos), String(t.sesiones), String(t.sesionesUltimos7)]);
    cuerpo.push(tabla(
      ["Sección", "Estudiantes", "Ingresaron", "Practicaron", "Con devolución", "Sesiones", "Últimos 7 días"],
      filas, [0.17, 0.12, 0.15, 0.15, 0.16, 0.11, 0.14],
      { color: (f) => (f[0] === "Total" ? DARK : null) },
    ));
  }

  // ── Cómo se practica ───────────────────────────────────────────────────────
  if (t.sesiones >= REGLAS.MIN_N && d.ritmo.length) {
    cuerpo.push(h2("Cómo se practica"));
    cuerpo.push(nota("La tabla separa la primera, la segunda y las siguientes sesiones de cada estudiante, porque la segunda entrevista no se parece a la primera. Cuenta solo sesiones con contenido (al menos 5 minutos o 6 mensajes); el tiempo es la mediana de tiempo activo, acotado.", { after: 80 }));
    cuerpo.push(tabla(
      ["Sesión del estudiante", "Sesiones", "Estudiantes", "Minutos (mediana)", "Mensajes (mediana)"],
      d.ritmo.map((r) => [r.etiqueta, String(r.sesiones), String(r.estudiantes), opt(r.minutosMediana, 1), opt(r.mensajesMediana)]),
      [0.28, 0.16, 0.16, 0.20, 0.20],
    ));
    if (d.ritmo.some((r) => r.minutosMediana === null)) {
      cuerpo.push(letraChica(`— : menos de ${REGLAS.MIN_N} sesiones; con tan pocas, la mediana describiría a personas y no a un grupo.`));
    }
    cuerpo.push(nota(`En total, ${num(t.horasTotales, 1)} horas de práctica clínica acumuladas.`, { before: 80 }));
  }

  // ── Ciclo de devolución ────────────────────────────────────────────────────
  if (d.devolucion.length) {
    cuerpo.push(h2("El ciclo de devolución"));
    cuerpo.push(nota("GlorIA propone una evaluación al cerrar cada sesión, pero el estudiante no la ve hasta que su docente la revisa y la aprueba. Ese paso es el que convierte la práctica en aprendizaje.", { after: 80 }));
    cuerpo.push(tabla(
      ["Sección", "Supervisión", "Evaluaciones", "Aprobadas", "Por revisar", "Más antigua (días)", "Espera (mediana, días)"],
      d.devolucion.map((x) => [x.seccion, x.supervision, String(x.evaluaciones), String(x.aprobadas),
        String(x.pendientes), opt(x.pendienteMasAntiguaDias), opt(x.esperaMediana, 1)]),
      [0.14, 0.26, 0.11, 0.10, 0.11, 0.13, 0.15],
      { izquierda: [1], color: (f, i) => (i === 4 && Number(f[4]) > 0 ? ALERTA : null) },
    ));
    cuerpo.push(letraChica(`Espera: días desde que el estudiante cierra la sesión hasta que su devolución se aprueba; para las que siguen por revisar, hasta hoy. Se muestra desde ${REGLAS.MIN_N} evaluaciones.`));
    const ed = d.edicionDocente;
    const sinEval = d.devolucion.reduce((s, x) => s + x.sinEvaluacion, 0);
    const partes: string[] = [];
    if (ed.aprobadas > 0) {
      const base = ed.aprobadas === 1 ? "la evaluación aprobada" : `las ${ed.aprobadas} evaluaciones aprobadas`;
      partes.push(ed.notasAjustadas === 0
        ? `Al aprobar, no se modificó ninguna de las notas propuestas por GlorIA en ${base}`
        : `Al aprobar, se modificó alguna nota propuesta por GlorIA en ${ed.notasAjustadas} de ${base}`);
      partes.push(ed.comentarios === ed.aprobadas
        ? (ed.aprobadas === 1 ? "lleva un comentario de supervisión para el estudiante." : "todas llevan un comentario de supervisión para el estudiante.")
        : `${ed.comentarios} ${ed.comentarios === 1 ? "lleva" : "llevan"} un comentario de supervisión para el estudiante.`);
    }
    let texto = partes.length ? `${partes[0]}; ${partes[1]}` : "";
    if (sinEval) texto += `${texto ? " " : ""}Además, ${plural(sinEval, "sesión completa quedó", "sesiones completas quedaron")} sin evaluación de GlorIA por una falla de nuestro lado, no de los estudiantes.`;
    if (texto) cuerpo.push(nota(texto, { before: 80 }));
  }

  // ── Perfil de competencias ─────────────────────────────────────────────────
  cuerpo.push(h2("Perfil de competencias del curso"));
  const conN = d.competencias.filter((c) => c.promedio !== null && c.n >= REGLAS.MIN_N);
  if (t.evaluaciones < REGLAS.MIN_N || !conN.length) {
    cuerpo.push(nota(`Con ${plural(t.evaluaciones, "evaluación", "evaluaciones")} todavía no se muestra un perfil del curso (se muestra desde ${REGLAS.MIN_N}): ${t.evaluaciones === 1 ? "la cifra sería la nota de una sola persona" : "las cifras serían las notas de muy pocas personas"}.`));
  } else {
    cuerpo.push(nota(`${plural(t.evaluaciones, "sesión evaluada", "sesiones evaluadas")} con el marco de competencias de Valdés Sánchez y Gómez Gallo (2023), en escala de 0 a 4. La columna n cuenta las sesiones donde la competencia era evaluable: las que no aplicaban quedan fuera del promedio. Un 0 no es "no se midió": es que había oportunidad y no se tomó.`, { after: 80 }));
    const orden = [...conN].sort((a, b) => (b.promedio ?? 0) - (a.promedio ?? 0));
    const max = orden[0].promedio, min = orden[orden.length - 1].promedio;
    const unicoMax = orden.filter((c) => c.promedio === max).length === 1;
    const unicoMin = orden.filter((c) => c.promedio === min).length === 1;
    cuerpo.push(tabla(
      ["Competencia", "Dominio", "Promedio", "n", ""],
      orden.map((c) => [`${c.label}${c.soloEscalaVigente ? " *" : ""}`, c.dominio, num(c.promedio ?? 0, 2), String(c.n), barra(c.promedio ?? 0)]),
      [0.30, 0.14, 0.12, 0.08, 0.36],
      { izquierda: [1, 4], color: (f) => (unicoMax && f[2] === num(max ?? 0, 2) ? VERDE : unicoMin && f[2] === num(min ?? 0, 2) ? ALERTA : null) },
    ));
    if (cambio) {
      cuerpo.push(letraChica(`* ${cambio.label}: solo evaluaciones desde el ${fechaLarga(cambio.fecha)} (rúbrica ${cambio.version}), porque ese día se precisó su escala y las notas anteriores no son comparables.`));
    }
    if (unicoMax && unicoMin && orden.length > 2) {
      cuerpo.push(nota(`Lo más alto del curso es ${orden[0].label.toLowerCase()} (${num(max ?? 0, 2)}); lo más bajo, ${orden[orden.length - 1].label.toLowerCase()} (${num(min ?? 0, 2)}).`, { before: 80 }));
    }
  }

  // ── Primera contra última sesión ───────────────────────────────────────────
  const L = d.longitudinal;
  cuerpo.push(h2("Primera contra última sesión"));
  if (L.pares < REGLAS.MIN_N || !L.filas.length) {
    cuerpo.push(nota(L.pares
      ? `Hay ${plural(L.pares, "estudiante", "estudiantes")} con dos sesiones comparables. La comparación se muestra desde ${REGLAS.MIN_N}.`
      : `Todavía no hay estudiantes con dos sesiones comparables (al menos ${REGLAS.MIN_MENSAJES_COMPARABLE} mensajes cada una).`));
  } else {
    const sinCambio = L.pares - L.mejoraron - L.empeoraron;
    cuerpo.push(p([
      txt(`De los estudiantes con dos sesiones comparables (${L.pares}), ${L.mejoraron} ${L.mejoraron === 1 ? "subió" : "subieron"} su nota general, ${L.empeoraron} ${L.empeoraron === 1 ? "bajó" : "bajaron"}${sinCambio ? ` y ${sinCambio} se ${sinCambio === 1 ? "mantuvo" : "mantuvieron"}` : ""}.`, { bold: true, size: 18 }),
      txt(` La mediana de variación es de ${signo(L.medianaCambio)} puntos en escala de 0 a 4.${L.pares < 15 ? " Con esta cantidad de casos es una señal temprana, no una conclusión." : ""}`, { color: GREY, size: 17 }),
    ], { after: 80, line: 220 }));
    cuerpo.push(tabla(
      ["Competencia", "Primera sesión", "Última sesión", "Cambio", "n"],
      L.filas.map((f) => [f.label, num(f.primera, 2), num(f.ultima, 2), signo(f.cambio), String(f.n)]),
      [0.36, 0.17, 0.17, 0.16, 0.14],
      { color: (f, i) => (i === 3 ? (f[3].startsWith("+") ? VERDE : f[3].startsWith("-") ? ALERTA : null) : null) },
    ));
    cuerpo.push(nota("Cómo leerla: casi siempre se compara la entrevista inicial con una de seguimiento del mismo paciente, y algunas competencias, como objetivos, dependen de la etapa del proceso. La variación no separa el aprendizaje de la etapa en que está la entrevista.", { before: 80 }));
    cuerpo.push(letraChica(`Se comparan la primera y la última sesión de cada estudiante cuando ambas tienen al menos ${REGLAS.MIN_MENSAJES_COMPARABLE} mensajes${L.excluidosPorLargo ? ` (${plural(L.excluidosPorLargo, "estudiante quedó", "estudiantes quedaron")} fuera por sesiones más cortas)` : ""}. La variación general es el promedio de la variación de las competencias comparables de cada estudiante; se muestran las que tienen al menos ${REGLAS.MIN_N} pares. Conducta no verbal no se incluye: su nota depende de cuántas señales no verbales muestre el paciente en cada sesión, y esa frecuencia varía entre sesiones.`));
  }

  // ── Seguridad y uso ────────────────────────────────────────────────────────
  const s = d.seguridad;
  cuerpo.push(h2("Seguridad y uso"));
  const pegado = s.sesionesMedidasPegado === 0
    ? `El texto pegado en el chat se registra desde el ${fechaCorta(s.pegadoDesde)}; ninguna sesión de este curso es posterior a esa fecha, así que ahí no hay medición.`
    : null;
  if (!s.alertasPendientes.length && !s.sesionesAntiprofesional && !s.sesionesConPegado) {
    cuerpo.push(nota(`Sin alertas pendientes de revisión y sin sesiones con conducta antiprofesional registrada.${pegado ? ` ${pegado}` : s.sesionesMedidasPegado ? ` Ninguna de las ${s.sesionesMedidasPegado} sesiones medidas tiene texto pegado en el chat.` : ""}`));
  } else {
    const filas: string[][] = [
      ...s.alertasPendientes.map((a) => [`Alerta automática aún no revisada: ${a.tipo.toLowerCase()}`, String(a.n)]),
      ["Sesiones con conducta antiprofesional registrada", String(s.sesionesAntiprofesional)],
      ...(s.sesionesMedidasPegado ? [[`Sesiones donde se pegó texto en el chat (de ${s.sesionesMedidasPegado} medidas)`, String(s.sesionesConPegado)]] : []),
    ];
    cuerpo.push(tabla(["Indicador", "Sesiones"], filas, [0.8, 0.2]));
    cuerpo.push(nota(`Las alertas se generan automáticamente y el equipo GlorIA las revisa; se muestran solo las que aún no han sido revisadas. ${pegado ?? `El texto pegado se registra desde el ${fechaCorta(s.pegadoDesde)}.`}`, { before: 80 }));
  }

  cuerpo.push(notaMetodologica(d));
  cuerpo.push(...anexo(d));

  return Buffer.from(await Packer.toBuffer(armar(cuerpo, d)));
}

function embudo(d: WeeklyReportData): Table {
  const e = d.embudo;
  const filas: [string, number][] = [
    ["Se les enviaron credenciales", e.credenciales],
    ["Ingresaron a la plataforma", e.ingresaron],
    ["Activaron su cuenta (cambiaron la clave temporal)", e.activaron],
    ["Hicieron al menos una sesión", e.practicaron],
    ["Tienen su retroalimentación disponible", e.conDevolucion],
  ];
  return tabla(
    ["Etapa", "Estudiantes", "Del total", ""],
    filas.map(([paso, n]) => [paso, String(n), `${pct(n, e.alumnos)}%`, barra((4 * n) / Math.max(1, e.alumnos))]),
    [0.46, 0.14, 0.12, 0.28],
    { izquierda: [3] },
  );
}

function notaMetodologica(d: WeeklyReportData): Paragraph {
  return p([
    txt("Nota metodológica. ", { bold: true, size: 15, color: FAINT }),
    txt(`Datos de la plataforma al momento de generar este documento; no incluye cuentas del equipo GlorIA ni nombres de estudiantes. El tiempo de cada sesión se acota para que una pestaña olvidada no infle el registro. En las notas, "no aplicaba" queda fuera del promedio y el 0 cuenta. Rúbrica vigente: ${d.rubrica.vigente}. Informe versión ${d.version}.`,
      { size: 15, color: FAINT }),
  ], { before: 240, after: 0, line: 216 });
}

function anexo(d: WeeklyReportData): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [
    new Paragraph({ children: [new PageBreak()] }),
    p(txt("Anexo", { color: INDIGO, size: 14, bold: true, caps: true }), { after: 50 }),
    p(txt("Las 10 competencias y sus niveles", { bold: true, size: 28 }), { after: 80, line: 260 }),
    nota(`Marco de competencias psicoterapéuticas genéricas de Valdés Sánchez y Gómez Gallo (2023), Universidad Santo Tomás. Los descriptores de nivel son redacción propia de GlorIA basada en ese marco (rúbrica ${d.rubrica.vigente}). Escala: 0 = había oportunidad y no se tomó; 1 a 4 = niveles de logro; "no aplicaba" = la situación no se presentó y queda fuera del promedio.`, { after: 60 }),
  ];
  for (const [key, info] of Object.entries(COMPETENCY_INFO)) {
    const r = COMPETENCY_RUBRIC[key as keyof typeof COMPETENCY_RUBRIC];
    if (!r) continue;
    out.push(p([
      txt(info.name, { bold: true, size: 19 }),
      txt(`  ·  ${info.domain === "estructura" ? "Estructura" : "Actitudes"}`, { size: 15, color: FAINT, caps: true }),
    ], { before: 180, after: 40, keepNext: true }));
    out.push(p(txt(info.definition, { size: 17, color: GREY, italic: true }), { after: 60, line: 220, keepNext: true }));
    out.push(tabla(["Nivel", "Qué se observa"],
      ([1, 2, 3, 4] as const).map((n) => [String(n), r.levels[n]]),
      [0.1, 0.9], { izquierda: [1] }));
  }
  return out;
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
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 70) || "institucion";
  const dia = new Date(d.generadoEl).toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
  return `gloria-informe-${slug(d.establecimiento)}-${dia}.docx`;
}
