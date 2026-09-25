import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { logVoiceAudit } from "@/lib/voice-pilot-auth";

async function requireSuperadmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 } as const;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "superadmin") return { error: "No autorizado", status: 403 } as const;
  return { user };
}

/** Configuración del piloto de voz (A-01, enabled apagado por default). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();
  const { enabled, starts_at, ends_at, budget_usd, retention_days, max_duration_seconds } = body;

  const updates: Record<string, unknown> = {};
  if (enabled !== undefined) updates.enabled = !!enabled;
  if (starts_at !== undefined) updates.starts_at = starts_at || null;
  if (ends_at !== undefined) updates.ends_at = ends_at || null;
  if (budget_usd !== undefined) {
    const n = Number(budget_usd);
    if (!Number.isFinite(n) || n <= 0) return NextResponse.json({ error: "budget_usd inválido" }, { status: 400 });
    updates.budget_usd = n;
  }
  if (retention_days !== undefined) {
    const n = Number(retention_days);
    if (!Number.isInteger(n) || n < 1) return NextResponse.json({ error: "retention_days inválido" }, { status: 400 });
    updates.retention_days = n;
  }
  if (max_duration_seconds !== undefined) {
    const n = Number(max_duration_seconds);
    if (!Number.isInteger(n) || n < 60 || n > 3600) {
      return NextResponse.json({ error: "max_duration_seconds debe estar entre 60 y 3600" }, { status: 400 });
    }
    updates.max_duration_seconds = n;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("voice_pilots").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logVoiceAudit({
    actorId: auth.user.id,
    action: "pilot_update",
    resource: `voice_pilots:${id}`,
    metadata: updates,
  });

  return NextResponse.json({ success: true, ...updates });
}
