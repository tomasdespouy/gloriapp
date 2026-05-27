import { createAdminClient } from "@/lib/supabase/admin";
import { getUserProfile } from "@/lib/supabase/user-profile";

/**
 * Monitor operacional — resolución de alcance.
 *
 * Un solo "panel de personas" sirve a supradmin, administrador e instructor;
 * lo único que cambia es QUÉ alumnos puede ver cada uno. Esa decisión vive
 * aquí y SIEMPRE se calcula en el servidor desde el rol real del usuario.
 *
 * Dos capas:
 *   - `getMonitorAuthority()` → el alcance MÁXIMO del usuario (su "llave").
 *     Es la frontera de seguridad: define qué alumnos podría tocar.
 *   - `resolveMonitorStudentIds(auth, requested)` → autoridad ∩ lo que el
 *     cliente pidió ver (un piloto, un establecimiento…). El "requested" es
 *     un filtro de UI, no de seguridad: nunca puede ampliar la autoridad.
 *   - `canAccessStudent(auth, id)` → chequeo puntual para el drill-down de
 *     conversaciones, antes de devolver mensajes.
 *
 * Honra impersonación: un superadmin impersonando admin/instructor obtiene
 * la autoridad del rol impersonado (vía getUserProfile, que ya aplica la
 * cookie gloria-impersonate).
 */

const NIL = "00000000-0000-0000-0000-000000000000";

/** Alcance que el cliente pide ver. Es un filtro, nunca amplía la autoridad. */
export type RequestedScope =
  | { kind: "all" }
  | { kind: "establishment"; ids: string[] }
  | { kind: "section"; ids: string[] }
  | { kind: "pilot"; id: string };

export type MonitorAuthority =
  | {
      ok: true;
      profileId: string;
      isSuperadmin: boolean;
      /** "all": sin restricción. "establishment"/"section": acotado a los ids. */
      mode: "all" | "establishment" | "section";
      establishmentIds: string[];
      sectionIds: string[];
      /** true cuando un instructor sin sección cayó al fallback de establecimiento. */
      sectionFallback: boolean;
    }
  | { ok: false; status: number; error: string };

/**
 * Calcula el alcance máximo (la "llave") del usuario autenticado a partir de
 * su rol real/efectivo. No confía en ningún parámetro del cliente.
 */
export async function getMonitorAuthority(): Promise<MonitorAuthority> {
  const profile = await getUserProfile();
  if (!profile) return { ok: false, status: 401, error: "No autenticado" };

  // Frontera real: solo estos roles acceden al monitor.
  const realAllowed = ["instructor", "admin", "superadmin"];
  if (!realAllowed.includes(profile.realRole)) {
    return { ok: false, status: 403, error: "No autorizado" };
  }

  const admin = createAdminClient();
  const role = profile.role; // efectivo (honra impersonación)

  // Superadmin sin impersonar → todo.
  if (role === "superadmin") {
    return {
      ok: true,
      profileId: profile.id,
      isSuperadmin: true,
      mode: "all",
      establishmentIds: [],
      sectionIds: [],
      sectionFallback: false,
    };
  }

  // Admin (o superadmin impersonando admin) → sus establecimientos.
  if (role === "admin") {
    let establishmentIds: string[] = [];
    if (profile.isImpersonating && profile.establishmentId) {
      establishmentIds = [profile.establishmentId];
    } else {
      const { data } = await admin
        .from("admin_establishments")
        .select("establishment_id")
        .eq("admin_id", profile.id);
      establishmentIds = (data || []).map((a) => a.establishment_id);
    }
    return {
      ok: true,
      profileId: profile.id,
      isSuperadmin: false,
      mode: "establishment",
      establishmentIds,
      sectionIds: [],
      sectionFallback: false,
    };
  }

  // Instructor → su sección. Fallback acordado: si no tiene section_id,
  // cae a su establecimiento (no rompe el panel docente actual).
  if (role === "instructor") {
    const { data: me } = await admin
      .from("profiles")
      .select("section_id, establishment_id")
      .eq("id", profile.id)
      .maybeSingle();

    if (me?.section_id) {
      return {
        ok: true,
        profileId: profile.id,
        isSuperadmin: false,
        mode: "section",
        establishmentIds: [],
        sectionIds: [me.section_id],
        sectionFallback: false,
      };
    }
    const estId = me?.establishment_id || profile.establishmentId;
    return {
      ok: true,
      profileId: profile.id,
      isSuperadmin: false,
      mode: "establishment",
      establishmentIds: estId ? [estId] : [],
      sectionIds: [],
      sectionFallback: true,
    };
  }

  return { ok: false, status: 403, error: "No autorizado" };
}

// ── Helpers de materialización de alumnos ───────────────────────────────

async function studentsByEstablishment(estIds: string[]): Promise<string[]> {
  if (estIds.length === 0) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "student")
    .in("establishment_id", estIds);
  return (data || []).map((p) => p.id);
}

async function studentsBySection(secIds: string[]): Promise<string[]> {
  if (secIds.length === 0) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "student")
    .in("section_id", secIds);
  return (data || []).map((p) => p.id);
}

async function studentsByPilot(pilotId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pilot_participants")
    .select("user_id")
    .eq("pilot_id", pilotId)
    .eq("role", "student");
  return (data || []).map((p) => p.user_id).filter((x): x is string => !!x);
}

/** Materializa la lista de alumnos del alcance pedido (sin intersectar aún). */
async function materializeRequested(requested: RequestedScope): Promise<{ all: boolean; ids: string[] }> {
  switch (requested.kind) {
    case "all":
      return { all: true, ids: [] };
    case "establishment":
      return { all: false, ids: await studentsByEstablishment(requested.ids) };
    case "section":
      return { all: false, ids: await studentsBySection(requested.ids) };
    case "pilot":
      return { all: false, ids: await studentsByPilot(requested.id) };
  }
}

/** Materializa la lista de alumnos de la autoridad del usuario. */
async function materializeAuthority(auth: Extract<MonitorAuthority, { ok: true }>): Promise<{ all: boolean; ids: string[] }> {
  if (auth.mode === "all") return { all: true, ids: [] };
  if (auth.mode === "section") return { all: false, ids: await studentsBySection(auth.sectionIds) };
  return { all: false, ids: await studentsByEstablishment(auth.establishmentIds) };
}

/**
 * Devuelve los student_id a mostrar: autoridad ∩ lo pedido.
 * `mode: "all"` solo cuando el usuario tiene autoridad total y pidió todo
 * (evita materializar miles de ids; el endpoint deja la query sin filtro).
 */
export async function resolveMonitorStudentIds(
  auth: Extract<MonitorAuthority, { ok: true }>,
  requested: RequestedScope,
): Promise<{ mode: "all" | "ids"; studentIds: string[] }> {
  const [authority, req] = await Promise.all([
    materializeAuthority(auth),
    materializeRequested(requested),
  ]);

  if (authority.all && req.all) return { mode: "all", studentIds: [] };
  if (authority.all) return { mode: "ids", studentIds: req.ids };
  if (req.all) return { mode: "ids", studentIds: authority.ids };

  const reqSet = new Set(req.ids);
  return { mode: "ids", studentIds: authority.ids.filter((id) => reqSet.has(id)) };
}

/**
 * ¿Puede este usuario inspeccionar a este alumno? Frontera de seguridad del
 * drill-down de conversaciones. Se chequea contra la AUTORIDAD (no contra el
 * filtro de UI), porque eso es lo que define qué puede tocar realmente.
 */
export async function canAccessStudent(
  auth: Extract<MonitorAuthority, { ok: true }>,
  studentId: string,
): Promise<boolean> {
  if (auth.mode === "all") return true;
  if (!studentId || studentId === NIL) return false;

  const admin = createAdminClient();
  const { data: student } = await admin
    .from("profiles")
    .select("establishment_id, section_id, role")
    .eq("id", studentId)
    .maybeSingle();

  if (!student || student.role !== "student") return false;

  if (auth.mode === "section") {
    return !!student.section_id && auth.sectionIds.includes(student.section_id);
  }
  // establishment
  return !!student.establishment_id && auth.establishmentIds.includes(student.establishment_id);
}

/** Parsea el query param `scope` (JSON) a RequestedScope, con default "all". */
export function parseRequestedScope(raw: string | null): RequestedScope {
  if (!raw) return { kind: "all" };
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.kind === "all") return { kind: "all" };
    if (parsed?.kind === "establishment" && Array.isArray(parsed.ids)) {
      return { kind: "establishment", ids: parsed.ids.filter((x: unknown) => typeof x === "string") };
    }
    if (parsed?.kind === "section" && Array.isArray(parsed.ids)) {
      return { kind: "section", ids: parsed.ids.filter((x: unknown) => typeof x === "string") };
    }
    if (parsed?.kind === "pilot" && typeof parsed.id === "string") {
      return { kind: "pilot", id: parsed.id };
    }
  } catch { /* ignore */ }
  return { kind: "all" };
}
