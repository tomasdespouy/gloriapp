"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, Loader2, ExternalLink, FileText, Upload, Trash2, Pencil, X, Check,
  ChevronDown, ChevronUp, BookOpen, Send, Sparkles, FileUp, GraduationCap,
  BarChart3, Lightbulb, Brain, TrendingUp, Zap,
} from "lucide-react";

type Opportunity = {
  id: string;
  scan_date: string;
  name: string;
  type: string;
  organizer: string | null;
  deadline: string | null;
  event_date: string | null;
  location: string | null;
  url: string | null;
  gloria_fit: string;
  advantages: string[];
  weaknesses: string[];
  approach: string | null;
  status: string;
  registration_cost: string | null;
  gloria_fit_summary: string | null;
  deliverable: string | null;
  indexing: string | null;
};

type Paper = {
  id: string;
  title: string;
  type: string;
  authors: string[];
  abstract: string | null;
  venue: string | null;
  date: string | null;
  file_url: string | null;
  tags: string[];
  content_summary: string | null;
};

const fitColors: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: "bg-green-100", text: "text-green-700", label: "Alta" },
  medium: { bg: "bg-amber-100", text: "text-amber-700", label: "Media" },
  low: { bg: "bg-red-100", text: "text-red-700", label: "Baja" },
};

const statusLabels: Record<string, { label: string; color: string }> = {
  new: { label: "Nuevo", color: "bg-blue-100 text-blue-700" },
  reviewing: { label: "Revisando", color: "bg-purple-100 text-purple-700" },
  preparing: { label: "Preparando", color: "bg-amber-100 text-amber-700" },
  submitted: { label: "Enviado", color: "bg-cyan-100 text-cyan-700" },
  accepted: { label: "Aceptado", color: "bg-green-100 text-green-700" },
  rejected: { label: "Rechazado", color: "bg-red-100 text-red-700" },
  skipped: { label: "Descartado", color: "bg-gray-100 text-gray-500" },
};

const typeLabels: Record<string, string> = {
  conference: "Conferencia", journal: "Journal", call_for_papers: "Call for Papers", grant: "Fondo / Grant",
};

const paperTypeLabels: Record<string, { label: string; color: string }> = {
  paper: { label: "Paper", color: "bg-blue-100 text-blue-700" },
  presentation: { label: "Presentación", color: "bg-purple-100 text-purple-700" },
  poster: { label: "Poster", color: "bg-teal-100 text-teal-700" },
  proposal: { label: "Propuesta", color: "bg-amber-100 text-amber-700" },
  report: { label: "Reporte", color: "bg-gray-100 text-gray-600" },
  congress: { label: "Congreso", color: "bg-indigo-100 text-indigo-700" },
  grant_application: { label: "Postulación fondo", color: "bg-emerald-100 text-emerald-700" },
};

type TabKey = "opportunities" | "funds" | "papers" | "data";

type Insight = {
  id: string;
  title: string;
  category: string;
  hypothesis: string;
  findings: string;
  data_source: string;
  sample_size: number | null;
  statistical_sig: string | null;
  suggested_venues: string[];
  suggested_paper_type: string | null;
  status: string;
  priority: string;
  created_at: string;
  reference_title: string | null;
  reference_authors: string | null;
  reference_year: number | null;
  reference_url: string | null;
};

export default function ResearchClient() {
  const [tab, setTab] = useState<TabKey>("opportunities");
  const [scanningFunds, setScanningFunds] = useState(false);
  const [fundScanResult, setFundScanResult] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<{
    id: string;
    started_at: string;
    model: string;
    status: string;
    scan_type?: string;
  } | null>(null);
  const [polling, setPolling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    const [opp, pap, ins, jobInfo] = await Promise.all([
      fetch("/api/admin/research/scan").then(r => r.json()),
      fetch("/api/admin/research/papers").then(r => r.json()),
      fetch("/api/admin/research/insights").then(r => r.json()).catch(() => []),
      fetch("/api/admin/research/jobs/active").then(r => r.json()).catch(() => ({})),
    ]);
    if (Array.isArray(opp)) setOpportunities(opp);
    if (Array.isArray(pap)) setPapers(pap);
    if (Array.isArray(ins)) setInsights(ins);
    if (jobInfo?.activeJob) setActiveJob(jobInfo.activeJob);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type === "application/pdf" || f.name.endsWith(".pdf"));
    if (fileArray.length === 0) return;

    setUploading(true);
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setUploadProgress(`Analizando ${file.name} (${i + 1}/${fileArray.length})...`);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/admin/research/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json();
          setUploadProgress(`Error en ${file.name}: ${err.error}`);
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch {
        setUploadProgress(`Error subiendo ${file.name}`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    setUploadProgress(null);
    setUploading(false);
    // Reload papers
    const updated = await fetch("/api/admin/research/papers").then(r => r.json());
    if (Array.isArray(updated)) setPapers(updated);
  };

  const deletePaper = async (id: string) => {
    if (!confirm("¿Eliminar este paper?")) return;
    await fetch("/api/admin/research/papers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setPapers(prev => prev.filter(p => p.id !== id));
  };

  const updatePaper = async (id: string, updates: Partial<Paper>) => {
    await fetch("/api/admin/research/papers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    setPapers(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    setEditingId(null);
  };

  // Kickoff Deep Research (async). Mismo backend para "Escanear congresos" y "Buscar fondos".
  const runScan = async (scanType: "mixed" | "funds" = "mixed") => {
    if (activeJob) {
      setScanResult(`Ya hay un Deep Research en curso (iniciado ${new Date(activeJob.started_at).toLocaleTimeString()}). Espera a que termine.`);
      return;
    }
    setScanning(true);
    setScanningFunds(scanType === "funds");
    setScanResult(null);
    setFundScanResult(null);
    try {
      const res = await fetch("/api/admin/research/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanType }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = "Error: " + (data.error || "desconocido");
        setScanResult(msg);
        setFundScanResult(msg);
      } else if (data.skipped && data.activeJob) {
        setActiveJob(data.activeJob);
        const msg = `Ya hay un Deep Research en curso. Iniciado a las ${new Date(data.activeJob.started_at).toLocaleTimeString()}.`;
        setScanResult(msg);
        setFundScanResult(msg);
      } else {
        setActiveJob({
          id: data.job_id,
          started_at: new Date().toISOString(),
          model: data.model,
          status: "pending",
          scan_type: scanType,
        });
        const msg = `Deep Research iniciada (${data.model}). Tarda 5-15 min — el digest llega por email cuando termine. Podes cerrar esta pestana.`;
        setScanResult(msg);
        setFundScanResult(msg);
      }
    } catch (e) {
      const msg = "Error: " + (e instanceof Error ? e.message : "fallo la peticion");
      setScanResult(msg);
      setFundScanResult(msg);
    } finally {
      setScanning(false);
      setScanningFunds(false);
    }
  };

  const runFundScan = () => runScan("funds");

  // Polling manual: procesa el job activo si ya termino. Refresca la lista al completar.
  const pollResults = async () => {
    setPolling(true);
    try {
      const res = await fetch("/api/admin/research/scan/poll");
      const data = await res.json();
      if (!res.ok) {
        setScanResult("Error verificando: " + (data.error || "desconocido"));
      } else if (data.processed === 0) {
        setActiveJob(null);
        setScanResult("Sin jobs pendientes.");
      } else {
        type PollResult = { status: string; opps_inserted?: number; email_sent?: boolean; email_error?: string | null };
        const results: PollResult[] = Array.isArray(data.results) ? data.results : [];
        const completed = results.find((r) => r.status === "completed");
        const inProgress = results.find((r) => r.status === "still_in_progress");
        if (completed) {
          setActiveJob(null);
          const emailNote = completed.email_sent ? " · email enviado" : completed.email_error ? ` · email fallo: ${completed.email_error}` : "";
          setScanResult(`Deep Research lista — ${completed.opps_inserted ?? 0} oportunidades agregadas${emailNote}.`);
          const updated = await fetch("/api/admin/research/scan").then((r) => r.json());
          if (Array.isArray(updated)) setOpportunities(updated);
        } else if (inProgress) {
          setScanResult("Aun en progreso. Volve a verificar en 2-3 min.");
        } else {
          setScanResult(`Estado: ${results.map((r) => r.status).join(", ")}.`);
        }
      }
    } catch (e) {
      setScanResult("Error verificando: " + (e instanceof Error ? e.message : "desconocido"));
    } finally {
      setPolling(false);
    }
  };

  // Separate opportunities from funds
  const conferenceOpps = opportunities.filter(o => o.type !== "grant");
  const fundOpps = opportunities.filter(o => o.type === "grant");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-sidebar" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="px-4 sm:px-8 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Investigación y Fondos</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Oportunidades de publicación, fondos concursables e información de respaldo de GlorIA
        </p>
      </header>

      <div className="px-4 sm:px-8 pb-8">
        {/* Tabs */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setTab("opportunities")}
              className={`flex items-center justify-center gap-2 text-sm font-medium py-2 px-4 rounded-md transition-colors ${tab === "opportunities" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
              <Sparkles size={15} />
              Oportunidades ({conferenceOpps.length})
            </button>
            <button onClick={() => setTab("funds")}
              className={`flex items-center justify-center gap-2 text-sm font-medium py-2 px-4 rounded-md transition-colors ${tab === "funds" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
              <span className="text-sm">$</span>
              Fondos y Concursos ({fundOpps.length})
            </button>
            <button onClick={() => setTab("papers")}
              className={`flex items-center justify-center gap-2 text-sm font-medium py-2 px-4 rounded-md transition-colors ${tab === "papers" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
              <BookOpen size={15} />
              Información de respaldo ({papers.length})
            </button>
            <button onClick={() => setTab("data")}
              className={`flex items-center justify-center gap-2 text-sm font-medium py-2 px-4 rounded-md transition-colors ${tab === "data" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
              <BarChart3 size={15} />
              Data ({insights.length})
            </button>
          </div>

          {tab === "opportunities" && (
            <div className="flex items-center gap-2">
              <button onClick={() => runScan("mixed")} disabled={scanning || polling || activeJob !== null}
                className="flex items-center gap-2 bg-sidebar text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                {scanning || activeJob ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {scanning ? "Iniciando..." : activeJob ? "Trabajando en informe..." : "Escanear congresos"}
              </button>
              <button onClick={pollResults} disabled={polling || (!activeJob && opportunities.length === 0)}
                className="flex items-center gap-2 border border-sidebar text-sidebar px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                {polling ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {polling ? "Verificando..." : "Verificar resultado"}
              </button>
            </div>
          )}
          {tab === "funds" && (
            <button onClick={() => runFundScan()} disabled={scanning || scanningFunds || polling || activeJob !== null}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              {scanningFunds || activeJob ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {scanningFunds ? "Iniciando..." : activeJob ? "Trabajando en informe..." : "Buscar fondos"}
            </button>
          )}
        </div>

        {activeJob && (
          <div className="mb-4 text-sm px-4 py-2.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            <span>
              Deep Research en curso ({activeJob.model}) — iniciado a las {new Date(activeJob.started_at).toLocaleTimeString()}.
              Tarda 5-15 min. Podes cerrar esta pestana, el digest llega por email.
            </span>
          </div>
        )}

        {scanResult && (
          <div className={`mb-4 text-sm px-4 py-2.5 rounded-lg ${scanResult.startsWith("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
            {scanResult}
          </div>
        )}

        {/* ════════ INFORMACIÓN DE RESPALDO TAB ════════ */}
        {tab === "papers" && (
          <div className="space-y-6">
            <p className="text-xs text-gray-500">
              Sube postulaciones, artículos, presentaciones y documentos de congresos. La IA los analiza y clasifica automáticamente para armar propuestas futuras de papers o fondos concursables.
            </p>
            {/* Upload zone */}
            <div
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
                dragOver ? "border-sidebar bg-sidebar/5" : "border-gray-200 bg-white"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={32} className="animate-spin text-sidebar" />
                  <p className="text-sm text-sidebar font-medium">{uploadProgress}</p>
                  <p className="text-xs text-gray-400">La IA está leyendo y clasificando el documento...</p>
                </div>
              ) : (
                <>
                  <FileUp size={36} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Arrastra PDFs aquí o haz click para subir
                  </p>
                  <p className="text-xs text-gray-400 mb-4">
                    La IA leerá el documento, generará un resumen y lo clasificará automáticamente
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 bg-sidebar text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-sidebar-hover transition-colors"
                  >
                    <Upload size={16} /> Seleccionar archivos
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleFiles(e.target.files)}
                  />
                </>
              )}
            </div>

            {/* Stats bar */}
            {papers.length > 0 && (
              <div className="flex items-center gap-6 text-xs text-gray-500">
                <span className="font-medium text-gray-700">{papers.length} documentos</span>
                {Object.entries(paperTypeLabels).map(([key, { label }]) => {
                  const count = papers.filter(p => p.type === key).length;
                  return count > 0 ? <span key={key}>{label}: {count}</span> : null;
                })}
              </div>
            )}

            {/* Papers list */}
            {papers.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <GraduationCap size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">Sin papers registrados</p>
                <p className="text-xs text-gray-400 mt-1">Sube un PDF para que la IA lo analice y clasifique</p>
              </div>
            ) : (
              <div className="space-y-3">
                {papers.map((p) => {
                  const pt = paperTypeLabels[p.type] || paperTypeLabels.paper;
                  const isEditing = editingId === p.id;

                  return (
                    <div key={p.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="p-5">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-xl bg-sidebar/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <FileText size={20} className="text-sidebar" />
                          </div>

                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <EditPaperInline paper={p} onSave={updatePaper} onCancel={() => setEditingId(null)} />
                            ) : (
                              <>
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-sm font-semibold text-gray-900">{p.title}</h3>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pt.color}`}>
                                    {pt.label}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500">
                                  {p.authors?.join(", ")}
                                  {p.venue && <span className="text-gray-400"> — {p.venue}</span>}
                                  {p.date && <span className="text-gray-400"> ({p.date})</span>}
                                </p>
                                {p.abstract && (
                                  <p className="text-xs text-gray-600 mt-2 leading-relaxed bg-gray-50 rounded-lg p-3">
                                    {p.abstract}
                                  </p>
                                )}
                                {p.tags?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {p.tags.map((t) => (
                                      <span key={t} className="text-[10px] bg-sidebar/10 text-sidebar px-2 py-0.5 rounded-full font-medium">{t}</span>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {!isEditing && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {p.file_url && (
                                <a href={p.file_url} target="_blank" rel="noopener noreferrer"
                                  className="p-2 text-gray-400 hover:text-sidebar rounded-lg hover:bg-gray-50 transition-colors" title="Ver PDF">
                                  <ExternalLink size={15} />
                                </a>
                              )}
                              <button onClick={() => setEditingId(p.id)}
                                className="p-2 text-gray-400 hover:text-sidebar rounded-lg hover:bg-gray-50 transition-colors" title="Editar">
                                <Pencil size={15} />
                              </button>
                              <button onClick={() => deletePaper(p.id)}
                                className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors" title="Eliminar">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════ OPPORTUNITIES TAB ════════ */}
        {tab === "opportunities" && (
          <div>
            {conferenceOpps.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <Sparkles size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">Sin oportunidades de congresos</p>
                <p className="text-xs text-gray-400 mt-1">Haz click en &ldquo;Escanear congresos&rdquo; para buscar con Tavily</p>
              </div>
            ) : (
              <OpportunitiesTimeline opportunities={conferenceOpps} />
            )}
          </div>
        )}

        {/* ════════ FUNDS TAB ════════ */}
        {tab === "funds" && (
          <div>
            {fundScanResult && (
              <div className={`mb-4 text-sm px-4 py-2.5 rounded-lg ${fundScanResult.startsWith("Error") ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
                {fundScanResult}
              </div>
            )}
            {fundOpps.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <span className="text-4xl block mb-3">$</span>
                <p className="text-gray-500 font-medium">Sin fondos concursables encontrados</p>
                <p className="text-xs text-gray-400 mt-1">Haz click en &ldquo;Buscar fondos&rdquo; para buscar ANID, FONDECYT, Corfo y más</p>
              </div>
            ) : (
              <OpportunitiesTimeline opportunities={fundOpps} />
            )}
          </div>
        )}

        {/* ════════ DATA / INSIGHTS TAB ════════ */}
        {tab === "data" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  La plataforma analiza la base de datos para detectar relaciones semánticas, correlaciones y tendencias relevantes para publicaciones académicas.
                </p>
                {insights.length > 0 && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Última generación: {new Date(insights.reduce((latest, ins) =>
                      ins.created_at > latest ? ins.created_at : latest, insights[0].created_at
                    )).toLocaleString("es-CL", { dateStyle: "long", timeStyle: "short" })}
                    {" "} ({insights.length} insights)
                  </p>
                )}
              </div>
              <button
                onClick={async () => {
                  setGeneratingInsights(true);
                  const res = await fetch("/api/admin/research/insights", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "generate" }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                      setInsights(prev => {
                        const newIds = new Set(data.map((d: { id: string }) => d.id));
                        const reviewedOld = prev.filter(p => p.status !== "nuevo" && !newIds.has(p.id));
                        return [...data, ...reviewedOld];
                      });
                    }
                  }
                  setGeneratingInsights(false);
                }}
                disabled={generatingInsights}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-sidebar text-white rounded-lg hover:bg-sidebar-hover transition-colors disabled:opacity-50 flex-shrink-0"
              >
                {generatingInsights ? <Loader2 size={15} className="animate-spin" /> : <Brain size={15} />}
                {generatingInsights ? "Analizando..." : "Generar insights"}
              </button>
            </div>

            {insights.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <Brain size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 font-medium">Sin insights generados</p>
                <p className="text-xs text-gray-400 mt-1">
                  Haz click en &ldquo;Generar insights&rdquo; para analizar la base de datos y encontrar hallazgos publicables
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.map((ins) => {
                  const catIcons: Record<string, typeof Lightbulb> = {
                    competencias: BarChart3, uso_plataforma: TrendingUp, correlación: Zap,
                    varianza: BarChart3, causalidad: Brain, tendencia: TrendingUp,
                    comparación: Sparkles, revisión_sistemática: BookOpen,
                    desarrollo_producto: FileText, metodología: GraduationCap,
                  };
                  const catColors: Record<string, string> = {
                    competencias: "border-l-blue-500 bg-blue-50/30",
                    uso_plataforma: "border-l-green-500 bg-green-50/30",
                    correlación: "border-l-purple-500 bg-purple-50/30",
                    varianza: "border-l-orange-500 bg-orange-50/30",
                    causalidad: "border-l-red-500 bg-red-50/30",
                    tendencia: "border-l-emerald-500 bg-emerald-50/30",
                    comparación: "border-l-indigo-500 bg-indigo-50/30",
                    revisión_sistemática: "border-l-cyan-500 bg-cyan-50/30",
                    desarrollo_producto: "border-l-amber-500 bg-amber-50/30",
                    metodología: "border-l-violet-500 bg-violet-50/30",
                  };
                  const Icon = catIcons[ins.category] || Lightbulb;
                  const isExpanded = expandedInsight === ins.id;

                  return (
                    <div
                      key={ins.id}
                      className={`bg-white rounded-xl border border-gray-200 border-l-4 ${catColors[ins.category] || "border-l-gray-500"} overflow-hidden cursor-pointer hover:shadow-md transition-all`}
                      onClick={() => setExpandedInsight(isExpanded ? null : ins.id)}
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Icon size={18} className="text-gray-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wide">
                                {ins.category.replace(/_/g, " ")}
                              </span>
                              {ins.sample_size && (
                                <span className="text-[10px] text-gray-400">n={ins.sample_size}</span>
                              )}
                            </div>
                            <h3 className="text-sm font-semibold text-gray-900 leading-snug">{ins.title}</h3>
                          </div>
                          {isExpanded ? <ChevronUp size={16} className="text-gray-400 mt-1" /> : <ChevronDown size={16} className="text-gray-400 mt-1" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Hipótesis</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{ins.hypothesis}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Hallazgos</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{ins.findings}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {ins.statistical_sig && (
                              <span className="text-[10px] px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded-full border border-yellow-200">
                                {ins.statistical_sig}
                              </span>
                            )}
                            {ins.suggested_paper_type && (
                              <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                                {ins.suggested_paper_type}
                              </span>
                            )}
                          </div>
                          {ins.suggested_venues.length > 0 && (
                            <div>
                              <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Venues sugeridos</p>
                              <div className="flex flex-wrap gap-1.5">
                                {ins.suggested_venues.map((v, vi) => (
                                  <span key={vi} className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                                    {v}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {ins.reference_title && (
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                              <p className="text-[10px] uppercase font-bold text-gray-400 mb-1.5">Paper similar publicado</p>
                              <p className="text-xs text-gray-800 font-medium leading-snug">{ins.reference_title}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                {ins.reference_authors}{ins.reference_year ? ` (${ins.reference_year})` : ""}
                              </p>
                              {ins.reference_url && (
                                <a
                                  href={ins.reference_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 mt-1.5 font-medium"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <ExternalLink size={10} />
                                  Ver paper
                                </a>
                              )}
                            </div>
                          )}
                          <div className="text-[10px] text-gray-400">
                            Fuente: {ins.data_source} | {new Date(ins.created_at).toLocaleDateString("es-CL")}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ──── Opportunities Timeline ────

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function OpportunitiesTimeline({ opportunities }: { opportunities: Opportunity[] }) {
  // Group by month of deadline
  const grouped = new Map<string, Opportunity[]>();

  for (const opp of opportunities) {
    let key = "Sin fecha límite";
    if (opp.deadline) {
      const d = new Date(opp.deadline + "T12:00:00");
      if (!isNaN(d.getTime())) {
        key = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      }
    }
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(opp);
  }

  // Sort months chronologically (with "Sin fecha" last)
  const sortedKeys = Array.from(grouped.keys()).sort((a, b) => {
    if (a === "Sin fecha límite") return 1;
    if (b === "Sin fecha límite") return -1;
    const parseMonth = (s: string) => {
      const parts = s.split(" ");
      const mi = MONTH_NAMES.indexOf(parts[0]);
      return parseInt(parts[1]) * 100 + mi;
    };
    return parseMonth(a) - parseMonth(b);
  });

  // Sort within each group by fit (high first)
  const fitOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

  return (
    <div className="space-y-8">
      {/* Status counters */}
      <div className="flex items-center gap-4 text-xs">
        <span className="font-medium text-gray-700">{opportunities.length} oportunidades</span>
        {Object.entries(statusLabels).map(([key, { label, color }]) => {
          const count = opportunities.filter(o => o.status === key).length;
          return count > 0 ? (
            <span key={key} className={`px-2 py-0.5 rounded-full font-medium ${color}`}>
              {label}: {count}
            </span>
          ) : null;
        })}
      </div>

      {sortedKeys.map((monthKey) => {
        const items = grouped.get(monthKey)!.sort(
          (a, b) => (fitOrder[a.gloria_fit] ?? 9) - (fitOrder[b.gloria_fit] ?? 9)
        );

        return (
          <div key={monthKey}>
            {/* Month header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-sidebar/10 flex items-center justify-center">
                <span className="text-sm font-bold text-sidebar">
                  {monthKey === "Sin fecha límite" ? "?" : monthKey.split(" ")[0].substring(0, 3)}
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">{monthKey}</h3>
                <p className="text-xs text-gray-400">{items.length} oportunidad{items.length !== 1 ? "es" : ""}</p>
              </div>
            </div>

            {/* Cards */}
            <div className="space-y-3 ml-[52px]">
              {items.map((opp) => {
                const fit = fitColors[opp.gloria_fit] || fitColors.medium;
                const st = statusLabels[opp.status] || statusLabels.new;

                // Build fit summary from advantages + approach if no summary field
                const fitSummary = opp.gloria_fit_summary
                  || (opp.approach ? opp.approach : (opp.advantages || []).join(". "));

                const deadlineStr = opp.deadline
                  ? new Date(opp.deadline + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" })
                  : null;

                  const hasCost = opp.registration_cost && opp.registration_cost !== "Gratuito" && opp.registration_cost !== "A confirmar";

                return (
                  <div key={opp.id} className={`bg-white rounded-xl border overflow-hidden hover:shadow-sm transition-shadow ${hasCost ? "border-amber-200" : "border-gray-200"}`}>
                    {/* Cost banner if paid */}
                    {hasCost && (
                      <div className="bg-amber-50 px-5 py-1.5 flex items-center gap-1.5 border-b border-amber-200">
                        <span className="text-amber-600 font-bold text-sm">$</span>
                        <span className="text-xs font-medium text-amber-700">Inscripción: {opp.registration_cost}</span>
                      </div>
                    )}

                    <div className="p-5">
                      {/* Name (clickable) + badges */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          {opp.url && opp.url !== "buscar" ? (
                            <a href={opp.url} target="_blank" rel="noopener noreferrer"
                              className="text-sm font-semibold text-sidebar hover:underline inline-flex items-center gap-1.5">
                              {opp.name} <ExternalLink size={12} />
                            </a>
                          ) : (
                            <h4 className="text-sm font-semibold text-gray-900">{opp.name}</h4>
                          )}
                          <p className="text-xs text-gray-500 mt-0.5">
                            {typeLabels[opp.type] || opp.type}
                            {opp.organizer && ` — ${opp.organizer}`}
                            {opp.location && ` · ${opp.location}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${fit.bg} ${fit.text}`}>
                            {fit.label}
                          </span>
                          <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${st.color}`}>
                            {st.label}
                          </span>
                        </div>
                      </div>

                      {/* Warning if no verified URL */}
                      {!opp.url && (
                        <div className="bg-red-50 text-red-600 text-[10px] font-medium px-3 py-1.5 rounded-lg mb-2">
                          Sin URL verificada — esta oportunidad debe ser validada manualmente
                        </div>
                      )}

                      {/* Info row: deadline + deliverable + indexing + event */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
                        {deadlineStr && (
                          <span><span className="font-medium text-gray-700">Deadline:</span> {deadlineStr}</span>
                        )}
                        {opp.deliverable && (
                          <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-medium">
                            {opp.deliverable}
                          </span>
                        )}
                        {opp.indexing && (
                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                            {opp.indexing}
                          </span>
                        )}
                        {opp.event_date && (
                          <span><span className="font-medium text-gray-700">Evento:</span> {opp.event_date}</span>
                        )}
                        {opp.registration_cost === "Gratuito" && (
                          <span className="text-green-600 font-medium">Gratuito</span>
                        )}
                      </div>

                      {/* Fit + Challenges side by side */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {fitSummary && (
                          <div className="bg-green-50 rounded-lg p-3">
                            <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide mb-1">
                              Por qué GlorIA calza
                            </p>
                            <p className="text-xs text-green-800 leading-relaxed">{fitSummary}</p>
                          </div>
                        )}
                        {opp.weaknesses && opp.weaknesses.length > 0 && (
                          <div className="bg-amber-50 rounded-lg p-3">
                            <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">
                              Desafíos
                            </p>
                            {opp.weaknesses.map((w, i) => (
                              <p key={i} className="text-xs text-amber-800 leading-relaxed">- {w}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ──── Inline Edit Form ────

function EditPaperInline({ paper, onSave, onCancel }: {
  paper: Paper;
  onSave: (id: string, updates: Partial<Paper>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(paper.title);
  const [type, setType] = useState(paper.type);
  const [authors, setAuthors] = useState(paper.authors?.join(", ") || "");
  const [venue, setVenue] = useState(paper.venue || "");
  const [date, setDate] = useState(paper.date || "");
  const [abstract, setAbstract] = useState(paper.abstract || "");
  const [tags, setTags] = useState(paper.tags?.join(", ") || "");

  const handleSave = () => {
    onSave(paper.id, {
      title,
      type,
      authors: authors.split(",").map(a => a.trim()).filter(Boolean),
      venue: venue || null,
      date: date || null,
      abstract: abstract || null,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-medium text-gray-500 mb-1">Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar" />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-500 mb-1">Tipo</label>
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm hover:border-gray-300 cursor-pointer">
            <option value="paper">Paper</option>
            <option value="presentation">Presentación</option>
            <option value="poster">Poster</option>
            <option value="proposal">Propuesta</option>
            <option value="report">Reporte</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-500 mb-1">Autores</label>
          <input value={authors} onChange={(e) => setAuthors(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar" />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Venue</label>
            <input value={venue} onChange={(e) => setVenue(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar" />
          </div>
          <div className="w-24">
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Año</label>
            <input value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar" />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-medium text-gray-500 mb-1">Resumen</label>
        <textarea value={abstract} onChange={(e) => setAbstract(e.target.value)} rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sidebar" />
      </div>
      <div>
        <label className="block text-[10px] font-medium text-gray-500 mb-1">Tags (separados por coma)</label>
        <input value={tags} onChange={(e) => setTags(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar" />
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave}
          className="flex items-center gap-1.5 bg-sidebar text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Check size={14} /> Guardar
        </button>
        <button onClick={onCancel}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-2">
          <X size={14} /> Cancelar
        </button>
      </div>
    </div>
  );
}
