import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Get user's profile for scoping
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, establishment_id, course_id, section_id")
    .eq("id", user.id)
    .single();

  // Admins and superadmins don't receive surveys
  if (profile?.role === "admin" || profile?.role === "superadmin") {
    return NextResponse.json([]);
  }

  // Gate: the survey asks about the student's experience using the
  // platform, so it only makes sense once they've actually finished at
  // least one session via the "Finalizar" button. We key on
  // conversations.status='completed' (set at the START of the complete
  // endpoint, before the LLM evaluator runs) so the gate opens
  // instantly — the survey can pop even if the async evaluator is
  // still crunching in the background.
  const { count: completedSessions } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("student_id", user.id)
    .eq("status", "completed");

  if (!completedSessions || completedSessions < 1) {
    return NextResponse.json([]);
  }

  // Get establishment country
  let country: string | null = null;
  if (profile?.establishment_id) {
    const { data: est } = await supabase
      .from("establishments").select("country").eq("id", profile.establishment_id).single();
    country = est?.country || null;
  }

  // Find active surveys matching user's scope
  const { data: surveys } = await supabase
    .from("surveys")
    .select("*")
    .eq("is_active", true)
    .lte("starts_at", new Date().toISOString())
    .gte("ends_at", new Date().toISOString());

  // Check which ones the user has already responded
  const { data: responses } = await supabase
    .from("survey_responses")
    .select("survey_id")
    .eq("user_id", user.id);

  const respondedIds = new Set((responses || []).map(r => r.survey_id));

  // For pilot-scoped surveys we also suppress any *other* survey that
  // belongs to the same pilot once the user has answered one of them.
  // This is how we avoid re-prompting veteran pilot users when we ship
  // a newer questionnaire version (form_version='v2_pilot') alongside
  // the legacy one: they already answered v1, so they won't see v2.
  let pilotIdsAlreadyAnswered = new Set<string>();
  if (respondedIds.size > 0) {
    const { data: respondedSurveys } = await supabase
      .from("surveys")
      .select("id, pilot_id")
      .in("id", Array.from(respondedIds));
    pilotIdsAlreadyAnswered = new Set(
      (respondedSurveys || [])
        .map((s: { pilot_id: string | null }) => s.pilot_id)
        .filter((p): p is string => !!p),
    );
  }

  // Pre-fetch the set of pilot_ids the user belongs to — used to gate
  // pilot-scoped surveys. Users who don't belong to any pilot get an
  // empty set, which means pilot-scoped surveys are silently skipped.
  const { data: pilotRows } = await supabase
    .from("pilot_participants")
    .select("pilot_id")
    .eq("user_id", user.id);
  const userPilotIds = new Set(
    (pilotRows || []).map((r: { pilot_id: string }) => r.pilot_id),
  );

  // Filter surveys by scope and not yet responded
  const applicable = (surveys || []).filter(s => {
    if (respondedIds.has(s.id)) return false;
    // Pilot-scoped survey: only visible to pilot participants of that
    // same pilot, regardless of their establishment/country/course.
    if (s.pilot_id) {
      // Veteran guard: if the user already answered ANY survey of this
      // same pilot, don't re-prompt them with another (e.g. newer v2
      // form version). Prevents double-surveying when we ship a newer
      // questionnaire mid-pilot.
      if (pilotIdsAlreadyAnswered.has(s.pilot_id)) return false;
      return userPilotIds.has(s.pilot_id);
    }
    if (s.scope_type === "global") return true;
    if (s.scope_type === "country" && s.scope_id === country) return true;
    if (s.scope_type === "establishment" && s.scope_id === profile?.establishment_id) return true;
    if (s.scope_type === "course" && s.scope_id === profile?.course_id) return true;
    if (s.scope_type === "section" && s.scope_id === profile?.section_id) return true;
    return false;
  });

  // Priority ordering — SurveyModal picks data[0], so the first item must
  // be the most relevant survey for this user. Without this, legacy
  // establishment-scoped surveys (is_active=true, pilot_id=null) created
  // in prior months can outrank a brand-new v2_pilot survey for the
  // user's actual pilot, and the student sees the old questionnaire.
  applicable.sort((a, b) => {
    // 1) Survey of a pilot the user currently belongs to wins over any
    //    non-pilot or other-pilot survey.
    const aIsMyPilot = !!(a.pilot_id && userPilotIds.has(a.pilot_id));
    const bIsMyPilot = !!(b.pilot_id && userPilotIds.has(b.pilot_id));
    if (aIsMyPilot !== bIsMyPilot) return aIsMyPilot ? -1 : 1;
    // 2) Newer questionnaire version (v2_pilot) wins over legacy (NULL).
    const aIsV2 = a.form_version === "v2_pilot";
    const bIsV2 = b.form_version === "v2_pilot";
    if (aIsV2 !== bIsV2) return aIsV2 ? -1 : 1;
    // 3) Fallback: most recently created first (deterministic).
    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });

  return NextResponse.json(applicable);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();
  const { survey_id, nps_score, positives, improvements, comments, answers, decline } = body;

  if (!survey_id) {
    return NextResponse.json({ error: "survey_id es requerido" }, { status: 400 });
  }

  // Decline path: student pressed "No realizar". We persist an explicit
  // row with status='not_taken' so superadmin can distinguish this from
  // "still pending" — no answers, no NPS, just the intent.
  if (decline === true) {
    const { error } = await supabase.from("survey_responses").insert({
      survey_id,
      user_id: user.id,
      nps_score: null,
      positives: null,
      improvements: null,
      comments: null,
      answers: null,
      status: "not_taken",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, status: "not_taken" });
  }

  // Accept both legacy NPS payload and new flexible JSONB answers payload.
  // At least one of the two must be provided.
  if (answers == null && nps_score == null) {
    return NextResponse.json(
      { error: "Debes enviar al menos una respuesta" },
      { status: 400 },
    );
  }

  // If the client sent a JSONB answers payload, enrich it with the
  // demographic fields the user already gave us at pilot enrollment.
  // The original Microsoft Form has q1-q4 (carrera, género, edad, rol)
  // but we don't ask the user to retype them; we look them up from
  // pilot_consents (most recent row for this user) and merge.
  let enrichedAnswers: Record<string, unknown> | null = null;
  if (answers != null && typeof answers === "object") {
    enrichedAnswers = { ...(answers as Record<string, unknown>) };

    // pilot_consents is superadmin-only via RLS, so we use the admin client.
    // The lookup is scoped strictly to the authenticated user (user.id).
    const admin = createAdminClient();
    const { data: consent } = await admin
      .from("pilot_consents")
      .select("university, gender, age, role")
      .eq("user_id", user.id)
      .order("signed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (consent) {
      // Don't overwrite if the client already sent these fields explicitly.
      if (enrichedAnswers.q1_carrera == null) enrichedAnswers.q1_carrera = consent.university || null;
      if (enrichedAnswers.q2_genero == null)  enrichedAnswers.q2_genero = consent.gender || null;
      if (enrichedAnswers.q3_edad == null)    enrichedAnswers.q3_edad = consent.age ?? null;
      if (enrichedAnswers.q4_rol == null)     enrichedAnswers.q4_rol = consent.role || null;
    }
  }

  const { error } = await supabase.from("survey_responses").insert({
    survey_id,
    user_id: user.id,
    nps_score: nps_score ?? null,
    positives: positives || null,
    improvements: improvements || null,
    comments: comments || null,
    answers: enrichedAnswers ?? answers ?? null,
    status: "completed",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
