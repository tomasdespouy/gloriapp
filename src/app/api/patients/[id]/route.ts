import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile?.role || !["admin", "superadmin", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Sin permisos para modificar pacientes" }, { status: 403 });
  }

  const { id } = await params;
  const updates = await request.json();

  // Only allow specific fields to be updated
  const allowedFields = [
    "name", "age", "gender", "occupation", "country", "quote",
    "backstory", "system_prompt", "difficulty_level", "is_active",
    "tags", "avatar_url", "video_url", "clinical_focus",
  ];
  const sanitizedUpdates: Record<string, unknown> = {};
  for (const key of Object.keys(updates)) {
    if (allowedFields.includes(key)) {
      sanitizedUpdates[key] = updates[key];
    }
  }

  if (Object.keys(sanitizedUpdates).length === 0) {
    return NextResponse.json({ error: "No hay campos válidos para actualizar" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("ai_patients")
    .update(sanitizedUpdates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile?.role || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "Sin permisos para eliminar pacientes" }, { status: 403 });
  }

  const { id } = await params;

  const admin = createAdminClient();
  const { error } = await admin
    .from("ai_patients")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
