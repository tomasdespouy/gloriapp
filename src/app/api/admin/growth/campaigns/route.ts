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

export async function GET() {
  const auth = await requireSuperadmin();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth as { supabase: Awaited<ReturnType<typeof createClient>>; user: { id: string } };

  const { data, error } = await supabase
    .from("growth_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth as { supabase: Awaited<ReturnType<typeof createClient>>; user: { id: string } };

  const body = await request.json();
  const { name, subject, html_body } = body;

  if (!name || !subject || !html_body) {
    return NextResponse.json({ error: "name, subject y html_body son requeridos" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("growth_campaigns")
    .insert({ name, subject, html_body })
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
    .from("growth_campaigns")
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

  const { error } = await supabase.from("growth_campaigns").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
