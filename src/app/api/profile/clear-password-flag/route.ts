import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// Clears must_change_password for the current user. Called after the user
// successfully sets a new password (forced first-login change, email reset,
// or "Mi perfil"). Scoped to the caller's own id.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = createAdminClient();

  // Las DOS escrituras van por separado, y el orden importa.
  //
  // Limpiar `must_change_password` es lo que deja entrar a la persona: si falla,
  // queda en bucle hacia /cambiar-clave y no puede usar la plataforma. Escribir
  // `password_set_at` es una mejora (protege su contraseña de un envío
  // programado), pero es prescindible.
  //
  // Cuando iban juntas en un solo UPDATE, un despliegue que llegara antes que su
  // migración tumbaba las dos a la vez y dejaba gente encerrada. Separadas, lo
  // esencial se escribe siempre.
  const { error } = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort: si la columna todavía no existe en este entorno, no pasa nada.
  // La protección de "no le rompas la contraseña a quien ya eligió la suya"
  // sigue cubierta por `last_sign_in_at`, que es la regla por omisión.
  const { error: marcaError } = await admin
    .from("profiles")
    .update({ password_set_at: new Date().toISOString() })
    .eq("id", user.id);

  if (marcaError) {
    console.warn("[clear-password-flag] no se pudo marcar password_set_at:", marcaError.message);
  }

  return NextResponse.json({ success: true });
}
