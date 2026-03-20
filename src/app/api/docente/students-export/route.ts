import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "instructor" && profile?.role !== "admin" && profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Fetch students + progress
  const [{ data: students }, { data: progress }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, created_at").eq("role", "student").order("full_name"),
    supabase.from("student_progress").select("student_id, level_name, sessions_completed, total_xp, current_streak, last_session_date"),
  ]);

  const progressMap = new Map<string, (typeof progress extends (infer T)[] | null ? T : never)>();
  progress?.forEach((p) => progressMap.set(p.student_id, p));

  // Build CSV
  const headers = ["Nombre", "Email", "Nivel", "Sesiones", "XP Total", "Racha", "Última sesión", "Registro"];
  const rows = (students || []).map((s) => {
    const p = progressMap.get(s.id);
    return [
      s.full_name || "",
      s.email,
      p?.level_name || "Sin actividad",
      String(p?.sessions_completed || 0),
      String(p?.total_xp || 0),
      String(p?.current_streak || 0),
      p?.last_session_date ? new Date(p.last_session_date).toLocaleDateString("es-CL") : "—",
      new Date(s.created_at).toLocaleDateString("es-CL"),
    ];
  });

  // BOM for Excel UTF-8 compatibility
  const BOM = "\uFEFF";
  const csv = BOM + [headers, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="alumnos-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
