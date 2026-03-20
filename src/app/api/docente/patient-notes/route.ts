import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "instructor" && profile?.role !== "admin" && profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { patient_id, notes } = await request.json();
  if (!patient_id) {
    return NextResponse.json({ error: "patient_id requerido" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("ai_patients")
    .update({ teacher_notes: notes ?? null })
    .eq("id", patient_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
