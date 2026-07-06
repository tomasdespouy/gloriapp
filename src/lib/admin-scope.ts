import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Alcance de un administrador acotable por asignatura/sección.
 *
 * Un admin tiene 0..N reglas (filas de `admin_establishments`). Cada regla:
 *   - courseId/sectionId NULL      → "Todas" (todo el establecimiento)
 *   - courseId set, sectionId NULL → solo esa asignatura (todas sus secciones)
 *   - sectionId set                → solo esa sección (elegir sección implica su asignatura)
 * Sin reglas = admin "sin asignar" = no ve nada.
 *
 * Todas las superficies de admin reusan `matchesScope` (predicado) y
 * `applyScope` (narrowing de una query PostgREST) para no filtrar datos de
 * secciones ajenas.
 */
export type ScopeRule = {
  establishmentId: string;
  courseId: string | null;
  sectionId: string | null;
};

export type Scope = { all: true } | { all: false; rules: ScopeRule[] };

const NO_MATCH_UUID = "00000000-0000-0000-0000-000000000000";

/** ¿Una persona (con establishment/course/section) cae dentro del alcance? */
export function matchesScope(
  scope: Scope,
  person: { establishment_id?: string | null; course_id?: string | null; section_id?: string | null },
): boolean {
  if (scope.all) return true;
  return scope.rules.some(
    (r) =>
      person.establishment_id === r.establishmentId &&
      (r.sectionId === null || person.section_id === r.sectionId) &&
      (r.courseId === null || person.course_id === r.courseId),
  );
}

/**
 * Acota una query PostgREST sobre una tabla con columnas establishment_id /
 * course_id / section_id (p.ej. `profiles`). superadmin → sin cambios; sin
 * reglas → filtro imposible (no ve nada). Los UUID salen de la BD
 * (admin_establishments), no de input de usuario → seguros dentro del `.or()`.
 */
export function applyScope<Q>(
  query: Q,
  scope: Scope,
  cols: { establishment?: string; course?: string; section?: string } = {},
): Q {
  if (scope.all) return query;
  // Genérico "libre" (sin `extends` sobre el builder de Supabase) para no
  // disparar instanciación de tipos infinita; se castea a una interfaz mínima.
  const q = query as unknown as { or(f: string): unknown; eq(c: string, v: string): unknown };
  const est = cols.establishment ?? "establishment_id";
  const course = cols.course ?? "course_id";
  const section = cols.section ?? "section_id";
  if (scope.rules.length === 0) return q.eq(est, NO_MATCH_UUID) as Q;
  const groups = scope.rules.map((r) => {
    const parts = [`${est}.eq.${r.establishmentId}`];
    if (r.sectionId) parts.push(`${section}.eq.${r.sectionId}`);
    if (r.courseId) parts.push(`${course}.eq.${r.courseId}`);
    return `and(${parts.join(",")})`;
  });
  return q.or(groups.join(",")) as Q;
}

/** ¿El alcance permite ver/elegir esta ASIGNATURA? (para dropdowns). */
export function scopeAllowsCourse(scope: Scope, establishmentId: string | null | undefined, courseId: string): boolean {
  if (scope.all) return true;
  return scope.rules.some((r) => r.establishmentId === establishmentId && (r.courseId === null || r.courseId === courseId));
}

/** ¿El alcance permite ver/elegir esta SECCIÓN? (para dropdowns). */
export function scopeAllowsSection(
  scope: Scope,
  establishmentId: string | null | undefined,
  courseId: string | null | undefined,
  sectionId: string,
): boolean {
  if (scope.all) return true;
  return scope.rules.some(
    (r) =>
      r.establishmentId === establishmentId &&
      (r.courseId === null || r.courseId === courseId) &&
      (r.sectionId === null || r.sectionId === sectionId),
  );
}

/** IDs de establecimiento del alcance (para tablas a nivel establecimiento). */
export function scopeEstablishmentIds(scope: Scope): string[] {
  if (scope.all) return [];
  return [...new Set(scope.rules.map((r) => r.establishmentId))];
}

/** IDs de asignatura del alcance (null en alguna regla ⇒ "todas" en ese est.). */
export function scopeCourseIds(scope: Scope): string[] {
  if (scope.all) return [];
  return [...new Set(scope.rules.map((r) => r.courseId).filter((x): x is string => !!x))];
}

/** IDs de sección del alcance. */
export function scopeSectionIds(scope: Scope): string[] {
  if (scope.all) return [];
  return [...new Set(scope.rules.map((r) => r.sectionId).filter((x): x is string => !!x))];
}

/** ¿Alguna regla acota por asignatura/sección? (si no, es "todo el establecimiento"). */
export function scopeIsNarrowed(scope: Scope): boolean {
  if (scope.all) return false;
  return scope.rules.some((r) => r.courseId !== null || r.sectionId !== null);
}

/** Lee las reglas de alcance de un admin desde `admin_establishments`. */
export async function resolveAdminScopeRules(supabase: SupabaseClient, adminId: string): Promise<ScopeRule[]> {
  const { data } = await supabase
    .from("admin_establishments")
    .select("establishment_id, course_id, section_id")
    .eq("admin_id", adminId);
  return (data || []).map((r) => ({
    establishmentId: r.establishment_id as string,
    courseId: (r.course_id as string | null) ?? null,
    sectionId: (r.section_id as string | null) ?? null,
  }));
}

/**
 * Verifica que una SECCIÓN caiga dentro del alcance resolviendo su asignatura y
 * establecimiento REALES desde la BD (no confía en el course_id del cliente).
 * Cierra el hueco de `matchesScope`, que salta la validación de sección cuando
 * la regla del admin es "toda la asignatura" (sectionId=null): sin esto un admin
 * de la asignatura C podría asignar/sembrar a alguien en una sección de la
 * asignatura D del mismo establecimiento (fuga de alcance). Devuelve el courseId
 * real para forzar consistencia curso↔sección.
 */
export async function sectionInScope(
  admin: SupabaseClient,
  scope: Scope,
  sectionId: string,
): Promise<{ ok: boolean; courseId: string | null; establishmentId: string | null }> {
  const { data: sec } = await admin.from("sections").select("course_id").eq("id", sectionId).maybeSingle();
  if (!sec?.course_id) return { ok: false, courseId: null, establishmentId: null };
  const courseId = sec.course_id as string;
  const { data: crs } = await admin.from("courses").select("establishment_id").eq("id", courseId).maybeSingle();
  const establishmentId = (crs?.establishment_id as string | null) ?? null;
  const ok = matchesScope(scope, { establishment_id: establishmentId, course_id: courseId, section_id: sectionId });
  return { ok, courseId, establishmentId };
}

/** Como `sectionInScope` pero para una ASIGNATURA sin sección. */
export async function courseInScope(
  admin: SupabaseClient,
  scope: Scope,
  courseId: string,
): Promise<{ ok: boolean; establishmentId: string | null }> {
  const { data: crs } = await admin.from("courses").select("establishment_id").eq("id", courseId).maybeSingle();
  if (!crs) return { ok: false, establishmentId: null };
  const establishmentId = (crs.establishment_id as string | null) ?? null;
  const ok = matchesScope(scope, { establishment_id: establishmentId, course_id: courseId, section_id: null });
  return { ok, establishmentId };
}

/** Resuelve el alcance de un usuario por su rol (superadmin = todo). */
export async function resolveScope(supabase: SupabaseClient, userId: string, role: string): Promise<Scope> {
  if (role === "superadmin") return { all: true };
  return { all: false, rules: await resolveAdminScopeRules(supabase, userId) };
}

/**
 * IDs de perfiles dentro del alcance (para rutas que filtran por
 * `.in('student_id'|'user_id'|'id', ...)`). Superadmin → { all: true } (el
 * caller no debe filtrar). Sin reglas → { all:false, ids: [] } = ve nada.
 */
export async function scopedProfileIds(
  supabase: SupabaseClient,
  scope: Scope,
  role?: string,
): Promise<{ all: boolean; ids: string[] }> {
  if (scope.all) return { all: true, ids: [] };
  let q = supabase.from("profiles").select("id");
  if (role) q = q.eq("role", role);
  q = applyScope(q, scope);
  const { data } = await q;
  return { all: false, ids: (data || []).map((p) => p.id as string) };
}
