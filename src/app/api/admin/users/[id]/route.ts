import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { logAdminAction } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin puede modificar usuarios" }, { status: 403 });
  }

  const { id } = await params;
  const adminClient = createAdminClient();

  // Block modifications to superadmin accounts
  const { data: target } = await adminClient.from("profiles").select("role").eq("id", id).single();
  if (target?.role === "superadmin") {
    return NextResponse.json({ error: "No se puede modificar una cuenta superadmin" }, { status: 403 });
  }

  const body = await request.json();
  const { full_name, role, establishment_id, course_id, section_id, is_disabled } = body;

  const updates: Record<string, unknown> = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (role !== undefined) updates.role = role;
  if (establishment_id !== undefined) updates.establishment_id = establishment_id;
  if (course_id !== undefined) updates.course_id = course_id;
  if (section_id !== undefined) updates.section_id = section_id;
  if (is_disabled !== undefined) updates.is_disabled = is_disabled;

  const { data, error } = await adminClient
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    adminId: user.id,
    action: "update_user",
    entityType: "user",
    entityId: id,
    details: updates,
  });

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Block deletion of superadmin accounts
  const { id } = await params;
  const adminDel = createAdminClient();

  // Block deletion of superadmin accounts
  const { data: target } = await adminDel.from("profiles").select("role").eq("id", id).single();
  if (target?.role === "superadmin") {
    return NextResponse.json({ error: "No se puede eliminar una cuenta superadmin" }, { status: 403 });
  }

  // Delete auth user (cascades to profile and all related data)
  const { error } = await adminDel.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    adminId: user.id,
    action: "delete_user",
    entityType: "user",
    entityId: id,
  });

  return NextResponse.json({ success: true });
}
