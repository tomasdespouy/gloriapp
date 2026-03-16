"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";

export default function ExportFichaButton({ patientId, patientName, studentId }: { patientId: string; patientName: string; studentId?: string }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);

    try {
      const url = studentId
        ? `/api/patients/${patientId}/ficha?studentId=${studentId}`
        : `/api/patients/${patientId}/ficha`;
      const res = await fetch(url);
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();

      // Generate PDF
      const doc = new jsPDF({ unit: "mm", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      let y = 20;

      const addText = (text: string, fontSize: number, bold: boolean = false, color: [number, number, number] = [30, 30, 30]) => {
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setTextColor(color[0], color[1], color[2]);
        const lines = doc.splitTextToSize(text, maxWidth);
        for (const line of lines) {
          if (y > 260) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, margin, y);
          y += fontSize * 0.45;
        }
      };

      const addSpace = (mm: number) => { y += mm; };

      // Header
      doc.setFillColor(74, 85, 162);
      doc.rect(0, 0, pageWidth, 35, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("FICHA CLÍNICA", margin, 15);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Paciente: ${data.patient.name} — ${data.patient.age} años, ${data.patient.occupation}`, margin, 23);
      doc.setFontSize(9);
      doc.text(`Dificultad: ${data.patient.difficulty_level} | País: ${data.patient.country || "Chile"} | Plataforma GlorIA`, margin, 30);

      y = 45;

      // Parse content into sections
      const content = data.content as string;
      const sections = content.split(/\d+\.\s+/).filter(Boolean);
      const sectionTitles = content.match(/\d+\.\s+[A-ZÁÉÍÓÚÑ\s]+/g) || [];

      for (let i = 0; i < sections.length; i++) {
        const title = sectionTitles[i]?.trim() || `Sección ${i + 1}`;
        const body = sections[i].trim();

        // Section title with colored bar
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFillColor(74, 85, 162);
        doc.rect(margin, y - 4, maxWidth, 8, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(title, margin + 3, y + 1);
        y += 10;

        // Section body
        addText(body, 10, false, [50, 50, 50]);
        addSpace(6);
      }

      // Narrative section (if available)
      const narrative = data.narrative as { narrative: string; key_themes: string[]; sessions_included: number } | null;
      if (narrative?.narrative) {
        if (y > 220) { doc.addPage(); y = 20; }
        addSpace(4);
        doc.setFillColor(74, 85, 162);
        doc.rect(margin, y - 4, maxWidth, 8, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`RESUMEN NARRATIVO ACUMULATIVO (${narrative.sessions_included} sesiones)`, margin + 3, y + 1);
        y += 10;

        addText(narrative.narrative, 10, false, [50, 50, 50]);
        addSpace(4);

        if (narrative.key_themes?.length) {
          addText(`Temas recurrentes: ${narrative.key_themes.join(", ")}`, 9, true, [74, 85, 162]);
          addSpace(4);
        }
      }

      // Footer on each page
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.setFont("helvetica", "normal");
        doc.text(`GlorIA — Ficha clínica de ${patientName} — Página ${i} de ${totalPages}`, margin, 272);
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, 268, pageWidth - margin, 268);
      }

      doc.save(`Ficha_Clinica_${patientName.replace(/\s+/g, "_")}.pdf`);
    } catch {
      // Silently fail
    }

    setLoading(false);
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
    >
      {loading ? (
        <>
          <Loader2 size={14} className="animate-spin" />
          Generando ficha...
        </>
      ) : (
        <>
          <FileText size={14} />
          Exportar ficha clínica
        </>
      )}
    </button>
  );
}
