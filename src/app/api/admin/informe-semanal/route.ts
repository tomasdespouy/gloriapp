import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserProfile } from "@/lib/supabase/user-profile";

/**
 * Gestión de la lista de distribución del informe semanal.
 *
 * Solo superadmin. La lista contiene correos de personas EXTERNAS a la
 * plataforma (contrapartes de cada universidad), así que quien la administra
 * está decidiendo a quién sale información de uso de una institución. Ese no
 * es un permiso que corresponda delegar en el admin de la propia institución.
 */

async function soloSuperadmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, res: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  const perfil = await getUserProfile();
  // realRole y no role: un superadmin impersonando a otro rol no debería poder
  // cambiar quién recibe los informes.
  if (perfil?.realRole !== "superadmin") {
    return { ok: false as const, res: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }
  return { ok: true as const, userId: user.id };
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  const auth = await soloSuperadmin();
  if (!auth.ok) return auth.res;

  const { establishment_id, email, full_name } = await request.json();
  if (!establishment_id || !email) {
    return NextResponse.json({ error: "establishment_id y email requeridos" }, { status: 400 });
  }
  const limpio = String(email).trim().toLowerCase();
  if (!CORREO.test(limpio)) {
    return NextResponse.json({ error: "Ese correo no tiene forma de correo" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: est } = await admin
    .from("establishments").select("id").eq("id", establishment_id).maybeSingle();
  if (!est) return NextResponse.json({ error: "Institución no encontrada" }, { status: 404 });

  // Reactivar en vez de duplicar: si el correo ya estuvo suscrito y se dio de
  // baja, volver a agregarlo debe revivir esa fila, no crear una segunda.
  const { data: existente } = await admin
    .from("report_subscriptions")
    .select("id")
    .eq("establishment_id", establishment_id)
    .ilike("email", limpio)
    .maybeSingle();

  if (existente) {
    const { error } = await admin.from("report_subscriptions")
      .update({ is_active: true, full_name: full_name || null, updated_at: new Date().toISOString() })
      .eq("id", existente.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: existente.id, reactivado: true });
  }

  const { data, error } = await admin.from("report_subscriptions")
    .insert({ establishment_id, email: limpio, full_name: full_name || null })
    .select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await soloSuperadmin();
  if (!auth.ok) return auth.res;

  const { id, is_active } = await request.json();
  if (!id || typeof is_active !== "boolean") {
    return NextResponse.json({ error: "id e is_active requeridos" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error } = await admin.from("report_subscriptions")
    .update({ is_active, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id, is_active });
}

export async function DELETE(request: Request) {
  const auth = await soloSuperadmin();
  if (!auth.ok) return auth.res;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("report_subscriptions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id });
}
