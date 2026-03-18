import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { Activity, AlertTriangle, Clock, Database, CheckCircle, XCircle } from "lucide-react";

export default async function MonitoreoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "superadmin") redirect("/admin/dashboard");

  const admin = createAdminClient();

  // Get recent errors from system_metrics
  const { data: recentErrors } = await admin
    .from("system_metrics")
    .select("*")
    .ilike("event", "%error%")
    .order("created_at", { ascending: false })
    .limit(20);

  // Get recent metrics
  const { data: recentMetrics } = await admin
    .from("system_metrics")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  // Calculate latency from chat_message metrics
  const chatMetrics = (recentMetrics || []).filter(m => m.event === "chat_message");
  const avgLatency = chatMetrics.length > 0
    ? chatMetrics.reduce((sum, m) => sum + (Number((m.data as Record<string, unknown>)?.duration_ms) || 0), 0) / chatMetrics.length
    : 0;

  // Count errors in last 24h
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const errors24h = (recentErrors || []).filter(e => e.created_at > yesterday).length;

  // DB health check
  const dbStart = Date.now();
  await admin.from("profiles").select("id").limit(1);
  const dbLatency = Date.now() - dbStart;

  // Sessions today
  const today = new Date().toISOString().split("T")[0];
  const { count: sessionsToday } = await admin.from("conversations")
    .select("id", { count: "exact", head: true })
    .gte("started_at", today);

  // API keys status
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasTavily = !!process.env.TAVILY_API_KEY;
  const hasLuma = !!process.env.LUMA_API_KEY;
  const hasResend = !!process.env.RESEND_API_KEY;
  const hasElevenLabs = !!process.env.ELEVENLABS_API_KEY;

  return (
    <div className="min-h-screen">
      <header className="px-8 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Monitoreo</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Estado de la plataforma, latencia y errores recientes
        </p>
      </header>

      <div className="px-8 pb-8 space-y-6">
        {/* Status cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-green-700">En línea</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{sessionsToday || 0}</p>
            <p className="text-xs text-gray-500">Sesiones hoy</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={14} className="text-blue-500" />
              <span className="text-xs font-medium text-blue-700">Latencia chat</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {avgLatency > 0 ? `${(avgLatency / 1000).toFixed(1)}s` : "--"}
            </p>
            <p className="text-xs text-gray-500">Promedio respuesta IA</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Database size={14} className="text-purple-500" />
              <span className="text-xs font-medium text-purple-700">Base de datos</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{dbLatency}ms</p>
            <p className="text-xs text-gray-500">Latencia query</p>
          </div>

          <div className={`bg-white rounded-xl border p-5 ${errors24h > 0 ? "border-red-200" : "border-gray-200"}`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className={errors24h > 0 ? "text-red-500" : "text-gray-400"} />
              <span className={`text-xs font-medium ${errors24h > 0 ? "text-red-700" : "text-gray-500"}`}>
                Errores 24h
              </span>
            </div>
            <p className={`text-2xl font-bold ${errors24h > 0 ? "text-red-600" : "text-gray-900"}`}>
              {errors24h}
            </p>
            <p className="text-xs text-gray-500">Últimas 24 horas</p>
          </div>
        </div>

        {/* API Keys status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Estado de APIs externas</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { name: "OpenAI", active: hasOpenAI },
              { name: "Tavily", active: hasTavily },
              { name: "Luma AI", active: hasLuma },
              { name: "Resend", active: hasResend },
              { name: "ElevenLabs", active: hasElevenLabs },
            ].map(api => (
              <div key={api.name} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${api.active ? "bg-green-50" : "bg-red-50"}`}>
                {api.active ? <CheckCircle size={14} className="text-green-600" /> : <XCircle size={14} className="text-red-500" />}
                <span className={`text-xs font-medium ${api.active ? "text-green-700" : "text-red-600"}`}>{api.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent errors */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Eventos recientes
            <span className="text-xs text-gray-400 font-normal ml-2">Últimos 50</span>
          </h3>

          {(recentMetrics || []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin eventos registrados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">Fecha</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">Evento</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">Datos</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentMetrics || []).slice(0, 30).map((m) => {
                    const isError = m.event.includes("error");
                    return (
                      <tr key={m.id} className={`border-b border-gray-50 ${isError ? "bg-red-50/50" : ""}`}>
                        <td className="py-2 px-2 text-gray-400 whitespace-nowrap">
                          {new Date(m.created_at).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-2 px-2">
                          <span className={`font-medium ${isError ? "text-red-600" : "text-gray-700"}`}>
                            {m.event}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-gray-500 max-w-xs truncate">
                          {m.data ? JSON.stringify(m.data).substring(0, 100) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
