/**
 * Núcleo compartido de entrega de credenciales.
 *
 * Lo usan los DOS caminos: la ruta interactiva (/api/admin/users/[id]/reset-password,
 * que corre con una persona mirando la pantalla) y el worker programado
 * (/api/cron/dispatch-credentials). Que compartan este módulo es lo que impide
 * que el camino diferido se desvíe del vivo: si mañana cambia la plantilla o
 * se agrega un paso, ambos lo heredan.
 *
 * Este módulo NO decide a quién mandarle: eso es eligibility.ts. Aquí se asume
 * que la decisión ya se tomó y solo se ejecuta la entrega.
 *
 * OJO: `updateUserById({ password })` es destructivo e inmediato. Quien llame a
 * esta función ya debe haber verificado que la persona no tiene una contraseña
 * propia que perder.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateTempPassword } from "@/lib/credentials/temp-password";
import { renderCredentialsEmail, type CredentialsVariant } from "@/lib/emails/credentials-template";
import { sendTransactional } from "@/lib/emails/send";
import type { EmailLogRow } from "@/lib/email-log";
import { logAdminAction } from "@/lib/audit";

export interface IssueCredentialsParams {
  userId: string;
  /** Si se omite, se deduce de credentials_sent_at (primera vez → bienvenida). */
  variant?: CredentialsVariant;
  /**
   * Clave ya generada y persistida por el worker antes de rotar. Reusarla es lo
   * que convierte un reintento en "el mismo correo otra vez" en vez de "una
   * segunda clave que invalida la primera".
   */
  presetPassword?: string;
  idempotencyKey?: string;
  /** Quién queda auditado como responsable. NULL si lo disparó el sistema. */
  actorId: string | null;
  via: "manual" | "programado";
  dispatchId?: string | null;
  batchId?: string | null;
  /** Párrafos libres escritos por quien agendó el envío. */
  customIntro?: string | null;
  /** Si viene, las filas de email_log se acumulan en vez de escribirse ya. */
  deferLog?: EmailLogRow[];
}

export interface IssueCredentialsResult {
  emailSent: boolean;
  providerMessageId: string | null;
  rateLimited: boolean;
  quotaExhausted: boolean;
  retryAfterSec: number | null;
  error: string | null;
  errorCode: string | null;
  /** Correo al que se envió de verdad (puede diferir del que traía el despacho). */
  sentTo: string | null;
}

export async function issueCredentials(
  admin: SupabaseClient,
  p: IssueCredentialsParams,
): Promise<IssueCredentialsResult> {
  // 1. Datos vigentes de la persona. Se leen AHORA, no se confía en la copia
  //    que traía el despacho: el correo pudo corregirse después de agendar.
  const { data: target, error: readErr } = await admin
    .from("profiles")
    .select("email, full_name, credentials_sent_at, establishment_id")
    .eq("id", p.userId)
    .single();

  if (readErr || !target) {
    return err("Perfil no encontrado", "profile_missing");
  }
  if (!target.email || !target.email.includes("@")) {
    return err("El perfil no tiene un correo válido", "no_email");
  }

  // 2. Marca institucional del correo. Es opcional: si el establecimiento no
  //    tiene logo cargado, la plantilla omite la fila sin romperse.
  let institutionName: string | null = null;
  let institutionLogoUrl: string | null = null;
  if (target.establishment_id) {
    const { data: est } = await admin
      .from("establishments")
      .select("name, logo_url")
      .eq("id", target.establishment_id)
      .single();
    institutionName = est?.name ?? null;
    institutionLogoUrl = est?.logo_url ?? null;
  }

  const variant: CredentialsVariant =
    p.variant ?? (target.credentials_sent_at == null ? "bienvenida" : "restablecimiento");

  // 3. Clave temporal. El worker la pasa ya persistida; la ruta interactiva
  //    la genera aquí.
  const tempPassword = p.presetPassword ?? generateTempPassword();

  // 4. Rotación. Destructiva e inmediata: a partir de acá la clave anterior
  //    dejó de servir, sin importar si el correo sale o no.
  const { error: rotErr } = await admin.auth.admin.updateUserById(p.userId, {
    password: tempPassword,
  });
  if (rotErr) {
    return err(rotErr.message, "rotate_failed");
  }

  // 5. La clave es temporal: se fuerza el cambio en el primer ingreso.
  await admin.from("profiles").update({ must_change_password: true }).eq("id", p.userId);

  // 6. Envío.
  const { subject, html } = renderCredentialsEmail({
    variant,
    fullName: target.full_name,
    email: target.email,
    tempPassword,
    institutionName,
    institutionLogoUrl,
    customIntro: p.customIntro ?? null,
  });

  const res = await sendTransactional({
    to: target.email,
    subject,
    html,
    type: variant === "recordatorio" ? "credentials_reminder" : "credentials",
    idempotencyKey: p.idempotencyKey,
    userId: p.userId,
    dispatchId: p.dispatchId ?? null,
    defer: p.deferLog,
  });

  // 7. `credentials_sent_at` solo se sella si el correo salió de verdad. Así el
  //    panel puede ofrecer "reintentar fallidos" sin mentir sobre el estado.
  if (res.ok) {
    await admin
      .from("profiles")
      .update({ credentials_sent_at: new Date().toISOString() })
      .eq("id", p.userId);
  }

  // 8. Auditoría. En el camino programado el actor es quien agendó, no el cron:
  //    la responsabilidad es de la persona que apretó el botón, aunque el correo
  //    salga tres días después.
  if (p.actorId) {
    await logAdminAction({
      adminId: p.actorId,
      action: p.via === "programado" ? "credentials_sent_scheduled" : "reset_password",
      entityType: "user",
      entityId: p.userId,
      details: {
        email: target.email,
        emailSent: res.ok,
        variant,
        via: p.via,
        dispatchId: p.dispatchId ?? null,
        batchId: p.batchId ?? null,
        errorCode: res.errorCode,
      },
    });
  }

  return {
    emailSent: res.ok,
    providerMessageId: res.providerMessageId,
    rateLimited: res.rateLimited,
    quotaExhausted: res.quotaExhausted,
    retryAfterSec: res.retryAfterSec,
    error: res.error,
    errorCode: res.errorCode,
    sentTo: target.email,
  };
}

function err(message: string, code: string): IssueCredentialsResult {
  return {
    emailSent: false,
    providerMessageId: null,
    rateLimited: false,
    quotaExhausted: false,
    retryAfterSec: null,
    error: message,
    errorCode: code,
    sentTo: null,
  };
}
