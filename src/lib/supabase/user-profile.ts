import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "./server";

export type UserProfile = {
  id: string;
  role: "student" | "instructor" | "admin" | "superadmin";
  realRole: "student" | "instructor" | "admin" | "superadmin";
  fullName: string;
  email: string;
  avatarUrl: string | null;
  establishmentId: string | null;
  isImpersonating: boolean;
  impersonationLabel?: string;
};

/**
 * Cached per-request: fetch user profile once, reuse across layout + page.
 * React `cache()` deduplicates within a single server render pass.
 * If the real user is superadmin and has a `gloria-impersonate` cookie,
 * the returned role and establishmentId are overridden.
 */
export const getUserProfile = cache(async (): Promise<UserProfile | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email, avatar_url, establishment_id")
    .eq("id", user.id)
    .single();

  const realRole = (profile?.role || "student") as UserProfile["role"];

  // Check for impersonation cookie (superadmin only)
  let overriddenRole = realRole;
  let overriddenEstId = profile?.establishment_id || null;
  let isImpersonating = false;
  let impersonationLabel: string | undefined;

  if (realRole === "superadmin") {
    try {
      const cookieStore = await cookies();
      const raw = cookieStore.get("gloria-impersonate")?.value;
      if (raw) {
        const override = JSON.parse(raw);
        if (override.role && override.establishmentId) {
          overriddenRole = override.role;
          overriddenEstId = override.establishmentId;
          isImpersonating = true;
          const roleLabels: Record<string, string> = {
            student: "Estudiante",
            instructor: "Docente",
            admin: "Admin",
          };
          impersonationLabel = `${roleLabels[override.role] || override.role} @ ${override.establishmentName || ""}`;
        }
      }
    } catch { /* cookie parse error — ignore */ }
  }

  return {
    id: user.id,
    role: overriddenRole,
    realRole,
    fullName: profile?.full_name || "Usuario",
    email: profile?.email || user.email || "",
    avatarUrl: profile?.avatar_url || null,
    establishmentId: overriddenEstId,
    isImpersonating,
    impersonationLabel,
  };
});
