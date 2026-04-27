/**
 * Estado del job activo de Deep Research (si hay).
 * Usado por la UI supradmin para bloquear el boton Escanear y mostrar
 * "Trabajando en informe..." al cargar la pagina.
 *
 * Auth: superadmin. Solo lectura, sin OpenAI calls (1 query a DB).
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

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
    return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("research_jobs")
    .select("id, response_id, model, scan_type, status, started_at, poll_attempts, trigger_source")
    .in("status", ["pending", "in_progress"])
    .gte("started_at", dayAgo)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activeJob: data ?? null });
}
