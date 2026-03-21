import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { total_duration } = await request.json();

  const { error } = await supabase
    .from("observation_sessions")
    .update({
      status: "completed",
      total_duration_seconds: total_duration || 0,
      ended_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("student_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
