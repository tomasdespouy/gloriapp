import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  // Block reset of superadmin accounts
  const { data: target } = await admin.from("profiles").select("role").eq("id", id).single();
  if (target?.role === "superadmin") {
    return NextResponse.json({ error: "No se puede restaurar una cuenta superadmin" }, { status: 403 });
  }

  // Delete all user data (conversations cascade to messages, feedback, competencies)
  await admin.from("conversations").delete().eq("student_id", id);
  await admin.from("student_achievements").delete().eq("student_id", id);
  await admin.from("learning_progress").delete().eq("student_id", id);

  // Reset progress to defaults
  await admin.from("student_progress").update({
    level: 1,
    level_name: "Observador",
    total_xp: 0,
    sessions_completed: 0,
    current_streak: 0,
    longest_streak: 0,
    last_session_date: null,
  }).eq("student_id", id);

  return NextResponse.json({ success: true });
}
