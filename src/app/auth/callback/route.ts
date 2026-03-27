import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  // Always clear impersonation on login so supradmin starts fresh
  const cookieStore = await cookies();
  cookieStore.delete("gloria-impersonate");

  if (code) {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.exchangeCodeForSession(code);

    // If there's a specific redirect target (e.g. /reset-password), use it
    if (next) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    if (session?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      const role = profile?.role;
      if (role === "admin" || role === "superadmin") {
        return NextResponse.redirect(`${origin}/admin/dashboard`);
      } else if (role === "instructor") {
        return NextResponse.redirect(`${origin}/docente/dashboard`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
