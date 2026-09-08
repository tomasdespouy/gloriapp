import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "node:crypto";

/**
 * Eventos de entrega de Resend.
 *
 * "Enviado" y "entregado" no son lo mismo, y la diferencia importa: un correo
 * aceptado por Resend puede rebotar minutos después contra una casilla que no
 * existe. Sin esto, el panel diría "5 enviados" para siempre y nadie se
 * enteraría de que uno nunca llegó.
 *
 * La API de Resend también permite consultar el estado de un correo, pero
 * requiere una clave con permiso de lectura; la que usa la plataforma es de
 * solo envío. El webhook no necesita ese permiso: es Resend quien avisa.
 *
 * Configuración (una vez, en el panel de Resend):
 *   Webhooks → Add endpoint → https://www.glor-ia.com/api/webhooks/resend
 *   Eventos: email.delivered, email.bounced, email.complained
 *   Copiar el signing secret a RESEND_WEBHOOK_SECRET.
 *
 * Mientras no exista ese secreto, la ruta rechaza todo. Un endpoint público
 * que escribe en la base sin verificar la firma es un buzón abierto: cualquiera
 * podría marcar como "rebotado" un correo que sí llegó.
 */

export const runtime = "nodejs";

/** Firma de Svix, que es lo que Resend usa por debajo. */
function firmaValida(secret: string, id: string, timestamp: string, body: string, header: string): boolean {
  // El secreto viene como "whsec_<base64>".
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const esperado = crypto
    .createHmac("sha256", Buffer.from(raw, "base64"))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  // La cabecera trae una o varias firmas, cada una como "v1,<base64>".
  for (const parte of header.split(" ")) {
    const [version, valor] = parte.split(",");
    if (version !== "v1" || !valor) continue;
    const a = Buffer.from(valor);
    const b = Buffer.from(esperado);
    // timingSafeEqual explota si los largos difieren; se compara antes.
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 });
  }

  const body = await request.text();
  const id = request.headers.get("svix-id") || "";
  const timestamp = request.headers.get("svix-timestamp") || "";
  const signature = request.headers.get("svix-signature") || "";

  if (!id || !timestamp || !signature || !firmaValida(secret, id, timestamp, body, signature)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  // Una firma vieja reproducida sigue siendo válida criptográficamente; la
  // ventana de 5 minutos es lo que impide reenviarla más tarde.
  const edadSegundos = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(edadSegundos) || edadSegundos > 300) {
    return NextResponse.json({ error: "Marca de tiempo fuera de rango" }, { status: 401 });
  }

  let evento: { type?: string; data?: { email_id?: string; created_at?: string } };
  try {
    evento = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const messageId = evento.data?.email_id;
  const tipo = (evento.type || "").replace(/^email\./, "");
  if (!messageId || !tipo) return NextResponse.json({ ok: true, ignorado: true });

  const admin = createAdminClient();

  // Solo actualiza filas del informe semanal; los demás correos de la
  // plataforma no llevan seguimiento de entrega y no hay por qué inventarlo.
  const { error } = await admin
    .from("report_deliveries")
    .update({ delivery_status: tipo, delivery_at: evento.data?.created_at || new Date().toISOString() })
    .eq("provider_message_id", messageId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, tipo });
}
