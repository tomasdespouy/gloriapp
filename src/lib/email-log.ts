import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fila de email_log. Los cuatro campos opcionales se agregaron con el envío
 * programado: sin `user_id` no se podía responder "¿a esta persona le llegó
 * su correo?" sin cruzar por texto, y sin `provider_message_id` no se podía
 * rastrear un envío concreto en el panel de Resend.
 */
export interface EmailLogRow {
  type: string;
  recipient: string | null;
  success: boolean;
  user_id?: string | null;
  dispatch_id?: string | null;
  provider_message_id?: string | null;
  error_code?: string | null;
}

/**
 * ¿El error de PostgREST viene de que la columna todavía no existe?
 *
 * El código puede llegar a producción antes que su migración: el deploy y la
 * migración corren en procesos separados. Cuando eso pasa, escribir las
 * columnas nuevas falla con 42703 / PGRST204, y sin este reintento se perdería
 * el registro de TODOS los correos de la plataforma, no solo los programados.
 */
function esColumnaFaltante(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  const m = (error.message || "").toLowerCase();
  return m.includes("column") && (m.includes("does not exist") || m.includes("schema cache"));
}

/**
 * Registra un correo enviado vía Resend en email_log (para el contador diario
 * del panel superadmin). Fire-and-forget: nunca debe romper el flujo de envío,
 * así que cualquier error se traga.
 *
 * La firma mantiene los tres primeros parámetros posicionales para que los
 * callsites anteriores al envío programado sigan compilando sin cambios.
 */
export async function logEmail(
  type: string,
  recipient: string | null,
  success = true,
  meta?: {
    userId?: string | null;
    dispatchId?: string | null;
    providerMessageId?: string | null;
    errorCode?: string | null;
  },
): Promise<void> {
  try {
    const admin = createAdminClient();
    const base = { type, recipient: recipient || null, success };
    const { error } = await admin.from("email_log").insert({
      ...base,
      user_id: meta?.userId ?? null,
      dispatch_id: meta?.dispatchId ?? null,
      provider_message_id: meta?.providerMessageId ?? null,
      error_code: meta?.errorCode ?? null,
    });
    // Sin las columnas nuevas todavía: se registra lo esencial igual.
    if (esColumnaFaltante(error)) {
      await admin.from("email_log").insert(base);
    }
  } catch {
    // noop — el log es best-effort
  }
}

/**
 * Inserta muchas filas de una vez. La usa el worker de credenciales al final
 * de cada corrida: escribir de a una añadía un viaje por correo enviado, y en
 * un lote de 50 eso era medio segundo de latencia pura.
 *
 * El índice único parcial email_log_dispatch_uidx impide dos filas exitosas
 * para el mismo despacho, así que una reejecución no infla el contador.
 */
export async function logEmailBatch(rows: EmailLogRow[]): Promise<void> {
  if (!rows.length) return;
  try {
    const admin = createAdminClient();
    const base = rows.map((r) => ({
      type: r.type,
      recipient: r.recipient || null,
      success: r.success,
    }));
    const { error } = await admin.from("email_log").insert(
      rows.map((r, i) => ({
        ...base[i],
        user_id: r.user_id ?? null,
        dispatch_id: r.dispatch_id ?? null,
        provider_message_id: r.provider_message_id ?? null,
        error_code: r.error_code ?? null,
      })),
    );
    if (esColumnaFaltante(error)) {
      await admin.from("email_log").insert(base);
    }
  } catch {
    // noop — el log es best-effort
  }
}
