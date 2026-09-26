// Rele de voz — Etapa 2 del piloto Fernanda LatAm (docs/specs/paciente-voz-latam).
//
// Dueno de la UNICA conexion real a OpenAI Realtime (WebSocket servidor-a-
// servidor, API key normal). El navegador ya no habla con OpenAI directo:
// habla por WebSocket con este servicio, que reenvia audio en ambos sentidos.
// Por eso cerrar la conexion de este lado SI corta la sesion de verdad — a
// diferencia del sideband (WebRTC directo + canal secundario) probado antes,
// que no pudo forzar el cierre para la Realtime API clasica.

import http from "node:http";
import crypto from "node:crypto";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { verifyTicket } from "./ticket.js";

const PORT = process.env.PORT || 8788;
const SHARED_SECRET = process.env.VOICE_RELAY_SHARED_SECRET;
const PROVIDER_MODE = process.env.VOICE_PROVIDER || "simulated";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SHARED_SECRET) {
  console.error("Falta VOICE_RELAY_SHARED_SECRET");
  process.exit(1);
}
if (PROVIDER_MODE === "real" && !OPENAI_API_KEY) {
  console.error("VOICE_PROVIDER=real requiere OPENAI_API_KEY");
  process.exit(1);
}

// attemptId -> { browserWs, provider, deadlineTimer }
const sessions = new Map();

function log(attemptId, msg) {
  console.log(`[relay ${new Date().toISOString()}] [${attemptId}] ${msg}`);
}

// ── Proveedor simulado: sin costo, prueba ticket/deadline/cierre. ─────────
function createSimulatedProvider({ onAudio, onEvent }) {
  let closed = false;
  const heartbeat = setInterval(() => {
    if (closed) return;
    onEvent({ type: "simulated.heartbeat", at: new Date().toISOString() });
  }, 5000);
  return {
    sendAudio(buf) {
      if (closed) return;
      // Eco simulado: devuelve el mismo audio recibido, como si el
      // "paciente" repitiera — suficiente para probar el flujo de datos.
      setTimeout(() => { if (!closed) onAudio(buf); }, 200);
    },
    close() {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
    },
  };
}

// ── Proveedor real: conexion directa a OpenAI Realtime (server-to-server).
// NOTA: nombres exactos de eventos (input_audio_buffer.append,
// response.audio.delta) son los de la Realtime API clasica por WebSocket,
// distintos del flujo WebRTC que se probo en el spike. Verificar contra
// developers.openai.com/api/docs/guides/realtime-conversations antes de la
// proxima prueba paga — no se volvio a verificar en vivo para este incremento.
function createRealProvider({ model, voice, instructions, onAudio, onEvent, onClose }) {
  const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
  });

  ws.on("open", () => {
    ws.send(JSON.stringify({
      type: "session.update",
      session: {
        type: "realtime",
        instructions,
        audio: {
          // silence_duration_ms mas alto que el default: la primera prueba
          // con un terapeuta real interrumpia antes de que terminara de
          // hablar — VAD demasiado gatillante ante pausas cortas normales.
          input: {
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 800,
            },
          },
          output: { voice },
        },
      },
    }));
  });

  ws.on("message", (data) => {
    let evt;
    try { evt = JSON.parse(data.toString()); } catch { return; }
    if (evt.type === "response.audio.delta" || evt.type === "response.output_audio.delta") {
      if (evt.delta) onAudio(Buffer.from(evt.delta, "base64"));
      return;
    }
    onEvent(evt);
  });

  ws.on("close", () => onClose());
  ws.on("error", (err) => { console.error("provider error", err.message); onClose(); });

  return {
    sendAudio(buf) {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: buf.toString("base64") }));
    },
    close() {
      try { ws.close(); } catch {}
    },
  };
}

function createProvider(opts) {
  return PROVIDER_MODE === "real" ? createRealProvider(opts) : createSimulatedProvider(opts);
}

// ── HTTP ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

app.get("/healthz", (_req, res) => res.json({ ok: true, provider: PROVIDER_MODE, activeSessions: sessions.size }));

function safeEqual(a, b) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
}

app.post("/internal/sessions/:attemptId/close", (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !safeEqual(token, SHARED_SECRET)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const session = sessions.get(req.params.attemptId);
  if (!session) return res.status(404).json({ error: "not_found" });

  log(req.params.attemptId, `cierre forzoso pedido por gloriapp: ${req.body?.reason || "sin motivo"}`);
  session.provider.close();
  session.browserWs.close(4000, "forced_close");
  clearTimeout(session.deadlineTimer);
  sessions.delete(req.params.attemptId);
  res.json({ ok: true });
});

const server = http.createServer(app);

// ── WebSocket del navegador ────────────────────────────────────────────
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== "/session") {
    socket.destroy();
    return;
  }
  const ticket = url.searchParams.get("ticket");
  const verification = verifyTicket(ticket, SHARED_SECRET);
  if (!verification.ok) {
    socket.write(`HTTP/1.1 401 Unauthorized\r\n\r\n${verification.reason}`);
    socket.destroy();
    return;
  }

  const { attemptId } = verification.payload;
  if (sessions.has(attemptId)) {
    socket.write("HTTP/1.1 409 Conflict\r\n\r\nsession_already_active");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (browserWs) => {
    startSession(browserWs, verification.payload);
  });
});

function startSession(browserWs, payload) {
  const { attemptId, aiPatientId, deadlineAt, model, voice, instructions } = payload;
  log(attemptId, `sesion iniciada, paciente=${aiPatientId}, deadline=${deadlineAt}`);

  const provider = createProvider({
    model: model || "gpt-realtime-mini",
    voice: voice || "marin",
    instructions: instructions || "",
    onAudio: (buf) => { if (browserWs.readyState === WebSocket.OPEN) browserWs.send(buf); },
    onEvent: (evt) => {
      // Log server-side de cada evento no-audio: sin esto, diagnosticar una
      // prueba real en vivo es puro reporte auditivo del usuario. Se loguea
      // el tipo siempre, y el texto/transcript cuando el evento lo trae, sin
      // volcar objetos gigantes (algunos eventos incluyen audio en base64).
      const preview = evt.transcript || evt.text || evt.delta?.slice?.(0, 120) || "";
      log(attemptId, `evento OpenAI: ${evt.type}${preview ? ` — "${preview}"` : ""}`);
      if (browserWs.readyState === WebSocket.OPEN) browserWs.send(JSON.stringify(evt));
    },
    onClose: () => { endSession(attemptId, "provider_closed"); },
  });

  const msUntilDeadline = Math.max(0, new Date(deadlineAt).getTime() - Date.now());
  const deadlineTimer = setTimeout(() => {
    log(attemptId, "DEADLINE alcanzado — cerrando");
    endSession(attemptId, "deadline");
  }, msUntilDeadline);

  sessions.set(attemptId, { browserWs, provider, deadlineTimer });

  browserWs.on("message", (data, isBinary) => {
    if (isBinary) provider.sendAudio(data);
  });
  browserWs.on("close", () => {
    log(attemptId, "navegador cerro la conexion");
    endSession(attemptId, "client_closed", { skipBrowserClose: true });
  });
  browserWs.on("error", (err) => log(attemptId, `error navegador: ${err.message}`));
}

function endSession(attemptId, reason, opts = {}) {
  const session = sessions.get(attemptId);
  if (!session) return;
  log(attemptId, `sesion terminada: ${reason}`);
  clearTimeout(session.deadlineTimer);
  session.provider.close();
  if (!opts.skipBrowserClose && session.browserWs.readyState === WebSocket.OPEN) {
    session.browserWs.close(4001, reason);
  }
  sessions.delete(attemptId);
}

server.listen(PORT, () => {
  console.log(`voice-relay escuchando en :${PORT} (provider=${PROVIDER_MODE})`);
});
