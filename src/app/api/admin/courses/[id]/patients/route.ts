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

/**
 * Pacientes habilitados para una asignatura del programa de certificación.
 * Mismo contrato que /api/admin/establishments/[id]/patients, a nivel de
 * asignatura en vez de establecimiento — ver comentario en la migración
 * course_patients sobre la semántica de lista vacía = "nada habilitado".
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: course_id } = await params;
  const body = await request.json();
  const { patient_id, patient_ids, _action } = body;

  const ids: string[] = patient_ids ?? (patient_id ? [patient_id] : []);
  if (ids.length === 0) {
    return NextResponse.json({ error: "patient_id o patient_ids requerido" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (_action === "remove") {
    const { error } = await admin
      .from("course_patients")
      .delete()
      .in("ai_patient_id", ids)
      .eq("course_id", course_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, count: ids.length });
  }

  const rows = ids.map((pid: string) => ({
    course_id,
    ai_patient_id: pid,
    granted_by: auth.user.id,
  }));

  const { data, error } = await admin
    .from("course_patients")
    .upsert(rows, { onConflict: "course_id,ai_patient_id" })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, count: data?.length ?? ids.length }, { status: 201 });
}
