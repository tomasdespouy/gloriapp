import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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

  const { data: templates, error } = await supabase
    .from("crm_email_templates")
    .select("id, name, subject, body_html, category, is_default")
    .order("category")
    .order("name");

  if (error) {
    console.error("Error fetching email templates:", error);
    return NextResponse.json({ error: "Error al cargar plantillas" }, { status: 500 });
  }

  return NextResponse.json({ templates });
}
