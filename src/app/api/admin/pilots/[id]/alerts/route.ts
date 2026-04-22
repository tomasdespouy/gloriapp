import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Returns the observational chat_alerts for a pilot, enriched with
// participant name + email so the dashboard can render a table
// without extra joins client-side.
//
// Superadmin-only. Rows are scoped to students that belong to the
// pilot (i.e. have a pilot_participants row pointing at this pilot).

type AlertRow = {
  id: string;
  conversation_id: string;
  message_id: string | null;
  student_id: string | null;
  ai_patient_id: string | null;
  source: "user" | "assistant";
  kind: string;
  severity: "low" | "medium" | "high" | "critical";
  matched_terms: string | null;
  sample: string | null;
  turn_number: number | null;
  reviewed_at: string | null;
  created_at: string;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: pilotId } = await params;
  const admin = createAdminClient();

  // 1. Participants in this pilot → user_ids scope.
  const { data: participants } = await admin
    .from("pilot_participants")
    .select("user_id, full_name, email")
    .eq("pilot_id", pilotId);

  const participantList = participants || [];
  const userIds = participantList
    .map((p) => p.user_id)
    .filter((v): v is string => !!v);

  if (userIds.length === 0) {
    return NextResponse.json({ alerts: [], total: 0, unreviewed: 0 });
  }

  // 2. All alerts for those students, newest first. Cap at 500 to
  // keep the dashboard snappy — pilots with more alerts can filter
  // via the review flag.
  const { data: alerts } = await admin
    .from("chat_alerts")
    .select(
      "id, conversation_id, message_id, student_id, ai_patient_id, source, kind, severity, matched_terms, sample, turn_number, reviewed_at, created_at",
    )
    .in("student_id", userIds)
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (alerts || []) as AlertRow[];

  // 3. Enrich with participant info (name + email) and patient name.
  const participantByUserId = new Map(
    participantList.map((p) => [p.user_id, { full_name: p.full_name, email: p.email }]),
  );

  const patientIds = [...new Set(rows.map((r) => r.ai_patient_id).filter((v): v is string => !!v))];
  let patientsMap = new Map<string, string>();
  if (patientIds.length > 0) {
    const { data: pats } = await admin
      .from("ai_patients")
      .select("id, name")
      .in("id", patientIds);
    patientsMap = new Map((pats || []).map((p) => [p.id, p.name]));
  }

  const enriched = rows.map((r) => ({
    ...r,
    student_name: r.student_id ? participantByUserId.get(r.student_id)?.full_name ?? null : null,
    student_email: r.student_id ? participantByUserId.get(r.student_id)?.email ?? null : null,
    patient_name: r.ai_patient_id ? patientsMap.get(r.ai_patient_id) ?? null : null,
  }));

  const unreviewed = enriched.filter((a) => !a.reviewed_at).length;

  return NextResponse.json({
    alerts: enriched,
    total: enriched.length,
    unreviewed,
  });
}

// Minimal PATCH so the superadmin can mark an alert as reviewed from
// the dashboard. Updates reviewed_at / reviewed_by / review_notes on
// the targeted row. Any other body keys are ignored.
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { alert_id?: string; reviewed?: boolean; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  if (!body.alert_id) {
    return NextResponse.json({ error: "alert_id es requerido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const update: Record<string, unknown> = {
    reviewed_at: body.reviewed === false ? null : new Date().toISOString(),
    reviewed_by: body.reviewed === false ? null : user.id,
  };
  if (typeof body.notes === "string") update.review_notes = body.notes;

  const { error } = await admin
    .from("chat_alerts")
    .update(update)
    .eq("id", body.alert_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
