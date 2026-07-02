import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/supabase/user-profile";
import { redirect } from "next/navigation";
import { type Scope, resolveAdminScopeRules, scopeEstablishmentIds } from "@/lib/admin-scope";

export type AdminContext = {
  userId: string;
  role: "admin" | "superadmin";
  isSuperadmin: boolean;
  establishmentIds: string[];
  isImpersonating: boolean;
  // Alcance completo (incluye acotamiento por asignatura/sección). Las
  // superficies que muestran PERSONAS/datos deben usar `scope` (matchesScope /
  // applyScope), no solo establishmentIds.
  scope: Scope;
};

/**
 * Get admin context — redirects if user is not admin/superadmin.
 *
 * Honors the `gloria-impersonate` cookie: when a superadmin is impersonating
 * an admin, the returned context reflects the admin's effective scope (single
 * establishment from the cookie), so scoping queries behave as the admin would
 * see them. Real-role authorization still requires the user to actually be
 * admin or superadmin in the database.
 */
export async function getAdminContext(): Promise<AdminContext> {
  const profile = await getUserProfile();
  if (!profile) redirect("/login");

  // Authorization check uses the real DB role. Impersonation is a view
  // overlay for superadmins — non-superadmins cannot impersonate.
  if (profile.realRole !== "admin" && profile.realRole !== "superadmin") {
    redirect("/dashboard");
  }

  // Effective role honors the impersonation cookie. If a superadmin is
  // impersonating a student/instructor, admin pages don't apply — redirect.
  if (profile.role !== "admin" && profile.role !== "superadmin") {
    redirect("/dashboard");
  }

  const isSuperadmin = profile.role === "superadmin";
  const supabase = await createClient();

  let scope: Scope;
  let establishmentIds: string[] = [];
  if (isSuperadmin) {
    // Real superadmin without impersonation: sees every establishment.
    scope = { all: true };
    const { data: establishments } = await supabase
      .from("establishments")
      .select("id");
    establishmentIds = establishments?.map((e) => e.id) || [];
  } else if (profile.isImpersonating && profile.establishmentId) {
    // Superadmin impersonating admin: scope to the cookie's single establishment
    // (whole establishment — the cookie carries no course/section narrowing).
    scope = { all: false, rules: [{ establishmentId: profile.establishmentId, courseId: null, sectionId: null }] };
    establishmentIds = [profile.establishmentId];
  } else {
    // Real admin: resolve scope (con acotamiento por asignatura/sección) desde
    // admin_establishments. Sin filas = "sin asignar" = no ve nada.
    const rules = await resolveAdminScopeRules(supabase, profile.id);
    scope = { all: false, rules };
    establishmentIds = scopeEstablishmentIds(scope);
  }

  return {
    userId: profile.id,
    role: profile.role,
    isSuperadmin,
    establishmentIds,
    isImpersonating: profile.isImpersonating,
    scope,
  };
}

/**
 * Build a Supabase filter that scopes queries by establishment_id.
 * For superadmin, returns all; for admin, filters by assigned establishments.
 */
export function scopeByEstablishment<T extends { in: (col: string, vals: string[]) => T }>(
  query: T,
  ctx: AdminContext,
  column = "establishment_id"
): T {
  if (ctx.isSuperadmin) return query;
  return query.in(column, ctx.establishmentIds.length > 0 ? ctx.establishmentIds : ["00000000-0000-0000-0000-000000000000"]);
}
