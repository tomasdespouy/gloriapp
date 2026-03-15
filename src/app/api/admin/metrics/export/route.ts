import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const admin = createAdminClient();
  const searchParams = request.nextUrl.searchParams;
  const establishmentId = searchParams.get("establishment_id");

  // Get scoped student IDs
  let studentQuery = admin
    .from("profiles")
    .select("id, full_name, email, establishment_id")
    .eq("role", "student");

  if (profile.role !== "superadmin") {
    const { data: assignments } = await admin
      .from("admin_establishments")
      .select("establishment_id")
      .eq("admin_id", user.id);
    const estIds = assignments?.map((a) => a.establishment_id) || [];
    if (estIds.length === 0) {
      return new Response("", { status: 200, headers: { "Content-Type": "text/csv" } });
    }
    studentQuery = studentQuery.in("establishment_id", estIds);
  }

  if (establishmentId) {
    studentQuery = studentQuery.eq("establishment_id", establishmentId);
  }

  const { data: students } = await studentQuery;
  const studentIds = students?.map((s) => s.id) || [];
  if (studentIds.length === 0) {
    return new Response("Alumno,Email,Sesiones,Puntaje Promedio\n", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=metricas.csv",
      },
    });
  }

  // Get sessions with competencies
  const { data: sessions } = await admin
    .from("conversations")
    .select("student_id, session_competencies(overall_score)")
    .eq("status", "completed")
    .in("student_id", studentIds);

  // Build CSV
  type CompRow = { overall_score: number };
  const rows = (students || []).map((s) => {
    const studentSessions = sessions?.filter((sess) => sess.student_id === s.id) || [];
    const scores = studentSessions.flatMap((sess) => {
      const comp = (sess.session_competencies as CompRow[] | null)?.[0];
      return comp?.overall_score != null ? [Number(comp.overall_score)] : [];
    });
    const avg = scores.length > 0
      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
      : "—";

    return `"${s.full_name || ""}","${s.email}",${studentSessions.length},${avg}`;
  });

  const csv = "Alumno,Email,Sesiones,Puntaje Promedio\n" + rows.join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=metricas.csv",
    },
  });
}
