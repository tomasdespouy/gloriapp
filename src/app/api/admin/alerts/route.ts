import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyScope, resolveAdminScopeRules } from "@/lib/admin-scope";

// GLOBAL chat_alerts feed for the Métricas section. Unlike the per-pilot
// endpoint, this is NOT scoped to a pilot — it surfaces alerts across all
// students the admin can see (superadmin = everyone; admin = students of
// their establishments). This is the feed that catches violence/incidents
// from users who are NOT part of a monitored pilot.

async function authAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 as const };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "superadmin") {
    return { error: "No autorizado", status: 403 as const };
  }
  return { user, isSuperadmin: profile.role === "superadmin" };
}

// Resolve the student_ids an admin may see. null => no restriction (superadmin).
async function scopedStudentIds(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<string[]> {
  const rules = await resolveAdminScopeRules(admin, userId);
  if (rules.length === 0) return [];
  const { data: studs } = await applyScope(
    admin.from("profiles").select("id").eq("role", "student"),
    { all: false, rules },
  );
  return (studs || []).map((s) => s.id);
}

export async function GET(request: Request) {
  const auth = await authAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const url = new URL(request.url);
  const highOnly = url.searchParams.get("severity") === "high"; // high+critical
  const onlyUnreviewed = url.searchParams.get("unreviewed") === "1";

  let studentIds: string[] | null = null;
  if (!auth.isSuperadmin) {
    studentIds = await scopedStudentIds(admin, auth.user.id);
    if (studentIds.length === 0) return NextResponse.json({ alerts: [], total: 0, unreviewed: 0 });
  }

  let q = admin
    .from("chat_alerts")
    .select("id, conversation_id, student_id, ai_patient_id, source, kind, severity, matched_terms, sample, turn_number, reviewed_at, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (studentIds) q = q.in("student_id", studentIds);
  if (highOnly) q = q.in("severity", ["high", "critical"]);
  if (onlyUnreviewed) q = q.is("reviewed_at", null);

  const { data: alerts } = await q;
  const rows = alerts || [];

  const sids = [...new Set(rows.map((r) => r.student_id).filter((v): v is string => !!v))];
  const pids = [...new Set(rows.map((r) => r.ai_patient_id).filter((v): v is string => !!v))];
  const [studsRes, patsRes] = await Promise.all([
    sids.length ? admin.from("profiles").select("id, full_name, email").in("id", sids) : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
    pids.length ? admin.from("ai_patients").select("id, name").in("id", pids) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const sMap = new Map((studsRes.data || []).map((s) => [s.id, s]));
  const pMap = new Map((patsRes.data || []).map((p) => [p.id, p.name]));

  const enriched = rows.map((r) => ({
    ...r,
    student_name: r.student_id ? sMap.get(r.student_id)?.full_name ?? sMap.get(r.student_id)?.email ?? null : null,
    student_email: r.student_id ? sMap.get(r.student_id)?.email ?? null : null,
    patient_name: r.ai_patient_id ? pMap.get(r.ai_patient_id) ?? null : null,
  }));

  return NextResponse.json({
    alerts: enriched,
    total: enriched.length,
    unreviewed: enriched.filter((a) => !a.reviewed_at).length,
  });
}

export async function PATCH(request: Request) {
  const auth = await authAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { alert_id?: string; reviewed?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 }); }
  if (!body.alert_id) return NextResponse.json({ error: "alert_id es requerido" }, { status: 400 });

  const admin = createAdminClient();

  // Un admin acotado solo puede marcar alertas de alumnos dentro de su alcance.
  if (!auth.isSuperadmin) {
    const { data: al } = await admin.from("chat_alerts").select("student_id").eq("id", body.alert_id).maybeSingle();
    const allowed = await scopedStudentIds(admin, auth.user.id);
    if (!al?.student_id || !allowed.includes(al.student_id)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const { error } = await admin.from("chat_alerts").update({
    reviewed_at: body.reviewed === false ? null : new Date().toISOString(),
    reviewed_by: body.reviewed === false ? null : auth.user.id,
  }).eq("id", body.alert_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
