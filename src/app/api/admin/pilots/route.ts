import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  // Use admin client to bypass RLS (auth already verified above)
  const admin = createAdminClient();
  return { user, supabase: admin };
}

export async function GET() {
  const auth = await requireSuperadmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data: pilots, error } = await auth.supabase
    .from("pilots")
    .select("*, pilot_participants(id)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = (pilots || []).map((p) => ({
    ...p,
    participant_count: (p.pilot_participants as { id: string }[])?.length || 0,
    pilot_participants: undefined,
  }));

  return NextResponse.json(result);
}

// Default consent text used when an admin creates a pilot without
// providing one. They can edit it later from the pilot detail screen.
const DEFAULT_CONSENT_TEXT = `Consentimiento Informado — Piloto GlorIA

Por favor lee con calma. Si tienes dudas antes de aceptar, escríbenos a soporte@glor-ia.com.

¿Qué es GlorIA?
GlorIA es una plataforma de aprendizaje basada en inteligencia artificial diseñada para que estudiantes de psicología practiquen entrevistas clínicas en un entorno seguro, sin riesgo para personas reales. Cada conversación queda registrada y es evaluada automáticamente por IA conforme a un marco de diez competencias clínicas.

¿Qué se te pide?
Participar voluntariamente en sesiones de práctica con pacientes simulados durante el período del piloto. Después de cada sesión, completarás una breve auto-reflexión y recibirás retroalimentación inmediata sobre tu desempeño.

¿Qué datos se recogen?
- Nombre completo, correo electrónico, edad, género y rol (estudiante / docente / coordinador)
- Universidad o institución a la que perteneces
- Las conversaciones que sostengas con los pacientes virtuales
- Tus respuestas a las auto-reflexiones post-sesión
- Las evaluaciones automáticas de IA sobre tus competencias clínicas

¿Cómo se usan tus datos?
Tus datos serán utilizados única y exclusivamente para fines investigativos y formativos del proyecto GlorIA, en condiciones de confidencialidad. Cualquier publicación o reporte derivado del piloto presentará los resultados de forma agregada y anonimizada — tu nombre no aparecerá nunca asociado a tus respuestas individuales. Tus datos no serán compartidos con terceros ajenos al proyecto.

Tus derechos
- Puedes retirar tu consentimiento en cualquier momento, escribiéndonos a soporte@glor-ia.com.
- Puedes solicitar acceso a una copia de tus datos personales en cualquier momento.
- Puedes solicitar la eliminación de tus datos al finalizar el piloto.

Al firmar este consentimiento, declaro que he leído y comprendido la información anterior, y acepto participar voluntariamente en el piloto institucional de GlorIA.`;

function generateEnrollmentSlug(name: string, institution: string): string {
  const base = `${institution}-${name}`
    .toLowerCase()
    .normalize("NFD")
    // Remove diacritics
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  // Append a 6-char random suffix to avoid collisions
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`.slice(0, 70);
}

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const {
    name,
    institution,
    country,
    contact_name,
    contact_email,
    csv_data,
    scheduled_at,
    ended_at,
    establishment_id,
    consent_text,
    test_mode,
    logo_url,
  } = body;

  if (!name) {
    return NextResponse.json({ error: "Nombre es requerido" }, { status: 400 });
  }

  if (!establishment_id) {
    return NextResponse.json({ error: "Establecimiento es requerido" }, { status: 400 });
  }

  // Auto-resolve institution + country from the chosen establishment if
  // the client didn't send them (the UI hides those fields now, the
  // establishment is the single source of truth).
  let finalInstitution = (institution || "").trim();
  let finalCountry = (country || "").trim() || null;
  if (!finalInstitution) {
    const { data: est } = await auth.supabase
      .from("establishments")
      .select("name, country")
      .eq("id", establishment_id)
      .single();
    if (!est) {
      return NextResponse.json({ error: "Establecimiento no encontrado" }, { status: 400 });
    }
    finalInstitution = est.name;
    if (!finalCountry) finalCountry = est.country || null;
  }

  // Create the pilot
  const { data: pilot, error: pilotError } = await auth.supabase
    .from("pilots")
    .insert({
      name,
      institution: finalInstitution,
      country: finalCountry,
      contact_name: contact_name || null,
      contact_email: contact_email || null,
      csv_data: csv_data || [],
      scheduled_at: scheduled_at || null,
      ended_at: ended_at || null,
      establishment_id,
      created_by: auth.user.id,
      status: "borrador",
      enrollment_slug: generateEnrollmentSlug(name, finalInstitution),
      consent_text: consent_text || DEFAULT_CONSENT_TEXT,
      consent_version: "v1",
      test_mode: test_mode === true,
      logo_url: logo_url?.trim() || null,
    })
    .select()
    .single();

  if (pilotError) return NextResponse.json({ error: pilotError.message }, { status: 500 });

  // Insert participants from csv_data
  if (csv_data && Array.isArray(csv_data) && csv_data.length > 0) {
    const participants = csv_data.map((row: { email: string; full_name: string; role: string }) => ({
      pilot_id: pilot.id,
      email: row.email,
      full_name: row.full_name,
      role: row.role || "student",
      status: "pendiente",
    }));

    const { error: partError } = await auth.supabase
      .from("pilot_participants")
      .insert(participants);

    if (partError) {
      console.error("Error inserting participants:", partError);
    }
  }

  // Auto-create the experience survey for this pilot's establishment.
  // The SurveyModal in (app)/layout.tsx fetches /api/surveys/active on
  // mount and pops the modal if it finds one the current user has not
  // yet responded to. By creating the survey here, every participant of
  // every new pilot gets prompted automatically after their first
  // session, without the admin having to remember to click anything.
  const surveyEndsAt = ended_at
    ? new Date(new Date(ended_at).getTime() + 7 * 24 * 60 * 60 * 1000) // pilot end + 7 days
    : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);                  // 90 days from now
  await auth.supabase.from("surveys").insert({
    title: `Experiencia ${pilot.name} — ${pilot.institution}`,
    scope_type: "establishment",
    scope_id: establishment_id,
    // Pilot-scoped: visible only to members of this pilot. Without this
    // column, any user of the establishment would see the survey — even
    // those not in the pilot.
    pilot_id: pilot.id,
    // New pilots created from here on use the v2_pilot questionnaire.
    // Legacy pilots keep form_version NULL (v1) and are unaffected.
    form_version: "v2_pilot",
    starts_at: scheduled_at || new Date().toISOString(),
    ends_at: surveyEndsAt.toISOString(),
    is_active: true,
    created_by: auth.user.id,
  });

  return NextResponse.json(pilot, { status: 201 });
}
