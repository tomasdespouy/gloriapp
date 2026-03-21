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
  const body = await request.json();
  const { patient_id, patient_ids, _action } = body;

  // Support single or bulk
  const ids: string[] = patient_ids ?? (patient_id ? [patient_id] : []);
  if (ids.length === 0) {
    return NextResponse.json({ error: "patient_id o patient_ids requerido" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (_action === "remove") {
    const { error } = await admin
      .from("establishment_patients")
      .delete()
      .in("ai_patient_id", ids)
      .eq("establishment_id", establishment_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, count: ids.length });
  }

  // Default: add (bulk upsert)
  const rows = ids.map((pid: string) => ({
    establishment_id,
    ai_patient_id: pid,
    granted_by: auth.user.id,
  }));

  const { data, error } = await admin
    .from("establishment_patients")
    .upsert(rows, { onConflict: "establishment_id,ai_patient_id" })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, count: data?.length ?? ids.length }, { status: 201 });
}
