"use client";

import Link from "next/link";
import {
  Globe, Users, Mail, Send, TrendingUp,
  ArrowRight, Building2, Zap,
} from "lucide-react";

type Props = {
  totalSchools: number;
  totalContacts: number;
  totalEmailsSent: number;
  statusCounts: Record<string, number>;
  countryCounts: Record<string, number>;
  recentEmails: {
    id: string;
    subject: string;
    status: string;
    sent_at: string;
    contactName: string;
    contactEmail: string;
  }[];
  campaigns: {
    id: string;
    name: string;
    status: string;
    total_sent: number;
    sent_at: string | null;
  }[];
  sequences: {
    id: string;
    name: string;
    is_active: boolean;
    enrollments: number;
  }[];
};

const statusLabels: Record<string, { label: string; color: string }> = {
  lead: { label: "Lead", color: "bg-gray-100 text-gray-700" },
  contacted: { label: "Contactado", color: "bg-blue-50 text-blue-700" },
  interested: { label: "Interesado", color: "bg-amber-50 text-amber-700" },
  negotiating: { label: "Negociando", color: "bg-purple-50 text-purple-700" },
  client: { label: "Cliente", color: "bg-green-50 text-green-700" },
  rejected: { label: "Rechazado", color: "bg-red-50 text-red-700" },
};

const emailStatusColors: Record<string, string> = {
  sent: "text-blue-600",
  delivered: "text-green-600",
  opened: "text-emerald-600",
  clicked: "text-purple-600",
  bounced: "text-red-600",
  failed: "text-red-600",
  queued: "text-gray-500",
};

export default function GrowthDashboardClient({
  totalSchools,
  totalContacts,
  totalEmailsSent,
  statusCounts,
  countryCounts,
  recentEmails,
  campaigns,
  sequences,
}: Props) {
  const topCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="min-h-screen">
      <header className="flex justify-between items-center px-8 py-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Growth</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Outreach a escuelas de psicologia de Iberoamerica
          </p>
        </div>
      </header>

      <div className="px-8 pb-8 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPI icon={Building2} value={totalSchools} label="Escuelas" color="indigo" />
          <KPI icon={Users} value={totalContacts} label="Contactos" color="blue" />
          <KPI icon={Send} value={totalEmailsSent} label="Emails enviados" color="green" />
          <KPI
            icon={TrendingUp}
            value={statusCounts["client"] || 0}
            label="Clientes convertidos"
            color="emerald"
          />
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin/growth/contactos"
            className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 hover:border-[#4A55A2] hover:shadow-sm transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Globe size={20} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Escuelas y contactos</p>
              <p className="text-xs text-gray-500">Gestiona tu base de leads</p>
            </div>
            <ArrowRight size={16} className="text-gray-300 group-hover:text-[#4A55A2]" />
          </Link>
          <Link
            href="/admin/growth/campanas"
            className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 hover:border-[#4A55A2] hover:shadow-sm transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <Mail size={20} className="text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Campanas</p>
              <p className="text-xs text-gray-500">Envia emails a tus contactos</p>
            </div>
            <ArrowRight size={16} className="text-gray-300 group-hover:text-[#4A55A2]" />
          </Link>
          <Link
            href="/admin/growth/secuencias"
            className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 hover:border-[#4A55A2] hover:shadow-sm transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <Zap size={20} className="text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Secuencias drip</p>
              <p className="text-xs text-gray-500">Automatiza seguimientos</p>
            </div>
            <ArrowRight size={16} className="text-gray-300 group-hover:text-[#4A55A2]" />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pipeline by status */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Pipeline</h3>
            <div className="space-y-2">
              {Object.entries(statusLabels).map(([key, { label, color }]) => (
                <div key={key} className="flex items-center justify-between py-1.5">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${color}`}>
                    {label}
                  </span>
                  <span className="text-sm font-bold text-gray-900">{statusCounts[key] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top countries */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Paises</h3>
            {topCountries.length > 0 ? (
              <div className="space-y-2">
                {topCountries.map(([country, count]) => (
                  <div key={country} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-gray-700">{country}</span>
                    <span className="text-sm font-bold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">Sin datos</p>
            )}
          </div>

          {/* Recent emails */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Emails recientes</h3>
            {recentEmails.length > 0 ? (
              <div className="space-y-2">
                {recentEmails.slice(0, 6).map((e) => (
                  <div key={e.id} className="py-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-900 truncate flex-1">{e.contactName}</p>
                      <span className={`text-[10px] font-semibold uppercase ${emailStatusColors[e.status] || "text-gray-500"}`}>
                        {e.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 truncate">{e.subject}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">Sin envios</p>
            )}
          </div>
        </div>

        {/* Campaigns & Sequences */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Campanas recientes</h3>
              <Link href="/admin/growth/campanas" className="text-xs text-[#4A55A2] hover:underline">
                Ver todas
              </Link>
            </div>
            {campaigns.length > 0 ? (
              <div className="space-y-2">
                {campaigns.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {c.sent_at ? new Date(c.sent_at).toLocaleDateString("es-CL") : "Borrador"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{c.total_sent}</p>
                      <p className="text-[10px] text-gray-400">enviados</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">Sin campanas</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Secuencias drip</h3>
              <Link href="/admin/growth/secuencias" className="text-xs text-[#4A55A2] hover:underline">
                Ver todas
              </Link>
            </div>
            {sequences.length > 0 ? (
              <div className="space-y-2">
                {sequences.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${s.is_active ? "bg-green-500" : "bg-gray-300"}`} />
                      <p className="text-sm font-medium text-gray-900">{s.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{s.enrollments}</p>
                      <p className="text-[10px] text-gray-400">inscritos</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">Sin secuencias</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  value: number | string;
  label: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.blue}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}
