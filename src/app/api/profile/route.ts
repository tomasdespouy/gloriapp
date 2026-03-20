import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, avatar_url, establishment_id")
    .eq("id", user.id)
    .single();

  let establishmentName: string | null = null;
  if (profile?.establishment_id) {
    const { data: est } = await supabase
      .from("establishments")
      .select("name")
      .eq("id", profile.establishment_id)
      .single();
    establishmentName = est?.name || null;
  }

  return NextResponse.json({
    id: user.id,
    ...profile,
    establishment_name: establishmentName,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  // Only allow updating avatar_url (name is read-only per user request)
  if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Password change
  if (body.new_password) {
    if (body.new_password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
    }
    const { error } = await supabase.auth.updateUser({ password: body.new_password });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
