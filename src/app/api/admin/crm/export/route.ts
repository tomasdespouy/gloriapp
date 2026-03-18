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

  if (profile?.role !== "superadmin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { data, error } = await supabase
    .from("crm_universities")
    .select("*")
    .order("country, name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Build CSV
  const headers = [
    "Nombre", "País", "Ciudad", "Sitio web", "Tipo", "Programa",
    "Email contacto", "Nombre contacto", "Teléfono", "Est. estudiantes",
    "Estado", "Prioridad", "Notas", "Próximo seguimiento",
  ];

  const rows = (data || []).map((u) => [
    u.name, u.country, u.city, u.website || "", u.type, u.program_name,
    u.contact_email || "", u.contact_name || "", u.contact_phone || "",
    u.estimated_students || "", u.status, u.priority,
    (u.notes || "").replace(/"/g, '""'), u.next_followup || "",
  ]);

  const csv = [
    headers.join(","),
    ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="crm-universidades-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
