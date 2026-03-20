"use client";

import { useState } from "react";
import { toast } from "sonner";

interface TeacherNotesEditorProps {
  patientId: string;
  initialNotes: string | null;
}

export default function TeacherNotesEditor({ patientId, initialNotes }: TeacherNotesEditorProps) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/docente/patient-notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: patientId, notes }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al guardar");
      }

      toast.success("Guardado");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al guardar las notas";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <label className="text-xs font-semibold text-[#4A55A2] uppercase tracking-wide block mb-2">
        Notas del docente
      </label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder="Agregue notas pedagógicas sobre este paciente..."
        className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-[#4A55A2]/20 focus:border-[#4A55A2]/40 placeholder:text-gray-400"
      />
      <div className="flex justify-end mt-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-[#4A55A2] rounded-lg hover:bg-[#3d4789] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Guardando..." : "Guardar notas"}
        </button>
      </div>
    </div>
  );
}
