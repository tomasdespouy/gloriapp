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
  const format = searchParams.get("format") || "csv"; // csv or detailed

  // Get scoped student IDs
  let studentQuery = admin
    .from("profiles")
    .select("id, full_name, email, establishment_id, created_at")
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

  const [{ data: students }, { data: establishments }] = await Promise.all([
    studentQuery,
    admin.from("establishments").select("id, name"),
  ]);

  const estMap = new Map<string, string>();
  establishments?.forEach((e) => estMap.set(e.id, e.name));

  const studentIds = students?.map((s) => s.id) || [];
  if (studentIds.length === 0) {
    const BOM = "\uFEFF";
    return new Response(BOM + "Sin datos", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=metricas.csv",
      },
    });
  }

  // Get sessions with V2 competencies + progress
  const [{ data: sessions }, { data: progress }] = await Promise.all([
    admin
      .from("conversations")
      .select(`student_id, created_at, session_competencies(
        overall_score, overall_score_v2, eval_version,
        setting_terapeutico, motivo_consulta, datos_contextuales, objetivos,
        escucha_activa, actitud_no_valorativa, optimismo, presencia, conducta_no_verbal, contencion_afectos,
        feedback_status
      )`)
      .eq("status", "completed")
      .in("student_id", studentIds),
    admin
      .from("student_progress")
      .select("student_id, level_name, total_xp, sessions_completed, current_streak"),
  ]);

  const progressMap = new Map<string, typeof progress extends (infer T)[] | null ? T : never>();
  progress?.forEach((p) => progressMap.set(p.student_id, p));

  // V2 competency keys
  const V2_KEYS = [
    "setting_terapeutico", "motivo_consulta", "datos_contextuales", "objetivos",
    "escucha_activa", "actitud_no_valorativa", "optimismo", "presencia", "conducta_no_verbal", "contencion_afectos",
  ];
  const V2_LABELS = [
    "Setting terapéutico", "Motivo consulta", "Datos contextuales", "Objetivos",
    "Escucha activa", "Actitud no valorativa", "Optimismo", "Presencia", "Conducta no verbal", "Contención afectos",
  ];

  type CompRow = Record<string, number | string | null>;

  // Build rows
  const headers = [
    "Alumno", "Email", "Institución", "Nivel", "XP", "Sesiones", "Racha",
    "Puntaje promedio",
    ...V2_LABELS,
    "Evaluaciones aprobadas", "Registro",
  ];

  const rows = (students || []).map((s) => {
    const studentSessions = sessions?.filter((sess) => sess.student_id === s.id) || [];
    const prog = progressMap.get(s.id);

    // Compute V2 averages
    const v2Scores = studentSessions.flatMap((sess) => {
      const comp = (sess.session_competencies as CompRow[] | null)?.[0];
      if (!comp || comp.eval_version !== 2) return [];
      return [comp];
    });

    const v2Avgs = V2_KEYS.map((key) => {
      const vals = v2Scores.map((c) => Number(c[key]) || 0).filter((v) => v > 0);
      return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : "—";
    });

    const overallScores = studentSessions.flatMap((sess) => {
      const comp = (sess.session_competencies as CompRow[] | null)?.[0];
      const score = comp?.overall_score_v2 ?? comp?.overall_score;
      return score != null ? [Number(score)] : [];
    });
    const avg = overallScores.length > 0
      ? (overallScores.reduce((a, b) => a + b, 0) / overallScores.length).toFixed(2)
      : "—";

    const approved = studentSessions.filter((sess) => {
      const comp = (sess.session_competencies as CompRow[] | null)?.[0];
      return comp?.feedback_status === "approved";
    }).length;

    return [
      s.full_name || "",
      s.email,
      estMap.get(s.establishment_id) || "—",
      prog?.level_name || "Sin actividad",
      String(prog?.total_xp || 0),
      String(studentSessions.length),
      String(prog?.current_streak || 0),
      avg,
      ...v2Avgs,
      `${approved}/${studentSessions.length}`,
      new Date(s.created_at).toLocaleDateString("es-CL"),
    ];
  });

  // BOM for Excel UTF-8
  const BOM = "\uFEFF";
  const csv = BOM + [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const filename = `metricas-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
