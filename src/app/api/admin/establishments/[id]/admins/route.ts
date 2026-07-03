import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: establishment_id } = await params;

  // Support both JSON and FormData
  let admin_id: string;
  let action: string;
  let course_id: string | null = null;   // NULL = "Todas las asignaturas"
  let section_id: string | null = null;  // NULL = "Todas las secciones"
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    admin_id = body.admin_id;
    action = body._action || "add";
    course_id = body.course_id || null;
    section_id = body.section_id || null;
  } else {
    const formData = await request.formData();
    admin_id = formData.get("admin_id") as string;
    action = (formData.get("_action") as string) || "add";
    course_id = (formData.get("course_id") as string) || null;
    section_id = (formData.get("section_id") as string) || null;
  }

  if (!admin_id) {
    return NextResponse.json({ error: "admin_id requerido" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (action === "remove") {
    const { error } = await admin
      .from("admin_establishments")
      .delete()
      .eq("admin_id", admin_id)
      .eq("establishment_id", establishment_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Default: add. course_id/section_id NULL = "Todas". Elegir sección implica su
  // asignatura: si viene sección sin curso, se deriva de la sección.
  if (section_id && !course_id) {
    const { data: sec } = await admin.from("sections").select("course_id").eq("id", section_id).maybeSingle();
    course_id = sec?.course_id ?? null;
  }
  // Validar pertenencia (la asignatura al establecimiento; la sección a la asignatura).
  if (course_id) {
    const { data: c } = await admin.from("courses").select("id").eq("id", course_id).eq("establishment_id", establishment_id).maybeSingle();
    if (!c) return NextResponse.json({ error: "La asignatura no pertenece al establecimiento" }, { status: 400 });
  }
  if (section_id) {
    const { data: s } = await admin.from("sections").select("id").eq("id", section_id).eq("course_id", course_id ?? "").maybeSingle();
    if (!s) return NextResponse.json({ error: "La sección no pertenece a la asignatura" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("admin_establishments")
    .insert({ admin_id, establishment_id, course_id, section_id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
