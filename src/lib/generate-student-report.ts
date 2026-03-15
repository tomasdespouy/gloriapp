/**
 * CLIENT-SIDE PDF generation for student consolidated report.
 * Uses jsPDF with Roboto font for full Unicode support (tildes, ñ, ¿¡).
 */
import { jsPDF } from "jspdf";
import { ROBOTO_REGULAR } from "@/lib/roboto-regular";
import { ROBOTO_BOLD } from "@/lib/roboto-bold";

const ACCENT = [74, 85, 162] as const; // #4A55A2
const LOGO_RATIO = 4.39;

interface CompRow {
  empathy: number;
  active_listening: number;
  open_questions: number;
  reformulation: number;
  confrontation: number;
  silence_management: number;
  rapport: number;
  overall_score: number;
  ai_commentary?: string;
  strengths?: string[];
  areas_to_improve?: string[];
  feedback_status?: string;
}

interface FbRow {
  teacher_comment?: string;
  teacher_score?: number;
}

interface SessionRow {
  id: string;
  session_number: number;
  status: string;
  created_at: string;
  ai_patients: { name: string; difficulty_level: string } | { name: string; difficulty_level: string }[] | null;
  session_competencies: CompRow[] | null;
  session_feedback: FbRow[] | null;
}

interface ActionItemRow {
  content: string;
  status: string;
  student_comment: string | null;
  created_at: string;
}

interface ReportData {
  student: { full_name: string; email: string; created_at: string };
  progress: { level: number; level_name: string; total_xp: number; sessions_completed: number; current_streak: number; longest_streak: number } | null;
  sessions: SessionRow[];
  actionItems: ActionItemRow[];
  teacherName: string;
  generatedAt: string;
}

const COMP_LABELS: Record<string, string> = {
  empathy: "Empatía",
  active_listening: "Escucha activa",
  open_questions: "Preguntas abiertas",
  reformulation: "Reformulación",
  confrontation: "Confrontación",
  silence_management: "Manejo de silencios",
  rapport: "Rapport",
};

export async function generateStudentReport(studentId: string): Promise<void> {
  // 1. Fetch data
  const res = await fetch(`/api/docente/report?student_id=${studentId}`);
  if (!res.ok) throw new Error("Error al obtener datos del reporte");
  const data: ReportData = await res.json();

  // 2. Create PDF
  const doc = new jsPDF({ unit: "mm", format: "letter" });

  // Register fonts
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

  // Helper: text with word-wrap and page breaks
  function txt(text: string, size = 10, bold = false, color?: readonly [number, number, number]) {
    doc.setFontSize(size);
    doc.setFont("Roboto", bold ? "bold" : "normal");
    doc.setTextColor(color ? color[0] : 30, color ? color[1] : 30, color ? color[2] : 30);
    const lines = doc.splitTextToSize(text, mw);
    for (const line of lines) {
      if (y > 260) { addPage(); }
      doc.text(line, mg, y);
      y += size * 0.45;
    }
  }

  // Section header
  function sec(title: string) {
    if (y > 235) { addPage(); }
    y += 4;
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.rect(mg, y - 4, mw, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("Roboto", "bold");
    doc.text(title, mg + 3, y + 1.5);
    y += 12;
  }

  // New page
  function addPage() {
    doc.addPage();
    y = 20;
  }

  // Footers
  function addFooters() {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setFont("Roboto", "normal");
      doc.setTextColor(150, 150, 150);
      doc.text(
        `GlorIA — Reporte consolidado | Página ${i} de ${pages}`,
        pw / 2, ph - 8,
        { align: "center" }
      );
    }
  }

  // ============================================================
  // HEADER
  // ============================================================
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(0, 0, pw, 40, "F");

  // Try to load logo
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
  } catch {
    // Logo optional
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("Roboto", "bold");
  doc.text("Reporte Consolidado del Estudiante", mg, 15);

  doc.setFontSize(10);
  doc.setFont("Roboto", "normal");
  doc.text(data.student.full_name || data.student.email, mg, 22);
  doc.setFontSize(8);
  doc.text(`${data.student.email}`, mg, 27);

  const genDate = new Date(data.generatedAt).toLocaleDateString("es-CL", {
    day: "numeric", month: "long", year: "numeric",
  });
  doc.text(`Generado: ${genDate} | Docente: ${data.teacherName}`, mg, 33);

  y = 48;

  // ============================================================
  // RESUMEN GENERAL
  // ============================================================
  sec("Resumen general");

  const prog = data.progress;
  const joinDate = new Date(data.student.created_at).toLocaleDateString("es-CL", {
    day: "numeric", month: "long", year: "numeric",
  });

  txt(`Fecha de registro: ${joinDate}`, 9);
  y += 1;
  txt(`Nivel: ${prog?.level_name || "Sin actividad"} (${prog?.total_xp || 0} XP)`, 9);
  y += 1;
  txt(`Sesiones completadas: ${data.sessions.length}`, 9);
  y += 1;
  txt(`Racha actual: ${prog?.current_streak || 0} días | Mejor racha: ${prog?.longest_streak || 0} días`, 9);
  y += 3;

  // ============================================================
  // PROMEDIOS DE COMPETENCIAS
  // ============================================================
  const allComps = data.sessions.flatMap((s) => {
    const c = Array.isArray(s.session_competencies) ? s.session_competencies[0] : null;
    return c ? [c] : [];
  });

  if (allComps.length > 0) {
    sec("Promedio de competencias clínicas");

    const keys = Object.keys(COMP_LABELS) as (keyof CompRow)[];
    for (const key of keys) {
      const vals = allComps.map((c) => Number(c[key])).filter((v) => !isNaN(v));
      const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

      // Draw bar
      const barY = y - 3;
      const barH = 4;
      const barW = mw * 0.55;
      const labelW = mw * 0.3;
      const valW = mw * 0.15;

      doc.setFontSize(8);
      doc.setFont("Roboto", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(COMP_LABELS[key], mg, y);

      // Background bar
      doc.setFillColor(230, 230, 230);
      doc.roundedRect(mg + labelW, barY, barW, barH, 1, 1, "F");

      // Fill bar
      const fill = avg >= 7 ? [34, 197, 94] : avg >= 5 ? [234, 179, 8] : [239, 68, 68];
      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.roundedRect(mg + labelW, barY, barW * (avg / 10), barH, 1, 1, "F");

      // Value
      doc.setFont("Roboto", "bold");
      doc.text(avg.toFixed(1), mg + labelW + barW + 5, y);

      y += 7;
    }

    // Overall average
    const overallVals = allComps.map((c) => Number(c.overall_score)).filter((v) => !isNaN(v));
    const overallAvg = overallVals.length > 0 ? overallVals.reduce((a, b) => a + b, 0) / overallVals.length : 0;
    y += 2;
    txt(`Puntaje general promedio: ${overallAvg.toFixed(1)} / 10`, 10, true, ACCENT);
    y += 3;
  }

  // ============================================================
  // EVOLUCIÓN POR SESIÓN
  // ============================================================
  if (data.sessions.length >= 2) {
    sec("Evolución del puntaje por sesión");

    // Table header
    const colW = [15, 35, 25, 20, mw - 95];
    const headers = ["#", "Paciente", "Fecha", "Puntaje", "Comentario IA"];

    doc.setFillColor(240, 240, 245);
    doc.rect(mg, y - 4, mw, 7, "F");
    doc.setFontSize(7);
    doc.setFont("Roboto", "bold");
    doc.setTextColor(80, 80, 80);
    let colX = mg + 2;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], colX, y);
      colX += colW[i];
    }
    y += 5;

    for (const session of data.sessions) {
      if (y > 250) { addPage(); }
      const comp = Array.isArray(session.session_competencies) ? session.session_competencies[0] : null;
      const patient = Array.isArray(session.ai_patients) ? session.ai_patients[0] : session.ai_patients;
      const score = comp?.overall_score != null ? Number(comp.overall_score).toFixed(1) : "—";
      const commentary = comp?.ai_commentary || "";
      const date = new Date(session.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" });

      doc.setFontSize(7);
      doc.setFont("Roboto", "normal");
      doc.setTextColor(50, 50, 50);

      colX = mg + 2;
      doc.text(`${session.session_number}`, colX, y);
      colX += colW[0];
      doc.text((patient?.name || "—").slice(0, 18), colX, y);
      colX += colW[1];
      doc.text(date, colX, y);
      colX += colW[2];

      // Score with color
      const scoreNum = comp?.overall_score != null ? Number(comp.overall_score) : 0;
      const scoreColor = scoreNum >= 7 ? [34, 120, 60] : scoreNum >= 5 ? [160, 120, 0] : [200, 50, 50];
      doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      doc.setFont("Roboto", "bold");
      doc.text(score, colX, y);
      colX += colW[3];

      // Commentary (truncated)
      doc.setFont("Roboto", "normal");
      doc.setTextColor(100, 100, 100);
      const shortComment = commentary.length > 60 ? commentary.slice(0, 60) + "..." : commentary;
      doc.text(shortComment, colX, y);

      y += 5;

      // Thin separator
      doc.setDrawColor(230, 230, 230);
      doc.line(mg, y - 2, mg + mw, y - 2);
    }
    y += 3;
  }

  // ============================================================
  // FORTALEZAS Y ÁREAS DE MEJORA (consolidated)
  // ============================================================
  const allStrengths: Record<string, number> = {};
  const allAreas: Record<string, number> = {};
  for (const c of allComps) {
    for (const s of c.strengths || []) {
      allStrengths[s] = (allStrengths[s] || 0) + 1;
    }
    for (const a of c.areas_to_improve || []) {
      allAreas[a] = (allAreas[a] || 0) + 1;
    }
  }

  if (Object.keys(allStrengths).length > 0 || Object.keys(allAreas).length > 0) {
    sec("Fortalezas y áreas de mejora recurrentes");

    if (Object.keys(allStrengths).length > 0) {
      txt("Fortalezas más frecuentes:", 9, true, [34, 120, 60]);
      const sorted = Object.entries(allStrengths).sort((a, b) => b[1] - a[1]).slice(0, 5);
      for (const [s, count] of sorted) {
        txt(`  + ${s} (${count}x)`, 8);
      }
      y += 2;
    }

    if (Object.keys(allAreas).length > 0) {
      txt("Áreas de mejora recurrentes:", 9, true, [200, 120, 0]);
      const sorted = Object.entries(allAreas).sort((a, b) => b[1] - a[1]).slice(0, 5);
      for (const [a, count] of sorted) {
        txt(`  → ${a} (${count}x)`, 8);
      }
      y += 2;
    }
  }

  // ============================================================
  // EVALUACIONES DEL DOCENTE
  // ============================================================
  const teacherReviews = data.sessions.filter((s) => {
    const fb = Array.isArray(s.session_feedback) ? s.session_feedback[0] : null;
    return fb?.teacher_comment || fb?.teacher_score != null;
  });

  if (teacherReviews.length > 0) {
    sec("Evaluaciones del docente");

    for (const session of teacherReviews) {
      if (y > 245) { addPage(); }
      const fb = Array.isArray(session.session_feedback) ? session.session_feedback[0] : null;
      const patient = Array.isArray(session.ai_patients) ? session.ai_patients[0] : session.ai_patients;
      const date = new Date(session.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" });

      txt(`Sesión #${session.session_number} — ${patient?.name || "—"} (${date})`, 9, true);
      if (fb?.teacher_score != null) {
        txt(`  Nota docente: ${Number(fb.teacher_score).toFixed(1)} / 10`, 8);
      }
      if (fb?.teacher_comment) {
        txt(`  "${fb.teacher_comment}"`, 8, false, [80, 80, 80]);
      }
      y += 3;
    }
  }

  // ============================================================
  // ACCIONABLES
  // ============================================================
  if (data.actionItems.length > 0) {
    sec("Acuerdos y accionables");

    for (const item of data.actionItems) {
      if (y > 250) { addPage(); }
      const statusLabel = item.status === "accepted" ? "Aceptado" : item.status === "rejected" ? "Rechazado" : "Pendiente";
      const statusColor: readonly [number, number, number] = item.status === "accepted" ? [34, 120, 60] : item.status === "rejected" ? [200, 50, 50] : [160, 120, 0];

      doc.setFontSize(8);
      doc.setFont("Roboto", "normal");
      doc.setTextColor(50, 50, 50);
      const lines = doc.splitTextToSize(`• ${item.content}`, mw - 30);
      for (const line of lines) {
        if (y > 260) { addPage(); }
        doc.text(line, mg + 2, y);
        y += 3.5;
      }

      doc.setFont("Roboto", "bold");
      doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.text(`[${statusLabel}]`, mg + 2, y);
      y += 2;

      if (item.student_comment) {
        doc.setFont("Roboto", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(`Comentario: "${item.student_comment}"`, mg + 10, y);
        y += 3;
      }
      y += 3;
    }
  }

  // ============================================================
  // FOOTERS
  // ============================================================
  addFooters();

  // 3. Download
  const safeName = (data.student.full_name || "estudiante").replace(/\s+/g, "_").toLowerCase();
  doc.save(`reporte_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
