/**
 * Único punto de salida de correo transaccional de GlorIA.
 *
 * Antes había tres `fetch` crudos a api.resend.com y dos instanciaciones del
 * SDK, cada una con su propio manejo de errores (o sin ninguno). Ninguna leía
 * el 429 ni el header Retry-After, así que un lote grande podía perder correos
 * en silencio: `send-invites` llegaba a devolver `success: true` con el correo
 * sin enviar.
 *
 * Se usa `fetch` directo y no el SDK a propósito: necesitamos el status HTTP
 * real, el header `Retry-After` y el header `Idempotency-Key`, y el SDK no
 * expone los dos primeros de forma estable.
 */

import { logEmail, type EmailLogRow } from "@/lib/email-log";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const FROM = "GlorIA <noreply@glor-ia.com>";
const DEFAULT_TIMEOUT_MS = 15_000;

export interface SendResult {
  ok: boolean;
  providerMessageId: string | null;
  /** 429: hay que esperar y reintentar. No es culpa del destinatario. */
  rateLimited: boolean;
  /** Cuota diaria/mensual agotada: reintentar a ciegas no sirve. */
  quotaExhausted: boolean;
  retryAfterSec: number | null;
  error: string | null;
  errorCode: string | null;
}

export interface SendTransactionalParams {
  to: string;
  subject: string;
  html: string;
  /** Categoría para email_log: credentials | credentials_reminder | ... */
  type: string;
  /**
   * Estable por unidad de trabajo (p. ej. `cd:<dispatch_id>`). Resend deduplica
   * durante 24 h, así que una reejecución del worker no genera un segundo correo.
   */
  idempotencyKey?: string;
  userId?: string | null;
  dispatchId?: string | null;
  /**
   * Si viene, el registro NO se escribe ahora: se acumula en este arreglo para
   * insertarlo en un solo viaje al final de la corrida (ver logEmailBatch).
   */
  defer?: EmailLogRow[];
  timeoutMs?: number;
}

/** Códigos de Resend que significan "la cuota se acabó", no "vas muy rápido". */
const QUOTA_CODES = new Set(["daily_quota_exceeded", "monthly_quota_exceeded"]);

export async function sendTransactional(p: SendTransactionalParams): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const r = fail("RESEND_API_KEY no configurada", "config_missing");
    await record(p, r);
    return r;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (p.idempotencyKey) headers["Idempotency-Key"] = p.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({ from: FROM, to: p.to, subject: p.subject, html: p.html }),
      signal: AbortSignal.timeout(p.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (e) {
    // Timeout o red caída. Es transitorio: el llamador debe reintentar.
    const r = fail(e instanceof Error ? e.message : "Error de red", "network");
    await record(p, r);
    return r;
  }

  const bodyText = await res.text();
  let body: { id?: string; name?: string; message?: string } = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    // Resend devolvió algo que no es JSON (p. ej. una página de error del CDN).
  }

  if (res.ok) {
    const r: SendResult = {
      ok: true,
      providerMessageId: body.id ?? null,
      rateLimited: false,
      quotaExhausted: false,
      retryAfterSec: null,
      error: null,
      errorCode: null,
    };
    await record(p, r);
    return r;
  }

  const code = body.name ?? `http_${res.status}`;
  const quota = QUOTA_CODES.has(code);
  const limited = res.status === 429 && !quota;

  const r: SendResult = {
    ok: false,
    providerMessageId: null,
    rateLimited: limited,
    quotaExhausted: quota,
    retryAfterSec: parseRetryAfter(res.headers.get("retry-after")),
    error: body.message ?? bodyText.slice(0, 300) ?? `HTTP ${res.status}`,
    errorCode: code,
  };
  console.error("[emails/send] fallo", { to: p.to, status: res.status, code, message: r.error });
  await record(p, r);
  return r;
}

/**
 * `Retry-After` viene en segundos o como fecha HTTP. Si no se puede leer,
 * devolvemos null y el llamador aplica su propio piso — nunca inventamos
 * un número que el proveedor no dijo.
 */
function parseRetryAfter(raw: string | null): number | null {
  if (!raw) return null;
  const asNum = Number(raw);
  if (Number.isFinite(asNum) && asNum >= 0) return Math.ceil(asNum);
  const asDate = Date.parse(raw);
  if (!Number.isNaN(asDate)) return Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
  return null;
}

function fail(message: string, code: string): SendResult {
  return {
    ok: false,
    providerMessageId: null,
    rateLimited: false,
    quotaExhausted: false,
    retryAfterSec: null,
    error: message,
    errorCode: code,
  };
}

/** Escribe (o difiere) la fila de email_log correspondiente a este envío. */
async function record(p: SendTransactionalParams, r: SendResult): Promise<void> {
  const row: EmailLogRow = {
    type: p.type,
    recipient: p.to,
    success: r.ok,
    user_id: p.userId ?? null,
    dispatch_id: p.dispatchId ?? null,
    provider_message_id: r.providerMessageId,
    error_code: r.errorCode,
  };
  if (p.defer) {
    p.defer.push(row);
    return;
  }
  await logEmail(p.type, p.to, r.ok, {
    userId: row.user_id,
    dispatchId: row.dispatch_id,
    providerMessageId: row.provider_message_id,
    errorCode: row.error_code,
  });
}
