"use client";

import { useState } from "react";
import { CalendarClock, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { chileLocalToUtcIso, utcIsoToChileLocal } from "@/lib/datetime-cl";

interface Props {
  patientId: string;
  patientName: string;
  currentScheduledAt: string | null;
  minHoursBetweenSessions: number;
  onClose: () => void;
  onScheduled: (patientId: string, scheduledAtIso: string) => void;
}

export default function PatientScheduleModal({
  patientId, patientName, currentScheduledAt, minHoursBetweenSessions, onClose, onScheduled,
}: Props) {
  const [cuando, setCuando] = useState(() =>
    utcIsoToChileLocal(currentScheduledAt || new Date(Date.now() + minHoursBetweenSessions * 60 * 60 * 1000).toISOString()),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    let iso: string;
    try {
      iso = chileLocalToUtcIso(cuando);
    } catch {
      setError("Fecha inválida.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/patients/${patientId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: iso }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.error === "collision") {
          setError(`Muy cerca de otra sesión: necesitas al menos ${data.minHours}h de diferencia con tus otros pacientes o sesiones ya completadas.`);
        } else {
          setError(data?.error || "No se pudo agendar.");
        }
        return;
      }
      toast.success(currentScheduledAt ? "Sesión reprogramada" : "Sesión agendada");
      onScheduled(patientId, data.scheduledAt);
      onClose();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-sidebar/10 flex items-center justify-center">
              <CalendarClock size={18} className="text-sidebar" />
            </div>
            <h3 className="text-base font-bold text-gray-900">
              {currentScheduledAt ? "Reprogramar" : "Agendar"} sesión
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-gray-600">
          Paciente: <strong>{patientName}</strong>
        </p>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Fecha y hora
          </label>
          <input
            type="datetime-local"
            value={cuando}
            onChange={(e) => setCuando(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sidebar/30"
          />
          <p className="text-xs text-gray-400">
            Debe haber al menos {minHoursBetweenSessions} horas de diferencia con tus otros pacientes agendados o sesiones ya realizadas.
          </p>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-sidebar text-white hover:opacity-90 disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {currentScheduledAt ? "Reprogramar" : "Agendar"}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
