import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { locales, defaultLocale } from "@/i18n/config";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Extract potential locale from first path segment
  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0] as string | undefined;

  // Check if path starts with a non-default locale (en, pt)
  const pathnameLocale = firstSegment && locales.includes(firstSegment as typeof locales[number]) && firstSegment !== defaultLocale
    ? (firstSegment as typeof locales[number])
    : null;

  // If path starts with /es/, redirect to the path without locale prefix
  // since Spanish is the default and served at /
  if (firstSegment === defaultLocale) {
    const pathWithoutLocale = "/" + segments.slice(1).join("/");
    const url = request.nextUrl.clone();
    url.pathname = pathWithoutLocale || "/";
    return NextResponse.redirect(url);
  }

  // For locale-prefixed paths (en, pt), validate the locale segment
  // and let the [locale] route handle them
  if (pathnameLocale) {
    // Pass through to supabase middleware for auth handling
    return await updateSession(request);
  }

  // For all other paths (no locale prefix), proceed normally
  // The default locale (es) is handled by the root routes
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|mp3|ico|txt|xml)$).*)",
  ],
};
