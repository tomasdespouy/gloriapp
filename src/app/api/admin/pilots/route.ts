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

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { name, institution, country, contact_name, contact_email, csv_data } = body;

  if (!name || !institution) {
    return NextResponse.json({ error: "Nombre e institución son requeridos" }, { status: 400 });
  }

  // Create the pilot
  const { data: pilot, error: pilotError } = await auth.supabase
    .from("pilots")
    .insert({
      name,
      institution,
      country: country || null,
      contact_name: contact_name || null,
      contact_email: contact_email || null,
      csv_data: csv_data || [],
      created_by: auth.user.id,
      status: "borrador",
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

  return NextResponse.json(pilot, { status: 201 });
}
