import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Marks profiles.welcome_video_seen_at = NOW() for the authenticated
// user. Idempotent: calling it again does nothing harmful (keeps the
// original timestamp unless you explicitly overwrite). Only updates
// if it was null, so we preserve the "first time" moment.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { error } = await supabase
    .from("profiles")
    .update({ welcome_video_seen_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("welcome_video_seen_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
