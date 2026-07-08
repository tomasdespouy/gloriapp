import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Verificación de enlaces de correo generados por la Admin API (recovery, etc.).
 *
 * Por qué esta ruta existe (y no reusamos /auth/callback): el enlace nativo de
 * Supabase (action_link → /auth/v1/verify) redirige con los tokens en el
 * FRAGMENTO de la URL (#access_token=...), que el servidor nunca ve. /auth/callback
 * espera un ?code= (flujo PKCE iniciado en el browser), que un enlace generado por
 * la Admin API no trae. Resultado: la sesión de recuperación nunca se establecía.
 *
 * Aquí verificamos el token_hash directamente con verifyOtp desde el servidor:
 * eso fija las cookies de sesión (vía el cliente SSR) y recién ahí redirigimos a
 * /reset-password, donde el usuario fija su nueva contraseña. Bonus: no dependemos
 * de la allowlist de "Redirect URLs" de Supabase, porque no pasamos por su verify.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") || "/dashboard";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/confirm] verifyOtp error", { type, error: error.message });
  }

  // Token inválido, expirado o ya usado → de vuelta a "Recuperar contraseña"
  // con un aviso para que el usuario pida un enlace nuevo.
  return NextResponse.redirect(`${origin}/forgot-password?error=enlace_invalido`);
}
