"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";

interface SessionData {
  patientName: string;
  patientAge: number;
  patientOccupation: string;
  sessionNumber: number;
  date: string;
  scores: { label: string; value: number }[];
  overallScore: number | null;
  aiCommentary: string;
  strengths: string[];
  areasToImprove: string[];
  reflection: {
    discomfortMoment?: string;
    wouldRedo?: string;
    clinicalNote?: string;
  };
  teacherComment?: string;
  teacherScore?: number;
}

export default function ExportSessionButton({ data }: { data: SessionData }) {
  const [loading, setLoading] = useState(false);

  const handleExport = () => {
    setLoading(true);
    try {
      const doc = new jsPDF({ unit: "mm", format: "letter" });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentW = pageW - margin * 2;
      let y = 20;

      const addLine = (text: string, size: number, style: "normal" | "bold" = "normal", color = [26, 26, 26]) => {
        doc.setFontSize(size);
        doc.setFont("helvetica", style);
        doc.setTextColor(color[0], color[1], color[2]);
        const lines = doc.splitTextToSize(text, contentW);
        if (y + lines.length * size * 0.4 > 260) {
          doc.addPage();
          y = 20;
        }
        doc.text(lines, margin, y);
        y += lines.length * size * 0.45 + 2;
      };

      const addSpacer = (h = 4) => { y += h; };

      // Header
      addLine("GlorIA — Resumen de Sesión", 16, "bold", [74, 85, 162]);
      addSpacer(2);

      // Session info
      addLine(`Paciente: ${data.patientName}`, 11, "bold");
      addLine(`${data.patientAge} años — ${data.patientOccupation}`, 10);
      addLine(`Sesión #${data.sessionNumber} — ${data.date}`, 10, "normal", [100, 100, 100]);
      addSpacer(6);

      // Scores
      if (data.overallScore != null) {
        addLine(`Puntaje general: ${data.overallScore.toFixed(1)} / 10`, 12, "bold", [74, 85, 162]);
        addSpacer(2);

        for (const s of data.scores) {
          const barW = contentW - 50;
          const barH = 3.5;
          const fillW = (s.value / 10) * barW;

          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(80, 80, 80);
          doc.text(s.label, margin, y);

          doc.setFillColor(230, 230, 240);
          doc.roundedRect(margin + 42, y - 2.5, barW, barH, 1, 1, "F");
          doc.setFillColor(74, 85, 162);
          doc.roundedRect(margin + 42, y - 2.5, fillW, barH, 1, 1, "F");

          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.text(s.value.toFixed(1), margin + 42 + barW + 3, y);
          y += 6;
        }
        addSpacer(4);
      }

      // AI Commentary
      if (data.aiCommentary) {
        addLine("Comentario IA", 11, "bold");
        addLine(data.aiCommentary, 9);
        addSpacer(4);
      }

      // Strengths
      if (data.strengths.length > 0) {
        addLine("Fortalezas", 11, "bold", [22, 163, 74]);
        for (const s of data.strengths) {
          addLine(`  + ${s}`, 9, "normal", [22, 130, 60]);
        }
        addSpacer(4);
      }

      // Areas to improve
      if (data.areasToImprove.length > 0) {
        addLine("Áreas de mejora", 11, "bold", [217, 119, 6]);
        for (const a of data.areasToImprove) {
          addLine(`  → ${a}`, 9, "normal", [180, 100, 0]);
        }
        addSpacer(4);
      }

      // Student reflection
      if (data.reflection.discomfortMoment || data.reflection.wouldRedo || data.reflection.clinicalNote) {
        addLine("Autorreflexión del estudiante", 11, "bold");
        if (data.reflection.discomfortMoment) {
          addLine("Momento de incomodidad:", 9, "bold", [100, 100, 100]);
          addLine(data.reflection.discomfortMoment, 9);
        }
        if (data.reflection.wouldRedo) {
          addLine("Qué haría diferente:", 9, "bold", [100, 100, 100]);
          addLine(data.reflection.wouldRedo, 9);
        }
        if (data.reflection.clinicalNote) {
          addLine("Nota clínica:", 9, "bold", [100, 100, 100]);
          addLine(data.reflection.clinicalNote, 9);
        }
        addSpacer(4);
      }

      // Teacher evaluation
      if (data.teacherComment || data.teacherScore != null) {
        addLine("Evaluación del docente", 11, "bold", [128, 0, 128]);
        if (data.teacherScore != null) {
          addLine(`Nota: ${data.teacherScore.toFixed(1)} / 10`, 10, "bold", [128, 0, 128]);
        }
        if (data.teacherComment) {
          addLine(data.teacherComment, 9);
        }
        addSpacer(4);
      }

      // Footer
      addSpacer(8);
      doc.setFontSize(7);
      doc.setTextColor(180, 180, 180);
      doc.text(
        `Generado por GlorIA — ${new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}`,
        margin,
        y
      );

      const fileName = `sesion-${data.patientName.toLowerCase().replace(/\s+/g, "-")}-${data.sessionNumber}.pdf`;
      doc.save(fileName);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-sidebar hover:bg-sidebar/5 rounded-lg transition-colors disabled:opacity-50"
      title="Exportar sesión como PDF"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
      PDF
    </button>
  );
}
