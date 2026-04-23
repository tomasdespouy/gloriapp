"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket, Upload, CheckCircle2, XCircle, Mail, BarChart3,
  FileText, Plus, ArrowLeft, ArrowRight, Loader2, Users,
  Calendar, Globe, Building2, Trash2, Eye, RefreshCw,
  Download, Send, Clock, UserCheck, MessageSquare,
  AlertCircle, Check, ChevronDown, RotateCcw,
  Link2, Copy, ExternalLink, Image as ImageIcon,
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
  /** Derived from first_login_at of participants — not persisted */
  derived_status?: string | null;
  participants?: Participant[];
  establishment_id?: string | null;
  // Self-enrollment + digital consent
  enrollment_slug?: string | null;
  consent_text?: string | null;
  consent_version?: string | null;
  test_mode?: boolean | null;
  is_anonymous?: boolean | null;
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
  // Set to the created_at of the participant's most recent COMPLETED
  // survey_responses row, or null if they haven't answered the closure
  // survey yet.
  survey_completed_at: string | null;
  // Set to the created_at of the participant's most recent DECLINED
  // survey_responses row (status='not_taken' — the "No realizar" button
  // was pressed), or null. Rendered as an explicit "No realizada" badge
  // so the superadmin can tell the difference between "never showed up"
  // and "declined to respond".
  survey_declined_at: string | null;
};

type CsvRow = {
  email: string;
  full_name: string;
  role: string;
};

// ────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────

// The raw DB status values are kept for backwards compat. User-facing
// labels reflect the 2026-04-20 simplification:
//   · enviado is now shown as "Activo" — the canonical enrolment flow is
//     the public link, not CSV-driven email invites, so a pilot in this
//     state is simply "turned on" rather than "just emailed".
//   · en_curso is retired: no code sets it. Legacy rows would still map
//     through STATUS_LABELS via the raw key if any turn up.
//   · validado is kept only for legacy pilots created before the CSV
//     validation step was removed from the wizard.
const STATUS_COLORS: Record<string, string> = {
  borrador: "bg-gray-100 text-gray-700",
  validado: "bg-blue-100 text-blue-700",
  enviado: "bg-green-100 text-green-700",
  finalizado: "bg-amber-100 text-amber-700",
  cancelado: "bg-red-100 text-red-600",
};

const STATUS_LABELS: Record<string, string> = {
  borrador: "Borrador",
  validado: "Validado",
  enviado: "Activo",
  en_desarrollo: "En desarrollo",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

// Derived label for pilots that are between "validado" and "finalizado"
// and already have at least one participant who logged in. It overrides
// the raw status in the general-list badge only; the DB still holds
// the real status (no migration).
const STATUS_COLORS_EXTENDED: Record<string, string> = {
  ...STATUS_COLORS,
  en_desarrollo: "bg-emerald-100 text-emerald-700",
};

// Tab order — student-facing ordering validated with the product owner on
// 2026-04-20. Internal step indices and the openPilot status→step mapping
// all key off this array. When adding a new step, also update:
//   · openPilot status→step mapping (lines 236-248 region)
//   · handleCreatePilot + handleSendInvites setStep targets
//   · the render switch (step === N ...)
//   · the "Nuevo piloto" click handlers that set step to INSTITUCION_STEP
const STEP_CONSENTIMIENTO = 0;
const STEP_CORREO         = 1;
const STEP_INSTITUCION    = 2;
const STEP_LINK           = 3;
const STEP_DASHBOARD      = 4;
const STEP_INFORME        = 5;

const STEPS = [
  { label: "Consentimiento",     icon: FileText },
  { label: "Correo",             icon: Mail },
  { label: "Ingresar Institución", icon: Building2 },
  { label: "Link",               icon: Link2 },
  { label: "Dashboard",          icon: BarChart3 },
  { label: "Informe",            icon: Rocket },
];

// Country → flag emoji. Comparison is accent-insensitive and case-insensitive
// via normalizeCountry(). Includes both Spanish and English spellings of the
// most common Latin American + iberoamerican countries we deploy to.
const COUNTRY_FLAGS: Record<string, string> = {
  chile: "\u{1F1E8}\u{1F1F1}",
  argentina: "\u{1F1E6}\u{1F1F7}",
  mexico: "\u{1F1F2}\u{1F1FD}",
  colombia: "\u{1F1E8}\u{1F1F4}",
  peru: "\u{1F1F5}\u{1F1EA}",
  brasil: "\u{1F1E7}\u{1F1F7}",
  brazil: "\u{1F1E7}\u{1F1F7}",
  uruguay: "\u{1F1FA}\u{1F1FE}",
  paraguay: "\u{1F1F5}\u{1F1FE}",
  bolivia: "\u{1F1E7}\u{1F1F4}",
  ecuador: "\u{1F1EA}\u{1F1E8}",
  venezuela: "\u{1F1FB}\u{1F1EA}",
  panama: "\u{1F1F5}\u{1F1E6}",
  costarica: "\u{1F1E8}\u{1F1F7}",
  republicadominicana: "\u{1F1E9}\u{1F1F4}",
  guatemala: "\u{1F1EC}\u{1F1F9}",
  honduras: "\u{1F1ED}\u{1F1F3}",
  elsalvador: "\u{1F1F8}\u{1F1FB}",
  nicaragua: "\u{1F1F3}\u{1F1EE}",
  cuba: "\u{1F1E8}\u{1F1FA}",
  puertorico: "\u{1F1F5}\u{1F1F7}",
  espana: "\u{1F1EA}\u{1F1F8}",
  spain: "\u{1F1EA}\u{1F1F8}",
  estadosunidos: "\u{1F1FA}\u{1F1F8}",
  unitedstates: "\u{1F1FA}\u{1F1F8}",
  usa: "\u{1F1FA}\u{1F1F8}",
  portugal: "\u{1F1F5}\u{1F1F9}",
};

function normalizeCountry(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function countryToFlag(country: string | null | undefined): string | null {
  if (!country) return null;
  return COUNTRY_FLAGS[normalizeCountry(country)] || null;
}

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

type Establishment = { id: string; name: string; country: string | null; logo_url: string | null };

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
    logo_url: "",
    is_anonymous: false,
  });
  const [csvError, setCsvError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dashboard state
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
    setFormData({ name: "", institution: "", country: "", contact_name: "", contact_email: "", scheduled_at: "", ended_at: "", establishment_id: "", logo_url: "", is_anonymous: false });
    setCsvError("");
    setDashboardData(null);
  };

  const openPilot = async (pilot: Pilot, targetStep?: number) => {
    // Fetch full pilot details
    let res: Response;
    try {
      res = await fetch(`/api/admin/pilots/${pilot.id}`);
    } catch (err) {
      console.error("openPilot: network error", err);
      alert(`Error de red al abrir el piloto. Revisá tu conexión.`);
      return;
    }
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("openPilot: API error", res.status, errBody);
      alert(`Error al abrir el piloto (${res.status}). Recargá la página o avisá al equipo.`);
      return;
    }
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
      logo_url: data.logo_url || "",
      is_anonymous: data.is_anonymous === true,
    });

    // Determine step from status or target (uses STEP_* constants).
    // Default for any state that lands a user in the dashboard view
    // (incl. cancelado) is STEP_DASHBOARD so the card click always
    // surfaces the same primary screen as "Ver detalle".
    if (targetStep !== undefined) {
      setStep(targetStep);
    } else if (data.status === "borrador") {
      setStep(STEP_CONSENTIMIENTO);
    } else if (data.status === "validado") {
      setStep(STEP_CORREO);
    } else if (data.status === "enviado") {
      setStep(STEP_DASHBOARD);
    } else if (data.status === "finalizado") {
      setStep(STEP_INFORME);
    } else if (data.status === "cancelado") {
      setStep(STEP_DASHBOARD);
    } else {
      setStep(STEP_CONSENTIMIENTO);
    }
    setShowWizard(false);
    setCreating(false);
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
    if (!formData.name.trim() || !formData.establishment_id) return;
    // Validate contact email format if provided
    if (formData.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email.trim())) return;
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
      // After creation, jump to Consentimiento — it's the first tab of the
      // editing flow per the 2026-04 ordering.
      await openPilot(pilot, STEP_CONSENTIMIENTO);
    } else {
      const errData = await res.json().catch(() => null);
      setCsvError(errData?.error || `Error al crear el piloto (${res.status}). Intenta de nuevo.`);
    }
    setCreating(false);
  };

  // Activate a pilot: transitions status to 'enviado' (UI label: "Activo")
  // without sending any email. The old "Enviar invitaciones" button set
  // the same status as a side-effect of emailing the CSV roster, but the
  // canonical onboarding flow is the public enrolment link, so there is
  // no roster to mail. Admin still needs a way to flip a pilot from
  // borrador/validado into active, hence this explicit action.
  const handleActivate = async () => {
    if (!selectedPilot) return;
    const res = await fetch(`/api/admin/pilots/${selectedPilot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "enviado" }),
    });
    if (res.ok) {
      await openPilot(selectedPilot, STEP_DASHBOARD);
    }
  };

  // ────────────────────────────────
  // Dashboard refresh
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

  // ────────────────────────────────
  // Delete a participant entirely (clean test users from analysis/report)
  // ────────────────────────────────

  const handleDeleteParticipant = async (participantId: string, participantLabel: string) => {
    if (!selectedPilot) return;
    if (!confirm(
      `¿Eliminar a ${participantLabel} del piloto?\n\n` +
      `ACCIÓN IRREVERSIBLE. Se eliminará:\n` +
      `  • La fila del participante en el piloto\n` +
      `  • Su cuenta auth y perfil\n` +
      `  • Todas sus conversaciones y sesiones evaluadas\n` +
      `  • Su consentimiento en este piloto\n\n` +
      `Usá esto solo para limpiar usuarios de prueba que no deben aparecer en el análisis.`
    )) return;

    const res = await fetch(
      `/api/admin/pilots/${selectedPilot.id}/participants/${participantId}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      await refreshDashboard();
    } else {
      const err = await res.json().catch(() => null);
      alert(`Error al eliminar participante: ${err?.error || res.statusText}`);
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
            onClick={() => { resetWizard(); setShowWizard(true); setStep(STEP_INSTITUCION); }}
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
                onClick={() => { resetWizard(); setShowWizard(true); setStep(STEP_INSTITUCION); }}
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
                    {(() => {
                      // Show "En desarrollo" badge when the pilot has
                      // been validated/sent AND at least one participant
                      // has actually logged in — computed upstream.
                      const effective = pilot.derived_status || pilot.status;
                      return (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${STATUS_COLORS_EXTENDED[effective] || "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABELS[effective] || effective}
                        </span>
                      );
                    })()}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-3">
                    {pilot.country && (() => {
                      const flag = countryToFlag(pilot.country);
                      return flag ? (
                        <span
                          className="text-base leading-none"
                          title={pilot.country}
                          aria-label={pilot.country}
                        >
                          {flag}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1" title={pilot.country}>
                          <Globe size={12} />
                          {pilot.country}
                        </span>
                      );
                    })()}
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {pilot.participant_count} participantes
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {formatDate(pilot.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-4">
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
          The consent panel lives inside step 1 now (see below), so the
          global floating panel is removed from here. */}

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
                  // For a saved pilot, tabs are freely navigable. The old
                  // "i <= step + 1" forward-gate made sense when the order
                  // was naturally sequential (Institución → Consent →
                  // Envío → Dashboard → Informe); the 2026-04-20 reorder
                  // put Consentimiento first, so sequential gating would
                  // block going back to Institución without a reason.
                  if (selectedPilot) setStep(i);
                }}
                disabled={(showWizard && !selectedPilot && i !== STEP_INSTITUCION) || creating}
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

      {/* Step content — index mapping uses STEP_* constants. */}
      <div className="px-4 sm:px-8 pb-8">
        {step === STEP_CONSENTIMIENTO && selectedPilot && (
          <div className="space-y-4 max-w-4xl">
            <PilotConsentPanel
              pilot={(dashboardData || selectedPilot)!}
              onPilotUpdated={handlePilotPatched}
            />
            <div className="flex justify-end">
              <button
                onClick={() => setStep(STEP_CORREO)}
                className="flex items-center gap-2 px-6 py-2.5 bg-sidebar text-white rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors cursor-pointer"
              >
                Continuar al correo
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === STEP_CORREO && <Step3Preview pilot={selectedPilot} />}

        {step === STEP_INSTITUCION && <Step1Upload
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
          onNext={() => setStep(STEP_CONSENTIMIENTO)}
          establishments={establishments}
        />}

        {step === STEP_LINK && selectedPilot && (
          <StepLinkPanel pilot={(dashboardData || selectedPilot)!} />
        )}

        {step === STEP_DASHBOARD && (
          <Step4Dashboard
            pilot={dashboardData || selectedPilot}
            refreshing={refreshing}
            onRefresh={refreshDashboard}
            onResetParticipant={handleResetParticipant}
            onDeleteParticipant={handleDeleteParticipant}
            onActivate={handleActivate}
            onFinalize={async () => {
              if (!selectedPilot) return;
              const res = await fetch(`/api/admin/pilots/${selectedPilot.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "finalizado", ended_at: new Date().toISOString() }),
              });
              if (res.ok) {
                await refreshDashboard();
                setStep(STEP_INFORME);
              }
            }}
          />
        )}

        {step === STEP_INFORME && <Step5Report
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
  formData: { name: string; institution: string; country: string; contact_name: string; contact_email: string; scheduled_at: string; ended_at: string; establishment_id: string; logo_url: string; is_anonymous: boolean };
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
  // Institution is auto-resolved server-side from establishment_id, so the
  // admin only has to pick the establishment.
  const emailValid = !formData.contact_email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email.trim());
  const canCreate = !!(formData.name.trim() && formData.establishment_id && emailValid);
  // Logo preview is derived from the selected establishment. The pilot-
  // specific logo URL override was removed 2026-04-20 — institutions now
  // own a single canonical logo managed from /admin/establecimientos, and
  // the sidebar cascade in (app)/layout.tsx picks it up automatically.
  const selectedEstablishment = establishments.find((e) => e.id === formData.establishment_id);
  const establishmentLogoUrl = selectedEstablishment?.logo_url || "";

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
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre contacto</label>
            <input
              type="text"
              value={formData.contact_name}
              onChange={(e) => setFormData((f) => ({ ...f, contact_name: e.target.value }))}
              placeholder="Dr. Juan Pérez"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email contacto</label>
            <input
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData((f) => ({ ...f, contact_email: e.target.value }))}
              placeholder="contacto@universidad.edu"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                formData.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)
                  ? "border-red-300 focus:ring-red-300"
                  : "border-gray-200 focus:ring-sidebar/30"
              }`}
            />
            {formData.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email) && (
              <p className="text-[10px] text-red-500 mt-1">Email no válido</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1.5">
              <ImageIcon size={12} />
              Logo de la institución
            </label>
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <div className="flex-shrink-0 w-24 h-12 bg-sidebar border border-sidebar-hover rounded flex items-center justify-center p-1.5">
                {establishmentLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={establishmentLogoUrl}
                    alt="Logo"
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.opacity = "0.2";
                    }}
                  />
                ) : (
                  <span className="text-[10px] text-white/50">sin logo</span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 leading-snug">
                {formData.establishment_id
                  ? "El logo viene del establecimiento seleccionado. Se edita en Instituciones, no acá."
                  : "Selecciona un establecimiento para ver su logo."}
              </p>
            </div>
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

      {/* Configuración — Piloto anónimo */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Configuración</h3>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.is_anonymous}
            onChange={(e) => setFormData((f) => ({ ...f, is_anonymous: e.target.checked }))}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-[#4A55A2] focus:ring-[#4A55A2]"
          />
          <div>
            <p className="text-sm font-medium text-gray-900">Piloto anónimo</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Los estudiantes no ingresan nombre ni correo. El sistema genera un
              email sintético y una contraseña al aceptar el consentimiento y
              las muestra una sola vez en pantalla para que las guarden. Úsalo
              cuando la universidad requiere que la participación no pueda
              vincularse a una identidad real.
            </p>
          </div>
        </label>
      </div>

      {/* Advanced mode: legacy CSV + manual entry. Hidden by default —
          the canonical flow is the public enrollment link. Admins who
          need to pre-load a closed roster can still use it. */}
      <details className="group">
        <summary className="flex items-center gap-2 cursor-pointer text-[11px] text-gray-400 hover:text-gray-600 select-none py-1">
          <ChevronDown size={12} className="transition-transform group-open:rotate-180" />
          Modo avanzado — pre-cargar participantes (CSV o manual)
        </summary>

        <div className="mt-3 space-y-4">

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

        </div>
      </details>

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
// Step 3: Preview Email & Send
// ════════════════════════════════════════════

const DEFAULT_EMAIL_BODY = `La evidencia muestra que la práctica con simulación clínica mejora hasta un 40% las competencias terapéuticas en el primer año. Con GlorIA, cada sesión cuenta.

Practicarás entrevistas clínicas con pacientes virtuales impulsados por inteligencia artificial, recibiendo retroalimentación inmediata sobre tus competencias terapéuticas. Sin riesgos, sin presiones, las veces que necesites.`;

function Step3Preview({
  pilot,
}: {
  pilot: Pilot | null;
}) {
  const appUrl = "https://app.glor-ia.com";

  const [emailBody, setEmailBody] = useState(DEFAULT_EMAIL_BODY);
  const [editingBody, setEditingBody] = useState(false);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Email body editor — reference template only. The "Enviar
          invitaciones" button was removed 2026-04-20 since enrolment
          happens through the public link in the Link tab; there is no
          roster to mail from here. */}
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

    </div>
  );
}

// ════════════════════════════════════════════
// Step: Public enrolment link
// ════════════════════════════════════════════
//
// Extracted from the former PilotConsentPanel on 2026-04-20. Each pilot
// has a public `/piloto/<slug>/consentimiento` URL where participants
// self-enrol, sign the consent and receive their credentials. The admin
// copies that URL from here and shares it with the institution.
//
// Logo preview and the "Modo de prueba" toggle that used to live next to
// this link have been removed — the logo is derived from the
// establishment and test_mode is not being used in production.
function StepLinkPanel({ pilot }: { pilot: Pilot }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const consentPath = pilot.is_anonymous ? "consent-anon" : "consentimiento";
  const enrollmentUrl = pilot.enrollment_slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/piloto/${pilot.enrollment_slug}/${consentPath}`
    : null;

  async function handleCopy() {
    if (!enrollmentUrl) return;
    try {
      await navigator.clipboard.writeText(enrollmentUrl);
      setCopied(true);
      setCopyError(null);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("No se pudo copiar al portapapeles. Cópialo manualmente.");
    }
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-[#4A55A2]/20 p-6 space-y-4 shadow-lg shadow-[#4A55A2]/5 max-w-4xl">
      <div className="flex items-start gap-3 pb-4 border-b border-gray-100">
        <div className="w-10 h-10 rounded-xl bg-[#4A55A2] flex items-center justify-center flex-shrink-0">
          <Link2 size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-gray-900">Link de inscripción</h2>
            {pilot.is_anonymous && (
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#4A55A2] bg-[#F0F0FF] border border-[#D1D5FF] rounded-full">
                Anónimo
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {pilot.is_anonymous
              ? "Este piloto es anónimo. Cada persona que abra el link aceptará el consentimiento y recibirá sus credenciales directamente en pantalla (no hay email)."
              : "Comparte este link con el coordinador de la institución. Cada persona que entre podrá inscribirse, firmar el consentimiento y recibir sus credenciales por correo automáticamente."}
          </p>
        </div>
      </div>

      {copyError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          {copyError}
        </div>
      )}

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
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#4A55A2] hover:bg-[#5C6BB5] text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              {copied ? (
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
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// Step 4: Live Dashboard
// ════════════════════════════════════════════

function Step4Dashboard({
  pilot, refreshing, onRefresh, onFinalize, onActivate, onResetParticipant, onDeleteParticipant,
}: {
  pilot: Pilot | null;
  refreshing: boolean;
  onRefresh: () => void;
  onFinalize: () => Promise<void>;
  onActivate: () => Promise<void>;
  onResetParticipant: (participantId: string, participantEmail: string) => Promise<void>;
  onDeleteParticipant: (participantId: string, participantLabel: string) => Promise<void>;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deactivating, setDeactivating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [activating, setActivating] = useState(false);
  const [openParticipantId, setOpenParticipantId] = useState<string | null>(null);
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
          {(pilot.status === "borrador" || pilot.status === "validado") && (
            <button
              onClick={async () => {
                if (!confirm("¿Activar este piloto? Los participantes podrán ingresar a la plataforma con el link público de inscripción.")) return;
                setActivating(true);
                await onActivate();
                setActivating(false);
              }}
              disabled={activating}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {activating ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
              Activar piloto
            </button>
          )}
          {pilot.status !== "cancelado" && pilot.status !== "finalizado" && pilot.status !== "borrador" && pilot.status !== "validado" && (
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
          {(pilot.status === "cancelado" || pilot.status === "finalizado") && (
            <>
              <span className={`text-xs font-medium px-3 py-1.5 rounded-lg ${
                pilot.status === "cancelado"
                  ? "text-red-500 bg-red-50"
                  : "text-amber-600 bg-amber-50"
              }`}>
                {pilot.status === "cancelado" ? "Piloto desactivado" : "Piloto finalizado"}
              </span>
              <button
                onClick={async () => {
                  if (!confirm("¿Reactivar este piloto? Verifica que las fechas de inicio y fin sigan vigentes — los estudiantes solo pueden ingresar dentro de esa ventana.")) return;
                  setActivating(true);
                  await onActivate();
                  setActivating(false);
                }}
                disabled={activating}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {activating ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                Reactivar piloto
              </button>
            </>
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
                <th className="text-center px-3 py-2 text-gray-500 font-medium w-12">Ver</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">Acciones</th>
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
                        title={`Respondida — ${new Date(p.survey_completed_at).toLocaleString("es-CL")}`}
                      >
                        <Check size={10} />
                        {new Date(p.survey_completed_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                      </span>
                    ) : p.survey_declined_at ? (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700"
                        title={`No realizada — ${new Date(p.survey_declined_at).toLocaleString("es-CL")}`}
                      >
                        <XCircle size={10} />
                        No realizada
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
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={() => setOpenParticipantId(p.id)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-sidebar hover:bg-sidebar/10 cursor-pointer transition-colors"
                      title="Ver conversaciones y pacientes"
                      aria-label={`Ver detalle de ${p.full_name}`}
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {pilot.test_mode && (
                        <button
                          onClick={() => onResetParticipant(p.id, p.email)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md cursor-pointer"
                          title="Borrar consent + auth user y volver a pendiente. Solo disponible en modo de prueba."
                        >
                          <RotateCcw size={11} />
                          Reset
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteParticipant(p.id, p.full_name || p.email)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md cursor-pointer"
                        title="Eliminar permanentemente al participante, sus sesiones y conversaciones (irreversible)"
                      >
                        <Trash2 size={11} />
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredParticipants.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-gray-400">
                    No hay participantes con este filtro
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Open answers from the automatic closure survey — cards / table toggle + export */}
      <AlertsSection pilotId={pilot.id} />

      <SurveyInsights pilotId={pilot.id} />

      {/* Participant detail drawer — lazy loaded, only when open */}
      {openParticipantId && (
        <ParticipantDetailDrawer
          pilotId={pilot.id}
          participantId={openParticipantId}
          onClose={() => setOpenParticipantId(null)}
          fallbackName={
            participants.find((p) => p.id === openParticipantId)?.full_name || ""
          }
        />
      )}
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

type GeneratedReport = {
  id: string;
  variant: "named" | "anonymous";
  file_path: string;
  file_size_bytes: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  public_url: string;
};

function Step5Report({ pilot }: { pilot: Pilot | null }) {
  const [generating, setGenerating] = useState<null | "named" | "anonymous">(null);
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
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

  // Fetch historical generated reports list
  const refreshReports = useCallback(async () => {
    if (!pilot) return;
    setLoadingReports(true);
    try {
      const res = await fetch(`/api/admin/pilots/${pilot.id}/reports`);
      if (res.ok) setReports(await res.json());
    } finally {
      setLoadingReports(false);
    }
  }, [pilot]);
  useEffect(() => {
    refreshReports();
  }, [refreshReports]);

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

  const handleGenerate = async (variant: "named" | "anonymous") => {
    setGenerating(variant);
    try {
      const res = await fetch(`/api/admin/pilots/${pilot.id}/report/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert("Error al generar el informe: " + (err?.error || res.status));
        return;
      }
      const newReport: GeneratedReport = await res.json();
      setReports((prev) => [newReport, ...prev]);
      window.open(newReport.public_url, "_blank");
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "desconocido"));
    } finally {
      setGenerating(null);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("¿Eliminar este informe? No se puede recuperar el archivo.")) return;
    const res = await fetch(
      `/api/admin/pilots/${pilot.id}/reports?reportId=${reportId}`,
      { method: "DELETE" },
    );
    if (res.ok) setReports((prev) => prev.filter((r) => r.id !== reportId));
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
              onClick={() => handleGenerate("anonymous")}
              disabled={!!generating}
              className="flex items-center gap-2 px-4 py-2 bg-sidebar text-white rounded-lg text-xs font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              Generar informe
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

      {/* Informes generados — historial de DOCX persistidos */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Informes generados</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Cada vez que presionás &ldquo;Generar informe&rdquo; se guarda un archivo .docx acá. Podés
              volver a descargarlo o eliminarlo.
            </p>
          </div>
          {loadingReports && <Loader2 size={14} className="animate-spin text-gray-400" />}
        </div>

        {reports.length === 0 && !loadingReports ? (
          <p className="text-xs text-gray-400 text-center py-4">
            Aún no hay informes generados para este piloto.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {reports.map((r) => {
              const kb = r.file_size_bytes ? Math.round(r.file_size_bytes / 1024) : 0;
              return (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <FileText size={16} className="text-sidebar flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">
                      Informe {r.variant === "anonymous" ? "anonimizado" : "con nombres"}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {new Date(r.created_at).toLocaleString("es-CL", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {kb > 0 && ` · ${kb} KB`}
                    </p>
                  </div>
                  <a
                    href={r.public_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-sidebar hover:bg-sidebar/5 rounded-md cursor-pointer"
                  >
                    <Download size={12} /> Descargar
                  </a>
                  <button
                    onClick={() => handleDeleteReport(r.id)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md cursor-pointer"
                    title="Eliminar"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
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

// ════════════════════════════════════════════
// Survey insights — schema-driven dashboard
// (quantitative summary + open answers). The schema comes from the
// endpoint response, so adding a future v3 form only requires touching
// `src/lib/survey-schema.ts` — nothing here changes.
// ════════════════════════════════════════════

type OpenAnswerRow = {
  response_id: string;
  user_id: string;
  full_name: string;
  email: string;
  created_at: string;
  answers: Record<string, unknown>;
};

type SurveyLikertItemStats = {
  key: string;
  label: string;
  n: number;
  mean: number | null;
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
  top2Pct: number | null;
};

type SurveyLikertGroupStats = {
  answersKey: string;
  title: string;
  number: number;
  groupMean: number | null;
  groupTop2Pct: number | null;
  items: SurveyLikertItemStats[];
};

type SurveyOpenQuestion = {
  answersKey: string;
  label: string;
  number: number;
  exportColumn: string;
};

type SurveyData = {
  pilot: { id: string; name: string; institution: string };
  formVersion: string;
  schema: {
    shortLabel: string;
    likertGroups: Array<{
      answersKey: string;
      title: string;
      number: number;
      items: Array<{ key: string; label: string }>;
    }>;
    openQuestions: SurveyOpenQuestion[];
  };
  stats: {
    formVersion: string;
    totalResponses: number;
    groups: SurveyLikertGroupStats[];
  };
  total: number;
  declinedTotal: number;
  rows: OpenAnswerRow[];
};

// ════════════════════════════════════════════
// Chat alerts section — observational supervision
// ════════════════════════════════════════════

type ChatAlertRow = {
  id: string;
  conversation_id: string;
  message_id: string | null;
  student_id: string | null;
  ai_patient_id: string | null;
  source: "user" | "assistant";
  kind: string;
  severity: "low" | "medium" | "high" | "critical";
  matched_terms: string | null;
  sample: string | null;
  turn_number: number | null;
  reviewed_at: string | null;
  created_at: string;
  student_name: string | null;
  student_email: string | null;
  patient_name: string | null;
};

type AlertsResponse = {
  alerts: ChatAlertRow[];
  total: number;
  unreviewed: number;
};

const ALERT_KIND_UI: Record<string, { label: string; color: string }> = {
  short_response: { label: "Respuesta truncada", color: "bg-amber-100 text-amber-800 border-amber-200" },
  profanity: { label: "Groserías", color: "bg-orange-100 text-orange-800 border-orange-200" },
  violence: { label: "Violencia", color: "bg-red-100 text-red-800 border-red-200" },
  self_harm: { label: "Riesgo / autolesión", color: "bg-red-200 text-red-900 border-red-300" },
  disrespect: { label: "Falta de respeto", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  prompt_leak: { label: "Fuga de prompt", color: "bg-purple-100 text-purple-800 border-purple-200" },
};

const ALERT_SEVERITY_UI: Record<string, { label: string; color: string }> = {
  low: { label: "Baja", color: "bg-gray-100 text-gray-700 border-gray-200" },
  medium: { label: "Media", color: "bg-amber-100 text-amber-800 border-amber-200" },
  high: { label: "Alta", color: "bg-orange-100 text-orange-800 border-orange-300" },
  critical: { label: "Crítica", color: "bg-red-100 text-red-900 border-red-300 font-bold" },
};

function AlertsSection({ pilotId }: { pilotId: string }) {
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [showReviewed, setShowReviewed] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/pilots/${pilotId}/alerts`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => null);
          throw new Error(body?.error || `Error ${r.status}`);
        }
        return r.json() as Promise<AlertsResponse>;
      })
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar alertas"))
      .finally(() => setLoading(false));
  }, [pilotId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/pilots/${pilotId}/alerts`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => null);
          throw new Error(body?.error || `Error ${r.status}`);
        }
        return r.json() as Promise<AlertsResponse>;
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Error al cargar alertas");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pilotId]);

  async function markReviewed(alertId: string, reviewed: boolean) {
    setMarking(alertId);
    try {
      await fetch(`/api/admin/pilots/${pilotId}/alerts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert_id: alertId, reviewed }),
      });
      reload();
    } finally {
      setMarking(null);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 text-xs text-gray-400">
        Cargando alertas…
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const filtered = data.alerts.filter((a) => {
    if (!showReviewed && a.reviewed_at) return false;
    if (kindFilter !== "all" && a.kind !== kindFilter) return false;
    if (severityFilter !== "all" && a.severity !== severityFilter) return false;
    return true;
  });

  const kindsPresent = [...new Set(data.alerts.map((a) => a.kind))];
  const severitiesPresent = [...new Set(data.alerts.map((a) => a.severity))];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            Alertas de la sesión
            {data.unreviewed > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {data.unreviewed}
              </span>
            )}
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Patrones detectados automáticamente — respuestas truncadas, groserías, violencia, riesgo, falta de respeto, fugas de prompt.
            {" "}
            Nunca cortan una conversación.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 bg-white cursor-pointer hover:border-gray-300"
          >
            <option value="all">Todos los tipos</option>
            {kindsPresent.map((k) => (
              <option key={k} value={k}>{ALERT_KIND_UI[k]?.label || k}</option>
            ))}
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 bg-white cursor-pointer hover:border-gray-300"
          >
            <option value="all">Toda severidad</option>
            {severitiesPresent.map((s) => (
              <option key={s} value={s}>{ALERT_SEVERITY_UI[s]?.label || s}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 cursor-pointer text-gray-600">
            <input
              type="checkbox"
              checked={showReviewed}
              onChange={(e) => setShowReviewed(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300"
            />
            Mostrar revisadas
          </label>
        </div>
      </div>

      {data.total === 0 && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Sin alertas registradas en este piloto.
        </p>
      )}

      {data.total > 0 && filtered.length === 0 && (
        <p className="text-xs text-gray-400 italic text-center py-4">
          No hay alertas que coincidan con los filtros seleccionados.
        </p>
      )}

      {filtered.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 text-gray-500 font-medium whitespace-nowrap">Fecha</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Estudiante</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Paciente</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Tipo</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Severidad</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Origen</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium min-w-[240px]">Muestra</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const kindUi = ALERT_KIND_UI[a.kind] || { label: a.kind, color: "bg-gray-100 text-gray-700 border-gray-200" };
                const sevUi = ALERT_SEVERITY_UI[a.severity] || { label: a.severity, color: "bg-gray-100 text-gray-700 border-gray-200" };
                return (
                  <tr key={a.id} className={`border-t border-gray-100 align-top ${a.reviewed_at ? "opacity-60" : ""}`}>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                      {new Date(a.created_at).toLocaleString("es-CL", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                      {a.turn_number != null && <div className="text-[10px] text-gray-400">turno {a.turn_number}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-800 font-medium">
                      {a.student_name || "(sin nombre)"}
                      {a.student_email && <div className="text-[10px] text-gray-400 truncate max-w-[180px]">{a.student_email}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">{a.patient_name || "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${kindUi.color}`}>
                        {kindUi.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${sevUi.color}`}>
                        {sevUi.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">
                      {a.source === "user" ? "Estudiante" : "Paciente IA"}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 whitespace-pre-wrap break-words max-w-[320px]">
                      <div>{a.sample || "—"}</div>
                      {a.matched_terms && (
                        <div className="text-[10px] text-gray-400 mt-1">
                          match: <span className="font-mono">{a.matched_terms}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => markReviewed(a.id, !a.reviewed_at)}
                        disabled={marking === a.id}
                        className="text-[11px] text-sidebar hover:underline cursor-pointer disabled:opacity-50"
                      >
                        {a.reviewed_at ? "Des-revisar" : "Marcar revisada"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-[10px] text-gray-400">
          Mostrando {filtered.length} de {data.total} alertas. Máximo 500 por carga.
        </p>
      )}
    </div>
  );
}

function SurveyInsights({ pilotId }: { pilotId: string }) {
  const [data, setData] = useState<SurveyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/pilots/${pilotId}/survey-responses?format=json`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => null);
          throw new Error(body?.error || `Error ${r.status}`);
        }
        return r.json() as Promise<SurveyData>;
      })
      .then((d) => {
        if (!cancelled) setData(d);
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

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 text-xs text-gray-400">
        Cargando respuestas de la encuesta…
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">
        {error}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-5">
      <QuantitativeSummary data={data} />
      <OpenAnswersSection data={data} pilotId={pilotId} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Quantitative summary — aggregated Likert stats
// ─────────────────────────────────────────────

function QuantitativeSummary({ data }: { data: SurveyData }) {
  const [expanded, setExpanded] = useState(false);
  const { stats, total, declinedTotal, schema } = data;

  if (total === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900">Panorámica cuantitativa</h3>
        <p className="text-xs text-gray-400 italic mt-3">
          Aún no hay respuestas para calcular promedios.
          {declinedTotal > 0 && ` (${declinedTotal} no realizada${declinedTotal === 1 ? "" : "s"})`}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Panorámica cuantitativa</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            N = {total} respuesta{total === 1 ? "" : "s"} · Escalas 1–5 · Formato {schema.shortLabel}
            {declinedTotal > 0 && (
              <span className="ml-2 text-amber-700">
                · {declinedTotal} no realizada{declinedTotal === 1 ? "" : "s"}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-sidebar hover:underline cursor-pointer shrink-0"
        >
          {expanded ? "Ocultar detalle por ítem" : "Ver detalle por ítem ▾"}
        </button>
      </div>

      {/* Group-level summary bars */}
      <div className="space-y-2.5">
        {stats.groups.map((g) => (
          <GroupBar key={g.answersKey} group={g} />
        ))}
      </div>

      {/* Legend */}
      <p className="text-[10px] text-gray-400 pt-1">
        <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1 align-middle" /> Promedio &lt; 3.0
        <span className="inline-block w-2 h-2 rounded-full bg-sidebar mx-1 ml-3 align-middle" /> 3.0 – 4.0
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mx-1 ml-3 align-middle" /> ≥ 4.0
        <span className="ml-4 text-emerald-700 font-semibold">fav.</span> = % de respuestas con nota 4 o 5
      </p>

      {/* Expanded detail */}
      {expanded && (
        <div className="pt-4 border-t border-gray-100 space-y-6">
          {stats.groups.map((g) => (
            <GroupDetail key={g.answersKey} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function barClass(mean: number): string {
  if (mean >= 4) return "bg-emerald-500";
  if (mean >= 3) return "bg-sidebar";
  return "bg-red-500";
}

function labelClass(mean: number): string {
  if (mean >= 4) return "text-emerald-700";
  if (mean >= 3) return "text-gray-700";
  return "text-red-700";
}

function GroupBar({ group }: { group: SurveyLikertGroupStats }) {
  if (group.groupMean === null) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-56 shrink-0">
          <p className="text-xs text-gray-700">
            {group.number}. {group.title}
          </p>
        </div>
        <div className="flex-1 text-[11px] text-gray-400 italic">Sin respuestas</div>
      </div>
    );
  }

  const pct = (group.groupMean / 5) * 100;
  return (
    <div className="flex items-center gap-3">
      <div className="w-56 shrink-0">
        <p className="text-xs text-gray-700">
          {group.number}. {group.title}
        </p>
      </div>
      <div className="flex-1">
        <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${barClass(group.groupMean)} transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="w-12 shrink-0 text-right">
        <span className={`text-xs font-bold tabular-nums ${labelClass(group.groupMean)}`}>
          {group.groupMean.toFixed(1)}
        </span>
      </div>
      <div
        className="w-20 shrink-0 text-right"
        title="Porcentaje de respuestas con nota 4 o 5 (top-2-box)"
      >
        {group.groupTop2Pct !== null ? (
          <span className="text-[11px] font-semibold tabular-nums text-emerald-700">
            {group.groupTop2Pct}% fav.
          </span>
        ) : (
          <span className="text-[11px] text-gray-300">—</span>
        )}
      </div>
    </div>
  );
}

function GroupDetail({ group }: { group: SurveyLikertGroupStats }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-900 mb-2">
        {group.number}. {group.title}
        {group.groupMean !== null && (
          <span className={`ml-2 text-[11px] font-normal ${labelClass(group.groupMean)}`}>
            · promedio {group.groupMean.toFixed(1)}
          </span>
        )}
        {group.groupTop2Pct !== null && (
          <span className="ml-2 text-[11px] font-normal text-emerald-700">
            · {group.groupTop2Pct}% favorables (4-5)
          </span>
        )}
      </h4>
      <div className="space-y-1.5">
        {group.items.map((item) => (
          <ItemRow key={item.key} item={item} />
        ))}
      </div>
    </div>
  );
}

function ItemRow({ item }: { item: SurveyLikertItemStats }) {
  if (item.n === 0 || item.mean === null) {
    return (
      <div className="flex items-center gap-3 text-[11px]">
        <div className="flex-1 min-w-0">
          <p className="text-gray-400 italic truncate">{item.label} — sin respuestas</p>
        </div>
      </div>
    );
  }

  const pct = (item.mean / 5) * 100;
  return (
    <div className="flex items-center gap-3 text-[11px]">
      <div className="flex-1 min-w-0">
        <p className="text-gray-700 truncate" title={item.label}>
          {item.label}
        </p>
      </div>
      <div className="w-28 shrink-0">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${barClass(item.mean)}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="w-8 shrink-0 text-right tabular-nums text-gray-700 font-medium">
        {item.mean.toFixed(1)}
      </div>
      <div
        className="w-12 shrink-0 text-right tabular-nums text-emerald-700 font-semibold"
        title="Porcentaje de respuestas con nota 4 o 5"
      >
        {item.top2Pct !== null ? `${item.top2Pct}%` : "—"}
      </div>
      <div
        className="w-32 shrink-0 text-gray-400 tabular-nums text-[10px]"
        title={`n=${item.n} · distribución: 1(${item.distribution[1]}) 2(${item.distribution[2]}) 3(${item.distribution[3]}) 4(${item.distribution[4]}) 5(${item.distribution[5]})`}
      >
        1·{item.distribution[1]} 2·{item.distribution[2]} 3·{item.distribution[3]} 4·{item.distribution[4]} 5·{item.distribution[5]}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Open answers section — one card per response
// or a wide table, schema-driven.
// ─────────────────────────────────────────────

function OpenAnswersSection({ data, pilotId }: { data: SurveyData; pilotId: string }) {
  const [view, setView] = useState<"cards" | "table">("cards");
  const { rows, declinedTotal } = data;
  const openQuestions = data.schema.openQuestions;

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
            {rows.length > 0
              ? `${rows.length} respuesta${rows.length === 1 ? "" : "s"} recibida${rows.length === 1 ? "" : "s"}.`
              : "Aún no hay respuestas."}
            {declinedTotal > 0 && (
              <span className="ml-2 text-amber-700">
                · {declinedTotal} no realizada{declinedTotal === 1 ? "" : "s"}
              </span>
            )}
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
      {rows.length === 0 && (
        <p className="text-xs text-gray-400 italic text-center py-6">
          Todavía nadie ha respondido la encuesta de cierre en este piloto.
        </p>
      )}

      {rows.length > 0 && view === "cards" && (
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
                {openQuestions.map((q) => {
                  const val = r.answers?.[q.answersKey];
                  const text = typeof val === "string" ? val.trim() : "";
                  return (
                    <div key={q.answersKey}>
                      <p className="text-[10px] font-medium text-gray-500">
                        {q.number}. {q.label}
                      </p>
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

      {rows.length > 0 && view === "table" && (
        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 text-gray-500 font-medium w-8">#</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Nombre</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium whitespace-nowrap">Fecha</th>
                {openQuestions.map((q) => (
                  <th key={q.answersKey} className="text-left px-3 py-2 text-gray-500 font-medium min-w-[200px]">
                    {q.number}. {q.label}
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
                  {openQuestions.map((q) => {
                    const val = r.answers?.[q.answersKey];
                    const text = typeof val === "string" ? val.trim() : "";
                    return (
                      <td key={q.answersKey} className="px-3 py-2.5 text-gray-700 whitespace-pre-wrap">
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

// ════════════════════════════════════════════
// Participant detail drawer (conversations + patients)
// ════════════════════════════════════════════

type ConvoRow = {
  id: string;
  patient_name: string;
  status: string;
  session_number: number | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  active_seconds: number;
  message_count: number;
  overall_score: number | null;
  ai_commentary: string | null;
};

type DrawerData = {
  participant: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
  conversations: ConvoRow[];
};

function ParticipantDetailDrawer({
  pilotId,
  participantId,
  onClose,
  fallbackName,
}: {
  pilotId: string;
  participantId: string;
  onClose: () => void;
  fallbackName: string;
}) {
  const [data, setData] = useState<DrawerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openConvoId, setOpenConvoId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Array<{ role: string; content: string; created_at: string }> | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/pilots/${pilotId}/participants/${participantId}/conversations`)
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => null);
          throw new Error(d?.error || `Error ${r.status}`);
        }
        return r.json();
      })
      .then((d: DrawerData) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pilotId, participantId]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lazy-fetch transcript when a conversation is opened inline.
  useEffect(() => {
    if (!openConvoId) {
      setTranscript(null);
      return;
    }
    let cancelled = false;
    setTranscriptLoading(true);
    fetch(`/api/admin/pilots/${pilotId}/participants/${participantId}/conversations/${openConvoId}/transcript`)
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => null);
          throw new Error(d?.error || `Error ${r.status}`);
        }
        return r.json();
      })
      .then((d: { messages: Array<{ role: string; content: string; created_at: string }> }) => {
        if (!cancelled) setTranscript(d.messages || []);
      })
      .catch(() => { if (!cancelled) setTranscript([]); })
      .finally(() => { if (!cancelled) setTranscriptLoading(false); });
    return () => { cancelled = true; };
  }, [openConvoId, pilotId, participantId]);

  const displayName = data?.participant.full_name || fallbackName || "Participante";
  const totalSessions = data?.conversations.length || 0;

  return (
    <div className="fixed inset-0 z-[90]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className="absolute right-0 top-0 bottom-0 w-full sm:w-[440px] bg-white shadow-2xl flex flex-col"
      >
        <header className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Participante</p>
              <h3 className="text-sm font-semibold text-gray-900 truncate">{displayName}</h3>
              {data?.participant.email && (
                <p className="text-xs text-gray-500 truncate">{data.participant.email}</p>
              )}
              <p className="text-[11px] text-gray-400 mt-1">
                {loading ? "Cargando…" : `${totalSessions} sesion${totalSessions === 1 ? "" : "es"}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 cursor-pointer"
              aria-label="Cerrar"
            >
              <XCircle size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="p-4">
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
            </div>
          )}

          {!error && !loading && !openConvoId && (
            <div className="p-4 space-y-2">
              {totalSessions === 0 && (
                <p className="text-xs text-gray-400 italic text-center py-8">
                  Este participante aún no ha tenido sesiones con pacientes.
                </p>
              )}
              {data?.conversations.map((c) => {
                const when = new Date(c.created_at).toLocaleString("es-CL", {
                  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                });
                const statusBadge =
                  c.status === "completed" ? "bg-green-100 text-green-700"
                  : c.status === "active" ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600";
                const minutes = Math.round((c.active_seconds || 0) / 60);
                return (
                  <div key={c.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.patient_name}</p>
                        <p className="text-[11px] text-gray-500">{when}</p>
                      </div>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusBadge}`}>
                        {c.status === "completed" ? "Completada" : c.status === "active" ? "En curso" : c.status === "abandoned" ? "Abandonada" : c.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1">
                      <span>{c.message_count} msgs</span>
                      <span>·</span>
                      <span>{minutes} min</span>
                      {typeof c.overall_score === "number" && c.overall_score > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-sidebar font-medium">{c.overall_score.toFixed(1)}/4</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => setOpenConvoId(c.id)}
                        className="text-[11px] text-sidebar hover:underline cursor-pointer"
                      >
                        Ver conversación →
                      </button>
                      <a
                        href={`/docente/sesion/${c.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-gray-400 hover:text-gray-700 hover:underline cursor-pointer"
                      >
                        Ficha completa ↗
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Inline transcript view */}
          {openConvoId && (
            <div className="p-4 space-y-3">
              <button
                onClick={() => setOpenConvoId(null)}
                className="text-[11px] text-sidebar hover:underline cursor-pointer"
              >
                ← Volver al listado
              </button>

              {(() => {
                const convo = data?.conversations.find((c) => c.id === openConvoId);
                if (!convo) return null;
                return (
                  <div className="border-b border-gray-100 pb-2 mb-2">
                    <p className="text-sm font-medium text-gray-900">{convo.patient_name}</p>
                    <p className="text-[11px] text-gray-500">
                      {new Date(convo.created_at).toLocaleString("es-CL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {" · "}
                      {convo.message_count} msgs
                    </p>
                  </div>
                );
              })()}

              {transcriptLoading && (
                <p className="text-xs text-gray-400 italic text-center py-6">Cargando transcripción…</p>
              )}

              {!transcriptLoading && transcript && transcript.length === 0 && (
                <p className="text-xs text-gray-400 italic text-center py-6">Sin mensajes registrados.</p>
              )}

              {!transcriptLoading && transcript && transcript.length > 0 && (
                <div className="space-y-2">
                  {transcript.map((m, i) => (
                    <div
                      key={i}
                      className={`rounded-lg px-3 py-2 text-xs ${
                        m.role === "user"
                          ? "bg-sidebar/10 text-gray-900"
                          : "bg-gray-50 text-gray-700"
                      }`}
                    >
                      <p className="text-[9px] uppercase tracking-wide font-semibold text-gray-400 mb-0.5">
                        {m.role === "user" ? "Terapeuta" : "Paciente"}
                      </p>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
