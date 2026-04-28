"use client";

import { useEffect, useRef, useState } from "react";

// Spike: speaker recognition con Picovoice Eagle. Probamos enrollment +
// detección en vivo en una pantalla aislada. Sin BD, sin servidor, sin
// localStorage — todo vive en memoria de esta pestaña.

type Phase =
  | "idle"           // sin AccessKey
  | "ready"          // profiler inicializado, esperando enroll
  | "enrolling"      // grabando enrollment
  | "enrolled"       // profile listo, eagle inicializado
  | "detecting";     // grabación continua + clasificación

// Tipos mínimos. Los SDKs son `any` para no acoplar el spike al shape
// exacto, ya tenemos los .d.ts en node_modules para autocomplete real.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EagleProfilerWorker = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EagleWorker = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EagleProfile = any;

export default function SpikeClient() {
  const [accessKey, setAccessKey] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [enrollPercent, setEnrollPercent] = useState(0);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Refs (no en state porque no afectan render directamente y los
  // necesitamos en callbacks de audio que se ejecutan a alta frecuencia).
  const phaseRef = useRef<Phase>("idle");
  const profilerRef = useRef<EagleProfilerWorker | null>(null);
  const eagleRef = useRef<EagleWorker | null>(null);
  const profileRef = useRef<EagleProfile | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const silenceRef = useRef<GainNode | null>(null);
  const sampleBufRef = useRef<number[]>([]);
  const enrolledFlagRef = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const log = (text: string) => {
    const ts = new Date().toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [...prev.slice(-29), `${ts}  ${text}`]);
  };

  const cleanupAudio = () => {
    try { processorRef.current?.disconnect(); } catch {}
    try { sourceRef.current?.disconnect(); } catch {}
    try { silenceRef.current?.disconnect(); } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    processorRef.current = null;
    sourceRef.current = null;
    silenceRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
    sampleBufRef.current = [];
  };

  const startAudio = async (frameLength: number, onFrame: (frame: Int16Array) => Promise<void> | void) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // El SDK exige 16kHz. AudioContext con sampleRate fija hace resample
    // automático desde el sample rate del hardware (usualmente 48000).
    const ctx = new AudioContext({ sampleRate: 16000 });
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    // GainNode con gain=0 evita feedback (audio del mic saliendo por
    // los parlantes). El processor igual necesita un destination para
    // que onaudioprocess dispare en algunos browsers.
    const silence = ctx.createGain();
    silence.gain.value = 0;

    streamRef.current = stream;
    audioCtxRef.current = ctx;
    sourceRef.current = source;
    processorRef.current = processor;
    silenceRef.current = silence;
    sampleBufRef.current = [];

    processor.onaudioprocess = async (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const buf = sampleBufRef.current;
      for (let i = 0; i < input.length; i++) {
        // Float32 [-1,1] → Int16 [-32768, 32767].
        const v = input[i] * 32767;
        buf.push(v < -32768 ? -32768 : v > 32767 ? 32767 : v | 0);
      }
      while (buf.length >= frameLength) {
        const slice = buf.splice(0, frameLength);
        const frame = new Int16Array(slice);
        try {
          await onFrame(frame);
        } catch (err) {
          log(`frame error: ${(err as Error).message}`);
        }
      }
    };

    source.connect(processor);
    processor.connect(silence);
    silence.connect(ctx.destination);
    log(`Audio iniciado @ 16kHz, frameLength=${frameLength}`);
  };

  // ─── Step 1: inicializar EagleProfiler ──────────────────────────────
  const handleInit = async () => {
    if (!accessKey.trim()) {
      setError("Falta el AccessKey");
      return;
    }
    setError(null);
    log("Cargando SDK Eagle...");
    try {
      const { EagleProfilerWorker } = await import("@picovoice/eagle-web");
      const profiler = await EagleProfilerWorker.create(accessKey.trim(), {
        publicPath: "/eagle_params.pv",
      });
      profilerRef.current = profiler;
      log(`EagleProfiler listo. frameLength=${profiler.frameLength}, sampleRate=${profiler.sampleRate}, version=${profiler.version}`);
      setPhase("ready");
    } catch (err) {
      const msg = (err as Error).message;
      setError(`Init falló: ${msg}`);
      log(`✗ Init: ${msg}`);
    }
  };

  // ─── Step 2: enrollment ─────────────────────────────────────────────
  const handleStartEnroll = async () => {
    if (!profilerRef.current) return;
    setEnrollPercent(0);
    enrolledFlagRef.current = false;
    setPhase("enrolling");
    log("Enrollment: hablá normal y sin pausas largas. Frase libre.");
    await startAudio(profilerRef.current.frameLength, async (frame) => {
      if (phaseRef.current !== "enrolling" || enrolledFlagRef.current) return;
      const pct: number = await profilerRef.current.enroll(frame);
      setEnrollPercent(pct);
      if (pct >= 100) {
        enrolledFlagRef.current = true;
        log("Enrollment 100%. Exportando profile...");
        try {
          const profile = await profilerRef.current.export();
          profileRef.current = profile;
          cleanupAudio();
          log("Inicializando EagleWorker para detección...");
          const { EagleWorker } = await import("@picovoice/eagle-web");
          const eagle = await EagleWorker.create(accessKey.trim(), {
            publicPath: "/eagle_params.pv",
          });
          eagleRef.current = eagle;
          log(`EagleWorker listo. minProcessSamples=${eagle.minProcessSamples}`);
          setPhase("enrolled");
        } catch (err) {
          const msg = (err as Error).message;
          setError(`Export/Recognition falló: ${msg}`);
          log(`✗ Export: ${msg}`);
          cleanupAudio();
          setPhase("ready");
        }
      }
    });
  };

  const handleResetEnroll = async () => {
    cleanupAudio();
    if (profilerRef.current) {
      try { await profilerRef.current.reset(); } catch {}
    }
    enrolledFlagRef.current = false;
    setEnrollPercent(0);
    profileRef.current = null;
    if (eagleRef.current) {
      try { await eagleRef.current.release(); } catch {}
      eagleRef.current = null;
    }
    setPhase("ready");
    log("Profile descartado, listo para nuevo enrollment.");
  };

  // ─── Step 3: detección en vivo ──────────────────────────────────────
  const handleStartDetect = async () => {
    if (!eagleRef.current || !profileRef.current) return;
    setLastScore(null);
    setPhase("detecting");
    log("Detección activa. Probá tu voz vs otra (ej. video, otra persona).");
    await startAudio(eagleRef.current.minProcessSamples, async (frame) => {
      if (phaseRef.current !== "detecting") return;
      const scores: number[] = await eagleRef.current.process(frame, profileRef.current);
      if (scores && scores.length > 0) {
        setLastScore(scores[0]);
      }
    });
  };

  const handleStopDetect = () => {
    cleanupAudio();
    setPhase("enrolled");
    log("Detección detenida.");
  };

  // ─── Reset total ────────────────────────────────────────────────────
  const handleReleaseAll = async () => {
    cleanupAudio();
    if (profilerRef.current) {
      try { await profilerRef.current.release(); } catch {}
      profilerRef.current = null;
    }
    if (eagleRef.current) {
      try { await eagleRef.current.release(); } catch {}
      eagleRef.current = null;
    }
    profileRef.current = null;
    enrolledFlagRef.current = false;
    setEnrollPercent(0);
    setLastScore(null);
    setLogs([]);
    setError(null);
    setPhase("idle");
  };

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      cleanupAudio();
      profilerRef.current?.release?.().catch(() => {});
      eagleRef.current?.release?.().catch(() => {});
    };
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto space-y-5">
      <header className="space-y-1 pb-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold">
            Spike experimental
          </span>
          <span className="text-[10px] text-gray-400">/observacion-spike</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Eagle — speaker recognition</h1>
        <p className="text-sm text-gray-500">
          Pantalla aislada para probar Picovoice Eagle. No toca <code className="text-xs bg-gray-100 px-1 rounded">/observacion</code> ni la BD. Todo en memoria de esta pestaña.
        </p>
      </header>

      {/* AccessKey */}
      <section className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">1. Picovoice AccessKey</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Conseguilo gratis en <a href="https://console.picovoice.ai/" target="_blank" rel="noreferrer" className="text-sidebar underline">console.picovoice.ai</a>. Solo se usa en memoria de esta pestaña.
          </p>
        </div>
        <input
          type="password"
          value={accessKey}
          onChange={(e) => setAccessKey(e.target.value)}
          placeholder="aBcD1234..."
          autoComplete="off"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sidebar/30 disabled:bg-gray-50"
          disabled={phase !== "idle"}
        />
        <div className="flex gap-2">
          <button
            onClick={handleInit}
            disabled={!accessKey.trim() || phase !== "idle"}
            className="px-4 py-2 bg-sidebar text-white rounded-lg text-sm font-medium hover:bg-sidebar-hover transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Inicializar Eagle
          </button>
          {phase !== "idle" && (
            <button
              onClick={handleReleaseAll}
              className="px-3 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              Reiniciar todo
            </button>
          )}
        </div>
      </section>

      {/* Enrollment */}
      {(phase === "ready" || phase === "enrolling" || phase === "enrolled" || phase === "detecting") && (
        <section className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">2. Enrollment</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Hablá normal unos 10–20 segundos hasta llegar a 100%. Ambiente silencioso, una sola voz.
            </p>
          </div>
          {phase === "ready" && (
            <button
              onClick={handleStartEnroll}
              className="px-4 py-2 bg-sidebar text-white rounded-lg text-sm font-medium hover:bg-sidebar-hover cursor-pointer"
            >
              Empezar enrollment
            </button>
          )}
          {phase === "enrolling" && (
            <>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-sidebar h-3 transition-all duration-200"
                  style={{ width: `${enrollPercent}%` }}
                />
              </div>
              <p className="text-xs text-gray-700 font-mono">{enrollPercent.toFixed(1)}%</p>
              <button
                onClick={handleResetEnroll}
                className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer"
              >
                Cancelar y reiniciar
              </button>
            </>
          )}
          {(phase === "enrolled" || phase === "detecting") && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 inline-block">
                ✓ Profile listo
              </p>
              <button
                onClick={handleResetEnroll}
                className="text-xs text-gray-500 underline cursor-pointer"
              >
                Re-enrolar
              </button>
            </div>
          )}
        </section>
      )}

      {/* Detection */}
      {(phase === "enrolled" || phase === "detecting") && (
        <section className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">3. Detección en vivo</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              El score va de 0 a 1. Mayor score = más parecido a tu enrollment. Probá hablar vos, después poné un video con otra voz.
            </p>
          </div>
          {phase === "enrolled" && (
            <button
              onClick={handleStartDetect}
              className="px-4 py-2 bg-sidebar text-white rounded-lg text-sm font-medium hover:bg-sidebar-hover cursor-pointer"
            >
              Iniciar detección
            </button>
          )}
          {phase === "detecting" && (
            <>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-mono tabular-nums w-32">
                  {lastScore !== null ? lastScore.toFixed(3) : "—"}
                </div>
                <div className="flex-1">
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 transition-all ${
                        lastScore !== null && lastScore > 0.5
                          ? "bg-emerald-500"
                          : "bg-rose-400"
                      }`}
                      style={{ width: `${Math.min(100, (lastScore ?? 0) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {lastScore === null
                      ? "esperando audio..."
                      : lastScore > 0.5
                      ? "🟢 parecido a vos"
                      : "🔴 no es tu voz"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleStopDetect}
                className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer"
              >
                Detener
              </button>
            </>
          )}
        </section>
      )}

      {/* Errors */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Log */}
      <section className="border border-gray-200 rounded-xl p-3 bg-gray-50">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mb-1.5">Log</p>
        <pre className="text-[11px] font-mono text-gray-700 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
          {logs.length === 0 ? "(vacío)" : logs.join("\n")}
        </pre>
      </section>
    </div>
  );
}
