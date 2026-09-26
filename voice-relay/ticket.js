// Verificacion de tickets firmados por gloriapp (src/lib/voice-relay-ticket.ts).
// Formato: base64url(JSON) + "." + HMAC-SHA256 hex del base64url(JSON), con
// VOICE_RELAY_SHARED_SECRET. Sin librerias de JWT — el payload es minimo y
// de un solo uso, no hace falta mas que esto.

import crypto from "node:crypto";

export function verifyTicket(ticket, secret) {
  if (!ticket || typeof ticket !== "string" || !ticket.includes(".")) {
    return { ok: false, reason: "malformed" };
  }
  const [payloadB64, sig] = ticket.split(".");
  const expectedSig = crypto.createHmac("sha256", secret).update(payloadB64).digest("hex");

  const sigBuf = Buffer.from(sig || "", "hex");
  const expectedBuf = Buffer.from(expectedSig, "hex");
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "bad_payload" };
  }

  if (!payload.attemptId || !payload.deadlineAt || !payload.exp) {
    return { ok: false, reason: "incomplete_payload" };
  }
  if (Date.now() > payload.exp) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, payload };
}
