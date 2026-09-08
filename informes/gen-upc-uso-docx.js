/**
 * Informe de uso para UPC — Psicopatología del Adulto, 2026-20.
 *
 * Dirigido al CLIENTE, no interno. Por eso:
 *  - No lleva nombres de estudiantes (eso va a cada docente sobre su sección).
 *  - No lleva defectos internos de la plataforma.
 *  - El eje es lo que UPC puede accionar, no lo que nosotros tenemos que arreglar.
 *
 * OJO con la rúbrica: la escala es 1 a 4 y el 0 significa "no observado", NO una
 * nota. Promediar incluyendo los ceros da cifras falsas (conducta no verbal
 * pasaba de 1,00 real a 0,52). Todos los promedios de acá excluyen los ceros y
 * declaran su n.
 */
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType, PageNumber, PageBreak,
} = require("C:/Users/tomas/documents/gloriapp/node_modules/docx");

const ROOT = "C:/Users/tomas/documents/gloriapp/";
const logo = fs.readFileSync(ROOT + "public/branding/gloria-logo.png");

const INDIGO = "4A55A2", DARK = "1A1A1A", GREY = "55555F", FAINT = "86868F",
      BOX = "F0F2FA", BORDE = "D8DAE8", ZEBRA = "F7F8FC", ALERTA = "B3402B", VERDE = "2E6B4F";

const PAGE_W = 12240, MARGIN = 1080;
const W = PAGE_W - 2 * MARGIN;

const nb = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const nbs = { top: nb, bottom: nb, left: nb, right: nb, insideHorizontal: nb, insideVertical: nb };
const linea = { style: BorderStyle.SINGLE, size: 2, color: "EFEFF1" };

const txt = (t, o = {}) => new TextRun({
  text: t, bold: !!o.bold, italics: !!o.italic, color: o.color || DARK,
  size: o.size || 19, font: o.mono ? "Consolas" : "Calibri",
  allCaps: !!o.caps, characterSpacing: o.caps ? 20 : undefined,
});
const p = (k, o = {}) => new Paragraph({
  children: Array.isArray(k) ? k : [k],
  spacing: { before: o.before || 0, after: o.after === undefined ? 80 : o.after, line: o.line || 245 },
  keepNext: o.keepNext, border: o.border, indent: o.indent,
});
const h2 = (t) => new Paragraph({
  spacing: { before: 140, after: 55, line: 220 }, keepNext: true,
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDE, space: 5 } },
  children: [txt(t, { color: FAINT, size: 15, bold: true, caps: true })],
});

const tabla = (cabs, filas, pesos, opts = {}) => {
  const anchos = pesos.map((x) => Math.round(W * x));
  const celda = (t, i, cab, zebra, color) => new TableCell({
    width: { size: anchos[i], type: WidthType.DXA },
    margins: { top: 24, bottom: 24, left: 110, right: 110 },
    shading: zebra ? { type: ShadingType.CLEAR, fill: ZEBRA } : undefined,
    borders: { top: nb, bottom: linea, left: nb, right: nb },
    children: [new Paragraph({
      spacing: { before: 0, after: 0, line: 202 },
      alignment: (i === 0 || (opts.izquierda || []).includes(i)) ? AlignmentType.LEFT : AlignmentType.RIGHT,
      children: [txt(t, cab ? { size: 14, bold: true, color: FAINT, caps: true }
                             : { size: 17, color: color || (i === 0 ? DARK : GREY), bold: !!color, mono: i > 0 && !(opts.izquierda || []).includes(i) })],
    })],
  });
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: anchos, borders: nbs,
    rows: [
      new TableRow({ tableHeader: true, children: cabs.map((t, i) => celda(t, i, true)) }),
      ...filas.map((f, r) => new TableRow({
        children: f.map((t, i) => celda(String(t), i, false, r % 2 === 1, opts.color && opts.color(f, i))),
      })),
    ],
  });
};

// ── Datos (producción, 7 de septiembre de 2026) ──────────────────────────────
const SECCIONES = [
  ["Sección 17175", "40", "39", "39", "39", "18,9", "34", "39"],
  ["Sección 17177", "40", "35", "33", "57", "20,8", "34", "2"],
  ["Sección 17174", "30", "20", "1", "1", "9,4", "15", "0"],
  ["Total", "110", "94", "73", "97", "19,4", "34", "41"],
];

// Estado del ciclo de devolución, por sección. Cada sección tiene su docente.
const DEVOLUCION = [
  ["Sección 17175", "Carmen D. Sánchez", "39", "39", "0", "0,4"],
  ["Sección 17177", "Ana Laura Silva", "36", "2", "34", "1,6"],
  ["Sección 17174", "Rosa E. Montes", "1", "0", "1", "—"],
];

// Primera contra última sesión de las 9 alumnas que ya tienen dos evaluadas.
// Solo competencias con al menos 3 pares comparables: con menos, el promedio
// dice más del azar que del aprendizaje.
const LONGITUDINAL = [
  ["Escucha activa", "2,00", "2,88", "+0,88", "8"],
  ["Presencia", "1,88", "2,50", "+0,63", "8"],
  ["Contención de afectos", "1,75", "2,25", "+0,50", "8"],
  ["Setting terapéutico", "2,00", "2,43", "+0,43", "7"],
  ["Datos contextuales", "2,50", "2,88", "+0,38", "8"],
  ["Optimismo", "2,33", "2,67", "+0,33", "3"],
  ["Actitud no valorativa", "3,13", "3,38", "+0,25", "8"],
];

const COMPETENCIAS = [
  ["Actitud no valorativa", "2,99", "75"],
  ["Motivo de consulta", "2,73", "63"],
  ["Datos contextuales", "2,60", "75"],
  ["Escucha activa", "2,56", "75"],
  ["Optimismo", "2,48", "31"],
  ["Presencia", "2,04", "74"],
  ["Contención de afectos", "1,96", "74"],
  ["Setting terapéutico", "1,83", "70"],
  ["Objetivos", "1,59", "17"],
  ["Conducta no verbal", "1,00", "40"],
];

// Barra proporcional sobre la escala completa (0 a 4). Se dibuja con bloques
// y no con una imagen para que el .docx siga siendo un documento editable y
// no dependa de nada externo para renderizarse.
const barra = (valor) => {
  const n = Math.max(1, Math.round((parseFloat(String(valor).replace(",", ".")) / 4) * 20));
  return "█".repeat(n);
};

const doc = new Document({
  creator: "GlorIA",
  title: "Uso de GlorIA en UPC — Psicopatología del Adulto 2026-20",
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: 15840 },
      margin: { top: MARGIN, bottom: 500, left: MARGIN, right: MARGIN } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 },
      children: [new ImageRun({ data: logo, type: "png", transformation: { width: 100, height: 33 } })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
      txt("GlorIA — Página ", { size: 14, color: FAINT }),
      new TextRun({ children: [PageNumber.CURRENT], size: 14, color: FAINT, font: "Calibri" }),
      txt(" de ", { size: 14, color: FAINT }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: FAINT, font: "Calibri" }),
    ] })] }) },
    children: [
      p(txt("Universidad Peruana de Ciencias Aplicadas · Psicopatología del Adulto · 2026-20", { color: INDIGO, size: 14, bold: true, caps: true }), { after: 50 }),
      p(txt("Primeras dos semanas de uso", { bold: true, size: 34 }), { after: 70, line: 280 }),
      p(txt("110 estudiantes de tres secciones recibieron acceso entre el 31 de agosto y el 1 de septiembre. Este informe cubre hasta el 8 de septiembre e incluye el primer contraste entre la primera y la segunda entrevista.",
            { color: GREY, size: 18 }), { after: 110, line: 220 }),

      // Hallazgo
      new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], borders: nbs,
        rows: [new TableRow({ children: [new TableCell({
          width: { size: W, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: BOX },
          margins: { top: 120, bottom: 120, left: 220, right: 220 },
          borders: { top: nb, bottom: nb, right: nb, left: { style: BorderStyle.SINGLE, size: 18, color: INDIGO } },
          children: [
            p(txt("Lo más accionable", { color: INDIGO, size: 14, bold: true, caps: true }), { after: 60 }),
            p(txt("La 17177 practicó en clase el domingo y pasó de 30 a 57 sesiones en una noche. Sus 34 evaluaciones esperan revisión docente: hasta que se aprueben, sus alumnas no ven nada.",
                  { bold: true, size: 21 }), { after: 70, line: 270 }),
            p(txt("Las dos decisiones que mueven la aguja son del docente, y la 17177 ya tomó la primera: agendar la práctica en un bloque de clase en vez de dejarla como tarea. Falta la segunda, revisar y aprobar la devolución, que es el paso que la hace visible al alumno. La 17175 tiene las dos cerradas y por eso sus 39 alumnas ya tienen retroalimentación.",
                  { color: GREY, size: 17 }), { after: 0, line: 220 }),
          ] })] })] }),

      h2("Participación por sección"),
      tabla(["Sección", "Alumnos", "Ingresó", "Practicó", "Sesiones", "Min. med.", "Mensajes", "Con devolución"],
        SECCIONES, [0.18, 0.10, 0.14, 0.14, 0.10, 0.09, 0.10, 0.15],
        { color: (f) => (f[0] === "Total" ? DARK : null) }),
      p(txt("Las sesiones duran una mediana de 19,4 minutos y 34 mensajes: son entrevistas clínicas completas, no exploraciones breves de la herramienta. En total, 31,9 horas de práctica clínica acumuladas.",
            { color: GREY, size: 17 }), { before: 90, after: 0, line: 220 }),

      h2("Perfil de competencias de la cohorte"),
      p(txt("76 sesiones evaluadas, sobre el marco de 10 competencias de Valdés y Gómez, en escala de 1 a 4. La columna n son las sesiones con evidencia suficiente: una primera entrevista de 19 minutos no siempre llega a formular objetivos, y esas se excluyen del promedio en vez de puntuarse con cero.",
            { color: GREY, size: 17 }), { after: 80, line: 220 }),
      tabla(["Competencia", "Promedio", "n", ""],
        COMPETENCIAS.map((f) => [...f, barra(f[1])]), [0.30, 0.14, 0.08, 0.48],
        { izquierda: [3],
          color: (f) => (f[0] === "Actitud no valorativa" ? VERDE : f[0] === "Conducta no verbal" ? ALERTA : null) }),

      p([txt("Dos hallazgos enseñables. ", { bold: true, size: 18 }),
         txt("El primero: el ", { color: GREY, size: 17 }),
         txt("setting terapéutico", { bold: true, size: 17 }),
         txt(" sigue siendo la debilidad más extendida (1,83, aunque subió desde 1,63 la semana pasada): la mayoría no explicita encuadre —presentarse, duración, confidencialidad— al abrir. El segundo es más marcado: en ", { color: GREY, size: 17 }),
         txt("conducta no verbal", { bold: true, size: 17 }),
         txt(", 36 sesiones no ofrecieron evidencia y las otras 40 quedaron todas en nivel 1: en 97 entrevistas, ninguna superó el mínimo. Llama la atención porque el paciente describe sus gestos entre corchetes en cada mensaje. La información está a la vista y no se recoge.", { color: GREY, size: 17 })],
        { before: 90, after: 0, line: 220 }),

      p([txt("Como contrapeso, la ", { color: GREY, size: 17 }),
         txt("actitud no valorativa", { bold: true, size: 17 }),
         txt(" es la fortaleza clara de la cohorte (2,99): 68 de 75 sesiones en nivel 3 o superior. Sostienen una postura de aceptación sin juicio, que es la base de todo lo demás.", { color: GREY, size: 17 })],
        { before: 70, after: 0, line: 220 }),

      new Paragraph({ children: [new PageBreak()] }),

      h2("El ciclo de devolución"),
      p(txt("GlorIA propone una evaluación al terminar la sesión, pero el estudiante no la ve hasta que su docente la revisa y la aprueba. Ese paso es el que hoy separa a una sección de las otras dos.",
            { color: GREY, size: 17 }), { after: 80, line: 220 }),
      tabla(["Sección", "Docente", "Evaluaciones", "Aprobadas", "Pendientes", "Días (mediana)"],
        DEVOLUCION, [0.20, 0.24, 0.16, 0.14, 0.14, 0.12]),
      p([txt("La 17175 tiene el ciclo cerrado y rápido: ", { color: GREY, size: 17 }),
         txt("mediana de 0,4 días", { bold: true, size: 17 }),
         txt(" entre que GlorIA propone la evaluación y la docente la aprueba, con 25 de 41 revisadas en menos de 24 horas. La 17177 acumuló 34 evaluaciones pendientes tras la clase del domingo: sus alumnas practicaron y todavía no ven nada. Es el cuello de botella de esta semana.", { color: GREY, size: 17 })],
        { before: 90, after: 70, line: 220 }),

      h2("Cuánto corrige el docente a GlorIA"),
      p([txt("En las 76 evaluaciones generadas, ninguna nota propuesta fue modificada", { bold: true, size: 18 }),
         txt(" ni se reescribió el comentario de GlorIA. Lo que sí se hizo fue agregar el propio: 41 comentarios de supervisión, todos distintos entre sí, de unas 380 palabras cada uno.", { color: GREY, size: 17 })],
        { after: 70, line: 220 }),
      p(txt("Conviene leerlo con cuidado: coincidir no es lo mismo que aprobar sin mirar. Las aprobaciones se repartieron en tres días, con una mediana de seis minutos entre una y otra, y ninguna a menos de un minuto de la anterior. El patrón es el de alguien que revisa cada sesión, valida la evaluación automática y le suma su propia lectura clínica. Aun así, la cifra vale la pena mirarla en la próxima tanda: si con más sesiones sigue en cero, vale preguntarse si la rúbrica está midiendo lo que la asignatura espera.",
            { color: GREY, size: 17 }), { after: 0, line: 220 }),

      h2("Mirada longitudinal"),
      p([txt("Ya hay 9 alumnas con dos sesiones evaluadas. Seis mejoraron, tres bajaron.", { bold: true, size: 18 }),
         txt(" La mediana de variación es de +0,4 puntos en el promedio general. Con nueve casos esto es una señal temprana, no una conclusión: se reporta porque el sentido es consistente competencia por competencia, no porque el número sea concluyente.", { color: GREY, size: 17 })],
        { after: 80, line: 220 }),
      tabla(["Competencia", "1.ª sesión", "2.ª sesión", "Cambio", "n"],
        LONGITUDINAL, [0.36, 0.16, 0.16, 0.16, 0.16],
        { color: (f, i) => (i === 3 ? VERDE : null) }),
      p(txt("Todas las competencias con suficientes pares comparables subieron, y las que más lo hicieron son las de oficio conversacional: escucha activa (+0,88), presencia (+0,63) y contención de afectos (+0,50). Las que quedan fuera de la tabla —objetivos, motivo de consulta y conducta no verbal— tienen menos de tres pares comparables: con esa cantidad, el promedio habla más del azar que del aprendizaje.",
            { color: GREY, size: 17 }), { before: 90, after: 0, line: 220 }),

      p([txt("Nota metodológica. ", { bold: true, size: 15, color: FAINT }),
         txt("Datos de producción al 8 de septiembre de 2026. El tiempo se acota por conversación para que una pestaña olvidada no infle el registro. Los promedios excluyen las sesiones sin evidencia suficiente: es una línea base, no un diagnóstico.",
              { size: 15, color: FAINT })],
        { before: 60, after: 0, line: 216,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDE, space: 7 } } }),
    ],
  }],
});

const OUT = path.join(ROOT, "informes", "upc-uso-2026-09-08.docx");
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(OUT, b); console.log("escrito:", OUT, "(" + Math.round(b.length / 1024) + " KB)"); });
