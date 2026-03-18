import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

export async function GET(request: Request) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const country = searchParams.get("country");
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  let query = auth.supabase
    .from("crm_universities")
    .select("*")
    .order("name");

  if (country) query = query.eq("country", country);
  if (status) query = query.eq("status", status);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { data, error } = await auth.supabase
    .from("crm_universities")
    .insert(body)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
