import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { resolveAdminScopeRules, scopeAllowsCourse, courseInScope } from "@/lib/admin-scope";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Solo admin/superadmin (service-role bypassa RLS): sin gate, cualquiera podía
  // enumerar secciones de cualquier asignatura.
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const callerRole = profile?.role;
  if (!callerRole || !["admin", "superadmin"].includes(callerRole)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const admin = createAdminClient();
  const courseId = request.nextUrl.searchParams.get("course_id");

  // Admin: solo secciones de una asignatura de su alcance (resolvemos el
  // establecimiento de la asignatura y usamos scopeAllowsCourse, que sí
  // reconoce una regla acotada a una sección de esa misma asignatura).
  if (callerRole === "admin") {
    if (!courseId) return NextResponse.json([]);
    const { data: crs } = await admin.from("courses").select("establishment_id").eq("id", courseId).maybeSingle();
    const rules = await resolveAdminScopeRules(supabase, user.id);
    if (!crs || !scopeAllowsCourse({ all: false, rules }, crs.establishment_id as string | null, courseId)) {
      return NextResponse.json([]);
    }
  }

  let query = admin.from("sections").select("id, name, course_id, is_active").order("name");
  if (courseId) query = query.eq("course_id", courseId);

  const { data } = await query;
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const callerRole = profile?.role;
  if (!callerRole || !["admin", "superadmin"].includes(callerRole)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { name, course_id } = await request.json();
  if (!name || !course_id) return NextResponse.json({ error: "name y course_id requeridos" }, { status: 400 });

  const admin = createAdminClient();

  // Un admin crea secciones solo dentro de una asignatura de su alcance, y solo
  // si su regla NO está acotada a una sección (crear una sección hermana
  // ampliaría su propio perímetro). `courseInScope` resuelve el establecimiento
  // real de la asignatura desde la BD: no confía en el cliente.
  if (callerRole === "admin") {
    const rules = await resolveAdminScopeRules(supabase, user.id);
    const { ok } = await courseInScope(admin, { all: false, rules }, course_id);
    if (!ok) return NextResponse.json({ error: "Sin permisos sobre esta asignatura" }, { status: 403 });
  }

  const { data, error } = await admin.from("sections").insert({ name, course_id }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
