import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  const pathname = request.nextUrl.pathname;

  // Redirect unauthenticated users to login (except public routes)
  if (
    !user &&
    pathname !== "/" &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/auth") &&
    !pathname.startsWith("/signup") &&
    !pathname.startsWith("/forgot-password") &&
    !pathname.startsWith("/reset-password") &&
    !pathname.startsWith("/privacidad") &&
    !pathname.startsWith("/terminos") &&
    !pathname.startsWith("/sobre") &&
    !pathname.startsWith("/api/health") &&
    !pathname.startsWith("/api/public/") &&
    // Vercel Cron hits these with Authorization: Bearer $CRON_SECRET.
    // The endpoints verify the secret themselves, so the middleware
    // must let the request through without redirecting to /login.
    !pathname.startsWith("/api/cron/") &&
    // Load test login: gated by LLM_PROVIDER=mock at the route level
    // (returns 404 in any env without that flag).
    !pathname.startsWith("/api/loadtest/") &&
    !pathname.startsWith("/piloto/") &&
    !pathname.startsWith("/ANGLO") &&
    !pathname.startsWith("/paulina")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
