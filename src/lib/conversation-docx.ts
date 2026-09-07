import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
} from "docx";
import { GLORIA_LOGO_PNG } from "./branding-logo";

/**
 * Descarga de una conversación en .docx desde la mirada del docente.
 *
 * El documento es la transcripción completa, no un resumen: el docente lo
 * abre para leer la entrevista entera, imprimirla, anotarla a mano o llevarla
 * a supervisión. Por eso se conservan las acotaciones no verbales del paciente
 * entre corchetes, los saltos de día y las pausas largas — son parte de lo que
 * se lee cuando se revisa una entrevista.
 *
 * Fuente Calibri en todo el documento: soporta tildes y ñ, que es requisito de
 * todo lo que genera la plataforma.
 */

const INDIGO = "4A55A2";
const DARK = "1A1A1A";
const GREY = "555555";
const FAINT = "9A9A9A";
const RULE = "E5E5E5";
const AMBER_TEXT = "92400E";
const AMBER_BG = "FFF7ED";

const TZ = "America/Santiago";

export type DocxMessage = { role: string; content: string; created_at: string };

export type ConversationDocxInput = {
  studentName: string;
  studentEmail?: string | null;
  patientName: string;
  patientAge?: number | null;
  patientOccupation?: string | null;
  sessionNumber?: number | null;
  createdAt: string;
  activeSeconds?: number | null;
  status?: string | null;
  /** conversations.end_reason — presente solo si el paciente cerró la sesión. */
  endReason?: string | null;
  establishmentName?: string | null;
  sectionName?: string | null;
  messages: DocxMessage[];
};

// ── Formato de fechas y horas (siempre en la zona de la plataforma) ────────

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CL", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-CL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

const dateTimeLabel = (iso: string) =>
  new Date(iso).toLocaleString("es-CL", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatGap = (ms: number) => {
  const min = Math.round(ms / 60000);
  if (min >= 1440) {
    const d = Math.round(min / 1440);
    return `${d} día${d === 1 ? "" : "s"}`;
  }
  if (min >= 60) return `${Math.round(min / 60)} h`;
  return `${min} min`;
};

const statusLabel = (status: string | null | undefined) => {
  if (status === "completed") return "Completada";
  if (status === "active") return "En curso";
  if (status === "abandoned") return "Abandonada";
  return status || "—";
};

// Mismos textos que el visor inline del monitor, para que el docente lea lo
// mismo en pantalla y en el documento descargado.
const endReasonLabel = (reason: string | null | undefined): string | null => {
  if (!reason) return null;
  if (reason.startsWith("directed_threat")) return "El paciente se retiró de la sesión: amenaza dirigida.";
  if (reason.startsWith("disrespect")) return "El paciente se retiró de la sesión: trato irrespetuoso.";
  if (reason.startsWith("name_evasion")) return "El paciente se retiró de la sesión: el terapeuta nunca se presentó.";
  if (reason.startsWith("unprofessional")) return "El paciente se retiró de la sesión: conducta poco profesional.";
  return "El paciente cerró la sesión.";
};

// ── Ladrillos de docx ─────────────────────────────────────────────────────

type RunOpts = { bold?: boolean; size?: number; color?: string; caps?: boolean; italics?: boolean };

const txt = (text: string, o: RunOpts = {}) =>
  new TextRun({
    text,
    bold: o.bold,
    size: o.size ?? 20,
    color: o.color ?? DARK,
    italics: o.italics,
    allCaps: o.caps,
    characterSpacing: o.caps ? 12 : undefined,
    font: "Calibri",
  });

type SpacingOpts = { before?: number; after?: number; line?: number; keepNext?: boolean };

const p = (children: TextRun | TextRun[], spacing: SpacingOpts = {}) =>
  new Paragraph({
    children: Array.isArray(children) ? children : [children],
    spacing: { before: spacing.before ?? 0, after: spacing.after ?? 0, line: spacing.line ?? 250 },
    // keepNext evita que la etiqueta del hablante o el separador de día
    // queden solos al pie de una página, con su texto en la siguiente.
    keepNext: spacing.keepNext,
  });

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;

/**
 * El contenido de un mensaje puede traer saltos de línea. En docx no existe
 * el "\n": cada línea tiene que ser su propio párrafo.
 */
const contentParagraphs = (content: string, color: string): Paragraph[] => {
  const lines = (content || "").split("\n");
  const visible = lines.length === 0 ? [""] : lines;
  return visible.map((line, i) =>
    p(txt(line || " ", { size: 20, color }), {
      after: i === visible.length - 1 ? 0 : 40,
      line: 250,
    }),
  );
};

/** Ficha de datos de la sesión, en dos columnas. */
const factsTable = (rows: [string, string][]): Table =>
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2200, 7160],
    borders: {
      top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
      insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
    },
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2200, type: WidthType.DXA },
              margins: { top: 30, bottom: 30, left: 0, right: 120 },
              borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
              children: [p(txt(label, { size: 17, color: FAINT, caps: true, bold: true }))],
            }),
            new TableCell({
              width: { size: 7160, type: WidthType.DXA },
              margins: { top: 30, bottom: 30, left: 0, right: 0 },
              borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
              children: [p(txt(value, { size: 20, color: GREY }))],
            }),
          ],
        }),
    ),
  });

/** Aviso destacado (retiro del paciente, sesiones pegadas). */
const noticeBox = (text: string): Table =>
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    borders: {
      top: NO_BORDER, bottom: NO_BORDER, right: NO_BORDER,
      left: { style: BorderStyle.SINGLE, size: 18, color: "F59E0B" },
      insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 9360, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: AMBER_BG, color: "auto" },
            margins: { top: 120, bottom: 120, left: 180, right: 180 },
            children: [p(txt(text, { size: 19, color: AMBER_TEXT, bold: true }))],
          }),
        ],
      }),
    ],
  });

// ── Documento ─────────────────────────────────────────────────────────────

export async function buildConversationDocx(input: ConversationDocxInput): Promise<Buffer> {
  const {
    studentName, studentEmail, patientName, patientAge, patientOccupation,
    sessionNumber, createdAt, activeSeconds, status, endReason,
    establishmentName, sectionName, messages,
  } = input;

  const patientDetail = [
    patientAge ? `${patientAge} años` : null,
    patientOccupation || null,
  ].filter(Boolean).join(", ");

  const facts: [string, string][] = [
    ["Estudiante", studentEmail ? `${studentName} · ${studentEmail}` : studentName],
  ];
  const belonging = [establishmentName, sectionName].filter(Boolean).join(" · ");
  if (belonging) facts.push(["Curso", belonging]);
  facts.push(["Paciente", patientDetail ? `${patientName} (${patientDetail})` : patientName]);
  facts.push(["Fecha", dateTimeLabel(createdAt)]);
  if (typeof sessionNumber === "number" && sessionNumber > 0) {
    facts.push(["Sesión", `N.° ${sessionNumber}`]);
  }
  const minutes = activeSeconds && activeSeconds > 0 ? Math.round(activeSeconds / 60) : null;
  facts.push([
    "Duración",
    minutes !== null ? `${minutes} min · ${messages.length} mensajes` : `${messages.length} mensajes`,
  ]);
  facts.push(["Estado", statusLabel(status)]);

  const body: (Paragraph | Table)[] = [
    p(txt("Transcripción de sesión clínica simulada", { color: INDIGO, size: 17, bold: true, caps: true }), { after: 60 }),
    p(txt(studentName, { bold: true, size: 34 }), { after: 40, line: 280 }),
    p(txt(`con ${patientName}`, { color: GREY, size: 22 }), { after: 220, line: 250 }),
    factsTable(facts),
  ];

  // Marco de lectura antes de la transcripción. Lo que el docente necesita
  // saber para no malinterpretar lo que viene: los corchetes son gestos del
  // paciente, no texto que el estudiante haya podido ignorar sin costo.
  body.push(
    new Paragraph({
      children: [],
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE } },
      spacing: { before: 260, after: 200 },
    }),
  );

  const retiro = endReasonLabel(endReason);
  if (retiro) {
    body.push(noticeBox(retiro));
    body.push(p(txt(" ", { size: 12 }), { after: 140 }));
  }

  const days = new Set(messages.map((m) => dayKey(m.created_at)));
  if (days.size > 1) {
    body.push(
      noticeBox(
        `Esta conversación abarca ${days.size} días distintos. Probablemente se reanudó sin cerrar la sesión anterior, por lo que varias sesiones quedaron unidas en este mismo registro.`,
      ),
    );
    body.push(p(txt(" ", { size: 12 }), { after: 140 }));
  }

  if (messages.length === 0) {
    body.push(p(txt("Sin mensajes registrados.", { color: FAINT, italics: true, size: 20 })));
  }

  messages.forEach((m, i) => {
    const prev = i > 0 ? messages[i - 1] : null;
    const showDay = !prev || dayKey(m.created_at) !== dayKey(prev.created_at);
    const gapMs = prev ? Date.parse(m.created_at) - Date.parse(prev.created_at) : 0;
    const showGap = !showDay && gapMs >= 2 * 3600 * 1000;
    const isTherapist = m.role === "user";

    if (showDay) {
      body.push(
        p(txt(dayLabel(m.created_at), { color: FAINT, size: 17, bold: true, caps: true }), {
          before: i === 0 ? 0 : 260,
          after: 140,
          keepNext: true,
        }),
      );
    }
    if (showGap) {
      body.push(
        p(txt(`··· reanudada ${formatGap(gapMs)} después ···`, { color: AMBER_TEXT, size: 17, italics: true }), {
          before: 140,
          after: 140,
          keepNext: true,
        }),
      );
    }

    body.push(
      p(
        [
          txt(isTherapist ? "Terapeuta" : "Paciente", {
            size: 17,
            bold: true,
            caps: true,
            color: isTherapist ? INDIGO : FAINT,
          }),
          txt(`   ${timeLabel(m.created_at)}`, { size: 16, color: FAINT }),
        ],
        { before: showDay || showGap ? 0 : 160, after: 40, keepNext: true },
      ),
    );
    body.push(...contentParagraphs(m.content, isTherapist ? DARK : GREY));
  });

  const doc = new Document({
    creator: "GlorIA",
    title: `Sesión de ${studentName} con ${patientName}`,
    description: "Transcripción de sesión clínica simulada",
    styles: { default: { document: { run: { font: "Calibri", size: 20, color: DARK } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, bottom: 900, left: 1440, right: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 0 },
                children: [
                  new ImageRun({
                    type: "png",
                    data: GLORIA_LOGO_PNG,
                    transformation: { width: 106, height: 24 },
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 120 },
                children: [
                  txt("GlorIA — Página ", { size: 15, color: FAINT }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 15, color: FAINT, font: "Calibri" }),
                  txt(" de ", { size: 15, color: FAINT }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 15, color: FAINT, font: "Calibri" }),
                ],
              }),
            ],
          }),
        },
        children: body,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

/**
 * Nombre de archivo: legible y ordenable, sin tildes ni caracteres que
 * Windows rechace. El docente descarga muchos y necesita distinguirlos en la
 * carpeta sin abrirlos.
 */
export function conversationDocxFilename(input: {
  studentName: string;
  patientName: string;
  createdAt: string;
}): string {
  const slug = (s: string) =>
    (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 40) || "sesion";
  const day = dayKey(input.createdAt);
  return `sesion-${slug(input.studentName)}-${slug(input.patientName)}-${day}.docx`;
}
