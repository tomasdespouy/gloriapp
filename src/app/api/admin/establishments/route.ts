import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { logAdminAction } from "@/lib/audit";

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
  return { user, profile };
}

export async function GET() {
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

  if (profile.role === "superadmin") {
    const { data, error } = await admin.from("establishments").select("*").order("name");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Admin: only assigned
  const { data: assignments } = await admin
    .from("admin_establishments")
    .select("establishment_id")
    .eq("admin_id", user.id);

  const estIds = assignments?.map((a) => a.establishment_id) || [];
  if (estIds.length === 0) return NextResponse.json([]);

  const { data, error } = await admin.from("establishments").select("*").in("id", estIds).order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { name, slug, logo_url, is_active, country, website_url, contact_name, contact_email } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "name y slug son requeridos" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("establishments")
    .insert({
      name, slug,
      logo_url: logo_url || null,
      is_active: is_active ?? true,
      country: country || null,
      website_url: website_url || null,
      contact_name: contact_name || null,
      contact_email: contact_email || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    adminId: auth.user.id,
    action: "create_establishment",
    entityType: "establishment",
    entityId: data.id,
    details: { name, slug },
  });

  return NextResponse.json(data, { status: 201 });
}
