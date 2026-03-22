"use client";

import { useState, useEffect } from "react";
import { Loader2, DollarSign, MessageSquare, Brain, Search, FileText, Image } from "lucide-react";

interface Establishment {
  id: string;
  name: string;
  country: string;
}

interface CostData {
  period: { from: string; to: string };
  counts: {
    chatMessages: number;
    userMessages: number;
    evaluations: number;
    researchScans: number;
    papersAnalyzed: number;
    totalPatients: number;
  };
  costs: {
    chat: number;
    classification: number;
    evaluation: number;
    research: number;
    papers: number;
    assets: number;
    total: number;
  };
  breakdown: { name: string; country: string; messages: number; cost: number }[];
}

const countryFlags: Record<string, string> = {
  "Chile": "/flags/cl.png",
  "Perú": "/flags/pe.png",
  "Colombia": "/flags/co.png",
  "México": "/flags/mx.png",
  "Argentina": "/flags/ar.png",
  "República Dominicana": "/flags/do.png",
};

export default function CostosClient({ establishments }: { establishments: Establishment[] }) {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);

  // Default: last 30 days
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [country, setCountry] = useState("all");
  const [establishment, setEstablishment] = useState("all");

  const countries = [...new Set(establishments.map(e => e.country))].sort();

  const loadCosts = async () => {
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    if (country !== "all") params.set("country", country);
    if (establishment !== "all") params.set("establishment", establishment);

    const res = await fetch(`/api/admin/costs?${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  };

  useEffect(() => { loadCosts(); }, [from, to, country, establishment]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const totalBreakdown = data?.breakdown.reduce((s, b) => s + b.cost, 0) || 0;

  return (
    <div className="min-h-screen">
      <header className="px-4 sm:px-8 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Costos estimados</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Estimación de consumo de APIs basado en interacciones de la plataforma
        </p>
      </header>

      <div className="px-4 sm:px-8 pb-8">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Desde:</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Hasta:</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white" />
          </div>
          <select value={country} onChange={(e) => { setCountry(e.target.value); setEstablishment("all"); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white hover:border-gray-300 cursor-pointer">
            <option value="all">Todos los países</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={establishment} onChange={(e) => setEstablishment(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white hover:border-gray-300 cursor-pointer">
            <option value="all">Todas las instituciones</option>
            {establishments
              .filter(e => country === "all" || e.country === country)
              .map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-sidebar" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Total */}
            <div className="bg-gradient-to-r from-sidebar to-[#354080] rounded-2xl p-6 text-white">
              <p className="text-white/60 text-sm">Costo total estimado del período</p>
              <p className="text-4xl font-bold mt-1">{fmt(data.costs.total)} USD</p>
              <p className="text-white/50 text-xs mt-2">
                {data.period.from} — {data.period.to}
              </p>
            </div>

            {/* Cost breakdown cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <CostCard icon={<MessageSquare size={18} />} label="Chat IA" amount={data.costs.chat}
                detail={`${data.counts.chatMessages.toLocaleString()} mensajes`} color="bg-blue-50 text-blue-700" />
              <CostCard icon={<Brain size={18} />} label="Evaluaciones" amount={data.costs.evaluation}
                detail={`${data.counts.evaluations} evaluaciones`} color="bg-purple-50 text-purple-700" />
              <CostCard icon={<MessageSquare size={18} />} label="Clasificación" amount={data.costs.classification}
                detail={`${data.counts.userMessages.toLocaleString()} clasificaciones`} color="bg-teal-50 text-teal-700" />
              <CostCard icon={<Search size={18} />} label="Investigación" amount={data.costs.research}
                detail={`${data.counts.researchScans} escaneos`} color="bg-amber-50 text-amber-700" />
              <CostCard icon={<FileText size={18} />} label="Análisis PDFs" amount={data.costs.papers}
                detail={`${data.counts.papersAnalyzed} documentos`} color="bg-green-50 text-green-700" />
            </div>

            {/* Assets cost (one-time) */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <Image size={18} className="text-gray-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Generación de imágenes y videos (costo único)</p>
                <p className="text-xs text-gray-400">{data.counts.totalPatients} pacientes activos</p>
              </div>
              <p className="text-lg font-bold text-gray-900">{fmt(data.costs.assets)}</p>
            </div>

            {/* Breakdown by institution */}
            {data.breakdown.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Desglose por institución</h3>
                <div className="space-y-3">
                  {data.breakdown.map((b, i) => {
                    const pct = totalBreakdown > 0 ? (b.cost / totalBreakdown) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        {countryFlags[b.country] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={countryFlags[b.country]} alt="" className="w-5 h-5 rounded-full object-cover" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-gray-800 truncate">{b.name}</p>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-gray-500">{b.messages.toLocaleString()} msgs</span>
                              <span className="font-bold text-gray-900">{fmt(b.cost)}</span>
                              <span className="text-gray-400 w-10 text-right">{pct.toFixed(0)}%</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="bg-sidebar h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Projection */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 text-center">
              <p className="text-xs text-gray-500">Proyección mensual basada en la tendencia actual</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                ~{fmt(data.costs.total * (30 / Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000))))} USD/mes
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CostCard({ icon, label, amount, detail, color }: {
  icon: React.ReactNode; label: string; amount: number; detail: string; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-xl font-bold text-gray-900">${amount.toFixed(2)}</p>
      <p className="text-xs font-medium text-gray-700 mt-0.5">{label}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{detail}</p>
    </div>
  );
}
