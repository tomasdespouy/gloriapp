import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = createAdminClient();

  const { data: surveys } = await admin
    .from("surveys")
    .select("*, survey_responses(id)")
    .order("created_at", { ascending: false });

  const result = (surveys || []).map((s) => ({
    ...s,
    responseCount: (s.survey_responses as unknown[])?.length || 0,
    survey_responses: undefined,
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const admin = createAdminClient();

  // Default new surveys to the v2 questionnaire. The legacy form (NULL)
  // has been retired from circulation; allow an explicit override only
  // if the caller passes a form_version string (keeps the door open for
  // future questionnaire versions without another hardening patch).
  const formVersion = typeof body.form_version === "string" && body.form_version.length > 0
    ? body.form_version
    : "v2_pilot";

  const { data, error } = await admin.from("surveys").insert({
    title: body.title,
    scope_type: body.scope_type,
    scope_id: body.scope_id || null,
    starts_at: body.starts_at,
    ends_at: body.ends_at,
    created_by: user.id,
    form_version: formVersion,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
