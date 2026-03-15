"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";

export default function DownloadReportButton({ studentId }: { studentId: string }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const { generateStudentReport } = await import("@/lib/generate-student-report");
      await generateStudentReport(studentId);
    } catch (e) {
      alert("Error al generar reporte: " + (e instanceof Error ? e.message : "desconocido"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-sidebar hover:bg-[#354080] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
    >
      <FileDown size={16} />
      {loading ? "Generando..." : "Descargar reporte"}
    </button>
  );
}
