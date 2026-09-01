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

type Admin = ReturnType<typeof createAdminClient>;
type ClaimedRow = DispatchRow & { pending_password: string | null; deferrals: number };

async function ejecutarCorrida({ dryRun }: Opts) {
  const t0 = Date.now();
  const admin = createAdminClient();
  const elapsed = () => Date.now() - t0;

  // ── 1. Mantenimiento ──────────────────────────────────────────────────────
  // Va ANTES del chequeo de freno a propósito: si el freno dura 6 horas (cuota
  // agotada) y el mantenimiento estuviera después, nadie rescataría las filas
  // colgadas ni barrería las vencidas durante todo ese rato, y el panel las
  // mostraría "enviando" seis horas.
  await mantenimiento(admin);

  // ── 2. ¿Hay un freno global vigente por 429 o cuota agotada? ──────────────
  const { data: rt } = await admin
    .from("dispatch_runtime")
    .select("throttled_until, throttle_reason")
    .eq("id", true)
    .single();

  const frenoVigente =
    rt?.throttled_until && new Date(rt.throttled_until).getTime() > Date.now();

  if (frenoVigente && !dryRun) {
    await tocarLatido(admin, { claimed: 0, sent: 0, failed: 0 });
    return NextResponse.json({
      throttled_until: rt!.throttled_until,
      reason: rt!.throttle_reason,
      enviados: 0,
    });
  }

  // El freno ya venció: se limpia para que `throttle_reason` no quede escrito
  // para siempre confundiendo a quien mire la tabla dentro de un mes.
  if (!frenoVigente && rt?.throttle_reason) {
    await admin
      .from("dispatch_runtime")
      .update({ throttled_until: null, throttle_reason: null })
      .eq("id", true);
  }

  // ── 3. Ensayo: se examina la cola SIN reclamar ni escribir nada ───────────
  // Reclamar en un ensayo tenía dos efectos malos: el bucle no avanzaba nunca
  // (ni `enviados` ni `fallidos` suben en dry run, así que giraba hasta agotar
  // los 95 s) y, peor, dejaba las filas en 'procesando' robándoselas al cron
  // real que venía después.
  if (dryRun) {
    const ahora = new Date().toISOString();
    const { data: filas } = await admin
      .from("credential_dispatches")
      .select("*")
      .eq("status", "pendiente")
      .lte("next_attempt_at", ahora)
      .gt("expires_at", ahora)
      .order("next_attempt_at")
      .limit(MAX_POR_CORRIDA);

    const lote = (filas ?? []) as ClaimedRow[];
    const previsto = { enviar: 0, omitir: 0, posponer: 0 };
    const motivos: Record<string, number> = {};
    if (lote.length) {
      const ctx = await loadDispatchContext(admin, lote);
      for (const fila of lote) {
        const v = evaluateDispatch(fila, ctx);
        previsto[v.kind]++;
        if (v.kind === "omitir") motivos[v.reason] = (motivos[v.reason] ?? 0) + 1;
      }
    }
    return NextResponse.json({
      dryRun: true,
      frenoVigente: !!frenoVigente,
      examinadas: lote.length,
      previsto,
      motivos,
      ms: elapsed(),
    });
  }

  // ── 4. Bucle de despacho ──────────────────────────────────────────────────
  let enviados = 0;
  let fallidos = 0;
  let reclamados = 0;
  let omitidos = 0;
  let frenado: { reason: string; retryAfterSec: number | null } | null = null;
  const registros: EmailLogRow[] = [];

  // Una persona recibe UN correo por corrida, aunque tenga filas en dos lotes
  // distintos. El contexto se carga una vez por tanda, así que la guarda
  // `ya_recibio_credenciales` de eligibility.ts no puede ver lo que se envió
  // hace dos segundos dentro de la misma tanda: este Set cubre ese hueco.
  const yaEmitidos = new Set<string>();

  while (enviados + fallidos < MAX_POR_CORRIDA && !frenado) {
    if (elapsed() > TIME_BUDGET_MS) break;

    const { data: filas, error: claimErr } = await admin.rpc("claim_credential_dispatches", {
      p_limit: Math.min(CHUNK, MAX_POR_CORRIDA - (enviados + fallidos)),
    });
    if (claimErr) {
      console.error("[dispatch-credentials] claim falló", claimErr.message);
      break;
    }
    const lote = (filas ?? []) as ClaimedRow[];
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

    for (let i = 0; i < lote.length; i++) {
      const fila = lote[i];

      if (elapsed() > TIME_BUDGET_MS) {
        await devolverAPendiente(admin, fila.id, fila.attempts);
        continue;
      }

      const veredicto = evaluateDispatch(fila, ctx);

      if (veredicto.kind === "posponer") {
        // `expires_at` se corre junto con la fecha porque el motivo de posponer
        // es que la ventana del programa todavía no abre: mantener la muerte
        // original mataría la fila antes de que pudiera salir.
        await actualizarSiProcesando(admin, fila.id, {
          status: "pendiente",
          attempts: Math.max(0, fila.attempts - 1), // posponer no gasta un intento
          next_attempt_at: veredicto.hasta,
          expires_at: new Date(new Date(veredicto.hasta).getTime() + 48 * 3600_000).toISOString(),
          last_error: veredicto.motivo,
        });
        continue;
      }

      if (veredicto.kind === "omitir") {
        const terminal = veredicto.reason === "cancelado_por_admin" ? "cancelado" : "omitido";
        await actualizarSiProcesando(admin, fila.id, {
          status: terminal,
          skip_reason: veredicto.reason,
          pending_password: null,
        });
        omitidos++;
        continue;
      }

      // Segunda persona, misma corrida: ya le mandamos uno hace un momento.
      // Mandar el segundo le rotaría la clave otra vez y solo funcionaría la
      // última — el peor resultado posible para quien lo recibe.
      if (fila.user_id && yaEmitidos.has(fila.user_id)) {
        await actualizarSiProcesando(admin, fila.id, {
          status: "omitido",
          skip_reason: "ya_recibio_credenciales",
          pending_password: null,
        });
        omitidos++;
        continue;
      }

      const batch = ctx.batches.get(fila.batch_id)!;

      // Clave temporal: se persiste ANTES de rotar y se reutiliza en cada
      // reintento. Así un reintento reenvía EL MISMO correo con la MISMA clave,
      // en vez de una segunda clave que invalidaría la primera.
      let clave = fila.pending_password;
      if (!clave) {
        clave = generateTempPassword();
        const { error } = await admin
          .from("credential_dispatches")
          .update({ pending_password: clave })
          .eq("id", fila.id)
          .eq("status", "procesando");
        // Si ya no está 'procesando', alguien canceló entre el claim y ahora:
        // no se rota nada ni sale ningún correo.
        if (error) {
          console.error("[dispatch-credentials] no se pudo fijar la clave", fila.id, error.message);
          continue;
        }
      }

      // Relectura del estado justo antes del acto destructivo. Es barato y
      // cierra la ventana entre el claim y el turno de esta fila (hasta ~10 s
      // con tandas de 5), en la que el admin pudo cancelar el lote o la propia
      // persona pudo entrar y fijar su contraseña.
      const vigente = await estadoVigente(admin, fila.id, fila.user_id!);
      if (!vigente.sigueProcesando) {
        continue;
      }
      if (vigente.passwordSetAt) {
        await actualizarSiProcesando(admin, fila.id, {
          status: "omitido",
          skip_reason: "clave_propia",
          pending_password: null,
        });
        omitidos++;
        continue;
      }
      if (vigente.canceladoElLote) {
        await actualizarSiProcesando(admin, fila.id, {
          status: "cancelado",
          skip_reason: "cancelado_por_admin",
          pending_password: null,
        });
        omitidos++;
        continue;
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
        const esperaSeg = Math.max(60, res.retryAfterSec ?? 60);
        await admin
          .from("credential_dispatches")
          .update({
            status: "pendiente",
            attempts: Math.max(0, fila.attempts - 1), // un 429 no es culpa del destinatario
            deferrals: (fila.deferrals ?? 0) + 1,
            next_attempt_at: new Date(Date.now() + esperaSeg * 1000).toISOString(),
            last_error: res.error,
          })
          .eq("id", fila.id)
          .eq("status", "procesando");

        // Las filas que quedan del chunk nunca se intentaron: no pueden pagar
        // el intento que les cobró el claim, ni quedarse en 'procesando'
        // durante todo el freno (que puede ser de 6 horas).
        await Promise.all(
          lote.slice(i + 1).map((f) =>
            admin
              .from("credential_dispatches")
              .update({
                status: "pendiente",
                attempts: Math.max(0, f.attempts - 1),
                next_attempt_at: new Date(Date.now() + esperaSeg * 1000).toISOString(),
              })
              .eq("id", f.id)
              .eq("status", "procesando"),
          ),
        );

        frenado = {
          reason: res.quotaExhausted ? "cuota_agotada" : "rate_limit",
          retryAfterSec: res.retryAfterSec,
        };
        break;
      }

      if (!res.emailSent) {
        fallidos += await reintentarOFallar(admin, fila, res.error ?? "Error desconocido");
        continue;
      }

      // Éxito. El correo YA salió: la fila debe registrarlo sí o sí, incluso si
      // el admin canceló el lote mientras tanto. Por eso este UPDATE no se
      // condiciona a 'procesando' — sería el único caso en que perder la
      // escritura significa mandar el correo y no dejar constancia.
      const { error: marcarErr } = await admin
        .from("credential_dispatches")
        .update({
          status: "enviado",
          skip_reason: null,
          sent_at: new Date().toISOString(),
          provider_message_id: res.providerMessageId,
          pending_password: null,
          last_error: null,
        })
        .eq("id", fila.id);
      if (marcarErr) {
        console.error(
          "[dispatch-credentials] correo enviado pero no se pudo marcar la fila",
          fila.id,
          marcarErr.message,
        );
      }

      if (fila.user_id) yaEmitidos.add(fila.user_id);

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
              name_snapshot: null,
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

  // ── 5. Escrituras diferidas, en un solo viaje ─────────────────────────────
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

/**
 * Rescate de filas colgadas y barrida de vencidas. Corre siempre, incluso con
 * el freno global activo.
 */
async function mantenimiento(admin: Admin) {
  // a) Filas que quedaron 'procesando' porque una corrida murió a mitad. Se les
  //    devuelve el intento: nunca llegaron a intentar un envío de verdad.
  const { data: colgadas } = await admin
    .from("credential_dispatches")
    .select("id, attempts")
    .eq("status", "procesando")
    .lt("claimed_at", new Date(Date.now() - LEASE_MIN * 60_000).toISOString())
    .limit(200);

  for (const f of colgadas ?? []) {
    await admin
      .from("credential_dispatches")
      .update({ status: "pendiente", attempts: Math.max(0, f.attempts - 1) })
      .eq("id", f.id)
      .eq("status", "procesando");
  }

  // b) Vencidas: pendientes que pasaron su ventana.
  await admin
    .from("credential_dispatches")
    .update({ status: "omitido", skip_reason: "vencido", pending_password: null })
    .eq("status", "pendiente")
    .lt("expires_at", new Date().toISOString());
}

/**
 * UPDATE condicionado a que la fila siga siendo nuestra. Si entre el claim y
 * ahora alguien canceló el lote, la fila ya es 'cancelado' y este UPDATE no
 * toca nada — en vez de escribir un estado contradictorio que el CHECK de la
 * tabla rechazaría en silencio.
 */
async function actualizarSiProcesando(
  admin: Admin,
  id: string,
  patch: Record<string, unknown>,
) {
  const { error } = await admin
    .from("credential_dispatches")
    .update(patch)
    .eq("id", id)
    .eq("status", "procesando");
  if (error) {
    console.error("[dispatch-credentials] update falló", id, error.message);
  }
}

/**
 * Relectura mínima justo antes de rotar la contraseña. Cierra la ventana entre
 * el reclamo de la tanda y el turno de esta fila.
 */
async function estadoVigente(admin: Admin, dispatchId: string, userId: string) {
  const [fila, perfil] = await Promise.all([
    admin
      .from("credential_dispatches")
      .select("status, batch_id, credential_batches!inner(cancel_requested_at)")
      .eq("id", dispatchId)
      .maybeSingle(),
    admin.from("profiles").select("password_set_at").eq("id", userId).maybeSingle(),
  ]);

  const lote = fila.data?.credential_batches as unknown as
    | { cancel_requested_at: string | null }
    | { cancel_requested_at: string | null }[]
    | undefined;
  const cancel = Array.isArray(lote) ? lote[0]?.cancel_requested_at : lote?.cancel_requested_at;

  return {
    sigueProcesando: fila.data?.status === "procesando",
    canceladoElLote: !!cancel,
    passwordSetAt: perfil.data?.password_set_at ?? null,
  };
}

/** Devuelve una fila reclamada a la cola sin gastarle el intento. */
async function devolverAPendiente(admin: Admin, id: string, attempts: number) {
  await admin
    .from("credential_dispatches")
    .update({ status: "pendiente", attempts: Math.max(0, attempts - 1) })
    .eq("id", id)
    .eq("status", "procesando");
}

/**
 * Error transitorio: se reintenta con espera creciente hasta max_attempts.
 * Devuelve 1 si la fila quedó definitivamente fallida, 0 si se reintentará.
 */
async function reintentarOFallar(admin: Admin, fila: DispatchRow, error: string): Promise<number> {
  if (fila.attempts >= fila.max_attempts) {
    await actualizarSiProcesando(admin, fila.id, {
      status: "fallido",
      last_error: error,
      pending_password: null,
    });
    return 1;
  }
  await actualizarSiProcesando(admin, fila.id, {
    status: "pendiente",
    last_error: error,
    next_attempt_at: new Date(Date.now() + fila.attempts * 5 * 60_000).toISOString(),
  });
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
  console.error(
    "[dispatch-credentials] freno global",
    f.reason,
    "hasta",
    new Date(Date.now() + esperaMs).toISOString(),
  );
}

/**
 * Marca como cerrados los lotes que ya no tienen filas por despachar. Se hace
 * con una sola consulta agregada y no una por lote.
 */
async function cerrarLotesTerminados(admin: Admin) {
  const { data: abiertos } = await admin
    .from("credential_batches")
    .select("id")
    .is("closed_at", null)
    .limit(100);
  if (!abiertos?.length) return;

  const ids = abiertos.map((b) => b.id);
  const { data: vivas } = await admin
    .from("credential_dispatches")
    .select("batch_id")
    .in("batch_id", ids)
    .in("status", ["pendiente", "procesando"]);

  const conPendientes = new Set((vivas ?? []).map((v) => v.batch_id));
  const terminados = ids.filter((id) => !conPendientes.has(id));
  if (!terminados.length) return;

  await admin
    .from("credential_batches")
    .update({ closed_at: new Date().toISOString() })
    .in("id", terminados);
}

/**
 * Latido. Sin esto, un cron muerto es indistinguible de una cola vacía, y nadie
 * se entera hasta que un curso completo reclama que no le llegaron sus claves.
 */
async function tocarLatido(admin: Admin, s: { claimed: number; sent: number; failed: number }) {
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
