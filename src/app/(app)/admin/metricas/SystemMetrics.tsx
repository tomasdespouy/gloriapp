"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity, AlertTriangle, Clock, Zap, MessageSquare,
  CheckCircle2, XCircle, Server,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type SystemData = {
  range: string;
  health: string;
  summary: {
    totalMessages: number;
    totalErrors: number;
    errorRate: string;
    avgLatencyMs: number;
    avgResponseWords: number;
    p95LatencyMs: number;
  };
  interventionCounts: Record<string, number>;
  latencyTrend: { hour: string; avgMs: number; count: number }[];
};

const INTERVENTION_LABELS: Record<string, string> = {
  pregunta_abierta: "Pregunta abierta",
  pregunta_cerrada: "Pregunta cerrada",
  validacion_empatica: "Validacion empatica",
  reformulacion: "Reformulacion",
  confrontacion: "Confrontacion",
  silencio_terapeutico: "Silencio",
  directividad: "Directividad",
  interpretacion: "Interpretacion",
  normalizacion: "Normalizacion",
  resumen: "Resumen",
  otro: "Otro",
};

export default function SystemMetrics() {
  const [data, setData] = useState<SystemData | null>(null);
  const [range, setRange] = useState("24h");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/metrics/system?range=" + range);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [range]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="text-center py-12 text-gray-400 text-sm">Cargando metricas del sistema...</div>;
  if (!data) return <div className="text-center py-12 text-gray-400 text-sm">Error al cargar</div>;

  const interventionData = Object.entries(data.interventionCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([key, count]) => ({ name: INTERVENTION_LABELS[key] || key, count }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server size={18} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Metricas del sistema</span>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {["24h", "7d", "30d"].map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${range === r ? "bg-white text-sidebar shadow-sm" : "text-gray-500"}`}>
              {r === "24h" ? "24 horas" : r === "7d" ? "7 dias" : "30 dias"}
            </button>
          ))}
        </div>
      </div>

      {/* Health + KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Health */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            {data.health === "healthy"
              ? <CheckCircle2 size={18} className="text-green-500" />
              : <XCircle size={18} className="text-red-500" />}
            <span className={`text-xs font-bold uppercase ${data.health === "healthy" ? "text-green-600" : "text-red-600"}`}>
              {data.health === "healthy" ? "Saludable" : "Degradado"}
            </span>
          </div>
          <p className="text-[10px] text-gray-400">Estado del sistema</p>
        </div>

        {/* Total messages */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{data.summary.totalMessages}</p>
          <p className="text-[10px] text-gray-400">Mensajes procesados</p>
        </div>

        {/* Avg latency */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className={`text-2xl font-bold ${data.summary.avgLatencyMs < 3000 ? "text-green-600" : data.summary.avgLatencyMs < 5000 ? "text-amber-600" : "text-red-600"}`}>
            {(data.summary.avgLatencyMs / 1000).toFixed(1)}s
          </p>
          <p className="text-[10px] text-gray-400">Latencia promedio</p>
        </div>

        {/* P95 latency */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{(data.summary.p95LatencyMs / 1000).toFixed(1)}s</p>
          <p className="text-[10px] text-gray-400">Latencia P95</p>
        </div>

        {/* Error rate */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className={`text-2xl font-bold ${parseFloat(data.summary.errorRate) < 1 ? "text-green-600" : "text-red-600"}`}>
            {data.summary.errorRate}
          </p>
          <p className="text-[10px] text-gray-400">Tasa de error</p>
        </div>

        {/* Avg words */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{data.summary.avgResponseWords}</p>
          <p className="text-[10px] text-gray-400">Palabras prom. respuesta</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latency trend */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Clock size={16} className="text-sidebar" /> Latencia por hora
          </h3>
          {data.latencyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.latencyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} unit="ms" />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="avgMs" stroke="#4A55A2" strokeWidth={2} dot={false} name="Latencia (ms)" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-gray-400 text-center py-8">Sin datos en este rango</p>
          )}
        </div>

        {/* Intervention distribution */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <MessageSquare size={16} className="text-sidebar" /> Tipos de intervencion
          </h3>
          {interventionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={interventionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 9 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={120} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" fill="#4A55A2" radius={[0, 4, 4, 0]} name="Cantidad" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-gray-400 text-center py-8">Sin datos</p>
          )}
        </div>
      </div>

      {/* Errors */}
      {data.summary.totalErrors > 0 && (
        <div className="bg-red-50 rounded-2xl border border-red-200 p-5">
          <h3 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
            <AlertTriangle size={16} /> {data.summary.totalErrors} errores en el periodo
          </h3>
          <p className="text-xs text-red-600">Revisa los logs del servidor para detalles.</p>
        </div>
      )}
    </div>
  );
}
