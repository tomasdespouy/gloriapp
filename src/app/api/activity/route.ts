import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  // Upsert: increment active_seconds by 30 (heartbeat interval)
  const { error } = await supabase.rpc("increment_platform_activity", {
    p_user_id: user.id,
    p_date: today,
    p_seconds: 30,
  });

  if (error) {
    // Fallback: try manual upsert if RPC doesn't exist yet
    const { data: existing } = await supabase
      .from("platform_activity")
      .select("id, active_seconds")
      .eq("user_id", user.id)
      .eq("activity_date", today)
      .single();

    if (existing) {
      await supabase
        .from("platform_activity")
        .update({
          active_seconds: existing.active_seconds + 30,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("platform_activity").insert({
        user_id: user.id,
        activity_date: today,
        active_seconds: 30,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
