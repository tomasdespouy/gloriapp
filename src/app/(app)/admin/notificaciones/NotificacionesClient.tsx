"use client";

import { useState, useEffect } from "react";
import {
  Bell, Send, Loader2, CheckCircle2, Users, User,
  Globe, Mail, AlertCircle, Building2, Sparkles, Clock,
  ChevronDown,
} from "lucide-react";

const TEMPLATES = [
  { label: "Mantención", subject: "Mantención programada — GlorIA", body: "Estimado/a usuario/a,\n\nLe informamos que el día [FECHA] entre las [HORA INICIO] y [HORA FIN] realizaremos una mantención programada de la plataforma GlorIA.\n\nDurante este período, la plataforma podría presentar intermitencias.\n\nAgradecemos su comprensión.\n\nEquipo GlorIA" },
  { label: "Nueva funcionalidad", subject: "Nueva funcionalidad disponible — GlorIA", body: "Estimado/a usuario/a,\n\nNos complace informarle que hemos incorporado una nueva funcionalidad a la plataforma GlorIA:\n\n[DESCRIPCIÓN]\n\nLo/la invitamos a probarla ingresando a glor-ia.com.\n\nEquipo GlorIA" },
  { label: "Nuevo curso", subject: "Nuevo curso disponible — GlorIA", body: "Estimado/a usuario/a,\n\nHemos publicado un nuevo módulo de aprendizaje:\n\n[NOMBRE DEL CURSO]\n\nPuede acceder desde la sección Aprendizaje en glor-ia.com.\n\nEquipo GlorIA" },
  { label: "Webinar", subject: "Invitación a webinar — GlorIA", body: "Estimado/a usuario/a,\n\nLo/la invitamos a nuestro próximo webinar:\n\nTema: [TEMA]\nFecha: [FECHA]\nHora: [HORA]\nLink: [LINK]\n\nEsperamos contar con su participación.\n\nEquipo GlorIA" },
];

const ROLES = [
  { value: "student", label: "Estudiantes" },
  { value: "instructor", label: "Docentes" },
  { value: "admin", label: "Administradores" },
];

const COUNTRIES = [
  "Chile", "Perú", "Colombia", "Argentina", "México",
  "República Dominicana", "Venezuela", "Ecuador",
];

type LogEntry = {
  id: string;
  subject: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  filters: Record<string, unknown>;
  created_at: string;
};

export default function NotificacionesClient() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [individualEmails, setIndividualEmails] = useState("");
  const [aiIdea, setAiIdea] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load history
  useEffect(() => {
    fetch("/api/admin/notifications").then(r => r.json()).then(setLogs).catch(() => {});
  }, [result]);

  const toggleRole = (role: string) => {
    setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const toggleCountry = (country: string) => {
    setSelectedCountries(prev => prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]);
  };

  const applyTemplate = (idx: number) => {
    setSubject(TEMPLATES[idx].subject);
    setBody(TEMPLATES[idx].body);
  };

  const generateWithAi = async () => {
    if (!aiIdea.trim()) return;
    setGeneratingAi(true);
    try {
      const res = await fetch("/api/admin/notifications/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: aiIdea }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubject(data.subject);
        setBody(data.body);
        setAiIdea("");
      }
    } catch { /* silent */ }
    setGeneratingAi(false);
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) { setError("Asunto y mensaje son requeridos."); return; }

    const hasRecipients = selectedRoles.length > 0 || selectedCountries.length > 0 || individualEmails.trim();
    if (!hasRecipients) { setError("Selecciona al menos un grupo de destinatarios."); return; }

    setSending(true);
    setError("");
    setResult(null);

    const payload: Record<string, unknown> = { subject, body };
    if (selectedRoles.length > 0) payload.roles = selectedRoles;
    if (selectedCountries.length > 0) payload.countries = selectedCountries;
    if (individualEmails.trim()) {
      payload.individualEmails = individualEmails.split(/[,;\n]/).map(e => e.trim()).filter(Boolean);
    }

    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setResult(await res.json());
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Error al enviar.");
      }
    } catch { setError("Error de conexión."); }
    setSending(false);
  };

  const reset = () => { setSubject(""); setBody(""); setResult(null); setError(""); setSelectedRoles([]); setSelectedCountries([]); setIndividualEmails(""); };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen">
      <header className="px-4 sm:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell size={24} className="text-sidebar" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
            <p className="text-sm text-gray-500 mt-0.5">Envía comunicaciones por email a usuarios de la plataforma</p>
          </div>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:border-sidebar/30 hover:text-sidebar transition-colors"
        >
          <Clock size={14} />
          Historial ({logs.length})
          <ChevronDown size={12} className={`transition-transform ${showHistory ? "rotate-180" : ""}`} />
        </button>
      </header>

      <div className="px-4 sm:px-8 pb-8 max-w-4xl">

        {/* History panel */}
        {showHistory && logs.length > 0 && (
          <div className="mb-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-500 font-medium">Fecha</th>
                    <th className="text-left px-4 py-2 text-gray-500 font-medium">Asunto</th>
                    <th className="text-center px-4 py-2 text-gray-500 font-medium">Enviados</th>
                    <th className="text-center px-4 py-2 text-gray-500 font-medium">Fallidos</th>
                    <th className="text-center px-4 py-2 text-gray-500 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-500">{formatDate(log.created_at)}</td>
                      <td className="px-4 py-2.5 text-gray-800 font-medium">{log.subject}</td>
                      <td className="px-4 py-2.5 text-center text-green-600 font-medium">{log.sent_count}</td>
                      <td className="px-4 py-2.5 text-center text-red-500 font-medium">{log.failed_count || "—"}</td>
                      <td className="px-4 py-2.5 text-center">
                        {log.failed_count === 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">Completado</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">Parcial</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Notificación enviada</h3>
            <p className="text-sm text-gray-600 mb-4">
              Se enviaron <strong>{result.sent}</strong> correos exitosamente
              {result.failed > 0 && <> (<span className="text-red-500">{result.failed} fallidos</span>)</>}.
            </p>
            <button onClick={reset} className="px-6 py-2.5 bg-sidebar text-white rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors">
              Enviar otra notificación
            </button>
          </div>
        ) : (
          <div className="space-y-6">

            {/* AI Generate */}
            <div className="bg-gradient-to-r from-sidebar/5 to-purple-50 rounded-xl border border-sidebar/10 p-6">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-sidebar" />
                <h3 className="text-sm font-semibold text-gray-900">Generar correo con IA</h3>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiIdea}
                  onChange={(e) => setAiIdea(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") generateWithAi(); }}
                  placeholder="Ej: Felices fiestas, mantención el viernes, nuevo curso de escucha activa..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30 bg-white"
                />
                <button
                  onClick={generateWithAi}
                  disabled={generatingAi || !aiIdea.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-sidebar text-white rounded-lg text-sm font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50"
                >
                  {generatingAi ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Generar
                </button>
              </div>
            </div>

            {/* Templates */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-gray-400 py-1">Plantillas:</span>
              {TEMPLATES.map((t, i) => (
                <button key={i} onClick={() => applyTemplate(i)}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:border-sidebar/30 hover:text-sidebar hover:bg-sidebar/5 transition-colors">
                  {t.label}
                </button>
              ))}
            </div>

            {/* Recipients — multi-select */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Destinatarios</h3>
              <p className="text-xs text-gray-400">Selecciona uno o más filtros. Se combinan (unión): todos los usuarios que cumplan al menos un criterio recibirán el correo.</p>

              {/* Roles */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <User size={14} className="text-gray-400" />
                  <span className="text-xs font-medium text-gray-600">Por rol</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => (
                    <button key={r.value} onClick={() => toggleRole(r.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedRoles.includes(r.value)
                          ? "bg-sidebar text-white"
                          : "border border-gray-200 text-gray-600 hover:border-sidebar/30"
                      }`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Countries */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Globe size={14} className="text-gray-400" />
                  <span className="text-xs font-medium text-gray-600">Por país</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {COUNTRIES.map((c) => (
                    <button key={c} onClick={() => toggleCountry(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedCountries.includes(c)
                          ? "bg-sidebar text-white"
                          : "border border-gray-200 text-gray-600 hover:border-sidebar/30"
                      }`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Individual */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Mail size={14} className="text-gray-400" />
                  <span className="text-xs font-medium text-gray-600">Emails individuales (opcional)</span>
                </div>
                <textarea
                  value={individualEmails}
                  onChange={(e) => setIndividualEmails(e.target.value)}
                  placeholder="usuario1@email.com, usuario2@email.com"
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sidebar/30 resize-none"
                />
              </div>

              {/* Summary */}
              <div className="text-xs text-gray-400 pt-1 border-t border-gray-100">
                {selectedRoles.length > 0 && <span className="text-sidebar font-medium">{selectedRoles.map(r => ROLES.find(x => x.value === r)?.label).join(", ")}</span>}
                {selectedRoles.length > 0 && selectedCountries.length > 0 && " + "}
                {selectedCountries.length > 0 && <span className="text-sidebar font-medium">{selectedCountries.join(", ")}</span>}
                {(selectedRoles.length > 0 || selectedCountries.length > 0) && individualEmails.trim() && " + "}
                {individualEmails.trim() && <span className="text-sidebar font-medium">{individualEmails.split(/[,;\n]/).filter(e => e.trim()).length} email(s) individuales</span>}
                {!selectedRoles.length && !selectedCountries.length && !individualEmails.trim() && "Ningún destinatario seleccionado"}
              </div>
            </div>

            {/* Message */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Mensaje</h3>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Asunto *</label>
                <input type="text" value={subject} onChange={(e) => { setSubject(e.target.value); setError(""); }}
                  placeholder="Asunto del correo"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cuerpo *</label>
                <textarea value={body} onChange={(e) => { setBody(e.target.value); setError(""); }}
                  placeholder="Escribe el mensaje..."
                  rows={10}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30 resize-none" />
                <p className="text-[10px] text-gray-400 mt-1">Usa [TEXTO] como marcador. Los saltos de línea se respetan.</p>
              </div>
            </div>

            {/* Email preview */}
            {(subject.trim() || body.trim()) && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Previsualización del email</h3>

                <div className="mb-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-16">De:</span>
                    <span className="text-xs text-gray-700 font-medium">GlorIA &lt;noreply@glor-ia.com&gt;</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-16">Asunto:</span>
                    <span className="text-xs text-gray-700 font-medium">{subject || "—"}</span>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div style={{ background: "#4A55A2", padding: "16px 24px", borderRadius: "8px 8px 0 0" }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p style={{ color: "white", margin: 0, fontSize: "16px", fontWeight: 700 }}>
                          {subject || "Asunto del correo"}
                        </p>
                        <p style={{ color: "rgba(255,255,255,0.7)", margin: "3px 0 0", fontSize: "11px" }}>
                          Plataforma de Entrenamiento Clínico con IA
                        </p>
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="https://ndwmnxlwbfqfwwtekjun.supabase.co/storage/v1/object/public/patients/gloria-side-logo.png"
                        alt="GlorIA"
                        style={{ height: 32 }}
                      />
                    </div>
                  </div>
                  <div className="p-5 bg-gray-50 text-sm text-gray-700 leading-relaxed">
                    <div
                      className="whitespace-pre-line"
                      style={{ fontSize: 13, lineHeight: 1.7, color: "#333" }}
                    >
                      {body || "El contenido del mensaje aparecerá aquí..."}
                    </div>
                    <div className="mt-5 pt-4 border-t border-gray-200">
                      <p className="text-[13px] text-gray-600">Con entusiasmo,</p>
                      <p className="text-[13px] text-gray-900 font-bold mt-0.5">Equipo GlorIA</p>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-gray-400 text-center mt-3">
                  GlorIA — Simulación clínica con inteligencia artificial
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            {/* Send */}
            <div className="flex justify-end">
              <button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-sidebar text-white rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50">
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {sending ? "Enviando..." : "Enviar notificación"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
