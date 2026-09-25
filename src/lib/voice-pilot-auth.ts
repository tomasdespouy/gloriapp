import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Autorización central del piloto de voz (docs/specs/paciente-voz-latam/
 * 02-arquitectura.md, AU-01). Toda ruta/página que toque una variante
 * `interaction_mode = 'voice_only'` pasa por acá — no repetir la política
 * en cada endpoint (AU-01: "usada antes de cualquier consulta con cliente
 * administrativo").
 *
 * Fail-closed a propósito: cualquier dato faltante o ambiguo (piloto sin
 * fechas, sin fila de acceso, etc.) resuelve a "no autorizado", nunca a
 * "autorizado por defecto".
 */

export type VoicePilot = {
  id: string;
  aiPatientId: string;
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
  model: string;
  modelSnapshot: string | null;
  voiceId: string | null;
  maxDurationSeconds: number;
  budgetUsd: number;
  retentionDays: number;
};

function mapPilot(row: Record<string, unknown>): VoicePilot {
  return {
    id: row.id as string,
    aiPatientId: row.ai_patient_id as string,
    enabled: !!row.enabled,
    startsAt: (row.starts_at as string) ?? null,
    endsAt: (row.ends_at as string) ?? null,
    model: row.model as string,
    modelSnapshot: (row.model_snapshot as string) ?? null,
    voiceId: (row.voice_id as string) ?? null,
    maxDurationSeconds: row.max_duration_seconds as number,
    budgetUsd: Number(row.budget_usd),
    retentionDays: row.retention_days as number,
  };
}

export async function getVoicePilotByPatientId(patientId: string): Promise<VoicePilot | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("voice_pilots")
    .select("*")
    .eq("ai_patient_id", patientId)
    .maybeSingle();
  return data ? mapPilot(data) : null;
}

/**
 * IDs de ai_patients (variantes voice_only) que el usuario puede ver en el
 * catálogo (AU-05, AC-01/02/03). Solo por voice_pilot_access explícito —
 * nunca por país/establecimiento/asignación genérica (A-02/A-06).
 */
export async function getAuthorizedVoicePilotPatientIds(userId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data: accessRows } = await admin
    .from("voice_pilot_access")
    .select("pilot_id, can_participate, expires_at, revoked_at")
    .eq("user_id", userId);

  const now = Date.now();
  const validPilotIds = (accessRows || [])
    .filter((r) => r.can_participate && !r.revoked_at && (!r.expires_at || new Date(r.expires_at).getTime() > now))
    .map((r) => r.pilot_id);
  if (validPilotIds.length === 0) return [];

  const { data: pilots } = await admin
    .from("voice_pilots")
    .select("ai_patient_id")
    .in("id", validPilotIds);
  return (pilots || []).map((p) => p.ai_patient_id);
}

/** Guard rápido para rutas de chat ordinarias (AU-03/AC-06). */
export async function isVoiceOnlyPatient(patientId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ai_patients")
    .select("interaction_mode")
    .eq("id", patientId)
    .maybeSingle();
  return data?.interaction_mode === "voice_only";
}

function withinWindow(pilot: VoicePilot, now: Date): boolean {
  // Fail-closed: sin ambas fechas fijadas, nunca se considera "dentro de
  // ventana" — un piloto recién creado (starts_at/ends_at NULL) no puede
  // iniciarse hasta que un superadmin lo configure explícitamente.
  if (!pilot.startsAt || !pilot.endsAt) return false;
  const start = new Date(pilot.startsAt).getTime();
  const end = new Date(pilot.endsAt).getTime();
  const t = now.getTime();
  return start <= t && t < end;
}

async function hasParticipantAccess(userId: string, pilotId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("voice_pilot_access")
    .select("can_participate, expires_at, revoked_at")
    .eq("pilot_id", pilotId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || !data.can_participate || data.revoked_at) return false;
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return false;
  return true;
}

async function isSuperadmin(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role === "superadmin";
}

export type StartAttemptDecision =
  | { ok: true; pilot: VoicePilot; grantId: string; attemptNumber: number }
  | { ok: false; reason:
      | "no_pilot" | "disabled" | "outside_window" | "no_access"
      | "no_grant_available" | "attempt_in_progress" | "no_budget" };

/**
 * puede_iniciar (AU-01), completo. Resuelve TODO server-side; nunca confía
 * en país/rol/deadline declarado por el navegador (AR-04).
 */
export async function canStartAttempt(userId: string, patientId: string): Promise<StartAttemptDecision> {
  const pilot = await getVoicePilotByPatientId(patientId);
  if (!pilot) return { ok: false, reason: "no_pilot" };
  if (!pilot.enabled) return { ok: false, reason: "disabled" };

  const now = new Date();
  if (!withinWindow(pilot, now)) return { ok: false, reason: "outside_window" };

  const superadmin = await isSuperadmin(userId);
  if (!superadmin) {
    const allowed = await hasParticipantAccess(userId, pilot.id);
    if (!allowed) return { ok: false, reason: "no_access" };
  }
  // El superadmin puede configurar el piloto, pero para HABLAR igual
  // necesita presupuesto y ventana vigentes — no se salta ninguna de esas
  // dos condiciones por su rol (AU-01, última línea).
  if (pilot.budgetUsd <= 0) return { ok: false, reason: "no_budget" };

  const admin = createAdminClient();

  // Todos los cupos (consumidos o no) de este usuario en este piloto — sirve
  // tanto para detectar un intento en curso como para hallar el próximo
  // disponible, en dos pasos simples en vez de un filtro anidado incierto.
  const { data: grants } = await admin
    .from("voice_attempt_grants")
    .select("id, consumed_by, attempt_number")
    .eq("pilot_id", pilot.id)
    .eq("user_id", userId)
    .order("attempt_number", { ascending: true });

  const consumedIds = (grants || []).map((g) => g.consumed_by).filter((id): id is string => !!id);
  if (consumedIds.length > 0) {
    const { data: activeAttempts } = await admin
      .from("voice_attempts")
      .select("id")
      .in("id", consumedIds)
      .in("lifecycle", ["authorized", "active"])
      .limit(1);
    if (activeAttempts && activeAttempts.length > 0) return { ok: false, reason: "attempt_in_progress" };
  }

  const grant = (grants || []).find((g) => !g.consumed_by);
  if (!grant) return { ok: false, reason: "no_grant_available" };

  return { ok: true, pilot, grantId: grant.id, attemptNumber: grant.attempt_number };
}

export type ReviewDecision = { ok: true } | { ok: false; reason: "no_access" | "expired" };

/** puede_revisar (AU-01). */
export async function canReviewAttempt(userId: string, ownerUserId: string, pilotId: string): Promise<ReviewDecision> {
  if (await isSuperadmin(userId)) return { ok: true };
  if (userId !== ownerUserId) return { ok: false, reason: "no_access" };

  const admin = createAdminClient();
  const { data } = await admin
    .from("voice_pilot_access")
    .select("can_review_own, expires_at, revoked_at")
    .eq("pilot_id", pilotId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || !data.can_review_own || data.revoked_at) return { ok: false, reason: "no_access" };
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return { ok: false, reason: "expired" };
  return { ok: true };
}

/** Registro de auditoría (AU-... / voice_audit_log) — best-effort. */
export async function logVoiceAudit(params: {
  actorId: string | null;
  action: string;
  resource: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  await admin.from("voice_audit_log").insert({
    actor_id: params.actorId,
    action: params.action,
    resource: params.resource,
    reason: params.reason ?? null,
    metadata: params.metadata ?? null,
  }).then(undefined, () => {});
}
