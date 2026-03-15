import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const admin = createAdminClient();
  const searchParams = request.nextUrl.searchParams;
  const role = searchParams.get("role");
  const establishment_id = searchParams.get("establishment_id");
  const search = searchParams.get("search");

  let query = admin.from("profiles").select("id, email, full_name, role, establishment_id, created_at").order("full_name");

  if (role) query = query.eq("role", role);
  if (establishment_id) query = query.eq("establishment_id", establishment_id);
  if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);

  // Scope for non-superadmin
  if (profile.role !== "superadmin") {
    const { data: assignments } = await admin
      .from("admin_establishments")
      .select("establishment_id")
      .eq("admin_id", user.id);

    const estIds = assignments?.map((a) => a.establishment_id) || [];
    if (estIds.length > 0) {
      query = query.in("establishment_id", estIds);
    } else {
      return NextResponse.json([]);
    }
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
