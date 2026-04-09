"use client";

import { useState } from "react";
import {
  Link2, Copy, Check, FlaskConical, Save, FileText, ExternalLink,
} from "lucide-react";

type PilotForPanel = {
  id: string;
  enrollment_slug?: string | null;
  consent_text?: string | null;
  consent_version?: string | null;
  test_mode?: boolean | null;
};

/**
 * Self-enrollment & consent management panel for a single pilot.
 * Lives inside the pilot detail / dashboard view (Step 4) of PilotosClient.
 *
 * Lets the superadmin:
 *   1. Copy the public enrollment URL to share with the institution
 *   2. Toggle test_mode (skip emails, show creds on screen)
 *   3. Edit the consent text in a textarea (no code involved)
 *   4. See the current consent_version label
 */
export default function PilotConsentPanel({
  pilot,
  onPilotUpdated,
}: {
  pilot: PilotForPanel;
  onPilotUpdated: (updated: Partial<PilotForPanel>) => void;
}) {
  const [consentText, setConsentText] = useState(pilot.consent_text || "");
  const [testMode, setTestMode] = useState(!!pilot.test_mode);
  const [savingConsent, setSavingConsent] = useState(false);
  const [savingTestMode, setSavingTestMode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const enrollmentUrl = pilot.enrollment_slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/piloto/${pilot.enrollment_slug}/consentimiento`
    : null;

  const consentDirty = consentText !== (pilot.consent_text || "");

  async function handleCopyLink() {
    if (!enrollmentUrl) return;
    try {
      await navigator.clipboard.writeText(enrollmentUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setError("No se pudo copiar al portapapeles. Copia el link manualmente.");
    }
  }

  async function patchPilot(update: Partial<PilotForPanel>): Promise<boolean> {
    setError(null);
    const res = await fetch(`/api/admin/pilots/${pilot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      setError(err?.error || `Error al guardar (${res.status})`);
      return false;
    }
    const data = await res.json();
    onPilotUpdated(data);
    return true;
  }

  async function handleSaveConsent() {
    setSavingConsent(true);
    const ok = await patchPilot({ consent_text: consentText });
    if (ok) {
      setSavedToast("Consentimiento actualizado");
      setTimeout(() => setSavedToast(null), 2500);
    }
    setSavingConsent(false);
  }

  async function handleToggleTestMode() {
    const newValue = !testMode;
    setTestMode(newValue);
    setSavingTestMode(true);
    const ok = await patchPilot({ test_mode: newValue });
    if (!ok) {
      // Roll back optimistic update on error
      setTestMode(!newValue);
    } else {
      setSavedToast(
        newValue ? "Modo de prueba activado" : "Modo de prueba desactivado",
      );
      setTimeout(() => setSavedToast(null), 2500);
    }
    setSavingTestMode(false);
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-[#4A55A2]/20 p-6 space-y-6 shadow-lg shadow-[#4A55A2]/5">
      <div className="flex items-start gap-3 pb-4 border-b border-gray-100">
        <div className="w-10 h-10 rounded-xl bg-[#4A55A2] flex items-center justify-center flex-shrink-0">
          <Link2 size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900">
            Inscripción y consentimiento
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Comparte el link único con la institución para que cada participante firme su
            consentimiento y reciba sus credenciales automáticamente.
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

      {/* ── Public enrollment link ─────────────────────────────────── */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
          Link único del piloto
        </label>
        {enrollmentUrl ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={enrollmentUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 font-mono text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700"
            />
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#4A55A2] hover:bg-[#5C6BB5] text-white text-xs font-medium rounded-lg transition-colors"
            >
              {copiedLink ? (
                <>
                  <Check size={14} /> Copiado
                </>
              ) : (
                <>
                  <Copy size={14} /> Copiar
                </>
              )}
            </button>
            <a
              href={enrollmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
              title="Abrir en nueva pestaña"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">
            Este piloto no tiene link único todavía. Edita y guarda el piloto
            para generar uno automáticamente.
          </p>
        )}
        <p className="text-xs text-gray-500 mt-2">
          Comparte este link con el coordinador de la institución. Cada
          persona que entre podrá inscribirse, firmar el consentimiento y
          recibir sus credenciales por correo automáticamente.
        </p>
      </div>

      {/* ── Test mode toggle ───────────────────────────────────────── */}
      <div className="border-t border-gray-100 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <FlaskConical size={16} className="text-amber-600" />
              <label className="text-sm font-semibold text-gray-900">
                Modo de prueba
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1.5 max-w-md">
              Cuando está activo, las credenciales se muestran en pantalla al
              firmar el consentimiento (no se envía email). Útil para probar
              el flujo entero sin necesidad de correos reales. También puedes
              usar el botón <strong>Reset</strong> de cada participante para
              re-correr el flujo con el mismo correo.
            </p>
          </div>
          <button
            onClick={handleToggleTestMode}
            disabled={savingTestMode}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
              testMode ? "bg-amber-500" : "bg-gray-200"
            } disabled:opacity-50`}
            role="switch"
            aria-checked={testMode}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                testMode ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* ── Consent text editor ───────────────────────────────────── */}
      <div className="border-t border-gray-100 pt-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-[#4A55A2]" />
            <label className="text-sm font-semibold text-gray-900">
              Texto del consentimiento informado
            </label>
          </div>
          <span className="text-xs text-gray-500 font-mono">
            versión: {pilot.consent_version || "v1"}
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Edita el texto que verá cada participante en su página de
          inscripción. Al guardar, se genera una nueva versión y los
          consentimientos previamente firmados quedan inmutables con su
          texto original.
        </p>
        <textarea
          value={consentText}
          onChange={(e) => setConsentText(e.target.value)}
          rows={14}
          className="w-full font-mono text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#4A55A2] focus:border-[#4A55A2] resize-y"
          placeholder="Texto del consentimiento informado…"
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-gray-400">
            {consentText.length.toLocaleString()} caracteres
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
