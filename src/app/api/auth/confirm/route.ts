import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Canje del enlace de recuperación. SOLO POST, y esa es toda la gracia.
 *
 * Antes esto vivía en un GET (/auth/confirm/route.ts) que llamaba a verifyOtp
 * directamente. El token de recuperación es de UN SOLO USO, así que cualquier
 * visita automática al enlace lo quemaba antes de que la persona hiciera clic:
 * los escáneres de seguridad de los correos institucionales abren cada URL del
 * mensaje para revisar que no sea maliciosa.
 *
 * Medido en producción el 2026-09-04 con el caso de una estudiante de USS:
 * 2 correos de recuperación generaron 12 peticiones a /auth/confirm — seis por
 * enlace. Ella recibía "el enlace expiró o ya fue usado" y volvía a pedirlo; en
 * agosto llegó a pedir 5 en 8 minutos. Solo entró cuando alcanzó a hacer clic
 * 41 segundos después de que llegó el correo, antes que el escáner.
 *
 * Un escáner hace GET. No hace POST desde un formulario. Por eso el GET ahora
 * solo muestra una pantalla con un botón, y el canje ocurre acá.
 */
export async function POST(request: Request) {
  const { origin } = new URL(request.url);

  let tokenHash: string | null = null;
  let type: EmailOtpType | null = null;
  let next = "/reset-password";

  try {
    const form = await request.formData();
    tokenHash = (form.get("token_hash") as string) || null;
    type = ((form.get("type") as string) || null) as EmailOtpType | null;
    const n = form.get("next") as string | null;
    if (n && n.startsWith("/")) next = n; // solo rutas internas
  } catch {
    // body inválido → cae al redirect de error
  }

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`, { status: 303 });
    }
    console.error("[auth/confirm] verifyOtp error", { type, error: error.message });
  }

  return NextResponse.redirect(`${origin}/forgot-password?error=enlace_invalido`, { status: 303 });
}
