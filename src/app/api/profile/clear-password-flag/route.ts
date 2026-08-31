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
  // `password_set_at` es la señal de "esta persona eligió su propia contraseña".
  // La lee el worker de envíos programados para NUNCA reemplazar una clave viva:
  // must_change_password no sirve para eso porque nace en false por DEFAULT y no
  // distingue "ya eligió" de "nunca se le pidió".
  const { error } = await admin
    .from("profiles")
    .update({ must_change_password: false, password_set_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
