import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function requireSuperadmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") {
    return { error: NextResponse.json({ error: "Solo superadmin" }, { status: 403 }) };
  }

  return { supabase, user };
}

export async function GET(request: Request) {
  const auth = await requireSuperadmin();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth as { supabase: Awaited<ReturnType<typeof createClient>>; user: { id: string } };

  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get("school_id");

  let query = supabase
    .from("growth_contacts")
    .select("*, growth_schools(name, country)")
    .order("created_at", { ascending: false });

  if (schoolId) query = query.eq("school_id", schoolId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth as { supabase: Awaited<ReturnType<typeof createClient>>; user: { id: string } };

  const body = await request.json();
  const { school_id, full_name, email, role_title, phone, notes } = body;

  if (!full_name || !email) {
    return NextResponse.json({ error: "full_name y email son requeridos" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("growth_contacts")
    .insert({ school_id, full_name, email, role_title, phone, notes })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: Request) {
  const auth = await requireSuperadmin();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth as { supabase: Awaited<ReturnType<typeof createClient>>; user: { id: string } };

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const { data, error } = await supabase
    .from("growth_contacts")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const auth = await requireSuperadmin();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth as { supabase: Awaited<ReturnType<typeof createClient>>; user: { id: string } };

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const { error } = await supabase.from("growth_contacts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
