"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  parseSGSFile, SAMPLE_SHORT, KEY_MINERALS, CHART_COLORS,
  type SGSWeekReport, type SheetData,
} from "@/lib/anglo/parse-sgs";

// ═══ Anglo American brand ═══
const AA = {
  navy: "#00205B",
  blue: "#0077C8",
  light: "#E8EFF7",
  bg: "#F7F9FC",
  border: "#D0D9E6",
  muted: "#7A8BA5",
  white: "#FFFFFF",
};

const TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "modal", label: "Modal" },
  { key: "cuDep", label: "Cu Deportment" },
  { key: "ccpLib", label: "Lib. Ccp" },
  { key: "moLib", label: "Lib. Mo" },
  { key: "cuSulphLib", label: "Lib. CuSulph" },
  { key: "grainMo", label: "Grano Mo" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const tooltipStyle = {
  backgroundColor: AA.white,
  border: `1px solid ${AA.border}`,
  borderRadius: "8px",
  fontSize: 11,
  color: AA.navy,
};

function getSheetData(r: SGSWeekReport, tab: TabKey): SheetData {
  switch (tab) {
    case "modal": return r.modal;
    case "cuDep": return r.cuDeportAbs;
    case "ccpLib": return r.ccpLibPct;
    case "moLib": return r.moLibPct;
    case "cuSulphLib": return r.cuSulphLibPct;
    case "grainMo": return r.grainSizeMoCum;
    default: return r.modal;
  }
}

function getTabUnit(tab: TabKey): string {
  if (tab === "ccpLib" || tab === "moLib" || tab === "cuSulphLib" || tab === "grainMo") return "%";
  return "wt%";
}

// ═══ Normalize to base 100 ═══
function normalizeSheet(data: SheetData, sampleIdx: number): Record<string, number> {
  const result: Record<string, number> = {};
  let total = 0;
  for (const [k, vals] of Object.entries(data)) {
    if (k === "Total" || k === "Others") continue;
    const v = vals[sampleIdx] ?? 0;
    total += v;
  }
  if (total === 0) return result;
  for (const [k, vals] of Object.entries(data)) {
    if (k === "Total" || k === "Others") continue;
    result[k] = ((vals[sampleIdx] ?? 0) / total) * 100;
  }
  return result;
}

// ═══ Main Component ═══
export default function AngloPage() {
  const [reports, setReports] = useState<SGSWeekReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [tab, setTab] = useState<TabKey>("resumen");
  const [sampleIdx, setSampleIdx] = useState(0);
  const [selectedMinerals, setSelectedMinerals] = useState<string[]>(KEY_MINERALS);
  const [dragOver, setDragOver] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sorted = useMemo(() => [...reports].sort((a, b) => a.weekNumber - b.weekNumber), [reports]);

  const allMinerals = useMemo(() => {
    const set = new Set<string>();
    for (const r of sorted) {
      const data = getSheetData(r, tab === "resumen" ? "modal" : tab);
      Object.keys(data).forEach((k) => {
        if (k !== "Total" && k !== "Others") set.add(k);
      });
    }
    return Array.from(set);
  }, [sorted, tab]);

  // ═══ File handling ═══
  const processFiles = useCallback(async (files: FileList | File[]) => {
    setLoading(true);
    const newErrors: string[] = [];
    const newReports: SGSWeekReport[] = [];
    for (const file of Array.from(files)) {
      if (!file.name.endsWith(".xlsx")) { newErrors.push(`${file.name}: no es .xlsx`); continue; }
      try {
        const buffer = await file.arrayBuffer();
        const report = parseSGSFile(buffer, file.name);
        const exists = reports.some((r) => r.weekLabel === report.weekLabel && r.plant === report.plant);
        if (exists) newErrors.push(`${file.name}: ya cargado (${report.weekLabel} ${report.plant})`);
        else newReports.push(report);
      } catch (e) {
        newErrors.push(`${file.name}: error - ${e instanceof Error ? e.message : "desconocido"}`);
      }
    }
    setReports((prev) => [...prev, ...newReports]);
    setErrors((prev) => [...prev, ...newErrors]);
    setLoading(false);
  }, [reports]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  // ═══ Chart data (base 100) ═══
  const chartData = useMemo(() => {
    if (sorted.length === 0) return [];
    const minerals = tab === "resumen" ? KEY_MINERALS : selectedMinerals;
    return sorted.map((r) => {
      const raw = getSheetData(r, tab === "resumen" ? "modal" : tab);
      const norm = normalizeSheet(raw, sampleIdx);
      const point: Record<string, number | string> = {
        week: `S${String(r.weekNumber).padStart(2, "0")}`,
      };
      for (const m of minerals) {
        point[m] = norm[m] ?? 0;
      }
      return point;
    });
  }, [sorted, tab, sampleIdx, selectedMinerals]);

  // ═══ KPIs (base 100) ═══
  const kpis = useMemo(() => {
    if (sorted.length < 2) return [];
    const latest = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const items = [
      { mineral: "Chalcopyrite", label: "Calcopirita" },
      { mineral: "Pyrite", label: "Pirita" },
      { mineral: "Gypsum/Anhydrite", label: "Gypsum" },
      { mineral: "Molybdenite", label: "Molibdenita" },
    ];
    const normL = normalizeSheet(latest.modal, sampleIdx);
    const normP = normalizeSheet(prev.modal, sampleIdx);
    return items.map((item) => {
      const v = normL[item.mineral] ?? 0;
      const vPrev = normP[item.mineral] ?? 0;
      const delta = vPrev > 0.0001 ? ((v - vPrev) / vPrev) * 100 : 0;
      return { ...item, v, vPrev, delta };
    });
  }, [sorted, sampleIdx]);

  // ═══ Multi-scale axis ═══
  const axisGroups = useMemo(() => {
    const minerals = tab === "resumen" ? KEY_MINERALS : selectedMinerals;
    if (sorted.length === 0 || minerals.length === 0) return { left: minerals, right: [] as string[] };
    const maxVals: Record<string, number> = {};
    for (const m of minerals) {
      let mx = 0;
      for (const pt of chartData) {
        const v = typeof pt[m] === "number" ? (pt[m] as number) : 0;
        if (v > mx) mx = v;
      }
      maxVals[m] = mx;
    }
    const vals = Object.values(maxVals).filter((v) => v > 0).sort((a, b) => a - b);
    if (vals.length < 2) return { left: minerals, right: [] as string[] };
    const ratio = vals[vals.length - 1] / vals[0];
    if (ratio < 10) return { left: minerals, right: [] as string[] };
    const geoMean = Math.sqrt(vals[0] * vals[vals.length - 1]);
    const left = minerals.filter((m) => maxVals[m] >= geoMean);
    const right = minerals.filter((m) => maxVals[m] < geoMean);
    if (left.length === 0 || right.length === 0) return { left: minerals, right: [] as string[] };
    return { left, right };
  }, [chartData, tab, selectedMinerals, sorted.length]);

  const hasRightAxis = axisGroups.right.length > 0;

  const toggleMineral = (m: string) => {
    setSelectedMinerals((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  };
  const removeReport = (idx: number) => { setReports((prev) => prev.filter((_, i) => i !== idx)); };

  // ═══ Infographic generator (server-side API) ═══
  const generateInfographic = async () => {
    if (sorted.length < 2) return;
    setGenLoading(true);
    try {
      const latest = sorted[sorted.length - 1];
      const prev = sorted[sorted.length - 2];
      const normL = normalizeSheet(latest.modal, sampleIdx);
      const normP = normalizeSheet(prev.modal, sampleIdx);
      const sample = SAMPLE_SHORT[sampleIdx];

      const lines: string[] = [];
      for (const m of KEY_MINERALS) {
        const vL = normL[m] ?? 0;
        const vP = normP[m] ?? 0;
        const d = vP > 0.001 ? ((vL - vP) / vP * 100).toFixed(1) : "N/A";
        lines.push(`- ${m}: ${vP.toFixed(2)}% -> ${vL.toFixed(2)}% (${d}%)`);
      }

      const prompt = `Crea una infografia profesional tipo dashboard ejecutivo. Titulo: "Los Bronces - Comparacion Mineralogica (Base 100)". Estilo: fondo blanco, texto azul marino (#00205B), acentos azul (#0077C8), alertas rojo (#D32F2F), positivos verde (#2E7D32). Sans-serif.\n\nMuestra: ${sample} | S${String(prev.weekNumber).padStart(2,"0")} vs S${String(latest.weekNumber).padStart(2,"0")} | ${latest.plant}\n\nDatos (base 100):\n${lines.join("\n")}\n\nTarjetas KPI grandes, flechas, bordes rojos >20%. Pie: "SGS Mineralogy | Proyecto 295511 | Anglo American"`;

      const res = await fetch("/api/anglo/infographic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) throw new Error("API error");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Infografia_LB_${sample}_S${prev.weekNumber}_vs_S${latest.weekNumber}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Error al generar. Descarga el prompt y p\u00e9galo en Google Gemini.");
    }
    setGenLoading(false);
  };

  // ═══ Download prompt for Nano Banana ═══
  const downloadPrompt = () => {
    if (sorted.length < 2) return;
    const latest = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const normL = normalizeSheet(latest.modal, sampleIdx);
    const normP = normalizeSheet(prev.modal, sampleIdx);
    const sample = SAMPLE_SHORT[sampleIdx];
    const lines: string[] = [];
    for (const m of KEY_MINERALS) {
      const vL = normL[m] ?? 0;
      const vP = normP[m] ?? 0;
      const d = vP > 0.001 ? ((vL - vP) / vP * 100).toFixed(1) : "N/A";
      lines.push(`- ${m}: ${vP.toFixed(2)}% -> ${vL.toFixed(2)}% (${d}%)`);
    }
    const prompt = `Crea una infografia profesional tipo dashboard ejecutivo con el titulo "Los Bronces - Comparacion Mineralogica (Base 100)".

Estilo: corporativo, fondo blanco, texto azul marino (#00205B), acentos azul (#0077C8), alertas rojo (#D32F2F), positivos verde (#2E7D32). Sans-serif. Layout vertical.

Muestra: ${sample}
Semanas: S${String(prev.weekNumber).padStart(2,"0")} vs S${String(latest.weekNumber).padStart(2,"0")}
Planta: ${latest.plant}
Datos normalizados (base 100):
${lines.join("\n")}

Incluye tarjetas KPI grandes con flechas de tendencia, bordes rojos en cambios criticos (>20%), y pie: "Fuente: SGS Mineralogy | Proyecto 295511 | Anglo American"`;

    const blob = new Blob([prompt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prompt-infografia-anglo.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ═══ RENDER ═══
  return (
    <div className="min-h-screen" style={{ backgroundColor: AA.bg, color: AA.navy }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">

        {/* Header */}
        <header className="text-center space-y-1 pb-4" style={{ borderBottom: `2px solid ${AA.blue}` }}>
          <p className="text-[10px] uppercase tracking-[0.3em] font-medium" style={{ color: AA.blue }}>
            Proyecto 295511 &middot; SGS Mineralogy &middot; Anglo American
          </p>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: AA.navy }}>
            Los Bronces &mdash; An&aacute;lisis Mineral&oacute;gico Longitudinal
          </h1>
          <p className="text-xs" style={{ color: AA.muted }}>Datos normalizados base 100</p>
        </header>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="rounded-xl p-8 text-center cursor-pointer transition-colors border-2 border-dashed"
          style={{
            borderColor: dragOver ? AA.blue : AA.border,
            backgroundColor: dragOver ? AA.light : AA.white,
          }}
        >
          <input ref={inputRef} type="file" accept=".xlsx" multiple className="hidden" onChange={(e) => e.target.files && processFiles(e.target.files)} />
          <p className="text-sm" style={{ color: AA.muted }}>
            {loading ? "Procesando archivos..." : "Arrastra archivos .xlsx aqu\u00ed o haz clic para seleccionar"}
          </p>
          <p className="text-[10px] mt-1" style={{ color: AA.border }}>Reportes SGS semanales</p>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            {errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            <button onClick={() => setErrors([])} className="text-[10px] text-red-400 underline mt-1">Limpiar</button>
          </div>
        )}

        {/* Loaded files */}
        {reports.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sorted.map((r) => (
              <div key={r.weekLabel + r.plant} className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ backgroundColor: AA.light, border: `1px solid ${AA.border}` }}>
                <div>
                  <p className="text-xs font-semibold" style={{ color: AA.navy }}>S{String(r.weekNumber).padStart(2, "0")}</p>
                  <p className="text-[9px]" style={{ color: AA.muted }}>{r.batch} &middot; {r.plant} &middot; {r.sampleCount}m</p>
                </div>
                <button onClick={() => removeReport(reports.indexOf(r))} className="text-red-300 hover:text-red-500 text-xs">&times;</button>
              </div>
            ))}
          </div>
        )}

        {sorted.length >= 1 && (
          <>
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-4 rounded-xl p-4" style={{ backgroundColor: AA.white, border: `1px solid ${AA.border}` }}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase" style={{ color: AA.muted }}>Muestra:</span>
                <div className="flex gap-1">
                  {SAMPLE_SHORT.map((s, i) => (
                    <button key={s} onClick={() => setSampleIdx(i)}
                      className="text-xs px-2.5 py-1 rounded-lg transition-colors font-medium"
                      style={{
                        backgroundColor: sampleIdx === i ? AA.blue : AA.light,
                        color: sampleIdx === i ? AA.white : AA.navy,
                      }}
                    >{s}</button>
                  ))}
                </div>
              </div>
              {/* Infographic buttons */}
              {sorted.length >= 2 && (
                <div className="flex gap-2 ml-auto">
                  <button onClick={downloadPrompt}
                    className="text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors"
                    style={{ backgroundColor: AA.light, color: AA.blue, border: `1px solid ${AA.border}` }}
                  >
                    Descargar prompt
                  </button>
                  <button onClick={generateInfographic} disabled={genLoading}
                    className="text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                    style={{ backgroundColor: AA.navy, color: AA.white }}
                  >
                    {genLoading ? "Generando..." : "Generar infograf\u00eda"}
                  </button>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className="text-xs px-4 py-2 rounded-lg whitespace-nowrap transition-colors font-medium"
                  style={{
                    backgroundColor: tab === t.key ? AA.navy : AA.white,
                    color: tab === t.key ? AA.white : AA.muted,
                    border: `1px solid ${tab === t.key ? AA.navy : AA.border}`,
                  }}
                >{t.label}</button>
              ))}
            </div>

            {/* ═══ RESUMEN ═══ */}
            {tab === "resumen" && (
              <div className="space-y-6">
                {kpis.length > 0 && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {kpis.map((k) => {
                      const critical = Math.abs(k.delta) > 20;
                      const positive = k.delta > 0 && k.mineral === "Chalcopyrite";
                      const arrow = k.delta >= 0 ? "\u2191" : "\u2193";
                      return (
                        <div key={k.mineral} className="rounded-xl p-4"
                          style={{ backgroundColor: AA.white, border: `2px solid ${critical ? "#D32F2F" : AA.border}` }}>
                          <p className="text-[10px] uppercase tracking-wider" style={{ color: AA.muted }}>{k.label} ({SAMPLE_SHORT[sampleIdx]})</p>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-lg font-bold" style={{ color: AA.navy }}>{k.vPrev.toFixed(2)}%</span>
                            <span style={{ color: AA.border }}>&rarr;</span>
                            <span className="text-lg font-bold" style={{ color: AA.navy }}>{k.v.toFixed(2)}%</span>
                          </div>
                          <p className="text-sm font-semibold mt-1" style={{ color: positive ? "#2E7D32" : critical ? "#D32F2F" : "#E65100" }}>
                            {arrow} {k.delta.toFixed(1)}%
                            {critical && <span className="ml-2 text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">ALERTA</span>}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Chart */}
                <div className="rounded-xl p-4" style={{ backgroundColor: AA.white, border: `1px solid ${AA.border}` }}>
                  <p className="text-xs mb-1" style={{ color: AA.muted }}>Tendencia Minerales Clave &mdash; {SAMPLE_SHORT[sampleIdx]} (base 100)</p>
                  {hasRightAxis && (
                    <p className="text-[10px] mb-3" style={{ color: AA.border }}>
                      Eje izq: {axisGroups.left.join(", ")} &middot; Eje der: {axisGroups.right.join(", ")}
                    </p>
                  )}
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={AA.border} />
                      <XAxis dataKey="week" tick={{ fill: AA.muted, fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fill: AA.muted, fontSize: 11 }} />
                      {hasRightAxis && <YAxis yAxisId="right" orientation="right" tick={{ fill: AA.border, fontSize: 11 }} />}
                      <Tooltip contentStyle={tooltipStyle} formatter={(value) => typeof value === "number" ? value.toFixed(3) : value} />
                      <Legend wrapperStyle={{ fontSize: 11, color: AA.navy }} />
                      {KEY_MINERALS.map((m, i) => {
                        const isRight = axisGroups.right.includes(m);
                        return (
                          <Line key={m} type="monotone" dataKey={m} yAxisId={isRight ? "right" : "left"}
                            stroke={CHART_COLORS[i]} strokeWidth={2} strokeDasharray={isRight ? "6 3" : undefined} dot={{ r: 4 }} />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Table */}
                <div className="rounded-xl p-4 overflow-x-auto" style={{ backgroundColor: AA.white, border: `1px solid ${AA.border}` }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${AA.blue}` }}>
                        <th className="text-left pb-2 pr-4" style={{ color: AA.muted }}>Mineral</th>
                        {sorted.map((r) => (
                          <th key={r.weekLabel} className="text-center pb-2 px-2" style={{ color: AA.muted }}>S{String(r.weekNumber).padStart(2, "0")}</th>
                        ))}
                        {sorted.length >= 2 && <th className="text-center pb-2 px-2" style={{ color: AA.muted }}>&Delta;%</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {KEY_MINERALS.map((m) => {
                        const vals = sorted.map((r) => normalizeSheet(r.modal, sampleIdx)[m] ?? 0);
                        const last = vals[vals.length - 1];
                        const prevV = vals.length >= 2 ? vals[vals.length - 2] : 0;
                        const delta = prevV > 0.0001 ? ((last - prevV) / prevV) * 100 : 0;
                        const critical = Math.abs(delta) > 20;
                        return (
                          <tr key={m} style={{ backgroundColor: critical ? "#FFF5F5" : undefined, borderBottom: `1px solid ${AA.light}` }}>
                            <td className="py-1.5 pr-4 font-medium" style={{ color: AA.navy }}>{m}</td>
                            {vals.map((v, i) => (
                              <td key={i} className="text-center py-1.5 px-2" style={{ color: AA.muted }}>{v.toFixed(3)}</td>
                            ))}
                            {sorted.length >= 2 && (
                              <td className="text-center font-semibold py-1.5 px-2"
                                style={{ color: critical ? "#D32F2F" : Math.abs(delta) > 5 ? "#E65100" : AA.muted }}>
                                {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ═══ GENERIC TAB ═══ */}
            {tab !== "resumen" && (
              <div className="space-y-4">
                {/* Mineral selector */}
                <div className="rounded-xl p-3" style={{ backgroundColor: AA.white, border: `1px solid ${AA.border}` }}>
                  <p className="text-[10px] uppercase mb-2" style={{ color: AA.muted }}>Seleccionar minerales:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {allMinerals.map((m) => (
                      <button key={m} onClick={() => toggleMineral(m)}
                        className="text-[10px] px-2 py-1 rounded transition-colors"
                        style={{
                          backgroundColor: selectedMinerals.includes(m) ? AA.light : AA.bg,
                          color: selectedMinerals.includes(m) ? AA.blue : AA.muted,
                          border: `1px solid ${selectedMinerals.includes(m) ? AA.blue : AA.border}`,
                        }}
                      >{m}</button>
                    ))}
                    <button onClick={() => setSelectedMinerals(allMinerals)} className="text-[10px] underline ml-2" style={{ color: AA.blue }}>Todos</button>
                    <button onClick={() => setSelectedMinerals([])} className="text-[10px] underline" style={{ color: AA.muted }}>Ninguno</button>
                  </div>
                </div>

                {/* Chart */}
                <div className="rounded-xl p-4" style={{ backgroundColor: AA.white, border: `1px solid ${AA.border}` }}>
                  <p className="text-xs mb-1" style={{ color: AA.muted }}>
                    {TABS.find((t) => t.key === tab)?.label} &mdash; {SAMPLE_SHORT[sampleIdx]} (base 100)
                  </p>
                  {hasRightAxis && (
                    <p className="text-[10px] mb-3" style={{ color: AA.border }}>
                      Eje izq: {axisGroups.left.join(", ")} &middot; Eje der (- - -): {axisGroups.right.join(", ")}
                    </p>
                  )}
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={AA.border} />
                      <XAxis dataKey="week" tick={{ fill: AA.muted, fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fill: AA.muted, fontSize: 11 }} />
                      {hasRightAxis && <YAxis yAxisId="right" orientation="right" tick={{ fill: AA.border, fontSize: 11 }} />}
                      <Tooltip contentStyle={tooltipStyle} formatter={(value) => typeof value === "number" ? value.toFixed(3) : value} />
                      <Legend wrapperStyle={{ fontSize: 10, color: AA.navy }} />
                      {selectedMinerals.map((m, i) => {
                        const isRight = axisGroups.right.includes(m);
                        return (
                          <Line key={m} type="monotone" dataKey={m} yAxisId={isRight ? "right" : "left"}
                            stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2}
                            strokeDasharray={isRight ? "6 3" : undefined} dot={{ r: 3 }} />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Table */}
                <div className="rounded-xl p-4 overflow-x-auto" style={{ backgroundColor: AA.white, border: `1px solid ${AA.border}` }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${AA.blue}` }}>
                        <th className="text-left pb-2 pr-4" style={{ color: AA.muted }}>Mineral</th>
                        {sorted.map((r) => (
                          <th key={r.weekLabel} className="text-center pb-2 px-2" style={{ color: AA.muted }}>S{String(r.weekNumber).padStart(2, "0")}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMinerals.map((m) => {
                        const data = sorted.map((r) => normalizeSheet(getSheetData(r, tab), sampleIdx)[m] ?? 0);
                        const isRight = axisGroups.right.includes(m);
                        return (
                          <tr key={m} style={{ borderBottom: `1px solid ${AA.light}` }}>
                            <td className="py-1.5 pr-4 font-medium" style={{ color: AA.navy }}>
                              {m}
                              {hasRightAxis && <span className="text-[9px] ml-1" style={{ color: AA.border }}>{isRight ? "(der)" : "(izq)"}</span>}
                            </td>
                            {data.map((v, i) => (
                              <td key={i} className="text-center py-1.5 px-2" style={{ color: AA.muted }}>
                                {v.toFixed(3)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {reports.length === 0 && !loading && (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: AA.border }}>Carga al menos un reporte SGS para comenzar</p>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center pt-4" style={{ borderTop: `1px solid ${AA.border}` }}>
          <p className="text-[10px]" style={{ color: AA.border }}>SGS Mineralogy &middot; Proyecto 295511 &middot; Anglo American</p>
        </footer>
      </div>
    </div>
  );
}
