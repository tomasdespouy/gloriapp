import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { ALL_MODULE_KEYS } from "@/lib/modules";

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: establishment_id } = await params;
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("establishment_modules")
    .select("module_key, is_active")
    .eq("establishment_id", establishment_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Build full module list with defaults (enabled if no row)
  const stateMap = new Map((rows || []).map((r: { module_key: string; is_active: boolean }) => [r.module_key, r.is_active]));
  const modules = ALL_MODULE_KEYS.map((key) => ({
    module_key: key,
    is_active: stateMap.has(key) ? stateMap.get(key) : true,
  }));

  return NextResponse.json({ modules });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: establishment_id } = await params;
  const { module_key, is_active } = await request.json();

  if (!module_key || !ALL_MODULE_KEYS.includes(module_key)) {
    return NextResponse.json({ error: "module_key inv\u00e1lido" }, { status: 400 });
  }
  if (typeof is_active !== "boolean") {
    return NextResponse.json({ error: "is_active debe ser boolean" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("establishment_modules")
    .upsert(
      { establishment_id, module_key, is_active },
      { onConflict: "establishment_id,module_key" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, module_key, is_active });
}
