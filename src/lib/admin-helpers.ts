import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/supabase/user-profile";
import { redirect } from "next/navigation";

export type AdminContext = {
  userId: string;
  role: "admin" | "superadmin";
  isSuperadmin: boolean;
  establishmentIds: string[];
  isImpersonating: boolean;
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

  let establishmentIds: string[] = [];
  if (isSuperadmin) {
    // Real superadmin without impersonation: sees every establishment.
    const { data: establishments } = await supabase
      .from("establishments")
      .select("id");
    establishmentIds = establishments?.map((e) => e.id) || [];
  } else if (profile.isImpersonating && profile.establishmentId) {
    // Superadmin impersonating admin: scope to the cookie's single establishment.
    establishmentIds = [profile.establishmentId];
  } else {
    // Real admin: resolve scope via admin_establishments.
    const { data: assignments } = await supabase
      .from("admin_establishments")
      .select("establishment_id")
      .eq("admin_id", profile.id);
    establishmentIds = assignments?.map((a) => a.establishment_id) || [];
  }

  return {
    userId: profile.id,
    role: profile.role,
    isSuperadmin,
    establishmentIds,
    isImpersonating: profile.isImpersonating,
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
