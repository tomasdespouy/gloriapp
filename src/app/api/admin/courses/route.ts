import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const establishmentId = request.nextUrl.searchParams.get("establishment_id");

  let query = admin.from("courses").select("id, name, code, establishment_id, is_active").order("name");
  if (establishmentId) query = query.eq("establishment_id", establishmentId);

  const { data } = await query;
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "superadmin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { name, code, establishment_id } = await request.json();
  if (!name || !establishment_id) return NextResponse.json({ error: "name y establishment_id requeridos" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.from("courses").insert({ name, code: code || null, establishment_id }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
