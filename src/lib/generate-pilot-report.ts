/**
 * CLIENT-SIDE PDF generation for the pilot closing report.
 * Uses jsPDF + Roboto for full Unicode support (tildes, ñ, ¿¡).
 */
import { jsPDF } from "jspdf";
import { ROBOTO_REGULAR } from "@/lib/roboto-regular";
import { ROBOTO_BOLD } from "@/lib/roboto-bold";

const ACCENT = [74, 85, 162] as const; // #4A55A2
const LOGO_RATIO = 4.39;

const COMPETENCY_LABELS: Record<string, string> = {
  setting_terapeutico: "Setting terapéutico",
  motivo_consulta: "Motivo de consulta",
  datos_contextuales: "Datos contextuales",
  objetivos: "Objetivos",
  escucha_activa: "Escucha activa",
  actitud_no_valorativa: "Actitud no valorativa",
  optimismo: "Optimismo",
  presencia: "Presencia",
  conducta_no_verbal: "Conducta no verbal",
  contencion_afectos: "Contención de afectos",
};

type ReportData = {
  pilot: {
    id: string;
    name: string;
    institution: string;
    country: string | null;
    scheduled_at: string | null;
    ended_at: string | null;
    status: string;
    created_at: string;
  };
  kpis: {
    total_participants: number;
    total_students: number;
    total_invited: number;
    total_connected: number;
    connection_rate: number;
    total_sessions: number;
    total_evaluated_sessions: number;
    avg_sessions_per_student: number;
    pilot_overall_avg: number;
  };
  competency_averages: Record<string, { avg: number; count: number }>;
  top_strengths: { text: string; count: number }[];
  top_areas: { text: string; count: number }[];
  students: {
    id: string;
    full_name: string;
    email: string;
    status: string;
    first_login_at: string | null;
    last_active_at: string | null;
    total_sessions: number;
    completed_sessions: number;
    evaluated_sessions: number;
    avg_overall: number;
  }[];
  generated_at: string;
};

export async function fetchPilotReport(pilotId: string): Promise<ReportData> {
  const res = await fetch(`/api/admin/pilots/${pilotId}/report`);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || "Error al obtener datos del informe");
  }
  return res.json();
}

export async function generatePilotReportPDF(pilotId: string): Promise<void> {
  const data = await fetchPilotReport(pilotId);

  const doc = new jsPDF({ unit: "mm", format: "letter" });
  doc.addFileToVFS("Roboto-Regular.ttf", ROBOTO_REGULAR);
  doc.addFileToVFS("Roboto-Bold.ttf", ROBOTO_BOLD);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
  doc.setFont("Roboto", "normal");

  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const mg = 20;
  const mw = pw - mg * 2;
  let y = 20;

  function addPage() {
    doc.addPage();
    y = 20;
  }

  function txt(text: string, size = 10, bold = false, color?: readonly [number, number, number]) {
    doc.setFontSize(size);
    doc.setFont("Roboto", bold ? "bold" : "normal");
    doc.setTextColor(color ? color[0] : 30, color ? color[1] : 30, color ? color[2] : 30);
    const lines = doc.splitTextToSize(text, mw);
    for (const line of lines) {
      if (y > 260) addPage();
      doc.text(line, mg, y);
      y += size * 0.45;
    }
  }

  function sec(title: string) {
    if (y > 235) addPage();
    y += 4;
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.rect(mg, y - 4, mw, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("Roboto", "bold");
    doc.text(title, mg + 3, y + 1.5);
    y += 12;
  }

  function addFooters() {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setFont("Roboto", "normal");
      doc.setTextColor(150, 150, 150);
      doc.text(
        `GlorIA — Informe del piloto | Página ${i} de ${pages}`,
        pw / 2, ph - 8,
        { align: "center" }
      );
    }
  }

  // ─── HEADER ─────────────────────────────────────────
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(0, 0, pw, 40, "F");

  try {
    const logoImg = new Image();
    logoImg.crossOrigin = "anonymous";
    await new Promise<void>((resolve) => {
      logoImg.onload = () => resolve();
      logoImg.onerror = () => resolve();
      logoImg.src = "/branding/gloria-logo-report.svg";
    });
    if (logoImg.complete && logoImg.naturalWidth > 0) {
      const logoH = 10;
      const logoW = logoH * LOGO_RATIO;
      doc.addImage(logoImg, "PNG", pw - mg - logoW, 5, logoW, logoH);
    }
  } catch { /* logo optional */ }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("Roboto", "bold");
  doc.text("Informe del Piloto", mg, 15);

  doc.setFontSize(10);
  doc.setFont("Roboto", "normal");
  doc.text(data.pilot.name, mg, 22);
  doc.setFontSize(8);
  doc.text(
    `${data.pilot.institution}${data.pilot.country ? " — " + data.pilot.country : ""}`,
    mg,
    27
  );

  const genDate = new Date(data.generated_at).toLocaleDateString("es-CL", {
    day: "numeric", month: "long", year: "numeric",
  });
  doc.text(`Generado: ${genDate}`, mg, 33);

  y = 48;

  // ─── RESUMEN ─────────────────────────────────────────
  sec("Resumen del piloto");

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("es-CL", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "—";

  txt(`Inicio: ${fmt(data.pilot.scheduled_at)}`, 9);
  y += 1;
  txt(`Fin: ${fmt(data.pilot.ended_at)}`, 9);
  y += 1;
  txt(`Estado: ${data.pilot.status}`, 9);
  y += 3;

  // ─── KPIs ───────────────────────────────────────────
  sec("Indicadores clave");

  const k = data.kpis;
  const connectionPct = Math.round(k.connection_rate * 100);

  txt(`Participantes totales: ${k.total_participants}`, 9, true);
  y += 1;
  txt(`Estudiantes: ${k.total_students}`, 9);
  y += 1;
  txt(`Invitaciones enviadas: ${k.total_invited}`, 9);
  y += 1;
  txt(`Estudiantes conectados: ${k.total_connected} (${connectionPct}% de tasa de conexión)`, 9);
  y += 1;
  txt(`Sesiones totales: ${k.total_sessions}`, 9);
  y += 1;
  txt(`Sesiones evaluadas por la IA: ${k.total_evaluated_sessions}`, 9);
  y += 1;
  txt(`Promedio de sesiones por estudiante: ${k.avg_sessions_per_student.toFixed(1)}`, 9);
  y += 1;
  if (k.pilot_overall_avg > 0) {
    txt(`Promedio general de competencias: ${k.pilot_overall_avg.toFixed(2)} / 4.0`, 9, true);
  } else {
    txt("Promedio general: sin sesiones evaluadas", 9, false, [150, 150, 150]);
  }
  y += 3;

  // ─── COMPETENCIAS ────────────────────────────────────
  sec("Competencias clínicas — Promedio del piloto");

  const hasComps = Object.values(data.competency_averages).some((c) => c.avg > 0);

  if (!hasComps) {
    txt(
      "No hay sesiones evaluadas todavía. Las competencias se calcularán cuando los participantes completen sesiones.",
      9,
      false,
      [120, 120, 120]
    );
    y += 4;
  } else {
    for (const [key, label] of Object.entries(COMPETENCY_LABELS)) {
      const stat = data.competency_averages[key];
      if (!stat) continue;
      const avg = stat.avg;

      // Bar
      const barY = y - 3;
      const barH = 4;
      const barW = mw * 0.5;
      const labelW = mw * 0.35;

      doc.setFontSize(8);
      doc.setFont("Roboto", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(label, mg, y);

      // Empty bar background
      doc.setFillColor(230, 230, 230);
      doc.rect(mg + labelW, barY, barW, barH, "F");

      // Filled bar
      const fillW = (avg / 4) * barW;
      doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.rect(mg + labelW, barY, fillW, barH, "F");

      // Value
      doc.setFont("Roboto", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text(
        `${avg.toFixed(2)} (n=${stat.count})`,
        mg + labelW + barW + 2,
        y
      );

      y += 6;
      if (y > 255) addPage();
    }
    y += 3;
  }

  // ─── FORTALEZAS ──────────────────────────────────────
  if (data.top_strengths.length > 0) {
    sec("Principales fortalezas detectadas");
    for (const s of data.top_strengths) {
      txt(`• ${s.text} (${s.count} menciones)`, 9);
    }
    y += 3;
  }

  // ─── ÁREAS DE MEJORA ────────────────────────────────
  if (data.top_areas.length > 0) {
    sec("Principales áreas de mejora");
    for (const a of data.top_areas) {
      txt(`• ${a.text} (${a.count} menciones)`, 9);
    }
    y += 3;
  }

  // ─── DETALLE POR ESTUDIANTE ─────────────────────────
  sec("Actividad por estudiante");

  // Table header
  if (y > 250) addPage();
  doc.setFontSize(8);
  doc.setFont("Roboto", "bold");
  doc.setTextColor(80, 80, 80);
  doc.setFillColor(245, 245, 245);
  doc.rect(mg, y - 4, mw, 6, "F");
  doc.text("Estudiante", mg + 1, y);
  doc.text("Sesiones", mg + 90, y);
  doc.text("Eval.", mg + 115, y);
  doc.text("Prom.", mg + 135, y);
  doc.text("Última actividad", mg + 155, y);
  y += 6;

  doc.setFont("Roboto", "normal");
  doc.setTextColor(60, 60, 60);
  for (const s of data.students) {
    if (y > 265) {
      addPage();
      // Re-draw header on new page
      doc.setFont("Roboto", "bold");
      doc.setFillColor(245, 245, 245);
      doc.rect(mg, y - 4, mw, 6, "F");
      doc.setTextColor(80, 80, 80);
      doc.text("Estudiante", mg + 1, y);
      doc.text("Sesiones", mg + 90, y);
      doc.text("Eval.", mg + 115, y);
      doc.text("Prom.", mg + 135, y);
      doc.text("Última actividad", mg + 155, y);
      y += 6;
      doc.setFont("Roboto", "normal");
      doc.setTextColor(60, 60, 60);
    }
    const name = s.full_name.length > 36 ? s.full_name.slice(0, 33) + "..." : s.full_name;
    const lastAct = s.last_active_at
      ? new Date(s.last_active_at).toLocaleDateString("es-CL", {
          day: "numeric",
          month: "short",
        })
      : "—";
    doc.text(name, mg + 1, y);
    doc.text(String(s.total_sessions), mg + 90, y);
    doc.text(String(s.evaluated_sessions), mg + 115, y);
    doc.text(s.avg_overall > 0 ? s.avg_overall.toFixed(2) : "—", mg + 135, y);
    doc.text(lastAct, mg + 155, y);
    y += 5;
  }

  // ─── FOOTER ──────────────────────────────────────────
  addFooters();

  // Save
  const safeName = data.pilot.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-]/g, "_");
  doc.save(`Informe_${safeName}.pdf`);
}
