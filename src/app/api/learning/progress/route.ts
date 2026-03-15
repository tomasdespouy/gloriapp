import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const XP_PER_EXAMPLE = 10;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { example_id, competency } = await request.json();
  if (!example_id || !competency) {
    return NextResponse.json({ error: "example_id y competency son requeridos" }, { status: 400 });
  }

  // Check if already read
  const { data: existing } = await supabase
    .from("learning_progress")
    .select("id")
    .eq("student_id", user.id)
    .eq("example_id", example_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ success: true, xp: 0, already_read: true });
  }

  // Insert progress
  const { error } = await supabase
    .from("learning_progress")
    .insert({ student_id: user.id, example_id, competency, xp_awarded: XP_PER_EXAMPLE });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Award XP
  const { data: progress } = await supabase
    .from("student_progress")
    .select("total_xp")
    .eq("student_id", user.id)
    .single();

  if (progress) {
    await supabase
      .from("student_progress")
      .update({ total_xp: progress.total_xp + XP_PER_EXAMPLE })
      .eq("student_id", user.id);
  }

  return NextResponse.json({ success: true, xp: XP_PER_EXAMPLE });
}
