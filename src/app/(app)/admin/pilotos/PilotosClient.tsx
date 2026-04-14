"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket, Upload, CheckCircle2, XCircle, Mail, BarChart3,
  FileText, Plus, ArrowLeft, ArrowRight, Loader2, Users,
  Calendar, Globe, Building2, Trash2, Eye, RefreshCw,
  Download, Send, Clock, UserCheck, MessageSquare,
  AlertCircle, Check, ChevronDown, RotateCcw,
} from "lucide-react";
import PilotConsentPanel from "./PilotConsentPanel";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

type Pilot = {
  id: string;
  name: string;
  institution: string;
  country: string | null;
  contact_name: string | null;
  contact_email: string | null;
  status: string;
  csv_data: CsvRow[];
  email_template: string | null;
  email_sent_at: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  report_url: string | null;
  created_at: string;
  updated_at: string;
  participant_count: number;
  participants?: Participant[];
  establishment_id?: string | null;
  // Self-enrollment + digital consent
  enrollment_slug?: string | null;
  consent_text?: string | null;
  consent_version?: string | null;
  test_mode?: boolean | null;
};

type Participant = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  user_id: string | null;
  invite_sent_at: string | null;
  first_login_at: string | null;
  sessions_count: number;
  last_active_at: string | null;
  // Set to the created_at of the participant's most recent survey_responses
  // row, or null if they haven't answered the closure survey yet.
  survey_completed_at: string | null;
};

type CsvRow = {
  email: string;
  full_name: string;
  role: string;
};

type ValidationError = {
  row: number;
  field: string;
  message: string;
};

// ────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  borrador: "bg-gray-100 text-gray-700",
  validado: "bg-blue-100 text-blue-700",
  enviado: "bg-purple-100 text-purple-700",
  en_curso: "bg-green-100 text-green-700",
  finalizado: "bg-amber-100 text-amber-700",
  cancelado: "bg-red-100 text-red-600",
};

const STATUS_LABELS: Record<string, string> = {
  borrador: "Borrador",
  validado: "Validado",
  enviado: "Enviado",
  en_curso: "En curso",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

const STEPS = [
  { label: "Ingresar usuarios", icon: Upload },
  { label: "Validar", icon: CheckCircle2 },
  { label: "Previsualizar", icon: Mail },
  { label: "Dashboard", icon: BarChart3 },
  { label: "Informe", icon: FileText },
];

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

// ────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────

type Establishment = { id: string; name: string; country: string | null };

export default function PilotosClient({
  pilots: initialPilots,
  establishments,
}: {
  pilots: Pilot[];
  establishments: Establishment[];
}) {
  const router = useRouter();
  const [pilots, setPilots] = useState(initialPilots);
  const [selectedPilot, setSelectedPilot] = useState<Pilot | null>(null);
  const [step, setStep] = useState(0);
  const [showWizard, setShowWizard] = useState(false);
  const [creating, setCreating] = useState(false);

  // Step 1 state
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    institution: "",
    country: "",
    contact_name: "",
    contact_email: "",
    scheduled_at: "",
    ended_at: "",
    establishment_id: "",
  });
  const [csvError, setCsvError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 state
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid_count: number;
    error_count: number;
    errors: ValidationError[];
  } | null>(null);

  // Step 3 state
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    total: number;
    success: number;
    failed: number;
  } | null>(null);

  // Step 4 state
  const [dashboardData, setDashboardData] = useState<Pilot | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ────────────────────────────────
  // Helpers
  // ────────────────────────────────

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const resetWizard = () => {
    setStep(0);
    setShowWizard(false);
    setCreating(false);
    setCsvRows([]);
    setFormData({ name: "", institution: "", country: "", contact_name: "", contact_email: "", scheduled_at: "", ended_at: "", establishment_id: "" });
    setCsvError("");
    setValidationResult(null);
    setSendResult(null);
    setDashboardData(null);
  };

  const openPilot = async (pilot: Pilot, targetStep?: number) => {
    // Fetch full pilot details
    const res = await fetch(`/api/admin/pilots/${pilot.id}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedPilot(data);
      setDashboardData(data);
      setCsvRows(data.csv_data || []);
      setFormData({
        name: data.name,
        institution: data.institution,
        country: data.country || "",
        contact_name: data.contact_name || "",
        contact_email: data.contact_email || "",
        scheduled_at: data.scheduled_at ? new Date(data.scheduled_at).toISOString().slice(0, 16) : "",
        ended_at: data.ended_at ? new Date(data.ended_at).toISOString().slice(0, 16) : "",
        establishment_id: data.establishment_id || "",
      });

      // Determine step from status or target
      if (targetStep !== undefined) {
        setStep(targetStep);
      } else if (data.status === "borrador") {
        setStep(0);
      } else if (data.status === "validado") {
        setStep(2);
      } else if (data.status === "enviado" || data.status === "en_curso") {
        setStep(3);
      } else if (data.status === "finalizado") {
        setStep(4);
      } else {
        setStep(0);
      }
      setShowWizard(false);
      setCreating(false);
    }
  };

  // ────────────────────────────────
  // CSV Parsing
  // ────────────────────────────────

  const parseCSV = (text: string) => {
    setCsvError("");
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      setCsvError("El archivo CSV debe tener al menos un encabezado y una fila de datos.");
      return;
    }

    const headerLine = lines[0].toLowerCase();
    const delimiter = headerLine.includes(";") ? ";" : ",";
    const headers = headerLine.split(delimiter).map((h) => h.trim().replace(/"/g, ""));

    // Map known column names
    const emailIdx = headers.findIndex((h) => ["email", "correo", "e-mail", "mail"].includes(h));
    const nameIdx = headers.findIndex((h) => ["nombre_completo", "full_name", "nombre", "name", "alumno"].includes(h));
    const roleIdx = headers.findIndex((h) => ["rol", "role", "tipo"].includes(h));

    if (emailIdx === -1) {
      setCsvError("No se encontró la columna 'email' en el CSV. Columnas detectadas: " + headers.join(", "));
      return;
    }
    if (nameIdx === -1) {
      setCsvError("No se encontró la columna 'nombre_completo' o 'nombre' en el CSV.");
      return;
    }

    const rows: CsvRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
      if (!cols[emailIdx]?.trim()) continue;

      let role = "student";
      if (roleIdx >= 0 && cols[roleIdx]) {
        const rawRole = cols[roleIdx].toLowerCase().trim();
        if (["instructor", "docente", "teacher", "profesor"].includes(rawRole)) {
          role = "instructor";
        }
      }

      rows.push({
        email: cols[emailIdx].trim(),
        full_name: cols[nameIdx]?.trim() || "",
        role,
      });
    }

    if (rows.length === 0) {
      setCsvError("No se encontraron filas válidas en el CSV.");
      return;
    }

    setCsvRows(rows);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const readFile = (file: File) => {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      setCsvError("Solo se permiten archivos .csv o .txt");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  // ────────────────────────────────
  // Step 1: Create pilot
  // ────────────────────────────────

  const handleCreatePilot = async () => {
    // CSV is optional now: the canonical onboarding flow is the public
    // enrollment link, where students self-register with their own
    // email. Pre-loading a CSV is only needed for closed pilots where
    // the admin already knows every participant.
    if (!formData.name.trim() || !formData.institution.trim() || !formData.establishment_id) return;
    setCreating(true);

    // Auto-add contact as instructor if not already in list
    let finalRows = [...csvRows];
    if (formData.contact_email?.trim() && formData.contact_name?.trim()) {
      const contactEmail = formData.contact_email.trim().toLowerCase();
      if (!finalRows.some((r) => r.email.toLowerCase() === contactEmail)) {
        finalRows = [...finalRows, {
          email: contactEmail,
          full_name: formData.contact_name.trim(),
          role: "instructor",
        }];
        setCsvRows(finalRows);
      }
    }

    const res = await fetch("/api/admin/pilots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formData,
        scheduled_at: formData.scheduled_at ? new Date(formData.scheduled_at).toISOString() : null,
        ended_at: formData.ended_at ? new Date(formData.ended_at).toISOString() : null,
        csv_data: finalRows,
      }),
    });

    if (res.ok) {
      const pilot = await res.json();
      setPilots((prev) => [{ ...pilot, participant_count: csvRows.length }, ...prev]);
      await openPilot(pilot, 1);
    } else {
      const errData = await res.json().catch(() => null);
      setCsvError(errData?.error || `Error al crear el piloto (${res.status}). Intenta de nuevo.`);
    }
    setCreating(false);
  };

  // ────────────────────────────────
  // Step 2: Validate
  // ────────────────────────────────

  const handleValidate = async () => {
    if (!selectedPilot) return;
    setValidating(true);
    setValidationResult(null);

    const res = await fetch(`/api/admin/pilots/${selectedPilot.id}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: csvRows }),
    });

    if (res.ok) {
      const data = await res.json();
      setValidationResult(data);
    }
    setValidating(false);
  };

  // ────────────────────────────────
  // Step 3: Send invites
  // ────────────────────────────────

  const handleSendInvites = async (customBody?: string) => {
    if (!selectedPilot) return;
    setSending(true);
    setSendResult(null);

    const res = await fetch(`/api/admin/pilots/${selectedPilot.id}/send-invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customBody: customBody || undefined }),
    });

    if (res.ok) {
      const data = await res.json();
      setSendResult(data);
      // Refresh pilot data
      await openPilot(selectedPilot, 3);
    }
    setSending(false);
  };

  // ────────────────────────────────
  // Step 4: Dashboard refresh
  // ────────────────────────────────

  const refreshDashboard = useCallback(async () => {
    if (!selectedPilot) return;
    setRefreshing(true);
    const res = await fetch(`/api/admin/pilots/${selectedPilot.id}`);
    if (res.ok) {
      const data = await res.json();
      setDashboardData(data);
      setSelectedPilot(data);
    }
    setRefreshing(false);
  }, [selectedPilot]);

  // Auto-refresh every 15 seconds on Step 4
  useEffect(() => {
    if (step !== 3 || !selectedPilot) return;
    const interval = setInterval(refreshDashboard, 15000);
    return () => clearInterval(interval);
  }, [step, selectedPilot, refreshDashboard]);

  // ────────────────────────────────
  // Reset a participant for re-testing (test_mode flow)
  // ────────────────────────────────

  const handleResetParticipant = async (participantId: string, participantEmail: string) => {
    if (!selectedPilot) return;
    if (!confirm(
      `¿Resetear a ${participantEmail}?\n\n` +
      `Esto borra su consentimiento, elimina su cuenta auth y vuelve su estado a "pendiente". ` +
      `La próxima vez que entre al link de inscripción podrá volver a firmar y obtener credenciales nuevas. ` +
      `Las conversaciones anteriores quedan huérfanas (no se borran).`
    )) return;

    const res = await fetch(
      `/api/admin/pilots/${selectedPilot.id}/participants/${participantId}/reset`,
      { method: "POST" },
    );
    if (res.ok) {
      await refreshDashboard();
    } else {
      const err = await res.json().catch(() => null);
      alert(`Error al resetear participante: ${err?.error || res.statusText}`);
    }
  };

  // Apply a partial pilot update locally (used by PilotConsentPanel after PATCH)
  const handlePilotPatched = (update: Partial<Pilot>) => {
    setSelectedPilot((prev) => (prev ? { ...prev, ...update } : prev));
    setDashboardData((prev) => (prev ? { ...prev, ...update } : prev));
    setPilots((prev) =>
      prev.map((p) => (p.id === selectedPilot?.id ? { ...p, ...update } : p)),
    );
  };

  // ────────────────────────────────
  // Delete pilot
  // ────────────────────────────────

  const handleDelete = async (pilotId: string) => {
    if (!confirm("¿Estás seguro de eliminar este piloto y todos sus participantes?")) return;
    const res = await fetch(`/api/admin/pilots/${pilotId}`, { method: "DELETE" });
    if (res.ok) {
      setPilots((prev) => prev.filter((p) => p.id !== pilotId));
      if (selectedPilot?.id === pilotId) {
        setSelectedPilot(null);
        resetWizard();
      }
    }
  };

  // ────────────────────────────────
  // Pilot list view
  // ────────────────────────────────

  if (!selectedPilot && !showWizard && step === 0) {
    return (
      <div className="min-h-screen">
        <header className="px-4 sm:px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pilotos</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Gestiona despliegues piloto en instituciones
            </p>
          </div>
          <button
            onClick={() => { resetWizard(); setShowWizard(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-sidebar text-white rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Nuevo piloto
          </button>
        </header>

        <div className="px-4 sm:px-8 pb-8">
          {pilots.length === 0 ? (
            <div className="text-center py-20">
              <Rocket size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">No hay pilotos creados aún</p>
              <button
                onClick={() => { resetWizard(); setShowWizard(true); }}
                className="mt-4 px-4 py-2 bg-sidebar text-white rounded-lg text-sm font-medium hover:bg-sidebar-hover transition-colors cursor-pointer"
              >
                Crear primer piloto
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pilots.map((pilot) => (
                <div
                  key={pilot.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => openPilot(pilot)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{pilot.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Building2 size={12} className="text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-gray-500 truncate">{pilot.institution}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${STATUS_COLORS[pilot.status] || "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[pilot.status] || pilot.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-3">
                    {pilot.country && (
                      <span className="flex items-center gap-1">
                        <Globe size={12} />
                        {pilot.country}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {pilot.participant_count} participantes
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {formatDate(pilot.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); openPilot(pilot); }}
                      className="text-xs text-sidebar hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Eye size={12} /> Ver detalle
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(pilot.id); }}
                      className="text-xs text-red-500 hover:underline flex items-center gap-1 ml-auto cursor-pointer"
                    >
                      <Trash2 size={12} /> Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ────────────────────────────────
  // Wizard view
  // ────────────────────────────────

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="px-4 sm:px-8 py-5">
        <button
          onClick={() => { setSelectedPilot(null); resetWizard(); }}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3 cursor-pointer"
        >
          <ArrowLeft size={14} />
          Volver a pilotos
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {showWizard && !selectedPilot ? "Nuevo piloto" : selectedPilot?.name || "Piloto"}
        </h1>
        {selectedPilot && (
          <p className="text-sm text-gray-500 mt-0.5">
            {selectedPilot.institution}
            {selectedPilot.country ? ` — ${selectedPilot.country}` : ""}
          </p>
        )}
      </header>

      {/* Consent + enrollment panel — TOP of the page once the pilot exists.
          This is the canonical onboarding mechanism (link único + consent
          firma digital). Lives ABOVE the legacy step indicators so it's
          impossible to miss. The legacy CSV→validate→preview wizard stays
          below as a fallback. */}
      {selectedPilot && step > 0 && (
        <div className="px-4 sm:px-8 mb-6">
          <PilotConsentPanel
            pilot={(dashboardData || selectedPilot)!}
            onPilotUpdated={handlePilotPatched}
          />
        </div>
      )}

      {/* Step indicators (legacy CSV-based wizard) */}
      <div className="px-4 sm:px-8 mb-6">
        {selectedPilot && step > 0 && (
          <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-2 font-medium">
            Flujo CSV legacy (opcional — usa el panel de inscripción de arriba)
          </p>
        )}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-2 overflow-x-auto">
          {STEPS.map((s, i) => {
            const isActive = i === step;
            const isDone = i < step;
            return (
              <button
                key={i}
                onClick={() => {
                  if (selectedPilot && i <= step + 1) setStep(i);
                }}
                disabled={(showWizard && !selectedPilot && i > 0) || creating}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors flex-shrink-0 cursor-pointer disabled:cursor-not-allowed ${
                  isActive
                    ? "bg-sidebar text-white"
                    : isDone
                    ? "bg-sidebar/10 text-sidebar"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <s.icon size={14} />
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="px-4 sm:px-8 pb-8">
        {step === 0 && <Step1Upload
          formData={formData}
          setFormData={setFormData}
          csvRows={csvRows}
          setCsvRows={setCsvRows}
          csvError={csvError}
          creating={creating}
          fileInputRef={fileInputRef}
          onFileDrop={handleFileDrop}
          onFileSelect={handleFileSelect}
          onCreatePilot={handleCreatePilot}
          isEditing={!!selectedPilot}
          onNext={() => setStep(1)}
          establishments={establishments}
        />}

        {step === 1 && <Step2Validate
          csvRows={csvRows}
          setCsvRows={setCsvRows}
          validating={validating}
          validationResult={validationResult}
          onValidate={handleValidate}
          onNext={() => setStep(2)}
        />}

        {step === 2 && <Step3Preview
          pilot={selectedPilot}
          sending={sending}
          sendResult={sendResult}
          onSend={handleSendInvites}
          onNext={() => setStep(3)}
        />}

        {step === 3 && (
          <Step4Dashboard
            pilot={dashboardData || selectedPilot}
            refreshing={refreshing}
            onRefresh={refreshDashboard}
            onResetParticipant={handleResetParticipant}
            onFinalize={async () => {
              if (!selectedPilot) return;
              const res = await fetch(`/api/admin/pilots/${selectedPilot.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "finalizado", ended_at: new Date().toISOString() }),
              });
              if (res.ok) {
                await refreshDashboard();
                setStep(4);
              }
            }}
          />
        )}

        {step === 4 && <Step5Report
          pilot={dashboardData || selectedPilot}
        />}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// Step 1: Upload CSV
// ════════════════════════════════════════════

function Step1Upload({
  formData, setFormData, csvRows, setCsvRows, csvError, creating, fileInputRef,
  onFileDrop, onFileSelect, onCreatePilot, isEditing, onNext, establishments,
}: {
  formData: { name: string; institution: string; country: string; contact_name: string; contact_email: string; scheduled_at: string; ended_at: string; establishment_id: string };
  setFormData: (fn: (prev: typeof formData) => typeof formData) => void;
  csvRows: CsvRow[];
  setCsvRows: (rows: CsvRow[]) => void;
  csvError: string;
  creating: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCreatePilot: () => void;
  isEditing: boolean;
  onNext?: () => void;
  establishments: Establishment[];
}) {
  const [manualForm, setManualForm] = useState({ first_name: "", last_name: "", email: "", role: "student" });
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CsvRow>({ email: "", full_name: "", role: "student" });
  const [createError, setCreateError] = useState("");
  // CSV pre-loading is optional — see handleCreatePilot for context.
  const canCreate = formData.name.trim() && formData.institution.trim() && formData.establishment_id;

  const handleAddManual = () => {
    if (!manualForm.first_name.trim() || !manualForm.last_name.trim() || !manualForm.email.trim()) return;
    const email = manualForm.email.trim().toLowerCase();
    // Check duplicate
    if (csvRows.some((r) => r.email.toLowerCase() === email)) {
      setCreateError(`El email ${email} ya está en la lista.`);
      return;
    }
    setCreateError("");
    const newRow: CsvRow = {
      email,
      full_name: `${manualForm.first_name.trim()} ${manualForm.last_name.trim()}`,
      role: manualForm.role,
    };
    setCsvRows([...csvRows, newRow]);
    setManualForm({ first_name: "", last_name: "", email: "", role: "student" });
  };

  const handleRemoveRow = (index: number) => {
    setCsvRows(csvRows.filter((_, i) => i !== index));
  };

  const startEdit = (index: number) => {
    setEditingIdx(index);
    setEditForm({ ...csvRows[index] });
  };

  const saveEdit = () => {
    if (editingIdx === null) return;
    const updated = [...csvRows];
    updated[editingIdx] = { ...editForm, email: editForm.email.trim().toLowerCase() };
    setCsvRows(updated);
    setEditingIdx(null);
  };

  const cancelEdit = () => {
    setEditingIdx(null);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Pilot info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Información del piloto</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del piloto *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              placeholder="Piloto UGM 2026-S1"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Establecimiento *</label>
            <select
              value={formData.establishment_id}
              onChange={(e) => {
                const newId = e.target.value;
                const est = establishments.find((x) => x.id === newId);
                setFormData((f) => ({
                  ...f,
                  establishment_id: newId,
                  // Auto-fill institution + country from the selected establishment.
                  // The admin can still override them after this.
                  institution: est?.name || f.institution,
                  country: est?.country || f.country,
                }));
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sidebar/30 hover:border-gray-300 cursor-pointer"
            >
              <option value="">— Seleccionar establecimiento —</option>
              {establishments.map((est) => (
                <option key={est.id} value={est.id}>
                  {est.name}{est.country ? ` (${est.country})` : ""}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              Los participantes quedarán vinculados a este establecimiento y verán solo sus pacientes asignados.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Institución <span className="text-gray-400 font-normal">(se rellena al elegir establecimiento)</span>
            </label>
            <input
              type="text"
              value={formData.institution}
              onChange={(e) => setFormData((f) => ({ ...f, institution: e.target.value }))}
              placeholder="Universidad Gabriela Mistral"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">País</label>
            <input
              type="text"
              value={formData.country}
              onChange={(e) => setFormData((f) => ({ ...f, country: e.target.value }))}
              placeholder="Chile"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre contacto</label>
            <input
              type="text"
              value={formData.contact_name}
              onChange={(e) => setFormData((f) => ({ ...f, contact_name: e.target.value }))}
              placeholder="Dr. Juan Pérez"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Email contacto</label>
            <input
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData((f) => ({ ...f, contact_email: e.target.value }))}
              placeholder="contacto@universidad.edu"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              <Clock size={12} className="inline mr-1" />
              Inicio de acceso
            </label>
            <input
              type="datetime-local"
              value={formData.scheduled_at}
              onChange={(e) => setFormData((f) => ({ ...f, scheduled_at: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              <Clock size={12} className="inline mr-1" />
              Fin de acceso
            </label>
            <input
              type="datetime-local"
              value={formData.ended_at}
              onChange={(e) => setFormData((f) => ({ ...f, ended_at: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30"
            />
          </div>
        </div>
      </div>

      {/* CSV Upload */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Archivo de participantes <span className="text-gray-400 font-normal">(opcional)</span></h3>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">
              <strong>No es necesario</strong> si vas a usar el link único de inscripción del piloto.
              Cada estudiante se inscribirá con su propio correo desde ese link y firmará el consentimiento. Sube un CSV solo si necesitas pre-cargar a participantes específicos.
            </p>
          </div>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-sidebar/40 hover:bg-sidebar/5 transition-colors"
        >
          <Upload size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600 font-medium">
            Arrastra tu archivo CSV aquí o haz clic para seleccionar
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Columnas requeridas: email, nombre_completo, rol (student/instructor)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={onFileSelect}
            className="hidden"
          />
        </div>

        {csvError && (
          <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 rounded-lg">
            <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-600">{csvError}</p>
          </div>
        )}

        {/* CSV Preview */}
        {csvRows.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-600">
                {csvRows.length} participantes detectados
              </p>
              <p className="text-xs text-gray-400">
                {csvRows.filter((r) => r.role === "student").length} estudiantes,{" "}
                {csvRows.filter((r) => r.role === "instructor").length} docentes
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">#</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Email</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Nombre</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Rol</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {csvRows.slice(0, 50).map((row, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      {editingIdx === i ? (
                        <>
                          <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-2 py-1">
                            <input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sidebar/30" />
                          </td>
                          <td className="px-2 py-1">
                            <input value={editForm.full_name} onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sidebar/30" />
                          </td>
                          <td className="px-2 py-1">
                            <select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                              className="border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-sidebar/30 hover:border-gray-300 cursor-pointer">
                              <option value="student">Estudiante</option>
                              <option value="instructor">Docente</option>
                            </select>
                          </td>
                          <td className="px-3 py-2 flex gap-1">
                            <button onClick={saveEdit} className="text-green-500 hover:text-green-700 cursor-pointer"><Check size={14} /></button>
                            <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 cursor-pointer"><XCircle size={14} /></button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2 text-gray-700">{row.email}</td>
                          <td className="px-3 py-2 text-gray-700">{row.full_name}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              row.role === "instructor" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                            }`}>
                              {row.role === "instructor" ? "Docente" : "Estudiante"}
                            </span>
                          </td>
                          <td className="px-3 py-2 flex gap-1">
                            <button onClick={() => startEdit(i)} className="text-gray-300 hover:text-sidebar transition-colors cursor-pointer">
                              <Eye size={14} />
                            </button>
                            <button onClick={() => handleRemoveRow(i)} className="text-gray-300 hover:text-red-500 transition-colors cursor-pointer">
                              <XCircle size={14} />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {csvRows.length > 50 && (
                    <tr className="border-t border-gray-100">
                      <td colSpan={5} className="px-3 py-2 text-center text-gray-400">
                        ... y {csvRows.length - 50} más
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Manual participant entry */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Agregar participante manualmente</h3>
        {createError && (
          <div className="mb-3 flex items-start gap-2 p-3 bg-red-50 rounded-lg">
            <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-600">{createError}</p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
            <input
              type="text"
              value={manualForm.first_name}
              onChange={(e) => setManualForm((f) => ({ ...f, first_name: e.target.value }))}
              placeholder="María"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Apellido *</label>
            <input
              type="text"
              value={manualForm.last_name}
              onChange={(e) => setManualForm((f) => ({ ...f, last_name: e.target.value }))}
              placeholder="González"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
            <input
              type="email"
              value={manualForm.email}
              onChange={(e) => setManualForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="maria@universidad.edu"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
            <select
              value={manualForm.role}
              onChange={(e) => setManualForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30 bg-white hover:border-gray-300 cursor-pointer"
            >
              <option value="student">Estudiante</option>
              <option value="instructor">Docente</option>
            </select>
          </div>
          <button
            onClick={handleAddManual}
            disabled={!manualForm.first_name.trim() || !manualForm.last_name.trim() || !manualForm.email.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-sidebar text-white rounded-lg text-sm font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Plus size={14} />
            Agregar
          </button>
        </div>
      </div>

      {/* Action */}
      <div className="flex justify-end">
        {isEditing ? (
          <button
            onClick={() => onNext?.()}
            disabled={csvRows.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-sidebar text-white rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <ArrowRight size={16} />
            Siguiente
          </button>
        ) : (
          <button
            onClick={onCreatePilot}
            disabled={!canCreate || creating}
            className="flex items-center gap-2 px-6 py-2.5 bg-sidebar text-white rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            Crear piloto
          </button>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// Step 2: Validate
// ════════════════════════════════════════════

function Step2Validate({
  csvRows, setCsvRows, validating, validationResult, onValidate, onNext,
}: {
  csvRows: CsvRow[];
  setCsvRows: (rows: CsvRow[]) => void;
  validating: boolean;
  validationResult: { valid_count: number; error_count: number; errors: ValidationError[] } | null;
  onValidate: () => void;
  onNext: () => void;
}) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<CsvRow>({ email: "", full_name: "", role: "student" });

  const startEdit = (i: number) => { setEditIdx(i); setEditRow({ ...csvRows[i] }); };
  const saveEdit = () => {
    if (editIdx === null) return;
    const updated = [...csvRows];
    updated[editIdx] = { ...editRow, email: editRow.email.trim().toLowerCase() };
    setCsvRows(updated);
    setEditIdx(null);
  };
  const removeRow = (i: number) => setCsvRows(csvRows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Validación de datos</h3>
          <button
            onClick={onValidate}
            disabled={validating}
            className="flex items-center gap-2 px-4 py-2 bg-sidebar text-white rounded-lg text-xs font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {validating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {validating ? "Validando..." : "Validar datos"}
          </button>
        </div>

        {/* Pre-validation summary */}
        {!validationResult && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700 mb-3">
                Se validarán <strong>{csvRows.length} participantes</strong> — verificando formato de email, duplicados y existencia en la base de datos.
              </p>
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium w-10">#</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Email</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Nombre</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Rol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 text-gray-700">{row.email}</td>
                        <td className="px-3 py-2 text-gray-700">{row.full_name}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            row.role === "instructor" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                          }`}>
                            {row.role === "instructor" ? "Docente" : "Estudiante"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Validation results */}
        {validationResult && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <Check size={14} className="text-green-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-green-600">{validationResult.valid_count}</p>
                  <p className="text-[10px] text-gray-500">válidos</p>
                </div>
              </div>
              {validationResult.error_count > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                    <XCircle size={14} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-500">{validationResult.error_count}</p>
                    <p className="text-[10px] text-gray-500">errores</p>
                  </div>
                </div>
              )}
            </div>

            {/* Row-by-row results */}
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium w-10">#</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Email</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Nombre</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Rol</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Estado</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {csvRows.map((row, i) => {
                    const rowErrors = validationResult.errors.filter((e) => e.row === i + 1);
                    const hasError = rowErrors.length > 0;
                    const isEditing = editIdx === i;
                    return (
                      <tr key={i} className={`border-t border-gray-100 ${hasError ? "bg-red-50" : ""}`}>
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        {isEditing ? (
                          <>
                            <td className="px-2 py-1">
                              <input value={editRow.email} onChange={(e) => setEditRow(r => ({ ...r, email: e.target.value }))}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sidebar/30" />
                            </td>
                            <td className="px-2 py-1">
                              <input value={editRow.full_name} onChange={(e) => setEditRow(r => ({ ...r, full_name: e.target.value }))}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sidebar/30" />
                            </td>
                            <td className="px-2 py-1">
                              <select value={editRow.role} onChange={(e) => setEditRow(r => ({ ...r, role: e.target.value }))}
                                className="border border-gray-300 rounded px-2 py-1 text-xs bg-white hover:border-gray-400 cursor-pointer">
                                <option value="student">Estudiante</option>
                                <option value="instructor">Docente</option>
                              </select>
                            </td>
                            <td className="px-3 py-2"></td>
                            <td className="px-3 py-2 flex gap-1">
                              <button onClick={saveEdit} className="text-green-500 hover:text-green-700 cursor-pointer"><Check size={14} /></button>
                              <button onClick={() => setEditIdx(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><XCircle size={14} /></button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2 text-gray-700">{row.email}</td>
                            <td className="px-3 py-2 text-gray-700">{row.full_name}</td>
                            <td className="px-3 py-2 text-gray-500">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                row.role === "instructor" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                              }`}>
                                {row.role === "instructor" ? "Docente" : "Estudiante"}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {hasError ? (
                                <span className="text-red-500 text-[10px]">{rowErrors[0].message}</span>
                              ) : (
                                <CheckCircle2 size={14} className="text-green-500" />
                              )}
                            </td>
                            <td className="px-3 py-2 flex gap-1">
                              {hasError && (
                                <button onClick={() => startEdit(i)} className="text-amber-500 hover:text-amber-700 cursor-pointer" title="Editar">
                                  <Eye size={14} />
                                </button>
                              )}
                              <button onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-500 cursor-pointer" title="Eliminar">
                                <XCircle size={14} />
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Next button */}
      {validationResult && validationResult.error_count === 0 && (
        <div className="flex justify-end">
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-6 py-2.5 bg-sidebar text-white rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors cursor-pointer"
          >
            Confirmar datos
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════
// Step 3: Preview Email & Send
// ════════════════════════════════════════════

const DEFAULT_EMAIL_BODY = `La evidencia muestra que la práctica con simulación clínica mejora hasta un 40% las competencias terapéuticas en el primer año. Con GlorIA, cada sesión cuenta.

Practicarás entrevistas clínicas con pacientes virtuales impulsados por inteligencia artificial, recibiendo retroalimentación inmediata sobre tus competencias terapéuticas. Sin riesgos, sin presiones, las veces que necesites.`;

function Step3Preview({
  pilot, sending, sendResult, onSend, onNext,
}: {
  pilot: Pilot | null;
  sending: boolean;
  sendResult: { total: number; success: number; failed: number } | null;
  onSend: (customBody?: string) => void;
  onNext: () => void;
}) {
  const appUrl = "https://app.glor-ia.com";

  const [assigningPatients, setAssigningPatients] = useState(false);
  const [patientMsg, setPatientMsg] = useState("");
  const [emailBody, setEmailBody] = useState(DEFAULT_EMAIL_BODY);
  const [editingBody, setEditingBody] = useState(false);

  const assignPatients = async (queryParams = "") => {
    if (!pilot?.establishment_id) {
      setPatientMsg("Este piloto no tiene un establecimiento asociado. Crea primero el establecimiento.");
      return;
    }
    setAssigningPatients(true);
    setPatientMsg("");
    try {
      const res = await fetch(`/api/admin/patients/all${queryParams}`);
      if (!res.ok) { setPatientMsg("Error al obtener pacientes"); return; }
      const patients = await res.json();
      const ids = patients.map((p: { id: string }) => p.id);
      if (ids.length === 0) { setPatientMsg("No se encontraron pacientes con ese filtro"); return; }
      const addRes = await fetch(`/api/admin/establishments/${pilot.establishment_id}/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "add", patient_ids: ids }),
      });
      if (addRes.ok) {
        setPatientMsg(`${ids.length} paciente(s) asignados correctamente`);
      } else {
        setPatientMsg("Error al asignar pacientes");
      }
    } catch { setPatientMsg("Error de conexión"); }
    finally { setAssigningPatients(false); }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Patient assignment */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Pacientes del piloto</h3>
        <p className="text-xs text-gray-500 mb-3">
          Asigna pacientes al establecimiento para que los participantes puedan verlos.
        </p>
        {patientMsg && (
          <div className={`text-xs mb-3 px-3 py-2 rounded-lg ${patientMsg.includes("Error") || patientMsg.includes("no tiene") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
            {patientMsg}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => assignPatients()}
            disabled={assigningPatients}
            className="px-3 py-1.5 rounded-lg bg-sidebar text-white text-xs font-medium hover:bg-[#354080] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {assigningPatients ? "Asignando..." : "Asignar todos"}
          </button>
          {["Chile", "Argentina", "Colombia", "México", "Perú", "República Dominicana"].map((country) => (
            <button
              key={country}
              onClick={() => assignPatients(`?country=${encodeURIComponent(country)}`)}
              disabled={assigningPatients}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:border-sidebar/30 hover:text-sidebar transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {country}
            </button>
          ))}
          {(["beginner", "intermediate", "advanced"] as const).map((level) => (
            <button
              key={level}
              onClick={() => assignPatients(`?difficulty=${level}`)}
              disabled={assigningPatients}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                level === "beginner" ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50" :
                level === "intermediate" ? "border-amber-200 text-amber-600 hover:bg-amber-50" :
                "border-red-200 text-red-600 hover:bg-red-50"
              }`}
            >
              {level === "beginner" ? "Principiante" : level === "intermediate" ? "Intermedio" : "Avanzado"}
            </button>
          ))}
        </div>
      </div>

      {/* Email body editor */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Cuerpo del mensaje</h3>
          <button
            onClick={() => setEditingBody(!editingBody)}
            className="text-xs text-sidebar font-medium hover:underline cursor-pointer"
          >
            {editingBody ? "Ver previsualización" : "Editar mensaje"}
          </button>
        </div>

        {editingBody ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Edita el cuerpo del mensaje. El saludo, credenciales, instrucciones de ingreso y firma se incluyen automáticamente.
            </p>
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={6}
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-4 leading-relaxed focus:outline-none focus:ring-2 focus:ring-sidebar/20 focus:border-sidebar/40 resize-y"
            />
            {emailBody !== DEFAULT_EMAIL_BODY && (
              <button
                onClick={() => setEmailBody(DEFAULT_EMAIL_BODY)}
                className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                Restaurar texto original
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20">De:</span>
                <span className="text-xs text-gray-700 font-medium">GlorIA &lt;noreply@glor-ia.com&gt;</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20">Asunto:</span>
                <span className="text-xs text-gray-700 font-medium">Bienvenidos a GlorIA — Tus credenciales de acceso</span>
              </div>
            </div>

            {/* Email mockup */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div style={{ background: "#4A55A2", padding: "20px 28px", borderRadius: "8px 8px 0 0" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p style={{ color: "white", margin: 0, fontSize: "18px", fontWeight: 700 }}>
                      Bienvenidos a GlorIA
                    </p>
                    <p style={{ color: "rgba(255,255,255,0.7)", margin: "4px 0 0", fontSize: "12px" }}>
                      Plataforma de Entrenamiento Clínico con IA
                    </p>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://ndwmnxlwbfqfwwtekjun.supabase.co/storage/v1/object/public/patients/gloria-side-logo.png"
                    alt="GlorIA"
                    style={{ height: 36 }}
                  />
                </div>
              </div>
              <div className="p-6 bg-gray-50 text-sm text-gray-700 leading-relaxed">
                <p>Hola <strong>[Nombre del participante]</strong>,</p>
                <p className="mt-3">
                  Has sido invitado/a a participar en el piloto <strong>{pilot?.name || "—"}</strong>{" "}
                  de <strong>{pilot?.institution || "—"}</strong> como <strong>[Rol]</strong>.
                </p>

                {emailBody.split("\n\n").map((paragraph, i) => (
                  <p key={i} className="mt-3">{paragraph}</p>
                ))}

                <div className="bg-white border border-gray-200 rounded-lg p-4 my-4">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2 font-semibold">
                    Credenciales de acceso
                  </p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex gap-2">
                      <span className="text-gray-500 w-24">Plataforma:</span>
                      <span className="text-sidebar font-medium">{appUrl}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-gray-500 w-24">Email:</span>
                      <span className="font-semibold">[email@ejemplo.com]</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-gray-500 w-24">Contraseña:</span>
                      <span className="font-mono font-bold text-sidebar">Gloria_Abc123</span>
                    </div>
                  </div>
                </div>

                {pilot?.ended_at && (
                  <div className="my-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg px-4 py-2.5">
                    <p className="text-xs text-amber-800 font-semibold">
                      Tu acceso estará disponible hasta el{" "}
                      {new Date(pilot.ended_at).toLocaleDateString("es-CL", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}.
                    </p>
                  </div>
                )}

                <p className="font-semibold mt-4">Cómo ingresar:</p>
                <ol className="list-decimal ml-5 mt-1 space-y-0.5 text-xs">
                  <li>Ingresa a <span className="text-sidebar">{appUrl}/login</span></li>
                  <li>Escribe tu email y la contraseña temporal indicada arriba</li>
                  <li>Explora los pacientes virtuales y comienza tu primera sesión</li>
                </ol>

                <div className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">Con entusiasmo,</p>
                  <p className="text-sm text-gray-900 font-bold mt-0.5">Equipo GlorIA</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Si tienes problemas para acceder, escríbenos a soporte@glor-ia.com
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Send results */}
      {sendResult && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Resultado del envío</h3>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <Check size={14} className="text-green-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-green-600">{sendResult.success}</p>
                <p className="text-[10px] text-gray-500">enviados</p>
              </div>
            </div>
            {sendResult.failed > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle size={14} className="text-red-500" />
                </div>
                <div>
                  <p className="text-lg font-bold text-red-500">{sendResult.failed}</p>
                  <p className="text-[10px] text-gray-500">fallidos</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end">
        {!sendResult && (
          <button
            onClick={() => onSend(emailBody !== DEFAULT_EMAIL_BODY ? emailBody : undefined)}
            disabled={sending}
            className="flex items-center gap-2 px-6 py-2.5 bg-sidebar text-white rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sending ? "Enviando invitaciones..." : "Enviar invitaciones"}
          </button>
        )}
        {sendResult && sendResult.success > 0 && (
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-6 py-2.5 bg-sidebar text-white rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors cursor-pointer"
          >
            Ver dashboard
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// Step 4: Live Dashboard
// ════════════════════════════════════════════

function Step4Dashboard({
  pilot, refreshing, onRefresh, onFinalize, onResetParticipant,
}: {
  pilot: Pilot | null;
  refreshing: boolean;
  onRefresh: () => void;
  onFinalize: () => Promise<void>;
  onResetParticipant: (participantId: string, participantEmail: string) => Promise<void>;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deactivating, setDeactivating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  if (!pilot) return null;

  const participants: Participant[] = (pilot as Pilot & { participants?: Participant[] }).participants || [];

  const invited = participants.filter((p) => p.status === "invitado" || p.status === "activo" || p.status === "inactivo").length;
  const loggedIn = participants.filter((p) => p.first_login_at).length;
  const active = participants.filter((p) => p.status === "activo").length;
  const totalSessions = participants.reduce((sum, p) => sum + (p.sessions_count || 0), 0);
  const totalMessages = totalSessions * 12; // estimate

  const filteredParticipants = statusFilter === "all"
    ? participants
    : participants.filter((p) => p.status === statusFilter);

  const handleDeactivate = async () => {
    if (!confirm("¿Estás seguro de desactivar este piloto? Los participantes perderán acceso.")) return;
    setDeactivating(true);
    const res = await fetch(`/api/admin/pilots/${pilot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelado" }),
    });
    if (res.ok) {
      onRefresh();
    }
    setDeactivating(false);
  };

  return (
    <div className="space-y-6">
      {/* Actions: deactivate */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {pilot.scheduled_at && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock size={12} />
              Inicio: {new Date(pilot.scheduled_at).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {pilot.ended_at && (
            <span className="text-xs text-gray-500 flex items-center gap-1 ml-3">
              <Clock size={12} />
              Fin: {new Date(pilot.ended_at).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pilot.status !== "cancelado" && pilot.status !== "finalizado" && (
            <button
              onClick={async () => {
                if (!confirm("¿Finalizar este piloto? Los participantes perderán acceso y se generará el informe de cierre.")) return;
                setFinalizing(true);
                await onFinalize();
                setFinalizing(false);
              }}
              disabled={finalizing}
              className="flex items-center gap-2 px-4 py-2 bg-sidebar text-white rounded-lg text-xs font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {finalizing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Finalizar piloto
            </button>
          )}
          {pilot.status !== "cancelado" && pilot.status !== "finalizado" && (
            <button
              onClick={handleDeactivate}
              disabled={deactivating}
              className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {deactivating ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
              Desactivar piloto
            </button>
          )}
          {pilot.status === "cancelado" && (
            <span className="text-xs font-medium text-red-500 bg-red-50 px-3 py-1.5 rounded-lg">
              Piloto desactivado
            </span>
          )}
          {pilot.status === "finalizado" && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
              Piloto finalizado
            </span>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
              <Mail size={16} className="text-purple-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{invited}</p>
              <p className="text-[10px] text-gray-500">Invitados</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <UserCheck size={16} className="text-blue-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{loggedIn}</p>
              <p className="text-[10px] text-gray-500">Conectados</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
              <Users size={16} className="text-green-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{active}</p>
              <p className="text-[10px] text-gray-500">Activos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <MessageSquare size={16} className="text-amber-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{totalSessions}</p>
              <p className="text-[10px] text-gray-500">Sesiones totales</p>
            </div>
          </div>
        </div>
      </div>

      {/* Connection rate */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Tasa de conexión</h3>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-sidebar hover:underline cursor-pointer"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-sidebar rounded-full transition-all duration-500"
                style={{ width: `${invited > 0 ? (loggedIn / invited) * 100 : 0}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-bold text-sidebar">
            {invited > 0 ? Math.round((loggedIn / invited) * 100) : 0}%
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {loggedIn} de {invited} invitados han ingresado a la plataforma
        </p>
      </div>

      {/* Participants table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Participantes</h3>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sidebar/30 hover:border-gray-300 cursor-pointer"
            >
              <option value="all">Todos</option>
              <option value="pendiente">Pendientes</option>
              <option value="invitado">Invitados</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 text-gray-500 font-medium w-8">#</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Nombre</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Email</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Rol</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Estado</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">Sesiones</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Encuesta</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Última actividad</th>
                {pilot.test_mode && (
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredParticipants.map((p, idx) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-gray-400 tabular-nums">{idx + 1}</td>
                  <td className="px-3 py-2.5 text-gray-900 font-medium">{p.full_name}</td>
                  <td className="px-3 py-2.5 text-gray-600">{p.email}</td>
                  <td className="px-3 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      p.role === "instructor" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {p.role === "instructor" ? "Docente" : "Estudiante"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusIndicator status={p.status} />
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-gray-700">{p.sessions_count || 0}</td>
                  <td className="px-3 py-2.5">
                    {p.survey_completed_at ? (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700"
                        title={new Date(p.survey_completed_at).toLocaleString("es-CL")}
                      >
                        <Check size={10} />
                        {new Date(p.survey_completed_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-400">
                    {p.last_active_at ? formatRelativeTime(p.last_active_at) : "—"}
                  </td>
                  {pilot.test_mode && (
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => onResetParticipant(p.id, p.email)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md cursor-pointer"
                        title="Borrar consent + auth user y volver a pendiente. Solo disponible en modo de prueba."
                      >
                        <RotateCcw size={11} />
                        Reset
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filteredParticipants.length === 0 && (
                <tr>
                  <td colSpan={pilot.test_mode ? 9 : 8} className="px-3 py-8 text-center text-gray-400">
                    No hay participantes con este filtro
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Open answers from the automatic closure survey — cards / table toggle + export */}
      <OpenAnswersSection pilotId={pilot.id} />
    </div>
  );
}

// ════════════════════════════════════════════
// Step 5: Report
// ════════════════════════════════════════════

type ReportData = {
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
};

function Step5Report({ pilot }: { pilot: Pilot | null }) {
  const [downloading, setDownloading] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [sent, setSent] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Fetch aggregated report data when the step opens
  useEffect(() => {
    if (!pilot) return;
    let cancelled = false;
    setLoadingReport(true);
    fetch(`/api/admin/pilots/${pilot.id}/report`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setReportData(data);
      })
      .catch(() => {
        if (!cancelled) setReportData(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingReport(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pilot]);

  if (!pilot) return null;

  const participants: Participant[] = (pilot as Pilot & { participants?: Participant[] }).participants || [];
  const students = participants.filter((p) => p.role === "student");

  // Use real data from the report endpoint when available, fall back to local computation.
  const k = reportData?.kpis;
  const invited = k?.total_invited ?? participants.filter((p) => p.status !== "pendiente").length;
  const connected = k?.total_connected ?? participants.filter((p) => p.first_login_at).length;
  const connectionRate = invited > 0 ? Math.round((connected / invited) * 100) : 0;
  const totalSessions = k?.total_sessions ?? students.reduce((sum, p) => sum + (p.sessions_count || 0), 0);
  const avgSessions = k
    ? k.avg_sessions_per_student.toFixed(1)
    : (students.length > 0 ? (totalSessions / students.length).toFixed(1) : "0");
  const completionRate = students.length > 0
    ? Math.round((students.filter((p) => (p.sessions_count || 0) > 0).length / students.length) * 100)
    : 0;

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const { generatePilotReportPDF } = await import("@/lib/generate-pilot-report");
      await generatePilotReportPDF(pilot.id);
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Error al generar el PDF: " + (err instanceof Error ? err.message : "desconocido"));
    } finally {
      setDownloading(false);
    }
  };

  const handleSendReport = async () => {
    if (!pilot.contact_email) {
      alert("No hay email de contacto configurado para este piloto.");
      return;
    }
    setSendingReport(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSendingReport(false);
    setSent(true);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Summary header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Informe del piloto</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {pilot.institution} — {pilot.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Descargar PDF
            </button>
            <button
              onClick={handleSendReport}
              disabled={sendingReport || sent}
              className="flex items-center gap-2 px-4 py-2 bg-sidebar text-white rounded-lg text-xs font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {sendingReport ? <Loader2 size={14} className="animate-spin" /> : sent ? <Check size={14} /> : <Send size={14} />}
              {sent ? "Informe enviado" : "Enviar informe"}
            </button>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-sidebar">{connectionRate}%</p>
            <p className="text-[10px] text-gray-500 mt-1">Tasa de conexión</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{completionRate}%</p>
            <p className="text-[10px] text-gray-500 mt-1">Tasa de completación</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{avgSessions}</p>
            <p className="text-[10px] text-gray-500 mt-1">Promedio sesiones/alumno</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{totalSessions}</p>
            <p className="text-[10px] text-gray-500 mt-1">Sesiones totales</p>
          </div>
        </div>
      </div>

      {/* Competency averages */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Competencias promedio del piloto
          </h3>
          {reportData && (
            <span className="text-[10px] text-gray-400">
              Basado en {reportData.kpis.total_evaluated_sessions} sesiones evaluadas
            </span>
          )}
        </div>
        {loadingReport && (
          <p className="text-xs text-gray-400 text-center py-6">Cargando datos del informe...</p>
        )}
        {!loadingReport && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
              {Object.entries(COMPETENCY_LABELS).map(([key, label]) => {
                const stat = reportData?.competency_averages?.[key];
                const val = stat?.avg ?? 0;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-36 truncate">{label}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-sidebar"
                        style={{ width: `${(val / 4) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-gray-700 w-10 text-right">
                      {val > 0 ? val.toFixed(2) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
            {reportData && reportData.kpis.total_evaluated_sessions === 0 && (
              <p className="text-xs text-gray-400 mt-4 text-center">
                Aún no hay sesiones evaluadas. Las competencias se calcularán cuando los participantes completen sesiones.
              </p>
            )}
          </>
        )}
      </div>

      {/* Top strengths and areas to improve */}
      {reportData && (reportData.top_strengths.length > 0 || reportData.top_areas.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reportData.top_strengths.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-3">
                Principales fortalezas
              </h4>
              <ul className="space-y-2">
                {reportData.top_strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <span className="text-emerald-500 mt-0.5">•</span>
                    <span className="flex-1">{s.text}</span>
                    <span className="text-gray-400 text-[10px]">{s.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {reportData.top_areas.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-3">
                Áreas de mejora
              </h4>
              <ul className="space-y-2">
                {reportData.top_areas.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <span className="text-amber-500 mt-0.5">•</span>
                    <span className="flex-1">{a.text}</span>
                    <span className="text-gray-400 text-[10px]">{a.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Participation breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Desglose de participación</h3>
        <div className="space-y-3">
          <ParticipationBar label="Invitados" value={invited} total={participants.length} color="bg-purple-500" />
          <ParticipationBar label="Conectados" value={connected} total={participants.length} color="bg-blue-500" />
          <ParticipationBar label="Con sesiones" value={students.filter((s) => (s.sessions_count || 0) > 0).length} total={students.length} color="bg-green-500" />
          <ParticipationBar
            label="3+ sesiones"
            value={students.filter((s) => (s.sessions_count || 0) >= 3).length}
            total={students.length}
            color="bg-sidebar"
          />
        </div>
      </div>

      {/* Student activity table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Actividad por estudiante</h3>
        <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Estudiante</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">Sesiones</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Estado</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Primer ingreso</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Última actividad</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="px-3 py-2.5 text-gray-900 font-medium">{s.full_name}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-gray-700">{s.sessions_count || 0}</td>
                  <td className="px-3 py-2.5">
                    <StatusIndicator status={s.status} />
                  </td>
                  <td className="px-3 py-2.5 text-gray-400">
                    {s.first_login_at ? formatRelativeTime(s.first_login_at) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-gray-400">
                    {s.last_active_at ? formatRelativeTime(s.last_active_at) : "—"}
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                    No hay estudiantes en este piloto
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// Shared sub-components
// ════════════════════════════════════════════

function StatusIndicator({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    pendiente: { color: "bg-gray-400", label: "Pendiente" },
    invitado: { color: "bg-purple-500", label: "Invitado" },
    activo: { color: "bg-green-500", label: "Activo" },
    inactivo: { color: "bg-amber-500", label: "Inactivo" },
  };
  const c = config[status] || config.pendiente;
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${c.color}`} />
      <span className="text-gray-600">{c.label}</span>
    </span>
  );
}

function ParticipationBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-28">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-16 text-right">
        {value}/{total} ({Math.round(pct)}%)
      </span>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  if (hours < 24) return `Hace ${hours}h`;
  if (days < 7) return `Hace ${days}d`;

  const d = new Date(iso);
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

// ════════════════════════════════════════════
// Open answers from the UGM closure survey
// ════════════════════════════════════════════

type OpenAnswerRow = {
  response_id: string;
  user_id: string;
  full_name: string;
  email: string;
  created_at: string;
  answers: Record<string, unknown>;
};

const OPEN_QUESTIONS = [
  { key: "q7_mas_gusto", label: "10. ¿Qué fue lo que más te gustó?" },
  { key: "q8_mejoras", label: "11. ¿Qué mejorarías?" },
  { key: "q9_integracion", label: "12. ¿Cómo integrarla mejor?" },
  { key: "q10_comentarios", label: "13. Comentarios adicionales" },
] as const;

function OpenAnswersSection({ pilotId }: { pilotId: string }) {
  const [view, setView] = useState<"cards" | "table">("cards");
  const [rows, setRows] = useState<OpenAnswerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/pilots/${pilotId}/survey-responses?format=json`)
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => null);
          throw new Error(data?.error || `Error ${r.status}`);
        }
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setRows((data.rows || []) as OpenAnswerRow[]);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Error al cargar respuestas");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pilotId]);

  const exportLinks = [
    { label: "XLSX con nombres", href: `/api/admin/pilots/${pilotId}/survey-responses?format=xlsx-named`, primary: true },
    { label: "XLSX anonimizado", href: `/api/admin/pilots/${pilotId}/survey-responses?format=xlsx-anonymous`, primary: false },
    { label: "CSV con nombres", href: `/api/admin/pilots/${pilotId}/survey-responses?format=csv-named`, primary: false },
    { label: "CSV anonimizado", href: `/api/admin/pilots/${pilotId}/survey-responses?format=csv-anonymous`, primary: false },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Respuestas abiertas de la encuesta</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {loading
              ? "Cargando respuestas…"
              : rows.length > 0
                ? `${rows.length} respuesta${rows.length === 1 ? "" : "s"} recibida${rows.length === 1 ? "" : "s"}.`
                : "Aún no hay respuestas."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setView("cards")}
              className={`px-2.5 py-1 text-[11px] font-medium cursor-pointer ${view === "cards" ? "bg-sidebar text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              Cards
            </button>
            <button
              onClick={() => setView("table")}
              className={`px-2.5 py-1 text-[11px] font-medium cursor-pointer border-l border-gray-200 ${view === "table" ? "bg-sidebar text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              Tabla
            </button>
          </div>
        </div>
      </div>

      {/* Export bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-gray-100">
        <span className="text-[11px] text-gray-500 mr-1">Exportar:</span>
        {exportLinks.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg cursor-pointer transition-colors ${
              l.primary
                ? "bg-sidebar hover:bg-[#354080] text-white"
                : "border border-gray-200 hover:bg-gray-50 text-gray-700"
            }`}
          >
            <Download size={12} />
            {l.label}
          </a>
        ))}
      </div>

      {/* Content */}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {!error && !loading && rows.length === 0 && (
        <p className="text-xs text-gray-400 italic text-center py-6">
          Todavía nadie ha respondido la encuesta de cierre en este piloto.
        </p>
      )}

      {!error && !loading && rows.length > 0 && view === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((r) => (
            <div key={r.response_id} className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-900 truncate">{r.full_name || "(sin nombre)"}</p>
                <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                  {new Date(r.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              <div className="space-y-1.5">
                {OPEN_QUESTIONS.map(({ key, label }) => {
                  const val = r.answers?.[key];
                  const text = typeof val === "string" ? val.trim() : "";
                  return (
                    <div key={key}>
                      <p className="text-[10px] font-medium text-gray-500">{label}</p>
                      <p className="text-xs text-gray-800 whitespace-pre-wrap">
                        {text || <span className="text-gray-300 italic">—</span>}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!error && !loading && rows.length > 0 && view === "table" && (
        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 text-gray-500 font-medium w-8">#</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Nombre</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium whitespace-nowrap">Fecha</th>
                {OPEN_QUESTIONS.map((q) => (
                  <th key={q.key} className="text-left px-3 py-2 text-gray-500 font-medium min-w-[200px]">
                    {q.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.response_id} className="border-t border-gray-100 align-top">
                  <td className="px-3 py-2.5 text-gray-400 tabular-nums">{idx + 1}</td>
                  <td className="px-3 py-2.5 text-gray-900 font-medium whitespace-nowrap">{r.full_name || "(sin nombre)"}</td>
                  <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  {OPEN_QUESTIONS.map(({ key }) => {
                    const val = r.answers?.[key];
                    const text = typeof val === "string" ? val.trim() : "";
                    return (
                      <td key={key} className="px-3 py-2.5 text-gray-700 whitespace-pre-wrap">
                        {text || <span className="text-gray-300 italic">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
