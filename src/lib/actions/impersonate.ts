"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const COOKIE_NAME = "gloria-impersonate";

export type ImpersonationOverride = {
  role: "student" | "instructor" | "admin";
  establishmentId: string;
  establishmentName: string;
};

export async function setImpersonation(
  role: "student" | "instructor" | "admin",
  establishmentId: string,
  establishmentName: string
) {
  // Verify caller is truly superadmin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") throw new Error("No autorizado");

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, JSON.stringify({ role, establishmentId, establishmentName }), {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    secure: true,
    maxAge: 3600, // 1h auto-expire (was 24h)
  });
}

export async function clearImpersonation() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getImpersonation(): Promise<ImpersonationOverride | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
