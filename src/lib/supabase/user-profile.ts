import { cache } from "react";
import { createClient } from "./server";

export type UserProfile = {
  id: string;
  role: "student" | "instructor" | "admin" | "superadmin";
  fullName: string;
  email: string;
  avatarUrl: string | null;
};

/**
 * Cached per-request: fetch user profile once, reuse across layout + page.
 * React `cache()` deduplicates within a single server render pass.
 */
export const getUserProfile = cache(async (): Promise<UserProfile | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email, avatar_url")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    role: (profile?.role || "student") as UserProfile["role"],
    fullName: profile?.full_name || "Usuario",
    email: profile?.email || user.email || "",
    avatarUrl: profile?.avatar_url || null,
  };
});
