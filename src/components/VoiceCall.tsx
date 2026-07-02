"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useRouter } from "next/navigation";
import { getPatientImageUrl } from "@/lib/patient-assets";

type Patient = { id: string; name: string; age: number; occupation: string | null };
type Turn = { source: "user" | "ai"; message: string };
type Phase = "idle" | "connecting" | "live" | "ended";

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-");
}

// "[QA] Sandbox — Carlos" → "Carlos"; "Carlos Paredes" → "Carlos Paredes"
function displayName(name: string) {
  return name.replace(/\[[^\]]*\]/g, "").replace(/sandbox\s*[—-]\s*/i, "").trim() || name;
}

const INDIGO = "#4A55A2";
const GREEN = "#2f9e6f";

// Despedidas (del alumno o del paciente) para el auto-colgado de la llamada.
const FAREWELL_RE = /\b(chau|chao|adi[oó]s|nos vemos|hasta (luego|pronto|la pr[oó]xima|ma[ñn]ana|el)|me despido|me tengo que ir|eso ser[ií]a (todo|por hoy)|gracias por (todo|hoy|su tiempo|la sesi[oó]n)|que (le|te) vaya bien|que est[eé] (bien|bonito)|cu[ií]d(ese|ate))\b/i;

export function VoiceCall(props: { patient: Patient; hasVoice: boolean; imageSlug?: string }) {
  // useConversation must live under a ConversationProvider.
  return (
    <ConversationProvider>
      <VoiceCallInner {...props} />
    </ConversationProvider>
  );
}

function VoiceCallInner({ patient, hasVoice, imageSlug }: { patient: Patient; hasVoice: boolean; imageSlug?: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const transcriptRef = useRef<Turn[]>([]);
  const convIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [imgOk, setImgOk] = useState(true);

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  // Tono de llamada saliente (ringback ~425 Hz, cadencia ~1 s tono / silencio),
  // sintetizado con WebAudio para no depender de ningún asset. Suena mientras se
  // conecta y se corta apenas el paciente "contesta" (onConnect) o si falla.
  const ringRef = useRef<{ ctx: AudioContext; osc: OscillatorNode; gain: GainNode; timer: ReturnType<typeof setInterval> } | null>(null);

  // Ambiente sutil de "línea" durante la llamada (WebAudio, sin asset).
  const ambienceRef = useRef<{ ctx: AudioContext; src: AudioBufferSourceNode; gain: GainNode } | null>(null);
  // Auto-colgado por despedida mutua (alumno se despide → Carlos se despide → cuelga).
  const byeArmedRef = useRef(false);
  const byeClosingRef = useRef(false);
  const prevSpeakingRef = useRef(false);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tono de "colgado" al cerrar la llamada: se toca una sola vez, y solo si la
  // llamada llegó a estar en vivo.
  const hangupPlayedRef = useRef(false);
  const wasLiveRef = useRef(false);

  const startRing = () => {
    if (ringRef.current) return;
    try {
      const AC: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 425;
      gain.gain.value = 0.0001;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      const ring = () => {
        const t = ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.09, t + 0.04);
        gain.gain.setValueAtTime(0.09, t + 0.9);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      };
      ring();
      const timer = setInterval(ring, 3200);
      ringRef.current = { ctx, osc, gain, timer };
    } catch { /* audio no disponible: seguir en silencio */ }
  };

  const stopRing = () => {
    const r = ringRef.current;
    if (!r) return;
    ringRef.current = null;
    try {
      clearInterval(r.timer);
      const t = r.ctx.currentTime;
      r.gain.gain.cancelScheduledValues(t);
      r.gain.gain.setValueAtTime(r.gain.gain.value, t);
      r.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      r.osc.stop(t + 0.12);
      setTimeout(() => { r.ctx.close().catch(() => {}); }, 250);
    } catch { /* noop */ }
  };

  // Ruido de fondo MUY sutil (ruido marrón filtrado ~1.6 kHz) para que la voz no
  // se sienta tan "limpia"/estéril, como la presencia de una línea telefónica.
  // gain 0.01 es apenas audible; súbelo/bájalo para más o menos "ruido".
  const startAmbience = () => {
    if (ambienceRef.current) return;
    try {
      const AC: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02; // integrador → ruido marrón (grave, suave)
        data[i] = last * 3.5;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1600;
      const gain = ctx.createGain();
      gain.gain.value = 0.01; // muy sutil; ajustable
      src.connect(lp).connect(gain).connect(ctx.destination);
      src.start();
      ambienceRef.current = { ctx, src, gain };
    } catch { /* sin ambiente si el audio no está disponible */ }
  };

  const stopAmbience = () => {
    const a = ambienceRef.current;
    if (!a) return;
    ambienceRef.current = null;
    try {
      const t = a.ctx.currentTime;
      a.gain.gain.cancelScheduledValues(t);
      a.gain.gain.setValueAtTime(a.gain.gain.value, t);
      a.gain.gain.linearRampToValueAtTime(0.0001, t + 0.3);
      a.src.stop(t + 0.35);
      setTimeout(() => { a.ctx.close().catch(() => {}); }, 500);
    } catch { /* noop */ }
  };

  // Sonido de "teléfono colgado" (tono de ocupado/desconexión ~425 Hz) durante
  // 2 s y luego silencio. Se reproduce UNA vez al cerrarse la llamada.
  const playHangup = () => {
    if (hangupPlayedRef.current) return;
    hangupPlayedRef.current = true;
    try {
      const AC: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      ctx.resume?.().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 425;
      gain.gain.value = 0.0001;
      osc.connect(gain).connect(ctx.destination);
      const t0 = ctx.currentTime;
      const total = 2.0, on = 0.4, period = 0.8, vol = 0.11; // cadencia "tu… tu… tu…"
      for (let start = 0; start < total - 0.01; start += period) {
        const s = t0 + start;
        const dur = Math.min(on, total - start);
        gain.gain.setValueAtTime(0.0001, s);
        gain.gain.exponentialRampToValueAtTime(vol, s + 0.02);
        gain.gain.setValueAtTime(vol, s + dur - 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, s + dur);
      }
      osc.start(t0);
      osc.stop(t0 + total + 0.05);
      setTimeout(() => { ctx.close().catch(() => {}); }, Math.round((total + 0.3) * 1000));
    } catch { /* noop */ }
  };

  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      stopRing();
      startAmbience();
      wasLiveRef.current = true;
      convIdRef.current = conversationId;
      setSeconds(0);
      stopTimer();
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      setPhase("live");
    },
    onDisconnect: () => {
      stopRing();
      stopAmbience();
      stopTimer();
      if (wasLiveRef.current) playHangup();
      setPhase((p) => (p === "idle" ? "idle" : "ended"));
    },
    onMessage: ({ message, source }: { message: string; source: "user" | "ai" }) => {
      if (!message) return;
      transcriptRef.current = [...transcriptRef.current, { source, message }];
      setTranscript(transcriptRef.current);
      // Auto-colgado: el alumno se despide → cuando Carlos TAMBIÉN se despide,
      // se cuelga al terminar de hablar (ver efecto sobre isSpeaking).
      if (source === "user" && FAREWELL_RE.test(message)) byeArmedRef.current = true;
      else if (source === "ai" && byeArmedRef.current && FAREWELL_RE.test(message)) {
        byeArmedRef.current = false;
        byeClosingRef.current = true;
      }
    },
    onError: (message: string) => {
      stopRing();
      stopAmbience();
      setError(message || "Hubo un problema con la llamada.");
    },
  });

  const { isSpeaking, startSession, endSession, isMuted, setMuted, getInputVolume, getOutputVolume } = conversation;

  // Refs vivos para el medidor de audio (evita cerrar sobre valores viejos).
  const eqRef = useRef<HTMLSpanElement | null>(null);
  const isMutedRef = useRef(false);
  isMutedRef.current = isMuted;
  const isSpeakingRef = useRef(false);
  isSpeakingRef.current = isSpeaking;
  const getInputVolumeRef = useRef(getInputVolume);
  getInputVolumeRef.current = getInputVolume;
  const getOutputVolumeRef = useRef(getOutputVolume);
  getOutputVolumeRef.current = getOutputVolume;

  useEffect(() => () => {
    stopTimer(); stopRing(); stopAmbience();
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
  }, []);

  // Medidor de audio: las barras se mueven según QUIÉN habla — cuando habla el
  // paciente, por el volumen de SALIDA (su voz); en nuestro turno, por el
  // MICRÓFONO. En silencio o muteado, quedan planas.
  useEffect(() => {
    if (phase !== "live") return;
    let raf = 0;
    const loop = () => {
      const el = eqRef.current;
      if (el) {
        let v = 0;
        try {
          if (isSpeakingRef.current) v = getOutputVolumeRef.current?.() ?? 0;
          else if (!isMutedRef.current) v = getInputVolumeRef.current?.() ?? 0;
        } catch { v = 0; }
        const level = Math.max(0, Math.min(1, v * 2.2));
        el.style.setProperty("--level", level.toFixed(3));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const handleStart = useCallback(async () => {
    setError(null);
    transcriptRef.current = [];
    setTranscript([]);
    setPhase("connecting");
    hangupPlayedRef.current = false;
    wasLiveRef.current = false;
    startRing();
    try {
      // Ask for the mic up-front so permission issues surface before we connect.
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const res = await fetch(`/api/voice/signed-url?patientId=${patient.id}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || "No se pudo iniciar la llamada");
      }
      const { signedUrl, conversationId, userId, patientId: pid } = await res.json();
      // Pass identity to our Custom LLM (/api/voice/llm) via extra body so it
      // can run the adaptive engine against the right patient + conversation.
      startSession({
        signedUrl,
        connectionType: "websocket",
        customLlmExtraBody: { patientId: pid, conversationId, userId },
      });
    } catch (e) {
      stopRing();
      setError(e instanceof Error ? e.message : "No se pudo iniciar la llamada. Revisa el micrófono.");
      setPhase("idle");
    }
  }, [patient.id, startSession]);

  const handleEnd = useCallback(() => {
    if (endTimerRef.current) { clearTimeout(endTimerRef.current); endTimerRef.current = null; }
    try { endSession(); } catch { /* noop */ }
    stopRing();
    stopAmbience();
    stopTimer();
    playHangup();
    setPhase("ended");
  }, [endSession]);

  // Auto-colgado: cuando Carlos termina de hablar su despedida, cerramos la
  // llamada (transición de isSpeaking true→false con byeClosing armado).
  useEffect(() => {
    if (phase === "live" && prevSpeakingRef.current && !isSpeaking && byeClosingRef.current) {
      byeClosingRef.current = false;
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
      endTimerRef.current = setTimeout(() => handleEnd(), 1200);
    }
    prevSpeakingRef.current = isSpeaking;
  }, [isSpeaking, phase, handleEnd]);

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const imgUrl = getPatientImageUrl(imageSlug || slugify(patient.name));
  const display = displayName(patient.name);
  const firstName = display.split(" ")[0];
  const initials = display.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const speakingPatient = phase === "live" && isSpeaking;
  const accent = phase !== "live" ? INDIGO : speakingPatient ? INDIGO : GREEN;

  if (!hasVoice) {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="text-xl font-bold text-[#1A1A1A]">{display}</h1>
          <p className="mt-2 text-sm text-[#6b6b72]">Este paciente aún no tiene modo voz habilitado.</p>
          <button onClick={() => router.push("/pacientes")} className="mt-6 rounded-lg border border-[#E5E5E5] bg-white px-4 py-2 text-sm">
            Volver a pacientes
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <style>{css}</style>

      {/* top bar */}
      <div className="flex items-center justify-between px-7 py-5">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#E5E5E5] bg-white px-3.5 py-1.5 text-[13px] text-[#6b6b72]">
          <span className={`vc-dot ${phase === "live" ? "vc-dot-on" : ""}`} />
          {phase === "live" ? "En sesión" : phase === "connecting" ? "Conectando…" : phase === "ended" ? "Sesión finalizada" : "Listo para empezar"}
        </span>
        {(phase === "live" || phase === "ended") && (
          <span className="inline-flex items-center rounded-full border border-[#E5E5E5] bg-white px-3.5 py-1.5 text-[13px] font-semibold tabular-nums text-[#1A1A1A]">
            {mmss}
          </span>
        )}
      </div>

      {/* stage */}
      <div className="flex flex-1 flex-col items-center justify-center gap-7" style={{ "--accent": accent } as React.CSSProperties}>
        <div className={`vc-avatarWrap ${speakingPatient ? "vc-halo" : ""}`}>
          <span className="vc-ring" /><span className="vc-ring" /><span className="vc-ring" />
          <span className="vc-glow" style={{ opacity: phase === "live" ? 1 : 0 }} />
          <div className="vc-avatar">
            {imgOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgUrl} alt={display} onError={() => setImgOk(false)} />
            ) : (
              <div className="vc-initials">{initials}</div>
            )}
          </div>
        </div>

        <div className="text-center">
          <h1 className="m-0 text-[26px] font-bold tracking-tight text-[#1A1A1A]">{display}</h1>
          <p className="mt-1 text-sm text-[#6b6b72]">{patient.age} años · {patient.occupation || "—"}</p>
        </div>

        {phase === "live" && (
          <div className="vc-status" style={{ color: accent }}>
            <span className="vc-eq" ref={eqRef}><i /><i /><i /><i /><i /></span>
          </div>
        )}

        {phase === "connecting" && (
          <p className="text-sm text-[#6b6b72]">Conectando con {firstName}…</p>
        )}

        {phase === "idle" && (
          <div className="flex flex-col items-center gap-3">
            <button onClick={handleStart} className="rounded-full bg-[#4A55A2] px-8 py-3.5 text-[15px] font-semibold text-white shadow-sm transition hover:bg-[#3f4990]">
              Iniciar llamada
            </button>
            <p className="max-w-xs text-center text-[12px] text-[#9a9aa2]">
              Tú abres la sesión, como en una consulta real. {firstName} responde por voz.
            </p>
          </div>
        )}

        {error && <p className="text-[13px] text-[#e5484d]">{error}</p>}
      </div>

      {/* controls */}
      {phase === "live" && (
        <div className="flex items-center justify-center gap-4 pb-10 pt-6">
          <button
            onClick={() => setMuted(!isMuted)}
            title={isMuted ? "Activar micrófono" : "Silenciar micrófono"}
            className={`grid h-[58px] w-[58px] place-items-center rounded-full border transition hover:-translate-y-0.5 ${isMuted ? "border-[#e5484d] bg-[#e5484d] text-white" : "border-[#E5E5E5] bg-white text-[#1A1A1A]"}`}
          >
            <MicIcon muted={isMuted} />
          </button>
          <button onClick={handleEnd} title="Terminar sesión" className="grid h-[66px] w-[66px] place-items-center rounded-full bg-[#e5484d] text-white shadow-sm transition hover:-translate-y-0.5">
            <PhoneOffIcon />
          </button>
        </div>
      )}

      {phase === "ended" && (
        <div className="mx-auto w-full max-w-xl px-6 pb-10">
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1A1A1A]">Transcripción ({transcript.length} turnos)</h2>
              <span className="text-[12px] text-[#9a9aa2]">Duración {mmss}</span>
            </div>
            {transcript.length === 0 ? (
              <p className="text-[13px] text-[#9a9aa2]">No se capturaron turnos.</p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-auto">
                {transcript.map((t, i) => (
                  <div key={i} className={`text-[13px] ${t.source === "ai" ? "text-[#1A1A1A]" : "text-[#4A55A2]"}`}>
                    <b>{t.source === "ai" ? firstName : "Tú"}:</b> {t.message}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-center gap-3">
            <button onClick={() => { setPhase("idle"); setSeconds(0); }} className="rounded-lg bg-[#4A55A2] px-4 py-2 text-sm font-medium text-white">
              Nueva llamada
            </button>
            <button onClick={() => router.push("/pacientes")} className="rounded-lg border border-[#E5E5E5] bg-white px-4 py-2 text-sm">
              Volver
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col"
      style={{
        height: "calc(100dvh - 48px)",
        background:
          "radial-gradient(900px 500px at 50% -10%, #eef0fb 0%, rgba(238,240,251,0) 60%), #FAFAFA",
      }}
    >
      {children}
    </div>
  );
}

function MicIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
      {muted && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}

function PhoneOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34A19.79 19.79 0 0 1 3.07 4.18 2 2 0 0 1 5 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.59 9.91" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
  );
}

const css = `
.vc-dot{width:7px;height:7px;border-radius:50%;background:#c4c4cc}
.vc-dot-on{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.15)}
.vc-avatarWrap{position:relative;width:300px;height:300px;display:grid;place-items:center}
.vc-ring{position:absolute;width:300px;height:300px;border-radius:50%;border:2.5px solid var(--accent);opacity:0;pointer-events:none}
.vc-halo .vc-ring{animation:vc-pulse 1.9s ease-out infinite}
.vc-halo .vc-ring:nth-child(2){animation-delay:.63s}
.vc-halo .vc-ring:nth-child(3){animation-delay:1.26s}
@keyframes vc-pulse{0%{transform:scale(.55);opacity:.9}80%{opacity:0}100%{transform:scale(1.2);opacity:0}}
.vc-glow{position:absolute;width:230px;height:230px;border-radius:50%;transition:opacity .3s,box-shadow .2s;animation:vc-breathe 3.4s ease-in-out infinite}
.vc-halo .vc-glow{animation:vc-breathe-strong 1.9s ease-in-out infinite}
@keyframes vc-breathe{0%,100%{box-shadow:0 0 50px 6px color-mix(in srgb,var(--accent) 14%,transparent)}50%{box-shadow:0 0 82px 16px color-mix(in srgb,var(--accent) 30%,transparent)}}
@keyframes vc-breathe-strong{0%,100%{box-shadow:0 0 72px 12px color-mix(in srgb,var(--accent) 26%,transparent)}50%{box-shadow:0 0 122px 28px color-mix(in srgb,var(--accent) 48%,transparent)}}
.vc-avatar{position:relative;z-index:2;width:222px;height:222px;border-radius:50%;overflow:hidden;border:4px solid #fff;box-shadow:0 10px 40px rgba(26,26,40,.16);background:#e6e6ec}
.vc-avatar img{width:100%;height:100%;object-fit:cover;object-position:50% 28%;display:block}
.vc-initials{width:100%;height:100%;display:grid;place-items:center;font-size:56px;font-weight:700;color:#9a9aa2}
.vc-status{display:flex;align-items:center;gap:11px;font-size:15px;font-weight:500;height:22px}
.vc-eq{display:flex;align-items:flex-end;gap:3px;height:20px;--level:0}
.vc-eq i{width:3px;background:currentColor;border-radius:2px;transition:height 80ms ease-out;height:calc(4px + var(--level) * 12px)}
.vc-eq i:nth-child(1){height:calc(4px + var(--level) * 6px)}
.vc-eq i:nth-child(2){height:calc(4px + var(--level) * 11px)}
.vc-eq i:nth-child(3){height:calc(4px + var(--level) * 15px)}
.vc-eq i:nth-child(4){height:calc(4px + var(--level) * 11px)}
.vc-eq i:nth-child(5){height:calc(4px + var(--level) * 6px)}
`;
