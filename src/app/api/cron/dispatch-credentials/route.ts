/**
 * CRON: despacho de credenciales programadas.
 *
 * Reemplaza el bucle que corría en la pestaña del admin
 * (UsuariosClient.sendCredentialsToIds): ahora el envío vive en el servidor,
 * sobrevive al cierre del navegador, deja rastro de qué pasó con cada persona
 * y se puede cancelar a mitad de camino.
 *
 * Auth: Bearer CRON_SECRET (GET, disparo automático) o sesión de superadmin
 * (POST, para "Ejecutar ahora" y para las pruebas en staging, donde los crons
 * nativos no disparan).
 *
 * Corre cada 5 minutos (vercel.json). El proyecto está en plan Vercel Pro, así
 * que este cron es nativo y no depende de ningún servicio externo.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCron, requireCronOrSuperadmin } from "@/lib/cron-auth";
import { issueCredentials } from "@/lib/credentials/issue";
import { generateTempPassword } from "@/lib/credentials/temp-password";
import {
  evaluateDispatch,
  loadDispatchContext,
  type DispatchRow,
} from "@/lib/credentials/eligibility";
import { logEmailBatch, type EmailLogRow } from "@/lib/email-log";

export const maxDuration = 120;

/** Techo duro de correos por corrida. Con 5 min entre corridas da ~600/hora. */
const MAX_POR_CORRIDA = 50;
/** Se reclama de a 5: si la función muere, quedan varadas 5 filas, no 50. */
const CHUNK = 5;
/** ~1,4 req/s. Resend admite del orden de 2/s. */
const SPACING_MS = 700;
/** Se corta antes del maxDuration de 120 s para alcanzar a cerrar prolijo. */
const TIME_BUDGET_MS = 95_000;
/** Una fila 'procesando' más vieja que esto se considera huérfana y se rescata. */
const LEASE_MIN = 15;

export async function GET(request: Request) {
  const rejected = requireCron(request);
  if (rejected) return rejected;
  return ejecutarCorrida({ dryRun: false });
}

/** Disparo manual desde el panel, o prueba en staging. */
export async function POST(request: Request) {
  const rejected = await requireCronOrSuperadmin(request);
  if (rejected) return rejected;
  const url = new URL(request.url);
  return ejecutarCorrida({ dryRun: url.searchParams.get("dry_run") === "1" });
}

interface Opts {
  dryRun: boolean;
}

async function ejecutarCorrida({ dryRun }: Opts) {
  const t0 = Date.now();
  const admin = createAdminClient();
  const elapsed = () => Date.now() - t0;

  // ── 0. ¿Hay un freno global vigente por 429 o cuota agotada? ───────────────
  const { data: rt } = await admin
    .from("dispatch_runtime")
    .select("throttled_until, throttle_reason")
    .eq("id", true)
    .single();

  if (rt?.throttled_until && new Date(rt.throttled_until).getTime() > Date.now()) {
    await tocarLatido(admin, { claimed: 0, sent: 0, failed: 0 });
    return NextResponse.json({
      throttled_until: rt.throttled_until,
      reason: rt.throttle_reason,
      enviados: 0,
    });
  }

  // ── 1. Mantenimiento ──────────────────────────────────────────────────────
  // a) Rescate de filas colgadas por una corrida que murió a mitad.
  await admin
    .from("credential_dispatches")
    .update({ status: "pendiente" })
    .eq("status", "procesando")
    .lt("claimed_at", new Date(Date.now() - LEASE_MIN * 60_000).toISOString());

  // b) Vencidos: pendientes que pasaron su ventana. Nunca en silencio.
  const { data: vencidos } = await admin
    .from("credential_dispatches")
    .update({ status: "omitido", skip_reason: "vencido", pending_password: null })
    .eq("status", "pendiente")
    .lt("expires_at", new Date().toISOString())
    .select("id, batch_id");

  // ── 2. Bucle de despacho ──────────────────────────────────────────────────
  let enviados = 0;
  let fallidos = 0;
  let reclamados = 0;
  let omitidos = 0;
  let frenado: { reason: string; retryAfterSec: number | null } | null = null;
  const registros: EmailLogRow[] = [];

  while (enviados + fallidos < MAX_POR_CORRIDA && !frenado) {
    if (elapsed() > TIME_BUDGET_MS) break;

    const { data: filas, error: claimErr } = await admin.rpc("claim_credential_dispatches", {
      p_limit: Math.min(CHUNK, MAX_POR_CORRIDA - (enviados + fallidos)),
    });
    if (claimErr) {
      console.error("[dispatch-credentials] claim falló", claimErr.message);
      break;
    }
    const lote = (filas ?? []) as (DispatchRow & { pending_password: string | null; deferrals: number })[];
    if (!lote.length) break;
    reclamados += lote.length;

    let ctx;
    try {
      ctx = await loadDispatchContext(admin, lote);
    } catch (e) {
      // Sin last_sign_in_at no podemos garantizar que no rompemos una
      // contraseña viva: devolvemos todo a pendiente y cortamos.
      console.error("[dispatch-credentials] contexto falló", e);
      await Promise.all(lote.map((f) => devolverAPendiente(admin, f.id, f.attempts)));
      break;
    }

    for (const fila of lote) {
      if (elapsed() > TIME_BUDGET_MS) {
        await devolverAPendiente(admin, fila.id, fila.attempts);
        continue;
      }

      const veredicto = evaluateDispatch(fila, ctx);

      if (veredicto.kind === "posponer") {
        await admin
          .from("credential_dispatches")
          .update({
            status: "pendiente",
            attempts: fila.attempts - 1, // posponer no gasta un intento
            next_attempt_at: veredicto.hasta,
            expires_at: new Date(new Date(veredicto.hasta).getTime() + 48 * 3600_000).toISOString(),
            last_error: veredicto.motivo,
          })
          .eq("id", fila.id);
        continue;
      }

      if (veredicto.kind === "omitir") {
        const terminal = veredicto.reason === "cancelado_por_admin" ? "cancelado" : "omitido";
        await admin
          .from("credential_dispatches")
          .update({ status: terminal, skip_reason: veredicto.reason, pending_password: null })
          .eq("id", fila.id);
        omitidos++;
        continue;
      }

      if (dryRun) {
        await devolverAPendiente(admin, fila.id, fila.attempts);
        continue;
      }

      const batch = ctx.batches.get(fila.batch_id)!;

      // Clave temporal: se persiste ANTES de rotar y se reutiliza en cada
      // reintento. Así un reintento reenvía EL MISMO correo con la MISMA clave,
      // en vez de una segunda clave que invalidaría la primera.
      let clave = fila.pending_password;
      if (!clave) {
        clave = generateTempPassword();
        await admin.from("credential_dispatches").update({ pending_password: clave }).eq("id", fila.id);
      }

      const res = await issueCredentials(admin, {
        userId: fila.user_id!,
        variant: fila.kind === "recordatorio" ? "recordatorio" : undefined,
        presetPassword: clave,
        idempotencyKey: `cd:${fila.id}`,
        actorId: batch.scheduled_by,
        via: "programado",
        dispatchId: fila.id,
        batchId: fila.batch_id,
        customIntro: batch.custom_intro,
        deferLog: registros,
      });

      // 429 o cuota agotada: el límite es de la cuenta entera, así que se frena
      // toda la corrida, no solo esta fila.
      if (res.rateLimited || res.quotaExhausted) {
        await admin
          .from("credential_dispatches")
          .update({
            status: "pendiente",
            attempts: fila.attempts - 1, // un 429 no es culpa del destinatario
            deferrals: (fila.deferrals ?? 0) + 1,
            next_attempt_at: new Date(
              Date.now() + Math.max(60, res.retryAfterSec ?? 60) * 1000,
            ).toISOString(),
            last_error: res.error,
          })
          .eq("id", fila.id);
        frenado = { reason: res.quotaExhausted ? "cuota_agotada" : "rate_limit", retryAfterSec: res.retryAfterSec };
        break;
      }

      if (!res.emailSent) {
        fallidos += await reintentarOFallar(admin, fila, res.error ?? "Error desconocido");
        continue;
      }

      // Éxito. Se marca la fila antes que nada más para achicar la ventana en
      // que una caída dejaría el correo enviado y la fila sin marcar.
      await admin
        .from("credential_dispatches")
        .update({
          status: "enviado",
          sent_at: new Date().toISOString(),
          provider_message_id: res.providerMessageId,
          pending_password: null,
          last_error: null,
        })
        .eq("id", fila.id);

      // Recordatorio: la fila hija nace AQUÍ, no al agendar. Así su fecha de
      // referencia es el envío real y no la de creación del lote.
      if (fila.kind === "credenciales" && batch.reminder_after_days) {
        const cuando = new Date(Date.now() + batch.reminder_after_days * 86_400_000).toISOString();
        await admin.from("credential_dispatches").upsert(
          [
            {
              batch_id: fila.batch_id,
              kind: "recordatorio",
              parent_id: fila.id,
              user_id: fila.user_id,
              email_snapshot: res.sentTo ?? fila.email_snapshot,
              batch_index: fila.batch_index,
              send_after: cuando,
              next_attempt_at: cuando,
              expires_at: new Date(new Date(cuando).getTime() + 48 * 3600_000).toISOString(),
            },
          ],
          { onConflict: "batch_id,user_id,kind", ignoreDuplicates: true },
        );
      }

      // Estado del participante, si el lote cuelga de un programa. Es lo que
      // hacía la ruta send-invites, pero ahora se escribe cuando el correo
      // salió de verdad, no cuando se intentó.
      if (batch.pilot_id) {
        await admin
          .from("pilot_participants")
          .update({ status: "invitado", invite_sent_at: new Date().toISOString() })
          .eq("user_id", fila.user_id)
          .eq("pilot_id", batch.pilot_id)
          .eq("status", "pendiente");
      }

      enviados++;
      await sleep(SPACING_MS);
    }
  }

  // ── 3. Escrituras diferidas, en un solo viaje ─────────────────────────────
  if (registros.length) await logEmailBatch(registros);

  if (frenado) await frenoGlobal(admin, frenado);

  await cerrarLotesTerminados(admin);
  await tocarLatido(admin, { claimed: reclamados, sent: enviados, failed: fallidos });

  return NextResponse.json({
    dryRun,
    reclamados,
    enviados,
    fallidos,
    omitidos,
    vencidos: vencidos?.length ?? 0,
    frenado,
    ms: elapsed(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type Admin = ReturnType<typeof createAdminClient>;

/** Devuelve una fila reclamada a la cola sin gastarle el intento. */
async function devolverAPendiente(admin: Admin, id: string, attempts: number) {
  await admin
    .from("credential_dispatches")
    .update({ status: "pendiente", attempts: Math.max(0, attempts - 1) })
    .eq("id", id);
}

/**
 * Error transitorio: se reintenta con espera creciente hasta max_attempts.
 * Devuelve 1 si la fila quedó definitivamente fallida, 0 si se reintentará.
 */
async function reintentarOFallar(
  admin: Admin,
  fila: DispatchRow,
  error: string,
): Promise<number> {
  if (fila.attempts >= fila.max_attempts) {
    await admin
      .from("credential_dispatches")
      .update({ status: "fallido", last_error: error, pending_password: null })
      .eq("id", fila.id);
    return 1;
  }
  await admin
    .from("credential_dispatches")
    .update({
      status: "pendiente",
      last_error: error,
      next_attempt_at: new Date(Date.now() + fila.attempts * 5 * 60_000).toISOString(),
    })
    .eq("id", fila.id);
  return 0;
}

/**
 * Freno de toda la cuenta. Una cuota agotada no es congestión: reintentar a
 * ciegas solo quema intentos, así que se espera bastante más que ante un 429.
 */
async function frenoGlobal(admin: Admin, f: { reason: string; retryAfterSec: number | null }) {
  const esperaMs =
    f.reason === "cuota_agotada" ? 6 * 3600_000 : Math.max(60, f.retryAfterSec ?? 60) * 1000;
  await admin
    .from("dispatch_runtime")
    .update({
      throttled_until: new Date(Date.now() + esperaMs).toISOString(),
      throttle_reason: f.reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  console.error("[dispatch-credentials] freno global", f.reason, "hasta", new Date(Date.now() + esperaMs).toISOString());
}

/** Marca como cerrados los lotes que ya no tienen filas por despachar. */
async function cerrarLotesTerminados(admin: Admin) {
  const { data: abiertos } = await admin
    .from("credential_batches")
    .select("id")
    .is("closed_at", null)
    .limit(50);
  if (!abiertos?.length) return;

  for (const b of abiertos) {
    const { count } = await admin
      .from("credential_dispatches")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", b.id)
      .in("status", ["pendiente", "procesando"]);
    if ((count ?? 0) === 0) {
      await admin
        .from("credential_batches")
        .update({ closed_at: new Date().toISOString() })
        .eq("id", b.id);
    }
  }
}

/**
 * Latido. Sin esto, un cron muerto es indistinguible de una cola vacía, y nadie
 * se entera hasta que un curso completo reclama que no le llegaron sus claves.
 */
async function tocarLatido(
  admin: Admin,
  s: { claimed: number; sent: number; failed: number },
) {
  await admin
    .from("dispatch_runtime")
    .update({
      last_run_at: new Date().toISOString(),
      last_run_claimed: s.claimed,
      last_run_sent: s.sent,
      last_run_failed: s.failed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
}
