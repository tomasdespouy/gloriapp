import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "superadmin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const admin = createAdminClient();
  const range = request.nextUrl.searchParams.get("range") || "24h";

  const since = new Date();
  if (range === "24h") since.setHours(since.getHours() - 24);
  else if (range === "7d") since.setDate(since.getDate() - 7);
  else if (range === "30d") since.setDate(since.getDate() - 30);

  const { data: metrics } = await admin
    .from("system_metrics")
    .select("event, data, created_at")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(1000);

  if (!metrics) return NextResponse.json({ events: [], summary: {} });

  // Aggregate metrics
  const chatResponses = metrics.filter(m => m.event === "chat_response");
  const chatErrors = metrics.filter(m => m.event === "chat_error");

  const avgLatency = chatResponses.length > 0
    ? Math.round(chatResponses.reduce((a, m) => a + (Number((m.data as Record<string, unknown>).duration_ms) || 0), 0) / chatResponses.length)
    : 0;

  const avgResponseWords = chatResponses.length > 0
    ? Math.round(chatResponses.reduce((a, m) => a + (Number((m.data as Record<string, unknown>).responseWords) || 0), 0) / chatResponses.length)
    : 0;

  // Intervention type distribution
  const interventionCounts: Record<string, number> = {};
  chatResponses.forEach(m => {
    const type = String((m.data as Record<string, unknown>).interventionType || "otro");
    interventionCounts[type] = (interventionCounts[type] || 0) + 1;
  });

  // Latency over time (grouped by hour)
  const latencyByHour: Record<string, { sum: number; count: number }> = {};
  chatResponses.forEach(m => {
    const hour = m.created_at.slice(0, 13);
    if (!latencyByHour[hour]) latencyByHour[hour] = { sum: 0, count: 0 };
    latencyByHour[hour].sum += Number((m.data as Record<string, unknown>).duration_ms) || 0;
    latencyByHour[hour].count++;
  });

  const latencyTrend = Object.entries(latencyByHour)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, v]) => ({ hour: hour.slice(5), avgMs: Math.round(v.sum / v.count), count: v.count }));

  // Health check — direct DB check instead of HTTP fetch
  let healthStatus = "healthy";
  try {
    const { error: dbErr } = await admin.from("profiles").select("id").limit(1);
    if (dbErr) healthStatus = "degraded";
    if (!process.env.OPENAI_API_KEY) healthStatus = "degraded";
  } catch { healthStatus = "degraded"; }

  return NextResponse.json({
    range,
    health: healthStatus,
    summary: {
      totalMessages: chatResponses.length,
      totalErrors: chatErrors.length,
      errorRate: chatResponses.length > 0 ? ((chatErrors.length / (chatResponses.length + chatErrors.length)) * 100).toFixed(1) + "%" : "0%",
      avgLatencyMs: avgLatency,
      avgResponseWords,
      p95LatencyMs: chatResponses.length > 0
        ? Math.round(chatResponses.map(m => Number((m.data as Record<string, unknown>).duration_ms) || 0).sort((a, b) => a - b)[Math.floor(chatResponses.length * 0.95)])
        : 0,
    },
    interventionCounts,
    latencyTrend,
  });
}
