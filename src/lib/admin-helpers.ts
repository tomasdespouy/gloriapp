import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type AdminContext = {
  userId: string;
  role: "admin" | "superadmin";
  isSuperadmin: boolean;
  establishmentIds: string[];
};

/**
 * Get admin context — redirects if user is not admin/superadmin.
 */
export async function getAdminContext(): Promise<AdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "superadmin") {
    redirect("/dashboard");
  }

  const isSuperadmin = profile.role === "superadmin";

  let establishmentIds: string[] = [];
  if (isSuperadmin) {
    // Superadmin sees all establishments
    const { data: establishments } = await supabase
      .from("establishments")
      .select("id");
    establishmentIds = establishments?.map((e) => e.id) || [];
  } else {
    // Admin sees only assigned establishments
    const { data: assignments } = await supabase
      .from("admin_establishments")
      .select("establishment_id")
      .eq("admin_id", user.id);
    establishmentIds = assignments?.map((a) => a.establishment_id) || [];
  }

  return {
    userId: user.id,
    role: profile.role as "admin" | "superadmin",
    isSuperadmin,
    establishmentIds,
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
