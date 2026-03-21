import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { searchParams } = request.nextUrl;
  const country = searchParams.get("country");
  const difficulty = searchParams.get("difficulty");

  let query = admin
    .from("ai_patients")
    .select("id, name, country, difficulty_level")
    .eq("is_active", true);

  if (country) {
    query = query.contains("country", [country]);
  }
  if (difficulty) {
    query = query.eq("difficulty_level", difficulty);
  }

  const { data, error } = await query.order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
