import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Lightweight live metrics endpoint polled every 30s.
 * Returns: latencyMs, onlineNow, inSession, platformMinutesToday
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin" && profile?.role !== "superadmin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const admin = createAdminClient();
    const twoMinAgo = new Date(Date.now() - 2 * 60_000).toISOString();
    const todayDate = new Date().toISOString().split("T")[0];

    // Measure DB latency
    const dbStart = Date.now();
    const { data: onlineUsers } = await admin
      .from("profiles")
      .select("id, role")
      .gte("last_seen_at", twoMinAgo);
    const latencyMs = Date.now() - dbStart;

    const onlineNow = onlineUsers?.length || 0;
    // Only students can be "in session"
    const onlineStudentIds = (onlineUsers || [])
      .filter((u: { id: string; role: string }) => u.role === "student")
      .map((u: { id: string; role: string }) => u.id);

    // In-session + platform time today in parallel
    const [activeConvsResult, todayActivityResult] = await Promise.all([
      onlineStudentIds.length > 0
        ? admin
            .from("conversations")
            .select("student_id")
            .eq("status", "active")
            .in("student_id", onlineStudentIds)
        : Promise.resolve({ data: [] }),
      admin
        .from("platform_activity")
        .select("active_seconds")
        .eq("activity_date", todayDate),
    ]);

    const inSession = new Set(
      (activeConvsResult.data || []).map(
        (c: { student_id: string }) => c.student_id
      )
    ).size;

    const platformMinutesToday = Math.round(
      (todayActivityResult.data || []).reduce(
        (s: number, a: { active_seconds: number }) =>
          s + (a.active_seconds || 0),
        0
      ) / 60
    );

    return NextResponse.json({
      ts: Date.now(),
      latencyMs,
      onlineNow,
      inSession,
      platformMinutesToday,
    });
  } catch {
    return NextResponse.json(
      { error: "Error fetching live metrics" },
      { status: 500 }
    );
  }
}
