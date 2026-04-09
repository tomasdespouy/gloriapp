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

  // Filter surveys by scope and not yet responded
  const applicable = (surveys || []).filter(s => {
    if (respondedIds.has(s.id)) return false;
    if (s.scope_type === "global") return true;
    if (s.scope_type === "country" && s.scope_id === country) return true;
    if (s.scope_type === "establishment" && s.scope_id === profile?.establishment_id) return true;
    if (s.scope_type === "course" && s.scope_id === profile?.course_id) return true;
    if (s.scope_type === "section" && s.scope_id === profile?.section_id) return true;
    return false;
  });

  return NextResponse.json(applicable);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();
  const { survey_id, nps_score, positives, improvements, comments, answers } = body;

  if (!survey_id) {
    return NextResponse.json({ error: "survey_id es requerido" }, { status: 400 });
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
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
