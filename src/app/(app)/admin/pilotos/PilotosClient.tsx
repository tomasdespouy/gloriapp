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
  { label: "Subir CSV", icon: Upload },
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
  const [creating, setCreating] = useState(false);

  // Step 1 state
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    institution: "",
    country: "",
    contact_name: "",
    contact_email: "",
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
    setCreating(false);
    setCsvRows([]);
    setFormData({ name: "", institution: "", country: "", contact_name: "", contact_email: "" });
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

    const res = await fetch("/api/admin/pilots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formData,
        csv_data: csvRows,
      }),
    });

    if (res.ok) {
      const pilot = await res.json();
      setPilots((prev) => [{ ...pilot, participant_count: csvRows.length }, ...prev]);
      await openPilot(pilot, 1);
    } else {
      setCsvError("Error al crear el piloto. Intenta de nuevo.");
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

  const handleSendInvites = async () => {
    if (!selectedPilot) return;
    setSending(true);
    setSendResult(null);

    const res = await fetch(`/api/admin/pilots/${selectedPilot.id}/send-invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  // Auto-refresh every 30 seconds on Step 4
  useEffect(() => {
    if (step !== 3 || !selectedPilot) return;
    const interval = setInterval(refreshDashboard, 30000);
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

  if (!selectedPilot && !creating && step === 0) {
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
            onClick={() => { resetWizard(); setCreating(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-sidebar text-white rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors"
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
                onClick={() => { resetWizard(); setCreating(true); }}
                className="mt-4 px-4 py-2 bg-sidebar text-white rounded-lg text-sm font-medium hover:bg-sidebar-hover transition-colors"
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
                      className="text-xs text-sidebar hover:underline flex items-center gap-1"
                    >
                      <Eye size={12} /> Ver detalle
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(pilot.id); }}
                      className="text-xs text-red-500 hover:underline flex items-center gap-1 ml-auto"
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
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft size={14} />
          Volver a pilotos
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {creating ? "Nuevo piloto" : selectedPilot?.name || "Piloto"}
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
                disabled={creating && i > 0}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
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
          csvError={csvError}
          creating={creating}
          fileInputRef={fileInputRef}
          onFileDrop={handleFileDrop}
          onFileSelect={handleFileSelect}
          onCreatePilot={handleCreatePilot}
          isEditing={!!selectedPilot}
        />}

        {step === 1 && <Step2Validate
          csvRows={csvRows}
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
  formData, setFormData, csvRows, csvError, creating, fileInputRef,
  onFileDrop, onFileSelect, onCreatePilot, isEditing,
}: {
  formData: { name: string; institution: string; country: string; contact_name: string; contact_email: string };
  setFormData: (fn: (prev: typeof formData) => typeof formData) => void;
  csvRows: CsvRow[];
  csvError: string;
  creating: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCreatePilot: () => void;
  isEditing: boolean;
}) {
  const canCreate = formData.name.trim() && formData.institution.trim() && csvRows.length > 0;

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
                  </tr>
                </thead>
                <tbody>
                  {csvRows.slice(0, 50).map((row, i) => (
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
                  {csvRows.length > 50 && (
                    <tr className="border-t border-gray-100">
                      <td colSpan={4} className="px-3 py-2 text-center text-gray-400">
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

      {/* Action */}
      {!isEditing && (
        <div className="flex justify-end">
          <button
            onClick={onCreatePilot}
            disabled={!canCreate || creating}
            className="flex items-center gap-2 px-6 py-2.5 bg-sidebar text-white rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            Crear piloto
          </button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════
// Step 2: Validate
// ════════════════════════════════════════════

function Step2Validate({
  csvRows, validating, validationResult, onValidate, onNext,
}: {
  csvRows: CsvRow[];
  validating: boolean;
  validationResult: { valid_count: number; error_count: number; errors: ValidationError[] } | null;
  onValidate: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Validación de datos</h3>
          <button
            onClick={onValidate}
            disabled={validating}
            className="flex items-center gap-2 px-4 py-2 bg-sidebar text-white rounded-lg text-xs font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50"
          >
            {validating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {validating ? "Validando..." : "Validar datos"}
          </button>
        </div>

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
                    <th className="text-left px-3 py-2 text-gray-500 font-medium w-10">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {csvRows.map((row, i) => {
                    const rowErrors = validationResult.errors.filter((e) => e.row === i + 1);
                    const hasError = rowErrors.length > 0;
                    return (
                      <tr key={i} className={`border-t border-gray-100 ${hasError ? "bg-red-50" : ""}`}>
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 text-gray-700">{row.email}</td>
                        <td className="px-3 py-2 text-gray-700">{row.full_name}</td>
                        <td className="px-3 py-2 text-gray-500">{row.role}</td>
                        <td className="px-3 py-2">
                          {hasError ? (
                            <div className="flex items-center gap-1">
                              <XCircle size={14} className="text-red-500" />
                              <span className="text-red-500">{rowErrors[0].message}</span>
                            </div>
                          ) : (
                            <CheckCircle2 size={14} className="text-green-500" />
                          )}
                        </td>
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
            className="flex items-center gap-2 px-6 py-2.5 bg-sidebar text-white rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors"
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

function Step3Preview({
  pilot, sending, sendResult, onSend, onNext,
}: {
  pilot: Pilot | null;
  sending: boolean;
  sendResult: { total: number; success: number; failed: number } | null;
  onSend: () => void;
  onNext: () => void;
}) {
  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://gloria-app.vercel.app";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Email preview */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Previsualización del email</h3>

        <div className="mb-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-20">De:</span>
            <span className="text-xs text-gray-700 font-medium">GlorIA &lt;info@gloria-app.cl&gt;</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-20">Asunto:</span>
            <span className="text-xs text-gray-700 font-medium">Bienvenido/a a GlorIA — Tus credenciales de acceso</span>
          </div>
        </div>

        {/* Email mockup */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div style={{ background: "#4A55A2", padding: "20px 28px", borderRadius: "8px 8px 0 0" }}>
            <p style={{ color: "white", margin: 0, fontSize: "18px", fontWeight: 700 }}>
              Bienvenido/a a GlorIA
            </p>
            <p style={{ color: "rgba(255,255,255,0.7)", margin: "4px 0 0", fontSize: "12px" }}>
              Plataforma de Entrenamiento Clínico con IA
            </p>
          </div>
          <div className="p-6 bg-gray-50 text-sm text-gray-700 leading-relaxed">
            <p>Hola <strong>[Nombre del participante]</strong>,</p>
            <p className="mt-3">
              Has sido invitado/a a participar en el piloto <strong>{pilot?.name || "—"}</strong>{" "}
              de <strong>{pilot?.institution || "—"}</strong> como <strong>[Rol]</strong>.
            </p>
            <p className="mt-3">
              GlorIA es una plataforma de simulación terapéutica donde podrás practicar
              entrevistas clínicas con pacientes virtuales impulsados por inteligencia artificial.
            </p>

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

            <p className="font-semibold mt-4">Cómo ingresar:</p>
            <ol className="list-decimal ml-5 mt-1 space-y-0.5 text-xs">
              <li>Ingresa a <span className="text-sidebar">{appUrl}/login</span></li>
              <li>Escribe tu email y la contraseña temporal indicada arriba</li>
              <li>Explora los pacientes virtuales y comienza tu primera sesión</li>
            </ol>
          </div>
        </div>
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
            onClick={onSend}
            disabled={sending}
            className="flex items-center gap-2 px-6 py-2.5 bg-sidebar text-white rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sending ? "Enviando invitaciones..." : "Enviar invitaciones"}
          </button>
        )}
        {sendResult && sendResult.success > 0 && (
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-6 py-2.5 bg-sidebar text-white rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors"
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

  return (
    <div className="space-y-6">
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
            className="flex items-center gap-1.5 text-xs text-sidebar hover:underline"
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
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sidebar/30"
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
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Descargar PDF
            </button>
            <button
              onClick={handleSendReport}
              disabled={sendingReport || sent}
              className="flex items-center gap-2 px-4 py-2 bg-sidebar text-white rounded-lg text-xs font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50"
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
