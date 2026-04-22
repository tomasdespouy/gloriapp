"use client";

import { useState } from "react";
import { Save, FileText } from "lucide-react";
import { ConsentRenderer } from "@/lib/consent-render";

type PilotForPanel = {
  id: string;
  consent_text?: string | null;
  consent_version?: string | null;
};

/**
 * Consentimiento text editor for a single pilot.
 *
 * Lives inside the "Consentimiento" tab of the pilot wizard. Only edits
 * the text that each participant will see on their enrolment page;
 * everything else that used to live here (public enrolment link, logo
 * preview, test mode toggle) has been moved or retired.
 */
export default function PilotConsentPanel({
  pilot,
  onPilotUpdated,
}: {
  pilot: PilotForPanel;
  onPilotUpdated: (updated: Partial<PilotForPanel>) => void;
}) {
  const [consentText, setConsentText] = useState(pilot.consent_text || "");
  const [savingConsent, setSavingConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const consentDirty = consentText !== (pilot.consent_text || "");

  async function handleSaveConsent() {
    setError(null);
    setSavingConsent(true);
    const res = await fetch(`/api/admin/pilots/${pilot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent_text: consentText }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      setError(err?.error || `Error al guardar (${res.status})`);
    } else {
      const data = await res.json();
      onPilotUpdated(data);
      setSavedToast("Consentimiento actualizado");
      setTimeout(() => setSavedToast(null), 2500);
    }
    setSavingConsent(false);
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-[#4A55A2]/20 p-6 space-y-6 shadow-lg shadow-[#4A55A2]/5">
      <div className="flex items-start gap-3 pb-4 border-b border-gray-100">
        <div className="w-10 h-10 rounded-xl bg-[#4A55A2] flex items-center justify-center flex-shrink-0">
          <FileText size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900">
            Consentimiento informado
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Edita el texto que cada participante firmará antes de acceder a la
            plataforma.
          </p>
        </div>
        {savedToast && (
          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-full font-medium flex-shrink-0">
            {savedToast}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-gray-900">
            Texto del consentimiento informado
          </label>
          <span className="text-xs text-gray-500 font-mono">
            versión: {pilot.consent_version || "v1"}
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Al guardar, se genera una nueva versión y los consentimientos
          previamente firmados quedan inmutables con su texto original.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Editor (texto plano + **negritas**)
            </p>
            <textarea
              value={consentText}
              onChange={(e) => setConsentText(e.target.value)}
              rows={16}
              className="w-full font-mono text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#4A55A2] focus:border-[#4A55A2] resize-y"
              placeholder="Texto del consentimiento informado…"
            />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Vista previa (así lo verán los participantes)
            </p>
            <ConsentRenderer
              text={consentText}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs overflow-y-auto leading-relaxed min-h-[280px] max-h-[420px]"
            />
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-gray-400">
            {consentText.length.toLocaleString()} caracteres · formatos:{" "}
            <span className="font-mono">**negrita**</span>,{" "}
            <span className="font-mono"># título</span>,{" "}
            <span className="font-mono">## subtítulo</span>,{" "}
            <span className="font-mono">- lista</span>
          </p>
          <button
            onClick={handleSaveConsent}
            disabled={!consentDirty || savingConsent}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#4A55A2] hover:bg-[#5C6BB5] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Save size={14} />
            {savingConsent ? "Guardando…" : "Guardar consentimiento"}
          </button>
        </div>
      </div>
    </div>
  );
}
