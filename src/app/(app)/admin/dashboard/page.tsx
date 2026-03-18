import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/admin-helpers";
import {
  Users, MessageSquare, User, Building2, ChevronRight,
  AlertTriangle, Clock, DollarSign, FlaskConical,
  UserPlus, Search, BarChart3, Activity, Brain,
  TrendingUp, TrendingDown, FileText, Shield,
} from "lucide-react";
import Link from "next/link";

export default async function AdminDashboard() {
  const ctx = await getAdminContext();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", ctx.userId)
    .single();

  const firstName = profile?.full_name?.split(" ")[0] || "Admin";
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  const safeEstIds = ctx.establishmentIds.length > 0 ? ctx.establishmentIds : ["00000000-0000-0000-0000-000000000000"];

  // ── Core KPIs ──
  const studentsQuery = supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student");
  const { count: totalStudents } = ctx.isSuperadmin ? await studentsQuery : await studentsQuery.in("establishment_id", safeEstIds);
  const { count: totalPatients } = await admin.from("ai_patients").select("id", { count: "exact", head: true }).eq("is_active", true);
  const { count: activeEstablishments } = await admin.from("establishments").select("id", { count: "exact", head: true }).eq("is_active", true);
  const { count: sessionsTotal } = await admin.from("conversations").select("id", { count: "exact", head: true }).eq("status", "completed");
  const { count: sessionsToday } = await admin.from("conversations").select("id", { count: "exact", head: true }).gte("started_at", today);
  const { count: sessionsWeek } = await admin.from("conversations").select("id", { count: "exact", head: true }).gte("started_at", weekAgo);
  const { count: newUsersWeek } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student").gte("created_at", weekAgo);

  // ── Pending reviews ──
  const { count: pendingCount } = await admin.from("session_competencies").select("id", { count: "exact", head: true }).eq("feedback_status", "pending");

  // ── Risk sessions pending review ──
  const { data: riskSessions } = await admin.from("conversations")
    .select("id, student_id, ai_patient_id, created_at, ai_patients(name, tags), session_competencies(feedback_status)")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(100);

  type RiskSession = { id: string; student_id: string; created_at: string; ai_patients: { name: string; tags: string[] | null } | null; session_competencies: { feedback_status: string }[] | null };
  const riskTags = ["ideacion", "suicida", "autolesion", "crisis", "riesgo"];
  const riskPending = (riskSessions as unknown as RiskSession[] || []).filter(s => {
    const tags = (s.ai_patients as { tags: string[] | null } | null)?.tags || [];
    const hasRisk = tags.some(t => riskTags.some(r => t.toLowerCase().includes(r)));
    const isPending = !(s.session_competencies as { feedback_status: string }[] | null)?.[0] || (s.session_competencies as { feedback_status: string }[])?.[0]?.feedback_status === "pending";
    return hasRisk && isPending;
  });

  // ── Inactive students ──
  const { data: recentStudents } = await admin.from("conversations").select("student_id").gte("started_at", weekAgo);
  const activeStudentIds = new Set((recentStudents || []).map(s => s.student_id));
  const inactiveStudents = Math.max(0, (totalStudents || 0) - activeStudentIds.size);

  // ── Competency averages (all admins — scoped by institution for non-superadmin) ──
  let compAverages: Record<string, number> = {};
  let overallAvg = 0;
  {
    const { data: allComps } = await admin.from("session_competencies")
      .select("setting_terapeutico, motivo_consulta, datos_contextuales, objetivos, escucha_activa, actitud_no_valorativa, optimismo, presencia, conducta_no_verbal, contencion_afectos, overall_score_v2, eval_version")
      .eq("eval_version", 2)
      .limit(500);

    if (allComps && allComps.length > 0) {
      const keys = ["setting_terapeutico", "motivo_consulta", "datos_contextuales", "objetivos", "escucha_activa", "actitud_no_valorativa", "optimismo", "presencia", "conducta_no_verbal", "contencion_afectos"];
      for (const key of keys) {
        const vals = allComps.map(c => Number((c as Record<string, number>)[key])).filter(v => v > 0);
        compAverages[key] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      }
      const overalls = allComps.map(c => Number(c.overall_score_v2)).filter(v => v > 0);
      overallAvg = overalls.length > 0 ? overalls.reduce((a, b) => a + b, 0) / overalls.length : 0;
    }
  }

  // ── Top patients ──
  let topPatients: { name: string; count: number }[] = [];
  {
    const { data: patientCounts } = await admin.from("conversations")
      .select("ai_patient_id, ai_patients(name)")
      .eq("status", "completed");

    if (patientCounts) {
      const countMap = new Map<string, { name: string; count: number }>();
      for (const s of patientCounts) {
        const name = (s.ai_patients as unknown as { name: string })?.name || "?";
        const existing = countMap.get(s.ai_patient_id) || { name, count: 0 };
        existing.count++;
        countMap.set(s.ai_patient_id, existing);
      }
      topPatients = Array.from(countMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);
    }
  }

  // ── Recent reports (superadmin only) ──
  let recentReports: { id: string; title: string; created_at: string }[] = [];
  if (ctx.isSuperadmin) {
    const { data } = await admin.from("technical_reports").select("id, title, created_at").order("created_at", { ascending: false }).limit(3);
    recentReports = data || [];
  }

  // ── Upcoming deadlines ──
  const { data: upcomingDeadlines } = await admin.from("research_opportunities")
    .select("id, name, deadline, type, url")
    .not("deadline", "is", null)
    .gte("deadline", today)
    .order("deadline", { ascending: true })
    .limit(3);

  const compLabels: Record<string, string> = {
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

  const sortedComps = Object.entries(compAverages).sort((a, b) => a[1] - b[1]);
  const weakest = sortedComps.filter(([, v]) => v > 0).slice(0, 3);
  const strongest = sortedComps.filter(([, v]) => v > 0).slice(-3).reverse();

  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate()} ${months[d.getMonth()]}`;
  };

  return (
    <div className="min-h-screen">
      <header className="px-4 sm:px-8 py-5">
        <h1 className="text-2xl font-bold text-gray-900">
          {ctx.isSuperadmin ? "Centro de Control" : "GlorIA Analytics"}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {ctx.isSuperadmin ? `Bienvenido, ${firstName}` : `Bienvenido, ${firstName}`}
        </p>
      </header>

      <div className="px-4 sm:px-8 pb-8 space-y-6">
        {/* KPIs row */}
        <div className={`grid gap-4 ${ctx.isSuperadmin ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-6" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-5"}`}>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center"><Users size={16} className="text-blue-500" /></div>
              <div><p className="text-xl font-bold text-gray-900">{totalStudents || 0}</p><p className="text-[10px] text-gray-500">Estudiantes</p></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center"><MessageSquare size={16} className="text-green-500" /></div>
              <div><p className="text-xl font-bold text-gray-900">{sessionsTotal || 0}</p><p className="text-[10px] text-gray-500">Sesiones totales</p></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center"><Clock size={16} className="text-amber-500" /></div>
              <div><p className="text-xl font-bold text-gray-900">{pendingCount || 0}</p><p className="text-[10px] text-gray-500">Por revisar</p></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sidebar/10 flex items-center justify-center"><Brain size={16} className="text-sidebar" /></div>
              <div><p className="text-xl font-bold text-sidebar">{overallAvg.toFixed(1)}</p><p className="text-[10px] text-gray-500">Prom. IA /4</p></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center"><User size={16} className="text-purple-500" /></div>
              <div><p className="text-xl font-bold text-gray-900">{totalPatients || 0}</p><p className="text-[10px] text-gray-500">Pacientes IA</p></div>
            </div>
          </div>
          {ctx.isSuperadmin && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center"><Building2 size={16} className="text-indigo-500" /></div>
                <div><p className="text-xl font-bold text-gray-900">{activeEstablishments || 0}</p><p className="text-[10px] text-gray-500">Instituciones</p></div>
              </div>
            </div>
          )}
        </div>

        {/* Alerts — always visible */}
        {(riskPending.length > 0 || inactiveStudents > 0 || (pendingCount || 0) > 5) && (
          <div className="bg-white rounded-xl border border-red-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={16} className="text-red-500" />
              <h3 className="text-sm font-semibold text-gray-900">Requiere atención</h3>
            </div>
            <div className="space-y-2">
              {riskPending.length > 0 && (
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-red-50">
                  <AlertTriangle size={14} className="text-red-500" />
                  <p className="text-xs text-red-700 flex-1">{riskPending.length} sesiones con pacientes de riesgo sin revisión docente</p>
                  <Link href="/admin/retroalimentacion" className="text-[10px] text-red-600 font-medium hover:underline">Revisar</Link>
                </div>
              )}
              {inactiveStudents > 3 && (
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-50">
                  <Clock size={14} className="text-amber-500" />
                  <p className="text-xs text-amber-700">{inactiveStudents} estudiantes inactivos (+7 días sin sesión)</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            {/* Global competencies — visible to all admins */}
            {Object.keys(compAverages).length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">Competencias globales</h3>
                  <span className="text-xs text-gray-400">Promedio de {sessionsTotal || 0} sesiones</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
                  {Object.entries(compAverages).map(([key, val]) => {
                    const color = val >= 3 ? "#22c55e" : val >= 2 ? "#eab308" : val > 0 ? "#ef4444" : "#d1d5db";
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 w-36 truncate">{compLabels[key] || key}</span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(val/4)*100}%`, backgroundColor: color }} />
                        </div>
                        <span className="text-[10px] font-bold w-6 text-right" style={{ color }}>{val.toFixed(1)}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Weakest & Strongest */}
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-[10px] font-bold text-red-600 uppercase mb-1.5">Más débiles</p>
                    {weakest.map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-600">{compLabels[key]}</span>
                        <span className="font-bold text-red-500">{val.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-green-600 uppercase mb-1.5">Más fuertes</p>
                    {strongest.map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-600">{compLabels[key]}</span>
                        <span className="font-bold text-green-600">{val.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Activity summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Actividad esta semana</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{sessionsToday || 0}</p>
                  <p className="text-[10px] text-gray-500">Sesiones hoy</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{sessionsWeek || 0}</p>
                  <p className="text-[10px] text-gray-500">Sesiones semana</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{newUsersWeek || 0}</p>
                  <p className="text-[10px] text-gray-500">Nuevos usuarios</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-sidebar">{pendingCount || 0}</p>
                  <p className="text-[10px] text-gray-500">Pendientes revisión</p>
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Acciones rápidas</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  { icon: UserPlus, label: "Crear usuario", href: "/admin/usuarios", color: "bg-blue-50 text-blue-700" },
                  { icon: User, label: "Nuevo paciente", href: "/perfiles/nuevo", color: "bg-purple-50 text-purple-700" },
                  { icon: BarChart3, label: "Métricas", href: "/admin/metricas", color: "bg-indigo-50 text-indigo-700" },
                  ...(ctx.isSuperadmin ? [
                    { icon: DollarSign, label: "Costos", href: "/admin/costos", color: "bg-green-50 text-green-700" },
                    { icon: Activity, label: "Monitoreo", href: "/admin/monitoreo", color: "bg-red-50 text-red-700" },
                    { icon: FileText, label: "Informes", href: "/admin/informes", color: "bg-amber-50 text-amber-700" },
                  ] : []),
                ].map((a) => (
                  <Link key={a.href} href={a.href} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg ${a.color} hover:opacity-80 transition-opacity`}>
                    <a.icon size={14} /><span className="text-xs font-medium">{a.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Right 1/3 */}
          <div className="space-y-6">
            {/* Top patients — visible to all admins */}
            {topPatients.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Pacientes más usados</h3>
                <div className="space-y-2">
                  {topPatients.map((p, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-400 w-4">{i + 1}.</span>
                      <span className="text-xs text-gray-700 flex-1 truncate">{p.name}</span>
                      <span className="text-xs font-bold text-sidebar">{p.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent reports (superadmin) */}
            {ctx.isSuperadmin && recentReports.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Últimos informes</h3>
                  <Link href="/admin/informes" className="text-[10px] text-sidebar hover:underline">Ver todos</Link>
                </div>
                <div className="space-y-2">
                  {recentReports.map(r => (
                    <div key={r.id} className="flex items-center gap-2">
                      <FileText size={12} className="text-sidebar flex-shrink-0" />
                      <span className="text-xs text-gray-700 flex-1 truncate">{r.title}</span>
                      <span className="text-[10px] text-gray-400">{formatDate(r.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming deadlines */}
            {(upcomingDeadlines || []).length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Próximos deadlines</h3>
                  <Link href="/admin/investigacion" className="text-[10px] text-sidebar hover:underline">Ver todos</Link>
                </div>
                <div className="space-y-2">
                  {(upcomingDeadlines || []).map(d => {
                    const days = Math.ceil((new Date(d.deadline + "T12:00:00").getTime() - Date.now()) / 86400000);
                    return (
                      <a key={d.id} href={d.url || "/admin/investigacion"} target={d.url ? "_blank" : undefined} rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <FlaskConical size={12} className="text-sidebar flex-shrink-0" />
                        <span className="text-xs text-gray-700 flex-1 truncate">{d.name}</span>
                        <span className={`text-[10px] font-bold ${days <= 14 ? "text-red-500" : "text-gray-400"}`}>{days}d</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Institutions (superadmin) */}
            {ctx.isSuperadmin && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Instituciones</h3>
                  <Link href="/admin/establecimientos" className="text-[10px] text-sidebar hover:underline">Gestionar</Link>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 size={16} className="text-indigo-500" />
                  <span className="text-sm text-gray-700">{activeEstablishments || 0} activas</span>
                  <span className="text-xs text-gray-400">{totalStudents || 0} usuarios totales</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
