import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_CONSENT_TEXT,
  DEFAULT_CONSENT_TEXT_ANON,
} from "@/lib/consent-texts";

async function requireSuperadmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") return { error: "No autorizado", status: 403 };
  return { user, supabase };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;

  const { data: pilot, error } = await auth.supabase
    .from("pilots")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const { data: participants } = await auth.supabase
    .from("pilot_participants")
    .select("*")
    .eq("pilot_id", id)
    .order("full_name");

  // Enrich participants with live data from profiles + conversations
  const enriched = await enrichParticipants(participants || [], auth.supabase);

  return NextResponse.json({ ...pilot, participants: enriched });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enrichParticipants(participants: any[], supabase: any) {
  const withUserId = participants.filter((p) => p.user_id);
  if (withUserId.length === 0) return participants;

  const userIds = withUserId.map((p) => p.user_id);

  // Fetch last sign-in from auth.users via admin client
  const admin = createAdminClient();
  const loginMap = new Map<string, string | null>();
  // Batch fetch auth users
  for (const uid of userIds) {
    const { data } = await admin.auth.admin.getUserById(uid);
    if (data?.user) {
      loginMap.set(uid, data.user.last_sign_in_at || null);
    }
  }

  // Fetch session counts and last activity from conversations
  const { data: sessionStats } = await supabase
    .from("conversations")
    .select("student_id, created_at")
    .in("student_id", userIds);

  const sessionsMap = new Map<string, { count: number; lastAt: string | null }>();
  for (const row of sessionStats || []) {
    const prev = sessionsMap.get(row.student_id) || { count: 0, lastAt: null };
    prev.count += 1;
    if (!prev.lastAt || row.created_at > prev.lastAt) prev.lastAt = row.created_at;
    sessionsMap.set(row.student_id, prev);
  }

  // Fetch every closure-survey row per user (both completed and
  // declined). We split by status so the UI can render three distinct
  // states:
  //   survey_completed_at — MAX created_at where status='completed'
  //   survey_declined_at  — MAX created_at where status='not_taken'
  //                         (label rendered as "No realizada")
  //   both null           — pending (never responded, never declined)
  const { data: surveyRows } = await supabase
    .from("survey_responses")
    .select("user_id, created_at, status")
    .in("user_id", userIds);

  const surveyMap = new Map<string, string>();
  const declinedMap = new Map<string, string>();
  for (const row of surveyRows || []) {
    const target = row.status === "not_taken" ? declinedMap : surveyMap;
    const prev = target.get(row.user_id);
    if (!prev || row.created_at > prev) target.set(row.user_id, row.created_at);
  }

  // Merge into participants and update DB in background
  return participants.map((p) => {
    if (!p.user_id) return p;

    const lastSignIn = loginMap.get(p.user_id) || null;
    const stats = sessionsMap.get(p.user_id);
    const sessionsCount = stats?.count || 0;
    const lastActive = stats?.lastAt || lastSignIn || null;
    const firstLogin = lastSignIn || null;
    const surveyCompletedAt = surveyMap.get(p.user_id) || null;
    const surveyDeclinedAt = declinedMap.get(p.user_id) || null;

    // Determine live status
    let status = p.status;
    if (p.status === "invitado" && firstLogin) {
      status = "activo";
    }

    // Fire-and-forget update to keep pilot_participants in sync
    if (
      p.first_login_at !== firstLogin ||
      p.sessions_count !== sessionsCount ||
      p.status !== status
    ) {
      supabase
        .from("pilot_participants")
        .update({
          first_login_at: firstLogin,
          sessions_count: sessionsCount,
          last_active_at: lastActive,
          status,
        })
        .eq("id", p.id)
        .then(() => {});
    }

    return {
      ...p,
      first_login_at: firstLogin,
      sessions_count: sessionsCount,
      last_active_at: lastActive,
      survey_completed_at: surveyCompletedAt,
      survey_declined_at: surveyDeclinedAt,
      status,
    };
  });
}

// Whitelist of fields the PATCH endpoint will accept. Anything else in
// the request body is silently ignored — protects columns like id,
// created_by, created_at and avoids privilege-escalation surprises.
const PATCH_ALLOWED_FIELDS = new Set([
  "name",
  "institution",
  "country",
  "contact_name",
  "contact_email",
  "csv_data",
  "scheduled_at",
  "started_at",
  "ended_at",
  "establishment_id",
  "status",
  "email_template",
  "report_url",
  "consent_text",
  "consent_version",
  "test_mode",
  "enrollment_slug",
  "logo_url",
  "ui_config",
  "is_anonymous",
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();

  // Filter to whitelisted fields only
  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (PATCH_ALLOWED_FIELDS.has(k)) update[k] = v;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "Ningún campo válido para actualizar" },
      { status: 400 },
    );
  }

  // Lock: una vez status=finalizado el piloto queda congelado. La única
  // mutación admitida es la propia transición a "finalizado" (idempotente)
  // y los timestamps que la acompañan (ended_at), para que el handler que
  // dispara la finalización siga funcionando si se reintenta. Cualquier
  // otro cambio se rechaza para preservar la información del informe.
  const { data: currentPilot } = await auth.supabase
    .from("pilots")
    .select("status")
    .eq("id", id)
    .single();
  if (currentPilot?.status === "finalizado") {
    const tryingToReopen =
      "status" in update && update.status !== "finalizado";
    const writingProtectedField = Object.keys(update).some(
      (k) => k !== "status" && k !== "ended_at" && k !== "updated_at",
    );
    if (tryingToReopen || writingProtectedField) {
      return NextResponse.json(
        {
          error:
            "Este piloto está finalizado y no admite cambios. La información del informe queda congelada.",
        },
        { status: 409 },
      );
    }
  }

  // Smart swap: if the admin flips is_anonymous and the stored consent
  // text is still one of our bakeable defaults, swap it to the matching
  // one. Custom text (edited by the admin) is left alone.
  if ("is_anonymous" in update && !("consent_text" in update)) {
    const { data: current } = await auth.supabase
      .from("pilots")
      .select("consent_text")
      .eq("id", id)
      .single();
    const currentText = current?.consent_text || "";
    const goingAnon = update.is_anonymous === true;
    if (goingAnon && currentText === DEFAULT_CONSENT_TEXT) {
      update.consent_text = DEFAULT_CONSENT_TEXT_ANON;
    } else if (!goingAnon && currentText === DEFAULT_CONSENT_TEXT_ANON) {
      update.consent_text = DEFAULT_CONSENT_TEXT;
    }
  }

  // If editing consent_text, bump consent_version automatically so any
  // in-flight enrollment is rejected with a friendly "recarga la página"
  // message instead of accidentally signing the wrong text.
  if ("consent_text" in update && !("consent_version" in update)) {
    update.consent_version = `v${Date.now()}`;
  }

  update.updated_at = new Date().toISOString();

  const { data, error } = await auth.supabase
    .from("pilots")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;

  // Participants are deleted via CASCADE
  const { error } = await auth.supabase
    .from("pilots")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
