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
    // Formulario de contacto del landing — público por diseño.
    !pathname.startsWith("/api/contact") &&
    // "Recuperar contraseña" lo usa, POR DEFINICIÓN, gente SIN sesión. La
    // página /forgot-password ya estaba permitida, pero su endpoint no: el POST
    // caía en este redirect a /login, que responde 405 a un POST, y el
    // formulario mostraba "No se pudo procesar la solicitud". Funcionaba solo si
    // el navegador ya tenía sesión, que es justo el caso que no importa.
    // Se lista la ruta exacta y no todo /api/auth/, para que agregar un endpoint
    // ahí en el futuro no lo vuelva público sin querer.
    // La ruta es segura para exponer: responde siempre lo mismo exista o no el
    // correo (anti-enumeración) y no cambia ninguna contraseña por sí sola.
    pathname !== "/api/auth/forgot-password" &&
    // Canje del enlace de recuperacion: lo usa gente SIN sesion, igual que el
    // formulario. Se listan las rutas exactas y no todo /api/auth/ para que
    // agregar un endpoint ahi no lo vuelva publico sin querer.
    pathname !== "/api/auth/confirm" &&
    // Vercel Cron hits these with Authorization: Bearer $CRON_SECRET.
    // The endpoints verify the secret themselves, so the middleware
    // must let the request through without redirecting to /login.
    !pathname.startsWith("/api/cron/") &&
    // Se auto-autoriza con Bearer CRON_SECRET o sesión superadmin (para lotes).
    !pathname.startsWith("/api/admin/reeval-session") &&
    !pathname.startsWith("/piloto/") &&
    !pathname.startsWith("/paulina")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
