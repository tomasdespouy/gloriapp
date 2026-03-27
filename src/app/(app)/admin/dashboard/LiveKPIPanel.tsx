"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Wifi, MessageCircle, Timer, Zap, Info } from "lucide-react";

const POLL_INTERVAL = 300_000; // 5 minutes
const MAX_POINTS = 12; // 12 points × 5min = 1 hour of history

type LiveSnapshot = {
  ts: number;
  latencyMs: number;
  onlineNow: number;
  inSession: number;
  platformMinutesToday: number;
};

type MetricConfig = {
  key: keyof Omit<LiveSnapshot, "ts">;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  format: (v: number) => string;
  unit: string;
  tooltip: string;
};

const METRICS: MetricConfig[] = [
  {
    key: "latencyMs",
    label: "Latencia DB",
    icon: Zap,
    color: "amber",
    format: (v) => `${v}`,
    unit: "ms",
    tooltip:
      "Tiempo de respuesta de la base de datos Supabase. Se actualiza cada 5 minutos.",
  },
  {
    key: "onlineNow",
    label: "Conectados",
    icon: Wifi,
    color: "green",
    format: (v) => `${v}`,
    unit: "",
    tooltip:
      "Usuarios cuya última actividad fue hace menos de 2 minutos. Se actualiza cada 5 minutos.",
  },
  {
    key: "inSession",
    label: "En sesión",
    icon: MessageCircle,
    color: "blue",
    format: (v) => `${v}`,
    unit: "",
    tooltip:
      "Estudiantes conectados que tienen al menos una conversación activa con un paciente IA.",
  },
  {
    key: "platformMinutesToday",
    label: "T. plataforma hoy",
    icon: Timer,
    color: "cyan",
    format: (v) => `${v}`,
    unit: "min",
    tooltip:
      "Minutos totales acumulados en la plataforma hoy por todos los usuarios.",
  },
];

const SPARK_COLORS: Record<
  string,
  { stroke: string; fill: string; dot: string; bg: string; text: string; aliveBg: string }
> = {
  amber: { stroke: "#f59e0b", fill: "rgba(245,158,11,0.15)", dot: "#f59e0b", bg: "bg-amber-50", text: "text-amber-500", aliveBg: "bg-amber-50" },
  green: { stroke: "#22c55e", fill: "rgba(34,197,94,0.15)", dot: "#22c55e", bg: "bg-green-50", text: "text-green-500", aliveBg: "bg-green-50" },
  blue: { stroke: "#3b82f6", fill: "rgba(59,130,246,0.15)", dot: "#3b82f6", bg: "bg-blue-50", text: "text-blue-500", aliveBg: "bg-blue-50" },
  cyan: { stroke: "#06b6d4", fill: "rgba(6,182,212,0.15)", dot: "#06b6d4", bg: "bg-cyan-50", text: "text-cyan-500", aliveBg: "bg-cyan-50" },
};

/* ─── Sparkline SVG ─── */

function Sparkline({
  data,
  color,
  width = 140,
  height = 32,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const c = SPARK_COLORS[color] || SPARK_COLORS.blue;

  if (data.length === 0) {
    return (
      <svg width={width} height={height} className="opacity-30">
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={c.stroke} strokeWidth={1} strokeDasharray="4 4" />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padY = 4;
  const usableH = height - padY * 2;

  const step = width / (MAX_POINTS - 1);
  const offset = MAX_POINTS - data.length;

  const points = data.map((v, i) => {
    const x = (offset + i) * step;
    const y = padY + usableH - ((v - min) / range) * usableH;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;
  const lastPt = points[points.length - 1];

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={areaPath} fill={c.fill} />
      <path d={linePath} fill="none" stroke={c.stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPt.x} cy={lastPt.y} r={3} fill={c.dot} />
      <circle cx={lastPt.x} cy={lastPt.y} r={5} fill={c.dot} opacity={0.3}>
        <animate attributeName="r" from="3" to="8" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ─── Live KPI Card ─── */

function LiveKPICard({
  metric,
  history,
  current,
}: {
  metric: MetricConfig;
  history: number[];
  current: number | null;
}) {
  const c = SPARK_COLORS[metric.color] || SPARK_COLORS.blue;
  const Icon = metric.icon;
  const alive = current !== null && current > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3.5">
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center relative`}>
          {alive && <span className={`absolute inset-0 rounded-lg ${c.aliveBg} animate-kpi-alive`} />}
          <Icon size={13} className={`${c.text} relative`} />
        </div>
        {current !== null && history.length > 1 && (
          <span className="text-[9px] text-gray-300 ml-auto">
            {Math.round((history.length * POLL_INTERVAL) / 60_000)}m
          </span>
        )}
      </div>
      <p className="text-lg font-bold text-gray-900 leading-tight">
        {current !== null ? metric.format(current) : "—"}
        {metric.unit && (
          <span className="text-xs font-normal text-gray-400 ml-0.5">
            {metric.unit}
          </span>
        )}
      </p>
      <div className="flex items-center gap-1 mt-0.5 mb-2">
        <p className="text-[10px] text-gray-500">{metric.label}</p>
        <InfoTip text={metric.tooltip} />
      </div>
      <Sparkline data={history} color={metric.color} />
      {history.length > 1 && (
        <div className="flex justify-between mt-1">
          <span className="text-[8px] text-gray-300">
            -{Math.round(((history.length - 1) * POLL_INTERVAL) / 60_000)}m
          </span>
          <span className="text-[8px] text-gray-300">ahora</span>
        </div>
      )}
    </div>
  );
}

/* ─── System Status (polls /api/health every 60s — the only truly live element) ─── */

function SystemStatusMini() {
  const [dbMs, setDbMs] = useState<number | null>(null);
  const [ok, setOk] = useState(true);
  const [label, setLabel] = useState("Verificando...");

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (!res.ok) {
          if (mounted) { setOk(false); setLabel("Sin conexión"); }
          return;
        }
        const data = await res.json();
        if (!mounted) return;
        setOk(data.status === "healthy");
        setLabel(
          data.status === "healthy"
            ? "Operativo"
            : data.status === "warning"
              ? "Latencia alta"
              : "Con problemas"
        );
        setDbMs(data.checks?.database?.ms ?? null);
      } catch {
        if (mounted) { setOk(false); setLabel("Sin conexión"); }
      }
    };
    check();
    const id = setInterval(check, 60_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return (
    <div className={`bg-white rounded-xl border ${ok ? "border-green-200" : "border-red-200"} p-3.5`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-7 h-7 rounded-lg ${ok ? "bg-green-50" : "bg-red-50"} flex items-center justify-center relative`}>
          <span className={`absolute inset-0 rounded-lg ${ok ? "bg-green-500" : "bg-red-500"} opacity-20 animate-[ping_2s_ease-in-out_infinite]`} />
          <span className={`relative w-2.5 h-2.5 rounded-full ${ok ? "bg-green-500" : "bg-red-500"} shadow-sm`} />
        </div>
      </div>
      <p className={`text-lg font-bold leading-tight ${ok ? "text-green-700" : "text-red-700"}`}>
        {label}
      </p>
      <div className="flex items-center gap-1 mt-0.5">
        <p className="text-[10px] text-gray-500">Estado sistema</p>
        <InfoTip text="Verifica conectividad a la base de datos, storage, proveedor LLM y servicio de correo. Se actualiza cada 60 s." />
      </div>
      {dbMs !== null && (
        <p className="text-[9px] text-gray-400 mt-0.5">DB {dbMs}ms</p>
      )}
    </div>
  );
}

/* ─── Panel ─── */

export default function LiveKPIPanel({
  showSystemStatus,
}: {
  showSystemStatus?: boolean;
}) {
  const [history, setHistory] = useState<LiveSnapshot[]>([]);
  const mountedRef = useRef(true);

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dashboard/live", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const snap: LiveSnapshot = await res.json();
      if (!mountedRef.current) return;
      setHistory((prev) => {
        const next = [...prev, snap];
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
      });
    } catch {
      // silently ignore — next poll will retry
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchLive();
    const id = setInterval(fetchLive, POLL_INTERVAL);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchLive]);

  const latest = history.length > 0 ? history[history.length - 1] : null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
          En vivo
        </h2>
        {history.length > 0 && (
          <span className="text-[9px] text-gray-300 ml-1">
            {new Date(latest!.ts).toLocaleTimeString("es-CL", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        )}
      </div>
      <div
        className={`grid grid-cols-2 ${
          showSystemStatus ? "md:grid-cols-5" : "md:grid-cols-4"
        } gap-3`}
      >
        {showSystemStatus && <SystemStatusMini />}
        {METRICS.map((m) => (
          <LiveKPICard
            key={m.key}
            metric={m}
            history={history.map((s) => s[m.key])}
            current={latest ? latest[m.key] : null}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Shared InfoTip ─── */

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative group/tip">
      <Info
        size={11}
        className="text-gray-300 hover:text-gray-500 cursor-help transition-colors"
      />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 rounded-lg bg-gray-900 text-white text-[10px] leading-snug px-3 py-2 opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 shadow-lg">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  );
}
