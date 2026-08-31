/**
 * Envíos programados de credenciales: crear y listar.
 *
 * POST con { preview: true } no escribe nada: corre las mismas reglas que el
 * worker y devuelve cuántos recibirían el correo y cuántos no, con el motivo.
 * Es lo que llena el modal antes de que el admin confirme.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { matchesScope, resolveAdminScopeRules, type ScopeRule } from "@/lib/admin-scope";
import { previewAudience } from "@/lib/credentials/eligibility";
import { slotFor, validatePace, scheduleRange, estimatedMinutesPerTanda } from "@/lib/dispatch-schedule";
import { logAdminAction } from "@/lib/audit";

/** Ventana de vida de un despacho: pasado esto, el correo perdió su sentido. */
const VIDA_HORAS = 48;
const MAX_DESTINATARIOS = 2000;

interface Caller {
  id: string;
  role: "admin" | "superadmin";
  rules: ScopeRule[];
}

async function resolveCaller(): Promise<
  { ok: true; caller: Caller } | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role;
  if (role !== "admin" && role !== "superadmin") {
    return { ok: false, response: NextResponse.json({ error: "Sin permisos" }, { status: 403 }) };
  }
  const rules = role === "admin" ? await resolveAdminScopeRules(supabase, user.id) : [];
  return { ok: true, caller: { id: user.id, role, rules } };
}

export async function POST(request: Request) {
  const auth = await resolveCaller();
  if (!auth.ok) return auth.response;
  const { caller } = auth;

  let body: {
    batchId?: string;
    label?: string;
    userIds?: string[];
    startsAt?: string;
    perBatch?: number;
    everyMinutes?: number;
    reminderAfterDays?: number | null;
    audienceRule?: "nunca_ingreso" | "reemision";
    customIntro?: string | null;
    pilotId?: string | null;
    audienceSummary?: Record<string, unknown>;
    preview?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const userIds = [...new Set(body.userIds ?? [])];
  if (!userIds.length) {
    return NextResponse.json({ error: "No hay destinatarios seleccionados" }, { status: 400 });
  }
  if (userIds.length > MAX_DESTINATARIOS) {
    return NextResponse.json(
      { error: `Máximo ${MAX_DESTINATARIOS} destinatarios por envío` },
      { status: 400 },
    );
  }

  const audienceRule = body.audienceRule === "reemision" ? "reemision" : "nunca_ingreso";
  const admin = createAdminClient();

  // Alcance: un admin solo puede programar envíos para gente que ya podría
  // atender hoy. Se filtra acá y se REVALIDA en el worker, porque entre agendar
  // y enviar el alcance puede cambiar.
  const { data: targets } = await admin
    .from("profiles")
    .select("id, email, full_name, role, establishment_id, course_id, section_id")
    .in("id", userIds);

  const alcanzables = (targets ?? []).filter((t) => {
    if (t.role === "superadmin") return false;
    if (caller.role === "superadmin") return true;
    if (t.role !== "student" && t.role !== "instructor") return false;
    return matchesScope({ all: false, rules: caller.rules }, t);
  });

  const fueraDeAlcance = userIds.length - alcanzables.length;

  // ── Vista previa: no escribe nada ─────────────────────────────────────────
  if (body.preview) {
    const preview = await previewAudience(admin, {
      userIds: alcanzables.map((t) => t.id),
      audienceRule,
      schedulerId: caller.id,
      schedulerRole: caller.role,
      pilotId: body.pilotId ?? null,
    });
    const pace = { perBatch: body.perBatch ?? 0, everyMinutes: body.everyMinutes ?? 0 };
    const startsAt = body.startsAt ?? new Date().toISOString();
    return NextResponse.json({
      ...preview,
      fueraDeAlcance,
      ventana: scheduleRange(preview.elegibles, startsAt, pace),
      minutosPorTanda: estimatedMinutesPerTanda(preview.elegibles, pace),
    });
  }

  // ── Creación ──────────────────────────────────────────────────────────────
  if (!body.startsAt) {
    return NextResponse.json({ error: "Falta la fecha y hora de envío" }, { status: 400 });
  }
  const startsAtMs = new Date(body.startsAt).getTime();
  if (Number.isNaN(startsAtMs)) {
    return NextResponse.json({ error: "Fecha de envío inválida" }, { status: 400 });
  }

  const pace = { perBatch: body.perBatch ?? 0, everyMinutes: body.everyMinutes ?? 0 };
  const paceError = validatePace(pace);
  if (paceError) return NextResponse.json({ error: paceError }, { status: 400 });

  if (!alcanzables.length) {
    return NextResponse.json(
      { error: "Ninguno de los destinatarios seleccionados está dentro de tu alcance" },
      { status: 403 },
    );
  }

  // El id lo propone el cliente para que reintentar el POST no duplique el
  // envío: el segundo intento choca contra la PK y devolvemos el lote existente.
  const batchId = body.batchId ?? crypto.randomUUID();

  const { data: existing } = await admin
    .from("credential_batches")
    .select("id")
    .eq("id", batchId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ batchId, yaExistia: true }, { status: 200 });
  }

  const { error: batchErr } = await admin.from("credential_batches").insert({
    id: batchId,
    label: body.label?.trim() || null,
    scheduled_by: caller.id,
    scheduled_by_role: caller.role,
    scope_snapshot: caller.rules,
    audience_summary: body.audienceSummary ?? { total: alcanzables.length },
    audience_rule: audienceRule,
    source: body.pilotId ? "programa" : "usuarios",
    pilot_id: body.pilotId ?? null,
    custom_intro: body.customIntro?.trim() || null,
    starts_at: new Date(startsAtMs).toISOString(),
    per_batch: pace.perBatch,
    every_minutes: pace.everyMinutes,
    reminder_after_days: body.reminderAfterDays ?? null,
  });
  if (batchErr) {
    return NextResponse.json({ error: batchErr.message }, { status: 500 });
  }

  // Orden determinista y explicable: alfabético por nombre. Si mañana alguien
  // pregunta "¿por qué a Zúñiga le llegó en la última tanda?", la respuesta es
  // verificable en pantalla.
  const ordenados = [...alcanzables].sort((a, b) =>
    (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "", "es"),
  );

  const filas = ordenados.map((t, i) => {
    const slot = slotFor(new Date(startsAtMs).toISOString(), i, pace);
    return {
      batch_id: batchId,
      kind: "credenciales" as const,
      user_id: t.id,
      email_snapshot: t.email ?? "",
      name_snapshot: t.full_name,
      batch_index: slot.batchIndex,
      send_after: slot.sendAfter,
      next_attempt_at: slot.sendAfter,
      expires_at: new Date(new Date(slot.sendAfter).getTime() + VIDA_HORAS * 3600_000).toISOString(),
    };
  });

  const { error: rowsErr } = await admin
    .from("credential_dispatches")
    .upsert(filas, { onConflict: "batch_id,user_id,kind", ignoreDuplicates: true });
  if (rowsErr) {
    // El lote sin filas no sirve de nada y confundiría el panel.
    await admin.from("credential_batches").delete().eq("id", batchId);
    return NextResponse.json({ error: rowsErr.message }, { status: 500 });
  }

  await logAdminAction({
    adminId: caller.id,
    action: "schedule_credentials",
    entityType: "credential_batch",
    entityId: batchId,
    details: {
      destinatarios: filas.length,
      fueraDeAlcance,
      startsAt: new Date(startsAtMs).toISOString(),
      perBatch: pace.perBatch,
      everyMinutes: pace.everyMinutes,
      reminderAfterDays: body.reminderAfterDays ?? null,
      audienceRule,
    },
  });

  return NextResponse.json(
    {
      batchId,
      programados: filas.length,
      fueraDeAlcance,
      ventana: scheduleRange(filas.length, new Date(startsAtMs).toISOString(), pace),
    },
    { status: 201 },
  );
}

/** Lista los envíos que el llamador puede ver. */
export async function GET(request: Request) {
  const auth = await resolveCaller();
  if (!auth.ok) return auth.response;
  const { caller } = auth;

  const url = new URL(request.url);
  const soloAbiertos = url.searchParams.get("abiertos") === "1";
  const admin = createAdminClient();

  let q = admin
    .from("credential_batches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  // Un admin ve los envíos que él programó. No se le muestran los de otros
  // admin del mismo establecimiento: el alcance manda sobre personas, no sobre
  // decisiones de terceros.
  if (caller.role === "admin") q = q.eq("scheduled_by", caller.id);
  if (soloAbiertos) q = q.is("closed_at", null);

  const { data: batches, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (batches ?? []).map((b) => b.id);
  const stats = ids.length
    ? (await admin.from("credential_batch_stats").select("*").in("batch_id", ids)).data ?? []
    : [];
  const statsById = new Map(stats.map((s) => [s.batch_id, s]));

  return NextResponse.json({
    batches: (batches ?? []).map((b) => ({ ...b, stats: statsById.get(b.id) ?? null })),
  });
}
