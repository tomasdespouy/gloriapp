"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Users,
  Activity,
  Clock,
  Target,
  ClipboardCheck,
  GraduationCap,
  RefreshCw,
  FlaskConical,
  AlertTriangle,
  Shield,
  TrendingUp,
  TrendingDown,
  Loader2,
  ExternalLink,
  FileText,
  Beaker,
  Calendar,
  ChevronRight,
  ChevronDown,
  Filter,
  Globe,
  Monitor,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";
import Link from "next/link";
import LiveKPIPanel, { InfoTip } from "./LiveKPIPanel";

/* ─────────────────────── Types ─────────────────────── */

type DashboardData = {
  firstName: string;
  kpis: {
    totalStudents: number;
    activeStudents: number;
    onlineNow: number;
    inSession: number;
    platformMinutesToday: number;
    avgSessionMinutes: number;
    avgPlatformMinutesPerDay: number;
    avgPlatformMinutesTotal: number;
    firstSessionScore: number;
    selfEvaluations: { completed: number; total: number };
    teacherEvaluations: { completed: number; total: number };
    returnRate: number;
    pilots: { active: number; completed: number };
  };
  trends: {
    totalStudents: number;
    activeStudents: number;
    avgSessionMinutes: number;
    avgPlatformMinutes: number;
  };
  mapData: {
    country: string;
    students: number;
    institutions: { name: string; students: number }[];
    sessions: number;
  }[];
  funnel: {
    enrolled: number;
    loggedIn: number;
    oneSession: number;
    threePlusSessions: number;
    selfEvalDone: number;
    teacherEvalDone: number;
  };
  competencies: Record<string, number>;
  alerts: {
    riskPending: number;
    inactiveStudents: number;
    pendingReviews: number;
  };
  charts: {
    sessionsPerDay: { date: string; sessions: number }[];
    weeklyScore: { week: string; score: number }[];
    registrations: { week: string; registrations: number }[];
    byEstablishment: {
      name: string;
      students: number;
      sessions: number;
      avgScore: number;
    }[];
    heatmap: number[][];
  };
  research: {
    opportunities: Record<string, number>;
    funds: Record<string, number>;
    deadlines: {
      id: string;
      name: string;
      deadline: string;
      days: number;
      url: string | null;
    }[];
    insights: {
      id: string;
      title: string;
      priority: string;
      category: string;
      sample_size: number;
      statistical_sig: string;
      suggested_venues: string[];
      suggested_paper_type: string;
      status: string;
    }[];
    achievements: {
      published: number;
      inDevelopment: number;
      acceptedConferences: number;
      acceptedFunds: number;
    };
  };
  filters: {
    countries: string[];
    establishments: { id: string; name: string; country: string }[];
    courses: { id: string; name: string; establishment_id: string }[];
    sections: { id: string; name: string; course_id: string }[];
  };
  isSuperadmin: boolean;
};

/* ─────────────────────── Constants ─────────────────────── */

const COMP_LABELS: Record<string, string> = {
  setting_terapeutico: "Setting terap.",
  motivo_consulta: "Mot. consulta",
  datos_contextuales: "Datos ctx.",
  objetivos: "Objetivos",
  escucha_activa: "Esc. activa",
  actitud_no_valorativa: "Act. no valor.",
  optimismo: "Optimismo",
  presencia: "Presencia",
  conducta_no_verbal: "C. no verbal",
  contencion_afectos: "Contención af.",
};

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

const CHART_TABS = [
  "Sesiones",
  "Score",
  "Registros",
  "Institución",
  "Heatmap",
];

const DATE_PRESETS = [
  { key: "today", label: "Hoy" },
  { key: "7d", label: "7d" },
  { key: "14d", label: "14d" },
  { key: "30d", label: "30d" },
  { key: "sem", label: "Sem" },
  { key: "all", label: "Todo" },
  { key: "custom", label: "Rango" },
];

const FUNNEL_STEPS: { key: keyof DashboardData["funnel"]; label: string }[] = [
  { key: "enrolled", label: "Inscritos" },
  { key: "loggedIn", label: "Sesión iniciada" },
  { key: "oneSession", label: "1 completa" },
  { key: "threePlusSessions", label: "3+ sesiones" },
  { key: "selfEvalDone", label: "Autoeval. hecha" },
  { key: "teacherEvalDone", label: "Eval. docente" },
];

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Map country names from DB (Spanish) to topojson (English)
const COUNTRY_GEO: Record<string, { eng: string; coords: [number, number] }> = {
  Chile: { eng: "Chile", coords: [-70.67, -33.45] },
  Colombia: { eng: "Colombia", coords: [-74.07, 4.71] },
  México: { eng: "Mexico", coords: [-99.13, 19.43] },
  Perú: { eng: "Peru", coords: [-77.04, -12.05] },
  Argentina: { eng: "Argentina", coords: [-58.38, -34.6] },
  España: { eng: "Spain", coords: [-3.7, 40.42] },
  Ecuador: { eng: "Ecuador", coords: [-78.47, -0.18] },
  Bolivia: { eng: "Bolivia", coords: [-68.15, -16.49] },
  Paraguay: { eng: "Paraguay", coords: [-57.58, -25.26] },
  Uruguay: { eng: "Uruguay", coords: [-56.17, -34.88] },
  Brasil: { eng: "Brazil", coords: [-47.93, -15.78] },
  Venezuela: { eng: "Venezuela", coords: [-66.92, 10.5] },
  Panamá: { eng: "Panama", coords: [-79.52, 8.98] },
  "Costa Rica": { eng: "Costa Rica", coords: [-84.09, 9.93] },
  Guatemala: { eng: "Guatemala", coords: [-90.51, 14.64] },
  Honduras: { eng: "Honduras", coords: [-87.19, 14.07] },
  "El Salvador": { eng: "El Salvador", coords: [-89.22, 13.69] },
  Nicaragua: { eng: "Nicaragua", coords: [-86.24, 12.11] },
  Cuba: { eng: "Cuba", coords: [-82.38, 23.13] },
  "Rep. Dominicana": { eng: "Dominican Rep.", coords: [-69.93, 18.49] },
  "República Dominicana": { eng: "Dominican Rep.", coords: [-69.93, 18.49] },
};

// ISO 3166-1 alpha-2 codes for flag CDN (flagcdn.com)
const COUNTRY_FLAG_CODE: Record<string, string> = {
  Chile: "cl",
  Colombia: "co",
  México: "mx",
  Perú: "pe",
  Argentina: "ar",
  España: "es",
  Ecuador: "ec",
  Bolivia: "bo",
  Paraguay: "py",
  Uruguay: "uy",
  Brasil: "br",
  Venezuela: "ve",
  Panamá: "pa",
  "Costa Rica": "cr",
  Guatemala: "gt",
  Honduras: "hn",
  "El Salvador": "sv",
  Nicaragua: "ni",
  Cuba: "cu",
  "Rep. Dominicana": "do",
  "República Dominicana": "do",
};

function CountryFlag({ country, size = 20 }: { country: string; size?: number }) {
  const code = COUNTRY_FLAG_CODE[country];
  if (!code) return null;
  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
      width={size}
      height={Math.round(size * 0.75)}
      alt={country}
      className="rounded-sm object-cover"
      style={{ width: size, height: Math.round(size * 0.75) }}
    />
  );
}

const PRIORITY_COLORS: Record<string, string> = {
  alta: "bg-red-100 text-red-700",
  media: "bg-amber-100 text-amber-700",
  baja: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  new: "Nuevas",
  reviewing: "En revisión",
  preparing: "Preparando",
  submitted: "Enviadas",
  accepted: "Aceptadas",
};

/* ─────────────────────── Helpers ─────────────────────── */

function defaultFrom() {
  return new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
}
function defaultTo() {
  return new Date().toISOString().split("T")[0];
}

const sumObj = (obj: Record<string, number>) =>
  Object.values(obj).reduce((a, b) => a + b, 0);

/* ─────────────────────── Main ─────────────────────── */

export default function AdminDashboardClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters — initialize from URL params
  const [country, setCountry] = useState(() => searchParams.get("country") || "");
  const [establishment, setEstablishment] = useState(() => searchParams.get("establishment") || "");
  const [course, setCourse] = useState(() => searchParams.get("course") || "");
  const [section, setSection] = useState(() => searchParams.get("section") || "");
  const [dateFrom, setDateFrom] = useState(() => searchParams.get("from") || defaultFrom());
  const [dateTo, setDateTo] = useState(() => searchParams.get("to") || defaultTo());
  const [datePreset, setDatePreset] = useState(() => searchParams.get("preset") || "30d");

  // Sync filters to URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (country) params.set("country", country);
    if (establishment) params.set("establishment", establishment);
    if (course) params.set("course", course);
    if (section) params.set("section", section);
    if (datePreset !== "30d") params.set("preset", datePreset);
    // Only persist dates if they differ from preset defaults
    const presetFrom = defaultFrom();
    const presetTo = defaultTo();
    if (dateFrom !== presetFrom || datePreset !== "30d") params.set("from", dateFrom);
    if (dateTo !== presetTo || datePreset !== "30d") params.set("to", dateTo);
    const qs = params.toString();
    router.replace(`/admin/dashboard${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [country, establishment, course, section, dateFrom, dateTo, datePreset, router]);

  // UI
  const [chartTab, setChartTab] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [mapZoom, setMapZoom] = useState(1);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-62, -15]);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const centerAtDragStart = useRef<[number, number]>([-62, -15]);

  const handleMapMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      centerAtDragStart.current = [...mapCenter] as [number, number];
      (e.target as HTMLElement).closest(".map-container")?.classList.add("cursor-grabbing");
    },
    [mapCenter]
  );

  const handleMapMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      // Convert pixel delta to geo delta (approximate)
      const scale = 280 * mapZoom;
      const lngDelta = (-dx / scale) * 60;
      const latDelta = (dy / scale) * 60;
      setMapCenter([
        centerAtDragStart.current[0] + lngDelta,
        centerAtDragStart.current[1] + latDelta,
      ]);
    },
    [mapZoom]
  );

  const handleMapMouseUp = useCallback(() => {
    isDragging.current = false;
    document.querySelector(".map-container")?.classList.remove("cursor-grabbing");
  }, []);

  const handleMapWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setMapZoom((z) => Math.max(0.5, Math.min(5, z * factor)));
    },
    []
  );

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (country) p.set("country", country);
    if (establishment) p.set("establishment", establishment);
    if (course) p.set("course", course);
    if (section) p.set("section", section);
    p.set("from", dateFrom);
    p.set("to", dateTo);
    try {
      const res = await fetch(`/api/admin/dashboard?${p}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [country, establishment, course, section, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const handleManualRefresh = () => {
    fetchData();
    setLastRefresh(new Date());
  };

  // ── Cascading ──
  const filteredEsts =
    data?.filters.establishments.filter(
      (e) => !country || e.country === country
    ) || [];
  const filteredCourses =
    data?.filters.courses.filter(
      (c) => !establishment || c.establishment_id === establishment
    ) || [];
  const filteredSections =
    data?.filters.sections.filter(
      (s) => !course || s.course_id === course
    ) || [];

  const handleCountry = (v: string) => {
    setCountry(v);
    setEstablishment("");
    setCourse("");
    setSection("");
  };
  const handleEst = (v: string) => {
    setEstablishment(v);
    setCourse("");
    setSection("");
  };
  const handleCourse = (v: string) => {
    setCourse(v);
    setSection("");
  };

  const applyPreset = (key: string) => {
    setDatePreset(key);
    if (key === "custom") return; // keep current dates, show pickers
    const now = new Date();
    const to = now.toISOString().split("T")[0];
    setDateTo(to);
    if (key === "today") setDateFrom(to);
    else if (key === "7d") setDateFrom(new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0]);
    else if (key === "14d") setDateFrom(new Date(now.getTime() - 14 * 86400000).toISOString().split("T")[0]);
    else if (key === "30d") setDateFrom(new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0]);
    else if (key === "sem") {
      const month = now.getMonth();
      const year = now.getFullYear();
      setDateFrom(month < 7 ? `${year}-03-01` : `${year}-08-01`);
    } else if (key === "all") setDateFrom("2024-01-01");
  };

  // Loading
  if (!data && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-sidebar" />
      </div>
    );
  }
  if (!data) return null;

  const d = data;
  const hasAlerts =
    d.alerts.riskPending > 0 ||
    d.alerts.inactiveStudents > 3 ||
    d.alerts.pendingReviews > 5;
  const sortedComps = Object.entries(d.competencies)
    .filter(([, v]) => v > 0)
    .sort((a, b) => a[1] - b[1]);
  const weakest3 = new Set(sortedComps.slice(0, 3).map(([k]) => k));
  const maxHeatVal = Math.max(...d.charts.heatmap.flat(), 1);

  // Map: which English country names have data
  const activeCountryEngs = new Set(
    d.mapData
      .map((m) => COUNTRY_GEO[m.country]?.eng)
      .filter(Boolean)
  );
  const maxMarker = Math.max(...d.mapData.map((m) => m.students), 1);

  return (
    <div className="flex min-h-screen">
      {/* ════════════ SIDEBAR ════════════ */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-gray-200 bg-white py-5 px-4 overflow-y-auto">
        <SidebarContent
          d={d}
          country={country}
          establishment={establishment}
          course={course}
          section={section}
          filteredEsts={filteredEsts}
          filteredCourses={filteredCourses}
          filteredSections={filteredSections}
          onCountry={handleCountry}
          onEst={handleEst}
          onCourse={handleCourse}
          onSection={(v) => setSection(v)}
          hasAlerts={hasAlerts}
        />
      </aside>

      {/* Mobile filter toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed bottom-4 right-4 z-50 bg-sidebar text-white p-3 rounded-full shadow-lg"
      >
        <Filter size={20} />
      </button>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setSidebarOpen(false)}
        >
          <aside
            className="w-72 h-full bg-white py-5 px-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent
              d={d}
              country={country}
              establishment={establishment}
              course={course}
              section={section}
              filteredEsts={filteredEsts}
              filteredCourses={filteredCourses}
              filteredSections={filteredSections}
              onCountry={handleCountry}
              onEst={handleEst}
              onCourse={handleCourse}
              onSection={(v) => setSection(v)}
              hasAlerts={hasAlerts}
            />
          </aside>
        </div>
      )}

      {/* ════════════ MAIN CANVAS ════════════ */}
      <main className="flex-1 overflow-y-auto">
        <header className="px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {d.isSuperadmin ? "Centro de Control" : "GlorIA Analytics"}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Bienvenido, {d.firstName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-gray-400 hidden sm:block">
              {lastRefresh.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <button
              onClick={handleManualRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-sidebar hover:bg-sidebar/5 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              title="Actualizar datos"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {loading ? "" : "Actualizar"}
            </button>
          </div>
        </header>

        <div className="px-6 pb-8 space-y-6">
          {/* ── En vivo (self-polling panel) ── */}
          <LiveKPIPanel showSystemStatus={d.isSuperadmin} />

          {/* ── Acumulados ── */}
          <div>
            <div className="flex items-center gap-2 mb-2.5 flex-wrap">
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Acumulados</h2>
              <div className="flex items-center gap-1 ml-auto">
                {DATE_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => applyPreset(p.key)}
                    className={`px-2 py-0.5 text-[10px] rounded-full transition-colors cursor-pointer ${
                      datePreset === p.key
                        ? "bg-sidebar text-white font-medium"
                        : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {datePreset === "custom" && (
              <div className="flex gap-2 mb-3">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="text-[11px] border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-sidebar/30"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="text-[11px] border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-sidebar/30"
                />
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPICard icon={Users} label="Inscritos" value={d.kpis.totalStudents} trend={d.trends.totalStudents} color="blue"
                tooltip="Total de perfiles con rol estudiante dentro de las instituciones en tu alcance." />
              <KPICard icon={Activity} label="Con sesiones" value={d.kpis.activeStudents} trend={d.trends.activeStudents} color="lime" alive={d.kpis.activeStudents > 0}
                tooltip="Estudiantes que iniciaron al menos 1 conversación con un paciente IA en el período seleccionado." />
              <KPICard icon={Monitor} label="T. plataforma/día" value={`${d.kpis.avgPlatformMinutesPerDay} min`} trend={d.trends.avgPlatformMinutes} subtitle={`${d.kpis.avgPlatformMinutesTotal} min total`} color="cyan" alive={d.kpis.avgPlatformMinutesPerDay > 0}
                tooltip="Promedio diario de minutos en la plataforma por usuario activo. Se registra con un heartbeat cada 30 s." />
              <KPICard icon={Clock} label="T. sesión prom." value={`${d.kpis.avgSessionMinutes} min`} trend={d.trends.avgSessionMinutes} color="amber"
                tooltip="Duración promedio de las sesiones completadas (active_seconds > 0) en el período." />
              <KPICard icon={Target} label="Satisf. 1ra sesión" value={`${d.kpis.firstSessionScore}/4`} color="purple"
                tooltip="Puntaje promedio de competencias (escala 0-4) en la primera sesión completada de cada estudiante." />
              <KPICard icon={ClipboardCheck} label="Autoevaluaciones" value={`${d.kpis.selfEvaluations.completed}/${d.kpis.selfEvaluations.total}`} subtitle={d.kpis.selfEvaluations.total > 0 ? `${Math.round((d.kpis.selfEvaluations.completed / d.kpis.selfEvaluations.total) * 100)}%` : undefined} color="teal"
                tooltip="Estudiantes que completaron al menos una autoevaluación sobre el total con sesiones completadas." />
              <KPICard icon={GraduationCap} label="Evals docentes" value={`${d.kpis.teacherEvaluations.completed}/${d.kpis.teacherEvaluations.total}`} subtitle={d.kpis.teacherEvaluations.total > 0 ? `${Math.round((d.kpis.teacherEvaluations.completed / d.kpis.teacherEvaluations.total) * 100)}%` : undefined} color="indigo"
                tooltip="Estudiantes con al menos una evaluación de competencias aprobada por un docente." />
              <KPICard icon={RefreshCw} label="Tasa retorno" value={`${d.kpis.returnRate}%`} color="emerald"
                tooltip="Porcentaje de estudiantes con 2 o más sesiones completadas, sobre los que completaron al menos 1." />
              <KPICard icon={FlaskConical} label="Pilotos" value={`${d.kpis.pilots.active} activos`} subtitle={`${d.kpis.pilots.completed} completos`} color="rose"
                tooltip="Pilotos activos (en curso, validados o enviados) y finalizados registrados en el sistema." />
            </div>
          </div>

          {/* ── Map + Funnel ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Map (3/5) */}
            <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Globe size={14} className="text-sidebar" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Distribución geográfica
                </h3>
                <span className="text-[10px] text-gray-400 ml-auto">
                  {d.mapData.length} países · {d.mapData.reduce((s, m) => s + m.institutions.length, 0)} inst.
                </span>
              </div>
              <div
                className="relative overflow-hidden rounded-lg map-container cursor-grab select-none"
                onMouseLeave={() => {
                  setHoveredCountry(null);
                  isDragging.current = false;
                }}
                onMouseDown={handleMapMouseDown}
                onMouseMove={handleMapMouseMove}
                onMouseUp={handleMapMouseUp}
                onWheel={handleMapWheel}
              >
                {/* Zoom controls */}
                <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                  <button
                    onClick={() => setMapZoom((z) => Math.min(z * 1.4, 5))}
                    className="w-7 h-7 bg-white border border-gray-200 rounded-md shadow-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 flex items-center justify-center text-sm font-bold transition-colors"
                  >
                    +
                  </button>
                  <button
                    onClick={() => {
                      setMapZoom((z) => Math.max(z / 1.4, 0.5));
                      if (mapZoom <= 0.8) setMapCenter([-62, -15]);
                    }}
                    className="w-7 h-7 bg-white border border-gray-200 rounded-md shadow-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 flex items-center justify-center text-sm font-bold transition-colors"
                  >
                    -
                  </button>
                  {mapZoom !== 1 && (
                    <button
                      onClick={() => {
                        setMapZoom(1);
                        setMapCenter([-62, -15]);
                      }}
                      className="w-7 h-7 bg-white border border-gray-200 rounded-md shadow-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 flex items-center justify-center transition-colors"
                      title="Restablecer"
                    >
                      <RefreshCw size={11} />
                    </button>
                  )}
                </div>
                {/* Region quick-zoom */}
                <div className="absolute bottom-2 left-2 z-10 flex gap-1">
                  {[
                    { label: "Caribe", center: [-72, 19] as [number, number], zoom: 2.8 },
                    { label: "Centroam.", center: [-85, 13] as [number, number], zoom: 2.5 },
                    { label: "Cono Sur", center: [-62, -33] as [number, number], zoom: 2 },
                  ].map((r) => (
                    <button
                      key={r.label}
                      onClick={() => {
                        setMapCenter(r.center);
                        setMapZoom(r.zoom);
                      }}
                      className="px-2 py-1 bg-white/90 backdrop-blur border border-gray-200 rounded-md shadow-sm text-[9px] text-gray-500 hover:text-sidebar hover:bg-white transition-colors"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                <ComposableMap
                  projection="geoMercator"
                  projectionConfig={{
                    center: mapCenter,
                    scale: 280 * mapZoom,
                  }}
                  width={480}
                  height={330}
                  style={{ width: "100%", height: "auto" }}
                >
                  <Geographies geography={GEO_URL}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const isActive = activeCountryEngs.has(
                          geo.properties.name
                        );
                        const name = geo.properties.name;
                        const LATAM = [
                          "Mexico","Guatemala","Honduras","El Salvador","Nicaragua",
                          "Costa Rica","Panama","Colombia","Venezuela","Ecuador",
                          "Peru","Brazil","Bolivia","Paraguay","Chile","Argentina",
                          "Uruguay","Cuba","Dominican Rep.","Haiti","Jamaica",
                          "Puerto Rico","Guyana","Suriname",
                        ];
                        if (!isActive && !LATAM.includes(name as string))
                          return null;
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={isActive ? "#C7CBE5" : "#F3F4F6"}
                            stroke="#FFFFFF"
                            strokeWidth={0.5}
                            style={{
                              default: { outline: "none" },
                              hover: {
                                fill: isActive ? "#A5ABD4" : "#E5E7EB",
                                outline: "none",
                              },
                              pressed: { outline: "none" },
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
                  {d.mapData.map((m) => {
                    const geo = COUNTRY_GEO[m.country];
                    if (!geo) return null;
                    const r = 5 + (m.students / maxMarker) * 12;
                    return (
                      <Marker key={m.country} coordinates={geo.coords}>
                        <circle
                          r={r}
                          fill="#4A55A2"
                          fillOpacity={0.75}
                          stroke="#FFF"
                          strokeWidth={1.5}
                          className="cursor-pointer transition-all"
                          onMouseEnter={(e) => {
                            setHoveredCountry(m.country);
                            const rect = (
                              e.target as SVGElement
                            ).closest("svg")?.getBoundingClientRect();
                            if (rect) {
                              setTooltipPos({
                                x: e.clientX - rect.left,
                                y: e.clientY - rect.top - 10,
                              });
                            }
                          }}
                          onMouseLeave={() => setHoveredCountry(null)}
                        />
                        <text
                          textAnchor="middle"
                          y={1}
                          dominantBaseline="middle"
                          style={{
                            fontFamily: "system-ui",
                            fontSize: r > 10 ? 8 : 6,
                            fill: "#FFF",
                            fontWeight: 700,
                            pointerEvents: "none",
                          }}
                        >
                          {m.students}
                        </text>
                        <text
                          textAnchor="middle"
                          y={r + 10}
                          style={{
                            fontFamily: "system-ui",
                            fontSize: 8,
                            fill: "#6B7280",
                            fontWeight: 600,
                            pointerEvents: "none",
                          }}
                        >
                          {m.country}
                        </text>
                      </Marker>
                    );
                  })}
                </ComposableMap>

                {/* Hover tooltip with institution breakdown */}
                {hoveredCountry && (() => {
                  const cm = d.mapData.find(
                    (m) => m.country === hoveredCountry
                  );
                  if (!cm) return null;
                  return (
                    <div
                      className="absolute z-20 bg-white rounded-xl shadow-lg border border-gray-200 px-3.5 py-3 pointer-events-none"
                      style={{
                        left: Math.min(tooltipPos.x, 300),
                        top: tooltipPos.y,
                        transform: "translate(-50%, -100%)",
                        minWidth: 200,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <CountryFlag country={cm.country} size={22} />
                        <p className="text-xs font-bold text-gray-900">
                          {cm.country}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        {cm.institutions.map((inst, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="text-[11px] text-gray-600 truncate">
                              {inst.name}
                            </span>
                            <span className="text-[11px] font-bold text-sidebar shrink-0">
                              {inst.students} lic.
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between text-[10px] text-gray-400">
                        <span>{cm.students} estudiantes</span>
                        <span>{cm.sessions} sesiones</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Spain inset if present */}
                {d.mapData.some((m) => m.country === "España") && (
                  <div
                    className="absolute top-1 right-1 bg-white/90 backdrop-blur rounded-lg border border-gray-200 p-1.5 cursor-pointer"
                    onMouseEnter={(e) => {
                      setHoveredCountry("España");
                      const rect = e.currentTarget
                        .closest(".relative")
                        ?.getBoundingClientRect();
                      if (rect) {
                        setTooltipPos({
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top - 10,
                        });
                      }
                    }}
                    onMouseLeave={() => setHoveredCountry(null)}
                  >
                    <ComposableMap
                      projection="geoMercator"
                      projectionConfig={{ center: [-3, 40], scale: 1200 }}
                      width={70}
                      height={50}
                      style={{ width: 70, height: 50 }}
                    >
                      <Geographies geography={GEO_URL}>
                        {({ geographies }) =>
                          geographies
                            .filter((g) =>
                              ["Spain", "Portugal", "France"].includes(
                                g.properties.name
                              )
                            )
                            .map((geo) => (
                              <Geography
                                key={geo.rsmKey}
                                geography={geo}
                                fill={
                                  geo.properties.name === "Spain"
                                    ? "#C7CBE5"
                                    : "#F3F4F6"
                                }
                                stroke="#FFF"
                                strokeWidth={0.5}
                                style={{
                                  default: { outline: "none" },
                                  hover: { outline: "none" },
                                  pressed: { outline: "none" },
                                }}
                              />
                            ))
                        }
                      </Geographies>
                      {(() => {
                        const esp = d.mapData.find(
                          (m) => m.country === "España"
                        );
                        if (!esp) return null;
                        return (
                          <Marker coordinates={[-3.7, 40.42]}>
                            <circle
                              r={4}
                              fill="#4A55A2"
                              fillOpacity={0.75}
                              stroke="#FFF"
                              strokeWidth={1}
                            />
                            <text
                              textAnchor="middle"
                              y={1}
                              dominantBaseline="middle"
                              style={{
                                fontSize: 5,
                                fill: "#FFF",
                                fontWeight: 700,
                              }}
                            >
                              {esp.students}
                            </text>
                          </Marker>
                        );
                      })()}
                    </ComposableMap>
                    <p className="text-center text-[8px] text-gray-500">
                      España
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Funnel (2/5) */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Funnel de engagement
              </h3>
              <div className="space-y-3">
                {FUNNEL_STEPS.map((step, i) => {
                  const val = d.funnel[step.key];
                  const max = d.funnel.enrolled || 1;
                  const pctVal = Math.round((val / max) * 100);
                  const width = Math.max((val / max) * 100, 3);
                  const opacity = 1 - i * 0.13;
                  return (
                    <div key={step.key}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] text-gray-600">
                          {step.label}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          <strong className="text-gray-900">{val}</strong>
                          {i > 0 && (
                            <span className="text-[10px] ml-1">{pctVal}%</span>
                          )}
                        </span>
                      </div>
                      <div className="h-6 bg-gray-50 rounded overflow-hidden">
                        <div
                          className="h-full rounded transition-all duration-700"
                          style={{
                            width: `${width}%`,
                            backgroundColor: `rgba(74, 85, 162, ${opacity})`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Competencies ── */}
          {Object.keys(d.competencies).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Competencias
              </h3>
              <div className="space-y-2">
                {sortedComps.reverse().map(([key, val]) => {
                  const isWeak = weakest3.has(key);
                  const color =
                    val >= 3
                      ? "#22c55e"
                      : val >= 2
                        ? "#eab308"
                        : val > 0
                          ? "#ef4444"
                          : "#d1d5db";
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-3 ${isWeak ? "bg-red-50/60 -mx-2 px-2 py-1 rounded-lg" : ""}`}
                    >
                      <span className="text-[11px] text-gray-500 w-28 shrink-0 truncate">
                        {COMP_LABELS[key] || key}
                      </span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${(val / 4) * 100}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                      <span
                        className="text-[11px] font-bold w-8 text-right"
                        style={{ color }}
                      >
                        {val.toFixed(1)}
                      </span>
                      {isWeak && (
                        <span className="text-[8px] text-red-500 font-bold">
                          REFORZAR
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Charts (tabbed) ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1">
                {CHART_TABS.map((tab, i) => {
                  if (i === 3 && !d.isSuperadmin) return null;
                  return (
                    <button
                      key={tab}
                      onClick={() => setChartTab(i)}
                      className={`text-[11px] px-3 py-1.5 rounded-lg transition-colors ${
                        chartTab === i
                          ? "bg-sidebar text-white"
                          : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                      }`}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <Calendar size={10} />
                {dateFrom} — {dateTo}
              </span>
            </div>

            {chartTab === 0 && (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={d.charts.sessionsPerDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => String(v).slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12 }} labelFormatter={(v) => `Fecha: ${v}`} />
                  <Line type="monotone" dataKey="sessions" stroke="#4A55A2" strokeWidth={2} dot={false} name="Sesiones" />
                </LineChart>
              </ResponsiveContainer>
            )}
            {chartTab === 1 && (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={d.charts.weeklyScore}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={(v) => String(v).slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 4]} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="score" stroke="#7C3AED" strokeWidth={2} dot={false} name="Puntaje" />
                </LineChart>
              </ResponsiveContainer>
            )}
            {chartTab === 2 && (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={d.charts.registrations}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={(v) => String(v).slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="registrations" stroke="#059669" fill="#059669" fillOpacity={0.15} name="Registros" />
                </AreaChart>
              </ResponsiveContainer>
            )}
            {chartTab === 3 && d.isSuperadmin && (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={d.charts.byEstablishment}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="students" fill="#4A55A2" name="Alumnos" />
                  <Bar dataKey="sessions" fill="#7C3AED" name="Sesiones" />
                </BarChart>
              </ResponsiveContainer>
            )}
            {chartTab === 4 && (
              <div className="overflow-x-auto">
                <div className="grid gap-[2px]" style={{ gridTemplateColumns: `50px repeat(24, 1fr)` }}>
                  <div />
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="text-[8px] text-gray-400 text-center">{h.toString().padStart(2, "0")}</div>
                  ))}
                  {d.charts.heatmap.map((row, dayIdx) => (
                    <div key={dayIdx} className="contents">
                      <div className="text-[10px] text-gray-500 flex items-center">{DAY_LABELS[dayIdx]}</div>
                      {row.map((val, h) => (
                        <div
                          key={h}
                          className="rounded-sm aspect-square min-h-[14px]"
                          style={{ backgroundColor: val > 0 ? `rgba(74, 85, 162, ${0.15 + (val / maxHeatVal) * 0.85})` : "#f5f5f5" }}
                          title={`${DAY_LABELS[dayIdx]} ${h}:00 — ${val} sesiones`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Research insights (superadmin) ── */}
          {d.isSuperadmin && d.research.insights.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-sidebar" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    Potenciales artículos
                  </h3>
                  <span className="text-[10px] bg-sidebar/10 text-sidebar px-2 py-0.5 rounded-full font-medium">
                    {d.research.insights.length}
                  </span>
                </div>
                <Link
                  href="/admin/investigacion"
                  className="text-[10px] text-sidebar hover:underline flex items-center gap-0.5"
                >
                  Ver todo <ChevronRight size={10} />
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {d.research.insights.slice(0, 3).map((ins) => (
                  <div
                    key={ins.id}
                    className={`p-3 rounded-lg border ${PRIORITY_COLORS[ins.priority] || "bg-gray-50 border-gray-200"}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-bold uppercase">
                        {ins.priority}
                      </span>
                      <span className="text-[9px] text-gray-400">
                        {ins.sample_size} ses.
                      </span>
                    </div>
                    <p className="text-xs font-medium text-gray-900 leading-snug line-clamp-2">
                      {ins.title}
                    </p>
                    {ins.suggested_venues[0] && (
                      <p className="text-[10px] text-gray-400 mt-1.5 truncate">
                        → {ins.suggested_venues[0]} ({ins.suggested_paper_type})
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ─────────────────────── Sidebar content ─────────────────────── */

function SidebarContent({
  d,
  country,
  establishment,
  course,
  section,
  filteredEsts,
  filteredCourses,
  filteredSections,
  onCountry,
  onEst,
  onCourse,
  onSection,
  hasAlerts,
}: {
  d: DashboardData;
  country: string;
  establishment: string;
  course: string;
  section: string;
  filteredEsts: { id: string; name: string; country: string }[];
  filteredCourses: { id: string; name: string; establishment_id: string }[];
  filteredSections: { id: string; name: string; course_id: string }[];
  onCountry: (v: string) => void;
  onEst: (v: string) => void;
  onCourse: (v: string) => void;
  onSection: (v: string) => void;
  hasAlerts: boolean;
}) {
  return (
    <>
      {/* Filters */}
      <div className="mb-5">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
          Filtros
        </p>
        <div className="space-y-2.5">
          <SidebarSelect label="País" value={country} onChange={onCountry} options={d.filters.countries.map((c) => ({ value: c, label: c }))} />
          <SidebarSelect label="Institución" value={establishment} onChange={onEst} options={filteredEsts.map((e) => ({ value: e.id, label: e.name }))} />
          <SidebarSelect label="Asignatura" value={course} onChange={onCourse} options={filteredCourses.map((c) => ({ value: c.id, label: c.name }))} />
          <SidebarSelect label="Sección" value={section} onChange={onSection} options={filteredSections.map((s) => ({ value: s.id, label: s.name }))} />
        </div>
      </div>

      {/* Alerts */}
      <div className="border-t border-gray-100 pt-4 mb-5">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">
          Alertas
        </p>
        {hasAlerts ? (
          <div className="space-y-1.5">
            {d.alerts.riskPending > 0 && (
              <Link
                href="/admin/retroalimentacion"
                className="flex items-center gap-2 text-xs text-red-600 hover:bg-red-50 rounded-md px-2 py-1.5 transition-colors"
              >
                <AlertTriangle size={11} className="shrink-0" />
                {d.alerts.riskPending} riesgo
              </Link>
            )}
            {d.alerts.inactiveStudents > 3 && (
              <div className="flex items-center gap-2 text-xs text-amber-600 px-2 py-1.5">
                <Clock size={11} className="shrink-0" />
                {d.alerts.inactiveStudents} inactivos
              </div>
            )}
            {d.alerts.pendingReviews > 5 && (
              <Link
                href="/admin/retroalimentacion"
                className="flex items-center gap-2 text-xs text-blue-600 hover:bg-blue-50 rounded-md px-2 py-1.5 transition-colors"
              >
                <ClipboardCheck size={11} className="shrink-0" />
                {d.alerts.pendingReviews} pendientes
              </Link>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-gray-300 px-2">Sin alertas</p>
        )}
      </div>

      {/* Research (superadmin) */}
      {d.isSuperadmin && (
        <div className="border-t border-gray-100 pt-4 mb-5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">
            Investigación
          </p>
          <div className="space-y-1 text-xs text-gray-600 px-2">
            <div className="flex justify-between">
              <span>Oportunidades</span>
              <strong>{sumObj(d.research.opportunities)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Fondos</span>
              <strong>{sumObj(d.research.funds)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Artículos</span>
              <strong>{d.research.insights.length}</strong>
            </div>
          </div>
          {d.research.deadlines.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-[9px] text-gray-400 uppercase px-2">
                Próximo
              </p>
              {d.research.deadlines.slice(0, 2).map((dl) => (
                <a
                  key={dl.id}
                  href={dl.url || "/admin/investigacion"}
                  target={dl.url ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="flex items-center justify-between text-[10px] px-2 py-1 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <span className="text-gray-600 truncate flex-1 mr-2">
                    {dl.name}
                  </span>
                  <span
                    className={`font-bold shrink-0 ${dl.days <= 14 ? "text-red-500" : "text-gray-400"}`}
                  >
                    {dl.days}d
                  </span>
                </a>
              ))}
            </div>
          )}
          <Link
            href="/admin/investigacion"
            className="flex items-center gap-1 text-[10px] text-sidebar hover:underline mt-2 px-2"
          >
            Ver investigación <ChevronRight size={10} />
          </Link>
        </div>
      )}

      {/* Achievements */}
      {d.isSuperadmin && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">
            Logros
          </p>
          <div className="space-y-1 text-xs px-2">
            {d.research.achievements.published > 0 && (
              <div className="flex items-center gap-2 text-gray-600">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {d.research.achievements.published} publicados
              </div>
            )}
            {d.research.achievements.inDevelopment > 0 && (
              <div className="flex items-center gap-2 text-gray-600">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {d.research.achievements.inDevelopment} en desarrollo
              </div>
            )}
            {d.research.achievements.acceptedConferences > 0 && (
              <div className="flex items-center gap-2 text-gray-600">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {d.research.achievements.acceptedConferences} conf. aceptada
              </div>
            )}
            {d.research.achievements.acceptedFunds > 0 && (
              <div className="flex items-center gap-2 text-gray-600">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                {d.research.achievements.acceptedFunds} fondo aceptado
              </div>
            )}
            {d.research.achievements.published === 0 &&
              d.research.achievements.inDevelopment === 0 &&
              d.research.achievements.acceptedConferences === 0 &&
              d.research.achievements.acceptedFunds === 0 && (
                <p className="text-[10px] text-gray-300">Sin logros aún</p>
              )}
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────────────── Sub-components ─────────────────────── */

function SidebarSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-[10px] text-gray-500 block mb-0.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs border border-gray-200 rounded-lg py-1.5 px-2 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-sidebar/30 appearance-none hover:border-gray-300 cursor-pointer"
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-50", text: "text-blue-500" },
  green: { bg: "bg-green-50", text: "text-green-500" },
  amber: { bg: "bg-amber-50", text: "text-amber-500" },
  purple: { bg: "bg-purple-50", text: "text-purple-500" },
  teal: { bg: "bg-teal-50", text: "text-teal-500" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-500" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-500" },
  rose: { bg: "bg-rose-50", text: "text-rose-500" },
  cyan: { bg: "bg-cyan-50", text: "text-cyan-500" },
  lime: { bg: "bg-lime-50", text: "text-lime-600" },
};

function KPICard({
  icon: Icon,
  label,
  value,
  trend,
  subtitle,
  color = "blue",
  alive,
  tooltip,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
  trend?: number;
  subtitle?: string;
  color?: string;
  alive?: boolean;
  tooltip?: string;
}) {
  const c = COLOR_MAP[color] || COLOR_MAP.blue;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3.5">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center relative`}>
          {alive && <span className={`absolute inset-0 rounded-lg ${c.bg} animate-kpi-alive`} />}
          <Icon size={13} className={`${c.text} relative`} />
        </div>
        {trend !== undefined && trend !== 0 && (
          <div
            className={`flex items-center gap-0.5 text-[9px] font-medium ml-auto ${
              trend > 0 ? "text-green-600" : "text-red-500"
            }`}
          >
            {trend > 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
            {trend > 0 ? "+" : ""}
            {trend}%
          </div>
        )}
      </div>
      <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
      <div className="flex items-center gap-1 mt-0.5">
        <p className="text-[10px] text-gray-500">{label}</p>
        {tooltip && <InfoTip text={tooltip} />}
      </div>
      {subtitle && <p className="text-[9px] text-gray-400">{subtitle}</p>}
    </div>
  );
}

/* ─── System Status Card (superadmin only) ─── */

type HealthStatus = "healthy" | "warning" | "degraded" | "loading" | "error";
type HealthCheck = { ok: boolean; ms: number; error?: string };

const STATUS_CONFIG: Record<HealthStatus, { label: string; color: string; dotColor: string; borderColor: string; bgColor: string }> = {
  healthy:  { label: "Operativo",      color: "text-green-700",  dotColor: "bg-green-500",  borderColor: "border-green-200", bgColor: "bg-green-50" },
  warning:  { label: "Latencia alta",  color: "text-amber-700",  dotColor: "bg-amber-400",  borderColor: "border-amber-200", bgColor: "bg-amber-50" },
  degraded: { label: "Con problemas",  color: "text-red-700",    dotColor: "bg-red-500",    borderColor: "border-red-200",   bgColor: "bg-red-50" },
  loading:  { label: "Verificando...", color: "text-gray-400",   dotColor: "bg-gray-300",   borderColor: "border-gray-200",  bgColor: "bg-gray-50" },
  error:    { label: "Sin conexión",   color: "text-red-700",    dotColor: "bg-red-500",    borderColor: "border-red-200",   bgColor: "bg-red-50" },
};

function SystemStatusCard() {
  const [status, setStatus] = useState<HealthStatus>("loading");
  const [checks, setChecks] = useState<Record<string, HealthCheck> | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (!res.ok) { setStatus("error"); return; }
      const data = await res.json();
      setStatus(data.status as HealthStatus);
      setChecks(data.checks);
    } catch {
      setStatus("error");
      setChecks(null);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.error;

  // Count OK / total from checks
  const checkEntries = checks ? Object.values(checks) : [];
  const okCount = checkEntries.filter((c) => c.ok).length;
  const totalCount = checkEntries.length;

  return (
    <Link
      href="/admin/monitoreo"
      className={`bg-white rounded-xl border ${cfg.borderColor} p-3.5 hover:shadow-md transition-shadow group block`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-7 h-7 rounded-lg ${cfg.bgColor} flex items-center justify-center relative`}>
          {/* Pulsing ring animation */}
          <span className={`absolute inset-0 rounded-lg ${cfg.dotColor} opacity-20 animate-[ping_2s_ease-in-out_infinite]`} />
          {/* Solid dot */}
          <span className={`relative w-2.5 h-2.5 rounded-full ${cfg.dotColor} shadow-sm`}>
            <span className={`absolute inset-0 rounded-full ${cfg.dotColor} animate-[pulse_2s_ease-in-out_infinite]`} />
          </span>
        </div>
        <ExternalLink size={10} className="text-gray-300 ml-auto group-hover:text-sidebar transition-colors" />
      </div>
      <p className={`text-lg font-bold leading-tight ${status === "loading" ? "text-gray-300" : cfg.color}`}>
        {cfg.label}
      </p>
      <p className="text-[10px] text-gray-500 mt-0.5">Estado sistema</p>
      {checks && status !== "loading" && (
        <p className="text-[9px] text-gray-400">
          {okCount}/{totalCount} servicios OK
          {checks.database && <span> · DB {checks.database.ms}ms</span>}
        </p>
      )}
    </Link>
  );
}
