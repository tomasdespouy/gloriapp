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
  return { user };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();
  const { name, slug, logo_url, is_active, country, website_url, contact_name, contact_email } = body;

  const admin = createAdminClient();
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (slug !== undefined) updates.slug = slug;
  if (logo_url !== undefined) updates.logo_url = logo_url;
  if (is_active !== undefined) updates.is_active = is_active;
  if (country !== undefined) updates.country = country;
  if (website_url !== undefined) updates.website_url = website_url;
  if (contact_name !== undefined) updates.contact_name = contact_name;
  if (contact_email !== undefined) updates.contact_email = contact_email;

  const { data, error } = await admin
    .from("establishments")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    adminId: auth.user.id,
    action: "update_establishment",
    entityType: "establishment",
    entityId: id,
    details: updates,
  });

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("establishments").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    adminId: auth.user.id,
    action: "delete_establishment",
    entityType: "establishment",
    entityId: id,
  });

  return NextResponse.json({ success: true });
}
