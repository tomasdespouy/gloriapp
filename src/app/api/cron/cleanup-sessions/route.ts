/**
 * CRON: Cleanup abandoned sessions
 * Marks sessions as "abandoned" if they've been active for >2 hours
 * with no new messages. Runs hourly via Vercel Cron.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Verify cron secret (Vercel Cron or manual trigger)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Find active sessions where the last message is older than 2 hours
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  // Get all active conversations
  const { data: activeSessions, error: fetchError } = await admin
    .from("conversations")
    .select("id, updated_at")
    .eq("status", "active")
    .lt("updated_at", twoHoursAgo);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!activeSessions || activeSessions.length === 0) {
    return NextResponse.json({ abandoned: 0, message: "No stale sessions found" });
  }

  const sessionIds = activeSessions.map((s) => s.id);

  // Mark them as abandoned
  const { error: updateError } = await admin
    .from("conversations")
    .update({ status: "abandoned", ended_at: new Date().toISOString() })
    .in("id", sessionIds);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    abandoned: sessionIds.length,
    message: `Marked ${sessionIds.length} sessions as abandoned`,
  });
}
