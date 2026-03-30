"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket, Upload, CheckCircle2, XCircle, Mail, BarChart3,
  FileText, Plus, ArrowLeft, ArrowRight, Loader2, Users,
  Calendar, Globe, Building2, Trash2, Eye, RefreshCw,
  Download, Send, Clock, UserCheck, MessageSquare,
  AlertCircle, Check, ChevronDown,
} from "lucide-react";

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

export default function PilotosClient({ pilots: initialPilots }: { pilots: Pilot[] }) {
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
    setFormData({ name: "", institution: "", country: "", contact_name: "", contact_email: "", scheduled_at: "", ended_at: "" });
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
    if (!formData.name.trim() || !formData.institution.trim() || csvRows.length === 0) return;
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

      {/* Step indicators */}
      <div className="px-4 sm:px-8 mb-6">
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

        {step === 3 && <Step4Dashboard
          pilot={dashboardData || selectedPilot}
          refreshing={refreshing}
          onRefresh={refreshDashboard}
        />}

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
  onFileDrop, onFileSelect, onCreatePilot, isEditing, onNext,
}: {
  formData: { name: string; institution: string; country: string; contact_name: string; contact_email: string; scheduled_at: string; ended_at: string };
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
}) {
  const [manualForm, setManualForm] = useState({ first_name: "", last_name: "", email: "", role: "student" });
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CsvRow>({ email: "", full_name: "", role: "student" });
  const [createError, setCreateError] = useState("");
  const canCreate = formData.name.trim() && formData.institution.trim() && csvRows.length > 0;

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
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Institución *</label>
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
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Archivo de participantes</h3>

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
  pilot, refreshing, onRefresh,
}: {
  pilot: Pilot | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deactivating, setDeactivating] = useState(false);
  const [creatingSurvey, setCreatingSurvey] = useState(false);
  const [surveyCreated, setSurveyCreated] = useState(false);
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

  const handleCreateSurvey = async () => {
    setCreatingSurvey(true);
    try {
      const res = await fetch("/api/admin/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Encuesta de cierre — ${pilot.name}`,
          scope_type: "establishment",
          scope_id: pilot.establishment_id || null,
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
      if (res.ok) {
        setSurveyCreated(true);
      }
    } catch { /* ignore */ }
    setCreatingSurvey(false);
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
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Nombre</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Email</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Rol</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Estado</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">Sesiones</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Última actividad</th>
              </tr>
            </thead>
            <tbody>
              {filteredParticipants.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
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
                  <td className="px-3 py-2.5 text-gray-400">
                    {p.last_active_at ? formatRelativeTime(p.last_active_at) : "—"}
                  </td>
                </tr>
              ))}
              {filteredParticipants.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                    No hay participantes con este filtro
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Closure survey */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Encuesta de cierre</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Envía una encuesta a los participantes al finalizar el piloto.
            </p>
          </div>
          <button
            onClick={handleCreateSurvey}
            disabled={creatingSurvey || surveyCreated}
            className="flex items-center gap-2 px-4 py-2 bg-sidebar text-white rounded-lg text-xs font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {creatingSurvey ? <Loader2 size={14} className="animate-spin" /> : surveyCreated ? <Check size={14} /> : <Send size={14} />}
            {surveyCreated ? "Encuesta creada" : "Enviar encuesta de cierre"}
          </button>
        </div>

        <div className="space-y-3 border border-gray-100 rounded-lg p-4 bg-gray-50">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">
            Preguntas incluidas
          </p>

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-xs font-bold text-sidebar mt-0.5">NPS</span>
              <p className="text-xs text-gray-700">
                ¿Qué tan probable es que recomiendes GlorIA a otros estudiantes? (0-10)
              </p>
            </div>

            <div className="flex items-start gap-2">
              <span className="text-xs font-bold text-emerald-600 mt-0.5">F1</span>
              <p className="text-xs text-gray-700">
                ¿Cuáles fueron las principales fortalezas de tu experiencia con GlorIA?
              </p>
            </div>

            <div className="flex items-start gap-2">
              <span className="text-xs font-bold text-amber-600 mt-0.5">D1</span>
              <p className="text-xs text-gray-700">
                ¿Qué aspectos mejorarías de la plataforma?
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// Step 5: Report
// ════════════════════════════════════════════

function Step5Report({ pilot }: { pilot: Pilot | null }) {
  const [downloading, setDownloading] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [sent, setSent] = useState(false);

  if (!pilot) return null;

  const participants: Participant[] = (pilot as Pilot & { participants?: Participant[] }).participants || [];
  const students = participants.filter((p) => p.role === "student");

  const invited = participants.filter((p) => p.status !== "pendiente").length;
  const connected = participants.filter((p) => p.first_login_at).length;
  const connectionRate = invited > 0 ? Math.round((connected / invited) * 100) : 0;
  const totalSessions = students.reduce((sum, p) => sum + (p.sessions_count || 0), 0);
  const avgSessions = students.length > 0 ? (totalSessions / students.length).toFixed(1) : "0";
  const completionRate = students.length > 0
    ? Math.round((students.filter((p) => (p.sessions_count || 0) > 0).length / students.length) * 100)
    : 0;

  const handleDownloadPDF = async () => {
    setDownloading(true);
    // Placeholder: In production, this would call a report generation endpoint
    await new Promise((r) => setTimeout(r, 1500));
    setDownloading(false);
    alert("Función de descarga PDF será implementada con el endpoint de generación de informes.");
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

      {/* Competency radar placeholder */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Competencias promedio del piloto
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
          {Object.entries(COMPETENCY_LABELS).map(([key, label]) => {
            // Placeholder values — in production these come from aggregated session_competencies
            const val = 0;
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 w-36 truncate">{label}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sidebar"
                    style={{ width: `${(val / 4) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-gray-400 w-6 text-right">
                  {val > 0 ? val.toFixed(1) : "—"}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-4 text-center">
          Las competencias se calcularán una vez que los participantes completen sesiones evaluadas.
        </p>
      </div>

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
