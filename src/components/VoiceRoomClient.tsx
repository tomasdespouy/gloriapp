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

export default function VoiceRoomClient({ patientId, patientName }: { patientId: string; patientName: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const attemptIdRef = useRef<string | null>(null);
  const nextPlayTimeRef = useRef(0);
  const pendingChunksRef = useRef<Int16Array[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadlineTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedRef = useRef(false);

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
  };

  useEffect(() => cleanup, []);

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
    const startAt = Math.max(nextPlayTimeRef.current, ctx.currentTime);
    source.start(startAt);
    nextPlayTimeRef.current = startAt + audioBuffer.duration;
  };

  const startCall = async () => {
    setErrorMsg(null);
    setStatus("solicitando");
    endedRef.current = false;

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
      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
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
        }
        // Mensajes de texto (session.created, heartbeats, etc.) se ignoran
        // en esta sala minima — no hay panel de eventos todavia.
      };
      ws.onerror = () => {
        setErrorMsg("Error de conexión con el relé de voz.");
        setStatus("error");
        if (!endedRef.current) { endedRef.current = true; notifyAttemptEnded("relay_error"); }
        cleanup();
      };
      ws.onclose = () => {
        setStatus((prev) => (prev === "error" ? prev : "terminada"));
        if (!endedRef.current) { endedRef.current = true; notifyAttemptEnded("client_closed"); }
        cleanup();
      };
    } catch (err) {
      console.error("[piloto-voz] error al iniciar:", err);
      setErrorMsg(err instanceof Error ? err.message : "No se pudo iniciar la sesión de voz.");
      setStatus("error");
      cleanup();
    }
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
    <div className="max-w-lg mx-auto py-16 px-6 text-center">
      <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Prueba técnica · piloto de voz</p>
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">{patientName}</h1>
      <p className="text-sm text-gray-500 mb-10">
        Sala mínima de escucha — sin transcripción ni feedback todavía. Solo audio en vivo contra el relé.
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
          {status === "solicitando" ? "Pidiendo micrófono y cupo..." : "Conectando con el relé..."}
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
    </div>
  );
}
