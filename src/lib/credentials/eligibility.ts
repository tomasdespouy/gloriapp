/**
 * Reglas de elegibilidad de un envío programado de credenciales.
 *
 * Este módulo responde una sola pregunta: llegado el momento, ¿a esta persona
 * se le manda el correo, se le omite (y por qué), o se pospone?
 *
 * Lo usan DOS consumidores, y que sea el mismo código es el punto:
 *   - el worker, al despachar;
 *   - la vista previa del modal, antes de que el admin confirme.
 * Así "3 quedarán fuera" en pantalla y lo que el worker hace no pueden separarse.
 *
 * LA REGLA QUE IMPORTA (clave_propia): un envío diferido NUNCA reemplaza una
 * contraseña que la persona eligió. `updateUserById({password})` es destructivo
 * e inmediato: si alguien agendó para el lunes y el domingo la persona entró y
 * fijó su clave, ejecutar el envío se la rompería. Por eso la regla no es
 * configurable — ni siquiera bajo `reemision`. Para ese caso está el botón de
 * envío inmediato, que ocurre ahora y con alguien mirando el resultado.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { pilotWindowBlock } from "@/lib/access-status";
import { matchesScope, resolveAdminScopeRules, type ScopeRule } from "@/lib/admin-scope";

export type SkipReason =
  | "ya_ingreso"
  | "clave_propia"
  | "cuenta_desactivada"
  | "usuario_eliminado"
  | "sin_correo"
  | "fuera_de_alcance"
  | "admin_sin_permiso"
  | "rol_no_elegible"
  | "programa_cerrado"
  | "ya_recibio_credenciales"
  | "vencido"
  | "cancelado_por_admin";

/** Etiquetas para el panel. Sin jerga: las lee un coordinador académico. */
const SKIP_LABELS: Record<SkipReason, string> = {
  ya_ingreso: "Ya había ingresado",
  clave_propia: "Ya eligió su propia contraseña",
  cuenta_desactivada: "Cuenta desactivada",
  usuario_eliminado: "La cuenta fue eliminada",
  sin_correo: "Sin correo válido",
  fuera_de_alcance: "Fuera del alcance de quien programó el envío",
  admin_sin_permiso: "Quien programó el envío ya no tiene permisos",
  rol_no_elegible: "El rol de esta cuenta no admite envío programado",
  programa_cerrado: "El programa ya terminó o fue cancelado",
  ya_recibio_credenciales: "Ya recibió sus credenciales hace poco",
  vencido: "Venció la ventana de envío",
  cancelado_por_admin: "El envío fue cancelado",
};

export function skipReasonLabel(r: SkipReason): string {
  return SKIP_LABELS[r] ?? r;
}

/**
 * Cuando alguien recibió credenciales hace menos de esto, un envío programado
 * lo omite. Evita el peor resultado posible para el destinatario: dos correos
 * el mismo día, con claves distintas, donde solo la segunda funciona.
 */
const RECIENTE_MS = 2 * 60 * 60 * 1000;

export interface DispatchRow {
  id: string;
  batch_id: string;
  kind: "credenciales" | "recordatorio";
  parent_id: string | null;
  user_id: string | null;
  email_snapshot: string;
  batch_index: number;
  send_after: string;
  expires_at: string;
  attempts: number;
  max_attempts: number;
}

export interface BatchRow {
  id: string;
  scheduled_by: string | null;
  scheduled_by_role: "admin" | "superadmin";
  audience_rule: "nunca_ingreso" | "reemision";
  pilot_id: string | null;
  custom_intro: string | null;
  reminder_after_days: number | null;
  cancel_requested_at: string | null;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  is_disabled: boolean | null;
  password_set_at: string | null;
  credentials_sent_at: string | null;
  establishment_id: string | null;
  course_id: string | null;
  section_id: string | null;
}

export interface SchedulerInfo {
  id: string;
  role: string;
  is_disabled: boolean | null;
  rules: ScopeRule[];
}

export interface DispatchContext {
  now: number;
  profiles: Map<string, ProfileRow>;
  batches: Map<string, BatchRow>;
  pilots: Map<string, { status: string | null; scheduled_at: string | null; ended_at: string | null; name: string | null }>;
  lastSignIn: Map<string, string | null>;
  schedulers: Map<string, SchedulerInfo | null>;
  /** sent_at de la fila original, para los recordatorios. */
  parentSentAt: Map<string, string | null>;
}

export type Verdict =
  | { kind: "enviar" }
  | { kind: "omitir"; reason: SkipReason }
  | { kind: "posponer"; hasta: string; motivo: string };

/**
 * Decide qué hacer con UNA fila. Sin efectos secundarios y sin I/O: todo lo que
 * necesita ya viene precargado en `ctx`, para no hacer N+1 dentro del bucle del
 * worker.
 *
 * El orden importa: lo terminal y lo barato va primero, y las guardas que
 * protegen a la persona (clave propia, ya ingresó) van antes que las que
 * protegen al sistema.
 */
export function evaluateDispatch(row: DispatchRow, ctx: DispatchContext): Verdict {
  const batch = ctx.batches.get(row.batch_id);
  if (!batch) return { kind: "omitir", reason: "cancelado_por_admin" };

  // 1. Cancelación en vuelo. Se relee justo antes de tocar nada, así que
  //    cancelar detiene incluso lo que ya estaba reclamado.
  if (batch.cancel_requested_at) return { kind: "omitir", reason: "cancelado_por_admin" };

  // 2. La ventana de envío ya pasó. Un correo de credenciales tres días tarde
  //    perdió su sentido: la clase para la que servía ya ocurrió.
  if (ctx.now > new Date(row.expires_at).getTime()) {
    return { kind: "omitir", reason: "vencido" };
  }

  // 3. La persona fue borrada. La fila queda como evidencia de que existió.
  if (!row.user_id) return { kind: "omitir", reason: "usuario_eliminado" };
  const target = ctx.profiles.get(row.user_id);
  if (!target) return { kind: "omitir", reason: "usuario_eliminado" };

  if (!target.email || !target.email.includes("@")) {
    return { kind: "omitir", reason: "sin_correo" };
  }

  // 4. Quien agendó. Un job diferido no hereda permisos que su autor ya perdió.
  const scheduler = batch.scheduled_by ? ctx.schedulers.get(batch.scheduled_by) : null;
  if (!batch.scheduled_by || !scheduler) return { kind: "omitir", reason: "admin_sin_permiso" };
  if (scheduler.is_disabled) return { kind: "omitir", reason: "admin_sin_permiso" };
  if (scheduler.role !== "admin" && scheduler.role !== "superadmin") {
    return { kind: "omitir", reason: "admin_sin_permiso" };
  }

  // 5. Nunca se le tocan las credenciales a un superadmin (espeja la ruta
  //    interactiva, que devuelve 403 en ese caso).
  if (target.role === "superadmin") return { kind: "omitir", reason: "rol_no_elegible" };

  // 6. Alcance del autor, evaluado contra la tabla VIVA. Entre agendar y enviar
  //    pudo perder el establecimiento, o la persona pudo ser reasignada.
  if (scheduler.role === "admin") {
    if (target.role !== "student" && target.role !== "instructor") {
      return { kind: "omitir", reason: "rol_no_elegible" };
    }
    if (!matchesScope({ all: false, rules: scheduler.rules }, target)) {
      return { kind: "omitir", reason: "fuera_de_alcance" };
    }
  }

  // 7. Cuenta desactivada: se omite SIEMPRE, incluso bajo `reemision`. Mandar
  //    credenciales a alguien que no puede entrar es un ticket de soporte seguro.
  if (target.is_disabled) return { kind: "omitir", reason: "cuenta_desactivada" };

  // 8. LA GUARDA CENTRAL. La persona ya eligió su contraseña: el envío diferido
  //    no la reemplaza bajo ninguna configuración.
  if (target.password_set_at) return { kind: "omitir", reason: "clave_propia" };

  const lastSignIn = ctx.lastSignIn.get(row.user_id) ?? null;

  if (row.kind === "recordatorio") {
    // 9. El recordatorio solo tiene sentido si NO usó lo que le mandamos. La
    //    referencia es el envío original, no la fecha del lote.
    const parentSent = row.parent_id ? ctx.parentSentAt.get(row.parent_id) ?? null : null;
    if (lastSignIn && parentSent && new Date(lastSignIn) > new Date(parentSent)) {
      return { kind: "omitir", reason: "ya_ingreso" };
    }
    if (lastSignIn && !parentSent) {
      return { kind: "omitir", reason: "ya_ingreso" };
    }
  } else {
    // 10. Audiencia por omisión: solo quien nunca inició sesión. Para esa gente
    //     no hay contraseña viva que destruir, y eso es lo que hace inocuo
    //     rotarla sin avisar.
    if (batch.audience_rule === "nunca_ingreso" && lastSignIn) {
      return { kind: "omitir", reason: "ya_ingreso" };
    }
    // 11. El admin agendó y después apretó "Enviar ahora" sobre la misma gente.
    if (
      batch.audience_rule === "nunca_ingreso" &&
      target.credentials_sent_at &&
      new Date(target.credentials_sent_at).getTime() > new Date(batch.created_at).getTime()
    ) {
      return { kind: "omitir", reason: "ya_recibio_credenciales" };
    }
  }

  // 12. Recibió credenciales hace muy poco, venga de donde venga (otro lote, el
  //     botón inmediato). Cubre el solapamiento entre lotes sin necesitar un
  //     índice único global que volvería el alta todo-o-nada.
  if (
    target.credentials_sent_at &&
    ctx.now - new Date(target.credentials_sent_at).getTime() < RECIENTE_MS
  ) {
    return { kind: "omitir", reason: "ya_recibio_credenciales" };
  }

  // 13. Programa asociado: cerrado se omite; aún sin abrir se POSPONE.
  //     Posponer y no omitir importa: si el correo sale antes de que la ventana
  //     abra, la persona entra, rebota a /piloto-cerrado — y ese rebote ya
  //     escribe last_sign_in_at, lo que después la dejaría sin recordatorio.
  if (batch.pilot_id) {
    const pilot = ctx.pilots.get(batch.pilot_id);
    if (pilot) {
      const block = pilotWindowBlock(
        { name: pilot.name, status: pilot.status, scheduled_at: pilot.scheduled_at, ended_at: pilot.ended_at },
        ctx.now,
      );
      if (block?.reason === "cancelado" || block?.reason === "ended") {
        return { kind: "omitir", reason: "programa_cerrado" };
      }
      if (block?.reason === "not_yet" && pilot.scheduled_at) {
        return {
          kind: "posponer",
          hasta: pilot.scheduled_at,
          motivo: "Esperando la apertura del programa",
        };
      }
    }
  }

  return { kind: "enviar" };
}

/**
 * Precarga en LOTE todo lo que `evaluateDispatch` necesita para un conjunto de
 * filas. Un viaje por tabla en vez de uno por fila: con tandas de 50, la
 * diferencia entre esto y el N+1 son varios segundos de la corrida.
 */
export async function loadDispatchContext(
  admin: SupabaseClient,
  rows: DispatchRow[],
): Promise<DispatchContext> {
  const userIds = [...new Set(rows.map((r) => r.user_id).filter((x): x is string => !!x))];
  const batchIds = [...new Set(rows.map((r) => r.batch_id))];
  const parentIds = [...new Set(rows.map((r) => r.parent_id).filter((x): x is string => !!x))];

  const [profilesRes, batchesRes, parentsRes] = await Promise.all([
    userIds.length
      ? cargarPerfiles(admin, userIds)
      : Promise.resolve({ data: [] as ProfileRow[] }),
    admin
      .from("credential_batches")
      .select("id, scheduled_by, scheduled_by_role, audience_rule, pilot_id, custom_intro, reminder_after_days, cancel_requested_at, created_at")
      .in("id", batchIds),
    parentIds.length
      ? admin.from("credential_dispatches").select("id, sent_at").in("id", parentIds)
      : Promise.resolve({ data: [] as { id: string; sent_at: string | null }[] }),
  ]);

  const profiles = new Map<string, ProfileRow>();
  for (const p of (profilesRes.data ?? []) as ProfileRow[]) profiles.set(p.id, p);

  const batches = new Map<string, BatchRow>();
  for (const b of (batchesRes.data ?? []) as BatchRow[]) batches.set(b.id, b);

  const parentSentAt = new Map<string, string | null>();
  for (const p of (parentsRes.data ?? []) as { id: string; sent_at: string | null }[]) {
    parentSentAt.set(p.id, p.sent_at);
  }

  // Pilotos asociados a los lotes en juego.
  const pilotIds = [...new Set([...batches.values()].map((b) => b.pilot_id).filter((x): x is string => !!x))];
  const pilots = new Map<string, { status: string | null; scheduled_at: string | null; ended_at: string | null; name: string | null }>();
  if (pilotIds.length) {
    const { data } = await admin.from("pilots").select("id, name, status, scheduled_at, ended_at").in("id", pilotIds);
    for (const p of data ?? []) {
      pilots.set(p.id, { status: p.status, scheduled_at: p.scheduled_at, ended_at: p.ended_at, name: p.name });
    }
  }

  // Autores. El alcance se relee de admin_establishments, no del snapshot.
  const schedulerIds = [...new Set([...batches.values()].map((b) => b.scheduled_by).filter((x): x is string => !!x))];
  const schedulers = new Map<string, SchedulerInfo | null>();
  if (schedulerIds.length) {
    const { data } = await admin.from("profiles").select("id, role, is_disabled").in("id", schedulerIds);
    for (const s of data ?? []) {
      const rules = s.role === "admin" ? await resolveAdminScopeRules(admin, s.id) : [];
      schedulers.set(s.id, { id: s.id, role: s.role, is_disabled: s.is_disabled, rules });
    }
  }

  const lastSignIn = await loadLastSignIn(admin, userIds);

  return { now: Date.now(), profiles, batches, pilots, lastSignIn, schedulers, parentSentAt };
}

/**
 * Lee los perfiles del chunk. Si `password_set_at` todavía no existe en este
 * entorno (deploy anterior a su migración), reintenta sin esa columna: la
 * guarda de "ya inició sesión" sigue protegiendo igual, que es la regla por
 * omisión.
 */
async function cargarPerfiles(
  admin: SupabaseClient,
  userIds: string[],
): Promise<{ data: ProfileRow[] }> {
  const COLS =
    "id, email, full_name, role, is_disabled, password_set_at, credentials_sent_at, establishment_id, course_id, section_id";
  const r = await admin.from("profiles").select(COLS).in("id", userIds);
  if (!r.error) return { data: (r.data ?? []) as ProfileRow[] };

  const falta = r.error.code === "42703" || (r.error.message || "").includes("password_set_at");
  if (!falta) throw new Error("No se pudieron leer los perfiles: " + r.error.message);

  console.warn("[eligibility] password_set_at no existe todavía; se usa solo last_sign_in_at");
  const sin = await admin
    .from("profiles")
    .select(COLS.replace("password_set_at, ", ""))
    .in("id", userIds);
  return { data: ((sin.data ?? []) as unknown[]).map((p) => ({ ...(p as object), password_set_at: null })) as ProfileRow[] };
}

/**
 * `auth.users.last_sign_in_at` en un viaje, vía la función SECURITY DEFINER de
 * la migración. Es el único campo que literalmente significa "inició sesión":
 * no depende de nuestro heartbeat y rotar la contraseña no lo resetea.
 */
export async function loadLastSignIn(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  if (!userIds.length) return out;
  const { data, error } = await admin.rpc("auth_last_sign_in", { p_ids: userIds });
  if (error) {
    // Sin esta señal no podemos garantizar que no rompemos una contraseña viva.
    // El worker trata el error como "no despachar", no como "despachar igual".
    console.error("[eligibility] auth_last_sign_in falló", error.message);
    throw new Error("No se pudo leer el último ingreso: " + error.message);
  }
  for (const r of (data ?? []) as { user_id: string; last_sign_in_at: string | null }[]) {
    out.set(r.user_id, r.last_sign_in_at);
  }
  return out;
}

export interface AudiencePreview {
  elegibles: number;
  omitidos: { reason: SkipReason; label: string; count: number }[];
  total: number;
}

/**
 * Vista previa para el modal: cuántos recibirían el correo y cuántos no, con el
 * motivo. Corre las MISMAS reglas que el worker, sobre un lote ficticio, para
 * que el número que el admin aprueba sea el que después ocurre.
 *
 * No es una promesa perfecta —entre la vista previa y el envío alguien puede
 * entrar a la plataforma— y por eso la interfaz la presenta como una estimación.
 */
export async function previewAudience(
  admin: SupabaseClient,
  p: {
    userIds: string[];
    audienceRule: "nunca_ingreso" | "reemision";
    schedulerId: string;
    schedulerRole: "admin" | "superadmin";
    pilotId?: string | null;
  },
): Promise<AudiencePreview> {
  const now = new Date();
  const fakeBatchId = "00000000-0000-0000-0000-000000000000";

  const rows: DispatchRow[] = p.userIds.map((uid, i) => ({
    id: `preview-${i}`,
    batch_id: fakeBatchId,
    kind: "credenciales",
    parent_id: null,
    user_id: uid,
    email_snapshot: "",
    batch_index: 0,
    send_after: now.toISOString(),
    expires_at: new Date(now.getTime() + 48 * 3600_000).toISOString(),
    attempts: 0,
    max_attempts: 4,
  }));

  const ctx = await loadDispatchContext(admin, []);
  // El lote no existe todavía: se arma en memoria con lo que el admin eligió.
  ctx.batches.set(fakeBatchId, {
    id: fakeBatchId,
    scheduled_by: p.schedulerId,
    scheduled_by_role: p.schedulerRole,
    audience_rule: p.audienceRule,
    pilot_id: p.pilotId ?? null,
    custom_intro: null,
    reminder_after_days: null,
    cancel_requested_at: null,
    created_at: now.toISOString(),
  });

  // Precarga acotada a los destinatarios de la vista previa.
  if (p.userIds.length) {
    const { data } = await admin
      .from("profiles")
      .select("id, email, full_name, role, is_disabled, password_set_at, credentials_sent_at, establishment_id, course_id, section_id")
      .in("id", p.userIds);
    for (const prof of (data ?? []) as ProfileRow[]) ctx.profiles.set(prof.id, prof);
    const ls = await loadLastSignIn(admin, p.userIds);
    for (const [k, v] of ls) ctx.lastSignIn.set(k, v);
  }

  const { data: sch } = await admin
    .from("profiles")
    .select("id, role, is_disabled")
    .eq("id", p.schedulerId)
    .single();
  if (sch) {
    const rules = sch.role === "admin" ? await resolveAdminScopeRules(admin, sch.id) : [];
    ctx.schedulers.set(sch.id, { id: sch.id, role: sch.role, is_disabled: sch.is_disabled, rules });
  }

  if (p.pilotId) {
    const { data: pil } = await admin
      .from("pilots")
      .select("id, name, status, scheduled_at, ended_at")
      .eq("id", p.pilotId)
      .single();
    if (pil) {
      ctx.pilots.set(pil.id, {
        status: pil.status,
        scheduled_at: pil.scheduled_at,
        ended_at: pil.ended_at,
        name: pil.name,
      });
    }
  }

  const counts = new Map<SkipReason, number>();
  let elegibles = 0;
  for (const row of rows) {
    const v = evaluateDispatch(row, ctx);
    // Posponer cuenta como elegible: el correo va a salir, solo que más tarde.
    if (v.kind === "enviar" || v.kind === "posponer") elegibles++;
    else counts.set(v.reason, (counts.get(v.reason) ?? 0) + 1);
  }

  return {
    elegibles,
    total: rows.length,
    omitidos: [...counts.entries()]
      .map(([reason, count]) => ({ reason, label: skipReasonLabel(reason), count }))
      .sort((a, b) => b.count - a.count),
  };
}
