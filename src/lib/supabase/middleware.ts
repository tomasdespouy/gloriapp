import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { locales, defaultLocale } from "@/i18n/config";

/**
 * Strips a locale prefix from the pathname if present.
 * E.g. "/en/login" -> "/login", "/pt/privacidad" -> "/privacidad"
 */
function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (first && locales.includes(first as typeof locales[number]) && first !== defaultLocale) {
    return "/" + segments.slice(1).join("/") || "/";
  }
  return pathname;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Validate the user's JWT on every request
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Strip locale prefix before checking against the public route allowlist
  const normalizedPath = stripLocalePrefix(request.nextUrl.pathname);

  // Redirect unauthenticated users to login (except public routes)
  if (
    !user &&
    normalizedPath !== "/" &&
    !normalizedPath.startsWith("/login") &&
    !normalizedPath.startsWith("/auth") &&
    !normalizedPath.startsWith("/signup") &&
    !normalizedPath.startsWith("/forgot-password") &&
    !normalizedPath.startsWith("/reset-password") &&
    !normalizedPath.startsWith("/privacidad") &&
    !normalizedPath.startsWith("/terminos") &&
    !normalizedPath.startsWith("/sobre") &&
    !normalizedPath.startsWith("/api/health")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
