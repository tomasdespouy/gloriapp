"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, ChevronRight, AlertTriangle, ClipboardCheck,
  CheckCircle2, Clock, Filter,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────

interface Session {
  id: string;
  student_id: string;
  ai_patient_id: string;
  session_number: number;
  status: string;
  created_at: string;
  ai_patients: unknown;
  session_feedback: unknown;
  session_competencies: unknown;
}

type FbRow = { teacher_comment: string | null; teacher_score: number | null };
type CompRow = {
  overall_score: number | null;
  overall_score_v2: number | null;
  feedback_status: string | null;
  eval_version: number | null;
};
type PatientRow = {
  name: string;
  tags: string[] | null;
  difficulty_level: string | null;
};

interface Props {
  sessions: Session[];
  studentMap: Record<string, string>;
}

// ── Constants ──────────────────────────────────────────

const RISK_KEYWORDS = ["ideacion", "suicida", "autolesion", "crisis", "riesgo"];

type TabKey = "pendientes" | "enviadas" | "cerradas" | "todas";

const TABS: { key: TabKey; label: string }[] = [
  { key: "pendientes", label: "Por revisar" },
  { key: "enviadas", label: "Enviadas" },
  { key: "cerradas", label: "Cerradas" },
  { key: "todas", label: "Todas" },
];

// ── Helpers ────────────────────────────────────────────

function getPatient(session: Session): PatientRow | null {
  return session.ai_patients as PatientRow | null;
}

function getFeedback(session: Session): FbRow | null {
  const raw = session.session_feedback;
  if (!raw) return null;
  if (Array.isArray(raw)) return (raw as FbRow[])[0] ?? null;
  return raw as FbRow;
}

function getCompetencies(session: Session): CompRow | null {
  const raw = session.session_competencies;
  if (!raw) return null;
  if (Array.isArray(raw)) return (raw as CompRow[])[0] ?? null;
  return raw as CompRow;
}

function hasRisk(patient: PatientRow | null): boolean {
  if (!patient?.tags) return false;
  return patient.tags.some((t) =>
    RISK_KEYWORDS.some((r) => t.toLowerCase().includes(r))
  );
}

function getScore(comp: CompRow | null): number | null {
  if (!comp) return null;
  if (comp.eval_version === 2 && comp.overall_score_v2 != null) {
    return Number(comp.overall_score_v2);
  }
  if (comp.overall_score != null) {
    return Number(comp.overall_score);
  }
  return null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

function getReviewStatus(
  _fb: FbRow | null,
  comp: CompRow | null
): "pending" | "approved" | "evaluated" {
  if (comp?.feedback_status === "evaluated") return "evaluated";
  if (comp?.feedback_status === "approved") return "approved";
  return "pending";
}

// ── Component ──────────────────────────────────────────

export default function RevisionesClient({ sessions, studentMap }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("pendientes");
  const [riskOnly, setRiskOnly] = useState(false);

  // Categorize sessions
  const categorized = useMemo(() => {
    return sessions.map((s) => {
      const fb = getFeedback(s);
      const comp = getCompetencies(s);
      const patient = getPatient(s);
      const status = getReviewStatus(fb, comp);
      const score = getScore(comp);
      const risk = hasRisk(patient);
      const studentName = studentMap[s.student_id] || "Alumno";
      return { session: s, fb, comp, patient, status, score, risk, studentName };
    });
  }, [sessions, studentMap]);

  // Tab counts
  const counts = useMemo(() => {
    const c = { pendientes: 0, enviadas: 0, cerradas: 0, todas: 0 };
    categorized.forEach(({ status }) => {
      c.todas++;
      if (status === "pending") c.pendientes++;
      else if (status === "approved") c.enviadas++;
      else if (status === "evaluated") c.cerradas++;
    });
    return c;
  }, [categorized]);

  // Filtered list
  const filtered = useMemo(() => {
    return categorized.filter((item) => {
      // Tab filter
      if (activeTab === "pendientes" && item.status !== "pending") return false;
      if (activeTab === "enviadas" && item.status !== "approved") return false;
      if (activeTab === "cerradas" && item.status !== "evaluated") return false;

      // Risk filter
      if (riskOnly && !item.risk) return false;

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const studentFirst = item.studentName.split(" ")[0].toLowerCase();
        const studentFull = item.studentName.toLowerCase();
        const patientName = (item.patient?.name || "").toLowerCase();
        if (
          !studentFirst.includes(q) &&
          !studentFull.includes(q) &&
          !patientName.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [categorized, activeTab, riskOnly, search]);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = counts[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar text-white"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab.label}
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + Risk filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px] relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por alumno o paciente..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30"
          />
        </div>
        <label className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors select-none">
          <input
            type="checkbox"
            checked={riskOnly}
            onChange={(e) => setRiskOnly(e.target.checked)}
            className="accent-red-500 w-3.5 h-3.5"
          />
          <AlertTriangle size={14} className="text-red-500" />
          <span className="text-sm text-gray-600">Solo riesgo</span>
        </label>
      </div>

      {/* Results summary */}
      <div className="flex items-center gap-2 px-1">
        <Filter size={12} className="text-gray-400" />
        <p className="text-xs text-gray-400">
          {filtered.length}{" "}
          {filtered.length === 1 ? "sesión" : "sesiones"}
          {search && ` para "${search}"`}
        </p>
      </div>

      {/* Session list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardCheck size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">
            {activeTab === "pendientes"
              ? "No hay sesiones por revisar"
              : activeTab === "enviadas"
              ? "No hay sesiones con retroalimentación enviada"
              : activeTab === "cerradas"
              ? "No hay sesiones cerradas"
              : "No se encontraron sesiones"}
          </p>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="mt-3 text-sm text-sidebar hover:underline"
            >
              Limpiar búsqueda
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(
            ({ session, patient, status, score, risk, studentName }) => {
              const firstName = studentName.split(" ")[0];
              const date = formatDate(session.created_at);
              const scoreLabel =
                score != null && score > 0 ? score.toFixed(1) : null;

              return (
                <button
                  key={session.id}
                  onClick={() =>
                    router.push(`/docente/sesion/${session.id}`)
                  }
                  className={`w-full text-left bg-white rounded-xl border overflow-hidden hover:shadow-md transition-all group ${
                    risk
                      ? "border-red-200 bg-red-50/30"
                      : status === "pending"
                      ? "border-amber-200"
                      : status === "evaluated"
                      ? "border-green-200"
                      : status === "approved"
                      ? "border-blue-200"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Risk icon */}
                    {risk && (
                      <div className="flex-shrink-0">
                        <AlertTriangle
                          size={16}
                          className="text-red-500"
                        />
                      </div>
                    )}

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {firstName}
                        </p>
                        <span className="text-gray-300">→</span>
                        <p className="text-sm text-gray-600 truncate">
                          {patient?.name || "Paciente"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                          <Clock size={10} />
                          {date}
                        </span>
                        {patient?.difficulty_level && (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            {patient.difficulty_level}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">
                          Sesión #{session.session_number}
                        </span>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="flex-shrink-0 text-right">
                      {scoreLabel ? (
                        <p className="text-sm font-bold text-sidebar">
                          {scoreLabel}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-300">--</p>
                      )}
                      <p className="text-[10px] text-gray-400">IA</p>
                    </div>

                    {/* Status badge */}
                    <div className="flex-shrink-0">
                      {status === "pending" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                          <Clock size={10} />
                          Por revisar
                        </span>
                      ) : status === "approved" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                          <ClipboardCheck size={10} />
                          Retroalimentación enviada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                          <CheckCircle2 size={10} />
                          Cerrada
                        </span>
                      )}
                    </div>

                    {/* Arrow */}
                    <ChevronRight
                      size={16}
                      className="text-gray-300 group-hover:text-sidebar transition-colors flex-shrink-0"
                    />
                  </div>
                </button>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}
