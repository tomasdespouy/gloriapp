import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { resolveAdminScopeRules, scopeAllowsEstablishmentWide } from "@/lib/admin-scope";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Solo admin/superadmin (usa service-role que bypassa RLS): sin gate, cualquier
  // usuario autenticado podía enumerar el catálogo de cualquier establecimiento.
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const callerRole = profile?.role;
  if (!callerRole || !["admin", "superadmin"].includes(callerRole)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const admin = createAdminClient();
  const establishmentId = request.nextUrl.searchParams.get("establishment_id");

  // Admin: solo asignaturas de un establecimiento de su alcance.
  if (callerRole === "admin") {
    const rules = await resolveAdminScopeRules(supabase, user.id);
    if (!establishmentId || !rules.some((r) => r.establishmentId === establishmentId)) {
      return NextResponse.json([]);
    }
  }

  let query = admin.from("courses").select("id, name, code, establishment_id, is_active").order("name");
  if (establishmentId) query = query.eq("establishment_id", establishmentId);

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

  const { name, code, establishment_id } = await request.json();
  if (!name || !establishment_id) return NextResponse.json({ error: "name y establishment_id requeridos" }, { status: 400 });

  // Un admin solo crea asignaturas en un establecimiento que administra COMPLETO
  // (regla sin acotar). Si su alcance está limitado a una asignatura/sección, la
  // asignatura nueva nacería fuera de su propio perímetro.
  if (callerRole === "admin") {
    const rules = await resolveAdminScopeRules(supabase, user.id);
    if (!scopeAllowsEstablishmentWide({ all: false, rules }, establishment_id)) {
      return NextResponse.json(
        { error: "Su alcance está acotado a una asignatura: no puede crear asignaturas nuevas" },
        { status: 403 },
      );
    }
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from("courses").insert({ name, code: code || null, establishment_id }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
