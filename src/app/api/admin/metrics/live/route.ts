import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const oneHourAgo = new Date(now.getTime() - 3600000).toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  // Active sessions right now (status = active, with recent messages)
  const { data: activeSessions } = await admin
    .from("conversations")
    .select("id, student_id, ai_patient_id, created_at, ai_patients(name), profiles!conversations_student_id_fkey(full_name)")
    .eq("status", "active")
    .gte("created_at", new Date(now.getTime() - 86400000).toISOString());

  // Messages in the last hour (for word count)
  const { data: recentMessages } = await admin
    .from("messages")
    .select("content, role, created_at")
    .gte("created_at", oneHourAgo);

  const totalWordsLastHour = (recentMessages || []).reduce((sum, m) => sum + m.content.split(/\s+/).length, 0);
  const userMessages = (recentMessages || []).filter(m => m.role === "user");
  const assistantMessages = (recentMessages || []).filter(m => m.role === "assistant");

  // Sessions completed today
  const { count: sessionsToday } = await admin
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("created_at", todayStart);

  // Total messages today
  const { count: messagesToday } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .gte("created_at", todayStart);

  // Most active patients today
  const { data: todaySessions } = await admin
    .from("conversations")
    .select("ai_patient_id, ai_patients(name)")
    .gte("created_at", todayStart);

  const patientCounts: Record<string, { name: string; count: number }> = {};
  (todaySessions || []).forEach(s => {
    const name = (s.ai_patients as unknown as { name: string })?.name || "?";
    if (!patientCounts[s.ai_patient_id]) patientCounts[s.ai_patient_id] = { name, count: 0 };
    patientCounts[s.ai_patient_id].count++;
  });
  const topPatients = Object.values(patientCounts).sort((a, b) => b.count - a.count).slice(0, 5);

  // Activity by hour today (heat map data)
  const hourlyActivity: number[] = Array(24).fill(0);
  (recentMessages || []).forEach(m => {
    const h = new Date(m.created_at).getHours();
    hourlyActivity[h]++;
  });

  // Active users right now
  const activeUserIds = new Set((activeSessions || []).map(s => s.student_id));

  // Students online today (unique)
  const { data: todayMessages } = await admin
    .from("messages")
    .select("conversation_id")
    .eq("role", "user")
    .gte("created_at", todayStart);

  const uniqueConvos = new Set((todayMessages || []).map(m => m.conversation_id));

  return NextResponse.json({
    timestamp: now.toISOString(),
    activeSessions: (activeSessions || []).map(s => ({
      id: s.id,
      studentName: (s.profiles as unknown as { full_name: string })?.full_name || "—",
      patientName: (s.ai_patients as unknown as { name: string })?.name || "—",
      startedAt: s.created_at,
    })),
    activeUsersCount: activeUserIds.size,
    sessionsCompletedToday: sessionsToday || 0,
    messagesToday: messagesToday || 0,
    totalWordsLastHour,
    userMessagesLastHour: userMessages.length,
    assistantMessagesLastHour: assistantMessages.length,
    topPatients,
    hourlyActivity,
    uniqueStudentsToday: uniqueConvos.size,
  });
}
