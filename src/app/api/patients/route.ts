import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: patients, error } = await admin
    .from("ai_patients")
    .select("id, name, age, occupation, quote, difficulty_level, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(patients);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Only superadmin can create patients. Use the real DB role (not the
  // impersonation cookie, which is UI-only) so an admin can't POST directly.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin puede crear pacientes" }, { status: 403 });
  }

  try {
    let patientData: Record<string, unknown>;

    // Support both JSON and FormData
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      patientData = await request.json();
    } else {
      const formData = await request.formData();
      const dataStr = formData.get("data") as string;
      patientData = JSON.parse(dataStr);
    }

    const admin = createAdminClient();

    // Build insert object with safe defaults
    const insertData: Record<string, unknown> = {
      name: patientData.name,
      age: patientData.age || 30,
      occupation: patientData.occupation || "",
      quote: patientData.quote || "",
      presenting_problem: patientData.presenting_problem || "",
      backstory: patientData.backstory || "",
      personality_traits: patientData.personality_traits || {},
      system_prompt: patientData.system_prompt || "",
      difficulty_level: patientData.difficulty_level || "beginner",
      tags: patientData.tags || [],
      skills_practiced: patientData.skills_practiced || [],
      total_sessions: patientData.total_sessions || 5,
      country: patientData.country || ["Chile"],
      country_origin: patientData.country_origin || (Array.isArray(patientData.country) ? (patientData.country as string[])[0] : "Chile"),
      country_residence: patientData.country_residence || (Array.isArray(patientData.country) ? (patientData.country as string[])[0] : "Chile"),
      birthday: patientData.birthday || null,
      neighborhood: patientData.neighborhood || null,
      family_members: patientData.family_members || [],
      is_active: true,
    };

    // New workflow fields (optional)
    if (patientData.short_narrative) insertData.short_narrative = patientData.short_narrative;
    if (patientData.extended_narrative) insertData.extended_narrative = patientData.extended_narrative;
    if (patientData.coherence_review) insertData.coherence_review = patientData.coherence_review;
    if (patientData.projections) insertData.projections = patientData.projections;

    const { data: patient, error } = await admin
      .from("ai_patients")
      .insert(insertData)
      .select("id, name")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(patient, { status: 201 });
  } catch (error) {
    console.error("Error creating patient:", error);
    return NextResponse.json({ error: "Error al crear el paciente" }, { status: 500 });
  }
}
