"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity, Users, MessageSquare, Clock, Zap, TrendingUp, Wifi,
} from "lucide-react";

type OnlineUser = {
  id: string;
  fullName: string;
  role: string;
  lastSeenAt: string;
};

type LiveData = {
  timestamp: string;
  activeSessions: { id: string; studentName: string; patientName: string; startedAt: string }[];
  activeUsersCount: number;
  sessionsCompletedToday: number;
  messagesToday: number;
  totalWordsLastHour: number;
  userMessagesLastHour: number;
  assistantMessagesLastHour: number;
  topPatients: { name: string; count: number }[];
  hourlyActivity: number[];
  uniqueStudentsToday: number;
  onlineUsers: OnlineUser[];
};

export default function LiveMetrics() {
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/admin/metrics/live");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) return <div className="text-center py-12 text-gray-400 text-sm">Cargando métricas en vivo...</div>;
  if (!data) return <div className="text-center py-12 text-gray-400 text-sm">Error al cargar</div>;

  const maxHourly = Math.max(...data.hourlyActivity, 1);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Live indicator */}
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs text-green-600 font-medium">En vivo</span>
        <span className="text-[10px] text-gray-400">
          Actualizado {new Date(data.timestamp).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI icon={Users} value={data.activeUsersCount} label="Usuarios activos" color="blue" />
        <KPI icon={Activity} value={data.activeSessions.length} label="Sesiones en curso" color="green" />
        <KPI icon={MessageSquare} value={data.messagesToday} label="Mensajes hoy" color="purple" />
        <KPI icon={Clock} value={data.sessionsCompletedToday} label="Sesiones completadas hoy" color="amber" />
        <KPI icon={Zap} value={data.totalWordsLastHour} label="Palabras última hora" color="indigo" />
        <KPI icon={TrendingUp} value={data.uniqueStudentsToday} label="Estudiantes hoy" color="emerald" />
      </div>

      {/* Online users — en vivo */}
      {data.onlineUsers && data.onlineUsers.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Wifi size={16} className="text-green-500" />
            Usuarios en l&iacute;nea ahora
            <span className="text-xs text-gray-400 font-normal">({data.onlineUsers.length})</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.onlineUsers.map((u) => {
              const roleColors: Record<string, string> = {
                student: "bg-blue-50 text-blue-700",
                instructor: "bg-amber-50 text-amber-700",
                admin: "bg-purple-50 text-purple-700",
                superadmin: "bg-red-50 text-red-700",
              };
              const roleLabels: Record<string, string> = {
                student: "Alumno",
                instructor: "Docente",
                admin: "Admin",
                superadmin: "Superadmin",
              };
              return (
                <div key={u.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                  </span>
                  <span className="text-sm font-medium text-gray-900">{u.fullName}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${roleColors[u.role] || "bg-gray-100 text-gray-600"}`}>
                    {roleLabels[u.role] || u.role}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active sessions */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Activity size={16} className="text-green-500" />
            Sesiones activas ahora
          </h3>
          {data.activeSessions.length > 0 ? (
            <div className="space-y-2">
              {data.activeSessions.map((s) => {
                const mins = Math.round((Date.now() - new Date(s.startedAt).getTime()) / 60000);
                return (
                  <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-green-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{s.studentName}</p>
                      <p className="text-[10px] text-gray-400">con {s.patientName}</p>
                    </div>
                    <span className="text-xs text-green-600 font-medium">{mins} min</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-6">Sin sesiones activas en este momento</p>
          )}
        </div>

        {/* Top patients today */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Pacientes más atendidos hoy</h3>
          {data.topPatients.length > 0 ? (
            <div className="space-y-2">
              {data.topPatients.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{p.name}</span>
                      <span className="text-xs text-sidebar font-medium">{p.count} sesiones</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className="h-1.5 bg-sidebar rounded-full" style={{ width: `${(p.count / (data.topPatients[0]?.count || 1)) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-6">Sin sesiones hoy</p>
          )}
        </div>
      </div>

      {/* Hourly activity heat map */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Actividad por hora (última hora por franja)</h3>
        <div className="flex items-end gap-1 h-24">
          {data.hourlyActivity.map((count, h) => {
            const intensity = count / maxHourly;
            const isNow = new Date().getHours() === h;
            return (
              <div key={h} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full rounded-sm transition-all ${isNow ? "bg-green-500" : "bg-sidebar"}`}
                  style={{ height: `${Math.max(intensity * 100, 4)}%`, opacity: count > 0 ? 0.3 + intensity * 0.7 : 0.1 }}
                  title={`${h}:00 — ${count} mensajes`}
                />
                {h % 3 === 0 && (
                  <span className="text-[8px] text-gray-400">{h}h</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Message flow */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Flujo de mensajes (última hora)</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-sidebar">{data.userMessagesLastHour}</p>
            <p className="text-xs text-gray-400">Del terapeuta</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-600">{data.assistantMessagesLastHour}</p>
            <p className="text-xs text-gray-400">Del paciente (IA)</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-600">{data.totalWordsLastHour}</p>
            <p className="text-xs text-gray-400">Palabras totales</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, value, label, color }: { icon: typeof Users; value: number; label: string; color: string }) {
  const colors: Record<string, string> = {
    blue: "from-blue-400 to-blue-500",
    green: "from-green-400 to-green-500",
    purple: "from-purple-400 to-purple-500",
    amber: "from-amber-400 to-amber-500",
    indigo: "from-indigo-400 to-indigo-500",
    emerald: "from-emerald-400 to-emerald-500",
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color] || colors.blue} flex items-center justify-center shadow-sm`}>
          <Icon size={20} className="text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-[10px] text-gray-400 leading-tight">{label}</p>
        </div>
      </div>
    </div>
  );
}
