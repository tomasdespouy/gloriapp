"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, PhoneOff, Loader2 } from "lucide-react";

type Status = "idle" | "solicitando" | "conectando" | "en_llamada" | "terminada" | "error";

const ERROR_MESSAGES: Record<string, string> = {
  no_pilot: "Este paciente no tiene un piloto de voz configurado.",
  disabled: "El piloto está deshabilitado. Actívalo en /admin/voice-pilots.",
  outside_window: "Estás fuera de la ventana de fechas configurada para este piloto.",
  no_access: "Tu cuenta no tiene acceso a este piloto. Incorpórate desde /admin/voice-pilots.",
  no_budget: "El piloto no tiene presupuesto asignado (budget_usd).",
  no_grant_available: "No te queda ningún cupo disponible. Otórgate uno nuevo desde /admin/voice-pilots (cada intento, exitoso o no, gasta uno).",
  attempt_in_progress: "Ya tenés un intento sin cerrar. Si esto persiste tras colgar, ciérralo desde /admin/voice-pilots (cierre forzoso).",
};

// Procesador de audio inline (sin archivo estatico aparte): convierte los
// bloques Float32 del microfono a PCM16, que es lo que espera el rele.
const CAPTURE_WORKLET_SOURCE = `
class PCM16Capture extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length) {
      const channel = input[0];
      const pcm16 = new Int16Array(channel.length);
      for (let i = 0; i < channel.length; i++) {
        const s = Math.max(-1, Math.min(1, channel[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    }
    return true;
  }
}
registerProcessor("pcm16-capture", PCM16Capture);
`;

const SAMPLE_RATE = 24000;
// El ticket vence a los 3 min de emitido (voice-pilot/attempts/route.ts).
// Render free apaga el relé tras inactividad. Primero se probó reintentar el
// WebSocket mismo cada 5s, pero eso demostró ser fragil: un intento de conexion
// fallido puede llegar a registrarse igual del lado del servidor (o el
// navegador puede frenar solo reconexiones repetidas al mismo host tras varios
// intentos fallidos), y ninguno de los dos deja rastro claro. Un caso real
// probado a mano contra el rele ya despierto mostro exactamente eso: el
// segundo intento choco con "sesion ya activa" (409) del intento anterior que
// el servidor todavia no habia liberado.
//
// Por eso ahora se "despierta" el rele con pedidos HTTP simples (sin el
// problema de reconexion del WebSocket) ANTES de intentar el WebSocket, que
// recien se abre una vez, cuando el rele ya esta confirmado despierto.
const RELAY_WAKE_POLL_INTERVAL_MS = 3000;
const RELAY_WAKE_POLL_DEADLINE_MS = 165_000;

async function waitForRelayAwake(baseUrl: string, cancelledRef: { current: boolean }): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < RELAY_WAKE_POLL_DEADLINE_MS) {
    if (cancelledRef.current) return false;
    try {
      // mode:no-cors: no hace falta leer la respuesta (el rele no manda
      // cabeceras CORS para /healthz) — que el fetch resuelva sin lanzar ya
      // confirma que algo respondio del otro lado.
      await fetch(`${baseUrl}/healthz`, { mode: "no-cors", cache: "no-store" });
      return true;
    } catch {
      // Error real de red (DNS, conexion rechazada, timeout del navegador):
      // el rele todavia esta despertando. Reintentar.
    }
    if (cancelledRef.current) return false;
    await new Promise((r) => setTimeout(r, RELAY_WAKE_POLL_INTERVAL_MS));
  }
  return false;
}

type TranscriptEntry = { id: string; role: "user" | "assistant"; text: string };

// Crea la entrada cuando OpenAI agrega el turno (así queda en orden
// cronológico aunque la transcripción del terapeuta llegue después de que la
// paciente ya empezó a responder) y le completa el texto cuando llega.
function upsertTranscript(prev: TranscriptEntry[], id: string, role: "user" | "assistant", text?: string): TranscriptEntry[] {
  const i = prev.findIndex((e) => e.id === id);
  if (i === -1) return [...prev, { id, role, text: text ?? "" }];
  if (text === undefined) return prev;
  const next = prev.slice();
  next[i] = { ...prev[i], text };
  return next;
}

export default function VoiceRoomClient({ patientId, patientName }: { patientId: string; patientName: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const attemptIdRef = useRef<string | null>(null);
  const nextPlayTimeRef = useRef(0);
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const pendingChunksRef = useRef<Int16Array[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadlineTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedRef = useRef(false);
  const openedRef = useRef(false);
  const wakePollCancelledRef = useRef(false);
  const [waking, setWaking] = useState(false);

  const notifyAttemptEnded = (reason: string) => {
    const attemptId = attemptIdRef.current;
    if (!attemptId) return;
    fetch(`/api/voice-pilot/attempts/${attemptId}/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }).catch(() => {});
  };

  const cleanup = () => {
    wakePollCancelledRef.current = true;
    if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    if (deadlineTimerRef.current) clearInterval(deadlineTimerRef.current);
    flushTimerRef.current = null;
    deadlineTimerRef.current = null;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close(1000, "client_end");
    wsRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    pendingChunksRef.current = [];
    scheduledSourcesRef.current = [];
  };

  useEffect(() => cleanup, []);

  // Interrupcion (barge-in): al detectar que el terapeuta empezo a hablar
  // de nuevo, cortar YA el audio de Fernanda que ya estaba en cola local —
  // sin esto, aunque el modelo deje de generar, lo que ya se habia recibido
  // y programado sigue sonando igual hasta el final (bug real visto en la
  // segunda prueba real: "la interrumpi... pero seguia leyendo").
  const stopPlayback = () => {
    for (const source of scheduledSourcesRef.current) {
      try { source.stop(); } catch { /* ya terminado */ }
    }
    scheduledSourcesRef.current = [];
    if (audioCtxRef.current) nextPlayTimeRef.current = audioCtxRef.current.currentTime;
  };

  const flushPendingAudio = () => {
    const chunks = pendingChunksRef.current;
    if (!chunks.length || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const totalLen = chunks.reduce((n, c) => n + c.length, 0);
    const merged = new Int16Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    pendingChunksRef.current = [];
    wsRef.current.send(merged.buffer);
  };

  const playIncomingAudio = (buf: ArrayBuffer) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const pcm16 = new Int16Array(buf);
    if (!pcm16.length) return;
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7fff);
    const audioBuffer = ctx.createBuffer(1, float32.length, SAMPLE_RATE);
    audioBuffer.copyToChannel(float32, 0);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.onended = () => {
      scheduledSourcesRef.current = scheduledSourcesRef.current.filter((s) => s !== source);
    };
    scheduledSourcesRef.current.push(source);
    const startAt = Math.max(nextPlayTimeRef.current, ctx.currentTime);
    source.start(startAt);
    nextPlayTimeRef.current = startAt + audioBuffer.duration;
  };

  const startCall = async () => {
    setErrorMsg(null);
    setStatus("solicitando");
    endedRef.current = false;
    openedRef.current = false;
    wakePollCancelledRef.current = false;
    setWaking(false);
    setTranscript([]);

    // Pedir el microfono ANTES de reclamar el ticket: el ticket vence a
    // los 60s de emitido, y el dialogo de permiso del navegador puede
    // tardar mas que eso si es la primera vez.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setErrorMsg("No se pudo acceder al micrófono. Revisá los permisos del navegador para este sitio.");
      setStatus("error");
      return;
    }
    streamRef.current = stream;

    try {
      const res = await fetch("/api/voice-pilot/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(ERROR_MESSAGES[data.error] || data.error || "No se pudo iniciar el intento.");
        setStatus("error");
        cleanup();
        return;
      }
      if (!data.relayUrl || !data.ticket) {
        setErrorMsg("El relé de voz no está configurado (VOICE_RELAY_URL / VOICE_RELAY_SHARED_SECRET en Vercel).");
        setStatus("error");
        cleanup();
        return;
      }

      attemptIdRef.current = data.attemptId;
      setStatus("conectando");

      // Despertar el rele con HTTP antes de intentar el WebSocket — ver el
      // comentario largo junto a RELAY_WAKE_POLL_INTERVAL_MS. Si esto tarda
      // mas de un intento, recien ahi se muestra el mensaje de "despertando".
      const quickCheck = await fetch(`${data.relayUrl}/healthz`, { mode: "no-cors", cache: "no-store" }).then(() => true, () => false);
      if (!quickCheck) {
        setWaking(true);
        const awake = await waitForRelayAwake(data.relayUrl, wakePollCancelledRef);
        setWaking(false);
        if (wakePollCancelledRef.current) return; // se colgo/desmonto mientras esperaba
        if (!awake) {
          setErrorMsg("El relé de voz no respondió en casi 3 minutos — algo más que un arranque en frío normal. El intento gastó un cupo; revisá los logs de Render antes de reintentar.");
          setStatus("error");
          if (!endedRef.current) { endedRef.current = true; notifyAttemptEnded("relay_wake_timeout"); }
          cleanup();
          return;
        }
        // El contenedor recien arranco: el /healthz puede responder una
        // fraccion de segundo antes de que este listo para aceptar
        // conexiones WebSocket nuevas (visto como un fallo de la conexion
        // de voz justo despues de un /healthz exitoso). Un respiro corto
        // antes de abrir el WebSocket de verdad reduce esa carrera. No hace
        // falta si el primer healthz ya respondio a la primera (ahi el
        // rele ya estaba tibio hace rato).
        await new Promise((r) => setTimeout(r, 1500));
        if (wakePollCancelledRef.current) return;
      }

      const deadline = new Date(data.deadlineAt).getTime();
      setRemainingSec(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
      deadlineTimerRef.current = setInterval(() => {
        setRemainingSec(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
      }, 1000);

      const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioCtxRef.current = audioCtx;
      nextPlayTimeRef.current = audioCtx.currentTime;

      const blobUrl = URL.createObjectURL(new Blob([CAPTURE_WORKLET_SOURCE], { type: "application/javascript" }));
      await audioCtx.audioWorklet.addModule(blobUrl);
      URL.revokeObjectURL(blobUrl);

      const source = audioCtx.createMediaStreamSource(stream);
      const capture = new AudioWorkletNode(audioCtx, "pcm16-capture");
      capture.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        pendingChunksRef.current.push(new Int16Array(e.data));
      };
      // Salida silenciada hacia destination: algunos navegadores no llaman
      // a process() en un AudioWorkletNode que no participa del grafo hasta
      // destination, aunque no nos importe su audio de salida.
      const silentSink = audioCtx.createGain();
      silentSink.gain.value = 0;
      capture.connect(silentSink);
      silentSink.connect(audioCtx.destination);

      const wsUrl = data.relayUrl.replace(/^http/, "ws") + `/session?ticket=${encodeURIComponent(data.ticket)}`;
      connectRelay(wsUrl, source, capture);
    } catch (err) {
      console.error("[piloto-voz] error al iniciar:", err);
      setErrorMsg(err instanceof Error ? err.message : "No se pudo iniciar la sesión de voz.");
      setStatus("error");
      cleanup();
    }
  };

  const connectRelay = (wsUrl: string, source: MediaStreamAudioSourceNode, capture: AudioWorkletNode) => {
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      openedRef.current = true;
      // Recien acá arranca la captura real: antes de este punto el audio
      // del microfono no se conecta a nada, para no acumular una rafaga
      // vieja mientras el WS todavia estaba conectando (Render puede
      // tardar en despertar el servicio).
      source.connect(capture);
      flushTimerRef.current = setInterval(flushPendingAudio, 100);
      setStatus("en_llamada");
    };
    ws.onmessage = (evt) => {
        if (evt.data instanceof ArrayBuffer) {
          playIncomingAudio(evt.data);
          return;
        }
        // Mensajes de texto: se usan solo dos cosas. (1) Que el terapeuta
        // empezo a hablar de nuevo: cortar YA el audio de Fernanda ya
        // programado localmente (barge-in), aunque el modelo deje de generar
        // del lado de OpenAI. (2) La transcripcion de ambos lados, para el
        // panel de abajo. Nada de esto se guarda todavia.
        try {
          const evtData = JSON.parse(evt.data);
          switch (evtData.type) {
            case "input_audio_buffer.speech_started":
              stopPlayback();
              break;
            case "conversation.item.added": {
              const item = evtData.item;
              if (item?.id && (item.role === "user" || item.role === "assistant")) {
                setTranscript((prev) => upsertTranscript(prev, item.id, item.role));
              }
              break;
            }
            case "conversation.item.input_audio_transcription.completed":
              if (evtData.item_id) {
                setTranscript((prev) => upsertTranscript(prev, evtData.item_id, "user", String(evtData.transcript ?? "").trim()));
              }
              break;
            case "response.output_audio_transcript.done":
              if (evtData.item_id) {
                setTranscript((prev) => upsertTranscript(prev, evtData.item_id, "assistant", String(evtData.transcript ?? "").trim()));
              }
              break;
          }
        } catch { /* no era JSON, ignorar */ }
      };
    ws.onerror = () => {
      // El navegador no expone el motivo del fallo del WebSocket, pero sí
      // se sabe si la conexión llegó a abrirse alguna vez. Para acá ya se
      // confirmó el rele despierto por HTTP, así que un fallo del WS mismo
      // es un problema real (no un arranque en frío) — no se reintenta solo.
      setErrorMsg(
        openedRef.current
          ? "Se cortó la conexión con el relé a mitad de la llamada."
          : "El rele respondió al ping HTTP pero rechazó la conexión de voz (revisá los logs de Render — puede ser un ticket vencido si tardaste en aceptar el micrófono).",
      );
      setStatus("error");
      if (!endedRef.current) { endedRef.current = true; notifyAttemptEnded("relay_error"); }
      cleanup();
    };
    ws.onclose = () => {
      setStatus((prev) => (prev === "error" ? prev : "terminada"));
      if (!endedRef.current) { endedRef.current = true; notifyAttemptEnded("client_closed"); }
      cleanup();
    };
  };

  const endCall = () => {
    // Cerrar el WS ya dispara onclose, que hace cleanup() y notifica el
    // cierre normal del intento — un solo camino, no duplicar la llamada.
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close(1000, "client_hangup");
    } else {
      if (!endedRef.current) { endedRef.current = true; notifyAttemptEnded("client_hangup"); }
      cleanup();
      setStatus("terminada");
    }
  };

  const mm = remainingSec !== null ? Math.floor(remainingSec / 60) : null;
  const ss = remainingSec !== null ? remainingSec % 60 : null;

  return (
    <div className="max-w-2xl mx-auto py-16 px-6 text-center">
      <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Prueba técnica · piloto de voz</p>
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">{patientName}</h1>
      <p className="text-sm text-gray-500 mb-10">
        Sala mínima de prueba — la transcripción se muestra abajo pero todavía no se guarda ni se evalúa.
      </p>

      {status === "idle" && (
        <button
          onClick={startCall}
          className="inline-flex items-center gap-2 bg-[#4A55A2] text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 cursor-pointer"
        >
          <Mic size={18} /> Iniciar sesión de voz
        </button>
      )}

      {(status === "solicitando" || status === "conectando") && (
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <Loader2 size={18} className="animate-spin" />
          {status === "solicitando"
            ? "Pidiendo micrófono y cupo..."
            : waking
              ? "El relé estaba apagado por inactividad — despertándolo, puede tardar hasta un par de minutos..."
              : "Conectando con el relé..."}
        </div>
      )}

      {status === "en_llamada" && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            En llamada{remainingSec !== null ? ` · quedan ${mm}:${String(ss).padStart(2, "0")}` : ""}
          </p>
          <button
            onClick={endCall}
            className="inline-flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 cursor-pointer"
          >
            <PhoneOff size={18} /> Colgar
          </button>
        </div>
      )}

      {status === "terminada" && (
        <div>
          <p className="text-sm text-gray-500 mb-4">Sesión terminada.</p>
          <button
            onClick={() => { setStatus("idle"); setRemainingSec(null); }}
            className="text-sm text-[#4A55A2] underline cursor-pointer"
          >
            Iniciar otra (necesita un cupo nuevo)
          </button>
        </div>
      )}

      {status === "error" && (
        <div>
          <p className="text-sm text-red-600 mb-4">{errorMsg}</p>
          <button
            onClick={() => { setStatus("idle"); setErrorMsg(null); }}
            className="text-sm text-[#4A55A2] underline cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {transcript.length > 0 && (
        <div className="mt-10 text-left">
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">Transcripción</p>
          <div className="space-y-3 max-h-[28rem] overflow-y-auto rounded-xl border border-[#E5E5E5] bg-white p-4">
            {transcript.map((e) => (
              <div key={e.id}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {e.role === "user" ? "Terapeuta (tú)" : patientName}
                </p>
                <p className="text-sm text-gray-800">{e.text || "…"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
