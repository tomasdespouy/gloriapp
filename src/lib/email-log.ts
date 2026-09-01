import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Registra un correo enviado vía Resend en email_log (para el contador diario
 * del panel superadmin). Fire-and-forget: nunca debe romper el flujo de envío,
 * así que cualquier error se traga.
 */
export async function logEmail(type: string, recipient: string | null, success = true): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("email_log").insert({ type, recipient: recipient || null, success });
  } catch {
    // noop — el log es best-effort
  }
}
