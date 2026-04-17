"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, ArrowLeft, LogOut, Mic, MicOff, Volume2, Square, Loader2, Clock, X, Phone, PhoneOff, FileText, CheckCircle2, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SessionTimer, { useActiveSecondsRef } from "@/components/SessionTimer";
import { sanitizeHTML } from "@/lib/sanitize";

interface Patient {
  id: string;
  name: string;
  age: number;
  occupation: string | null;
  presenting_problem: string;
  difficulty_level: string;
  voice_id?: string | null;
}

interface Message {
  role: string;
  content: string;
  created_at?: string;
}

interface ChatInterfaceProps {
  patient: Patient;
  conversationId?: string;
  initialMessages: Message[];
  initialActiveSeconds?: number;
  userAvatarUrl?: string | null;
  userName?: string;
}

type Phase = "idle" | "thinking" | "writing";

// Default visual typing speed (ms per 2-char tick). Individual patients
// may ship their own pacing profile via the "pacing" SSE event — see
// src/lib/conversation-pacing.ts for the profiles. This value is only
// used as a safe fallback before the server tells us otherwise.
const DEFAULT_CHAR_DELAY_MS = 28;

// Default silence thresholds; may be overridden per-patient via the
// "pacing" event. Length of the array == number of nudge stages.
const DEFAULT_SILENCE_THRESHOLDS_MS = [60_000, 120_000, 210_000, 300_000];

export function ChatInterface({ patient, conversationId: initialConvId, initialMessages, initialActiveSeconds = 0, userAvatarUrl, userName = "" }: ChatInterfaceProps) {
  console.log("[ChatInterface] Mount:", { patient: patient.name, patientId: patient.id, conversationId: initialConvId, initialMessagesCount: initialMessages.length, voiceId: patient.voice_id });
  const userInitials = userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConvId);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [isRecording, setIsRecording] = useState(false);
  const { ref: activeSecondsExtRef, updateRef: onTimerTick } = useActiveSecondsRef();
  const [displaySeconds, setDisplaySeconds] = useState(initialActiveSeconds);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(initialMessages.length > 0);
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false); // true = audio playing, hide text
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [showVoiceConsent, setShowVoiceConsent] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesRecording, setNotesRecording] = useState(false);
  const [notesCorrecting, setNotesCorrecting] = useState(false);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const notesRecognitionRef = useRef<SpeechRecognition | null>(null);
  const notesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceModeRef = useRef(false);
  const messagesRef = useRef<Message[]>(initialMessages);
  const isStreamingRef = useRef(false);
  // Per-patient pacing knobs, mutable so the server can override them
  // via the SSE "pacing" event without forcing a re-render.
  const charDelayRef = useRef<number>(DEFAULT_CHAR_DELAY_MS);
  const silenceThresholdsRef = useRef<number[]>(DEFAULT_SILENCE_THRESHOLDS_MS);
  // Extra pause after ".?!" + space so sentences breathe naturally.
  // Random in [min, max] ms each time one is hit. 0 disables.
  const sentenceGapMinRef = useRef<number>(0);
  const sentenceGapMaxRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const router = useRouter();

  // TTS (ElevenLabs)
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [loadingTtsIdx, setLoadingTtsIdx] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Streaming TTS queue for voice mode
  const ttsQueueRef = useRef<string[]>([]);
  const ttsPlayingRef = useRef(false);
  const ttsSentenceBufferRef = useRef("");
  const ttsStreamDoneRef = useRef(false);

  const fetchTtsBlob = async (text: string): Promise<Blob | null> => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: patient.voice_id }),
      });
      if (!res.ok) return null;
      return await res.blob();
    } catch { return null; }
  };

  // Play queued TTS chunks sequentially (walkie-talkie: mic OFF while playing)
  const drainTtsQueue = async () => {
    if (ttsPlayingRef.current) return;
    ttsPlayingRef.current = true;

    // Walkie-talkie: mute mic while AI speaks
    if (voiceModeRef.current && voiceRecognitionRef.current) {
      try { voiceRecognitionRef.current.stop(); } catch {}
      setIsRecording(false);
    }

    while (ttsQueueRef.current.length > 0) {
      const sentence = ttsQueueRef.current.shift()!;
      const blob = await fetchTtsBlob(sentence);
      if (!blob) continue;

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      await new Promise<void>((resolve) => {
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        audio.play().catch(() => resolve());
      });
    }

    audioRef.current = null;
    ttsPlayingRef.current = false;

    // If stream is done and queue is empty, finish voice mode playback
    if (ttsStreamDoneRef.current) {
      setPlayingIdx(null);
      setVoiceSpeaking(false);
      ttsStreamDoneRef.current = false;

      // Type text gradually after audio finishes
      const fullText = lastAssistantMsgRef.current;
      if (fullText) {
        let charIdx = 0;
        const typeInterval = setInterval(() => {
          charIdx += 2;
          const partial = fullText.substring(0, charIdx);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") {
              updated[updated.length - 1] = { ...last, content: partial };
            }
            return updated;
          });
          if (charIdx >= fullText.length) {
            clearInterval(typeInterval);
            // Walkie-talkie: re-enable mic after AI finishes speaking
            if (voiceModeRef.current && voiceRecognitionRef.current) {
              setTimeout(() => {
                try { voiceRecognitionRef.current?.start(); setIsRecording(true); } catch {}
              }, 500);
            }
            // Start silence timers AFTER TTS playback finishes (not during)
            if (voiceModeRef.current) {
              setSilenceTrigger((c) => c + 1);
            }
          }
        }, charDelayRef.current);
      } else {
        // No text to type — reactivate mic immediately
        if (voiceModeRef.current && voiceRecognitionRef.current) {
          setTimeout(() => {
            try { voiceRecognitionRef.current?.start(); setIsRecording(true); } catch {}
          }, 500);
        }
        if (voiceModeRef.current) {
          setSilenceTrigger((c) => c + 1);
        }
      }
    }
  };

  // Push a sentence to TTS queue and start draining
  const queueTtsSentence = (sentence: string) => {
    const clean = sentence.trim();
    if (!clean) return;
    ttsQueueRef.current.push(clean);
    if (!ttsPlayingRef.current) drainTtsQueue();
  };

  // Check sentence buffer for complete sentences and queue them
  const flushSentenceBuffer = (force: boolean = false) => {
    const buf = ttsSentenceBufferRef.current;
    // Match sentences ending with . ? ! ... or stage directions [...]
    const sentenceEnd = /([.!?]+|\.\.\.)(\s|$)/g;
    let lastIdx = 0;
    let match;
    while ((match = sentenceEnd.exec(buf)) !== null) {
      const endPos = match.index + match[0].length;
      const sentence = buf.slice(lastIdx, endPos).trim();
      if (sentence) queueTtsSentence(sentence);
      lastIdx = endPos;
    }
    ttsSentenceBufferRef.current = buf.slice(lastIdx);

    // If force flush (stream done), send remaining text
    if (force && ttsSentenceBufferRef.current.trim()) {
      queueTtsSentence(ttsSentenceBufferRef.current);
      ttsSentenceBufferRef.current = "";
    }
  };

  const playTts = async (text: string, idx: number) => {
    // If already playing this message, stop it
    if (playingIdx === idx) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingIdx(null);
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingIdx(null);
    }

    setLoadingTtsIdx(idx);
    try {
      const blob = await fetchTtsBlob(text);
      if (!blob) throw new Error("TTS failed");

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      audio.onended = () => {
        setPlayingIdx(null);
        audioRef.current = null;
        URL.revokeObjectURL(url);
      };

      audioRef.current = audio;
      setPlayingIdx(idx);
      setLoadingTtsIdx(null);
      await audio.play();
    } catch {
      setLoadingTtsIdx(null);
      setPlayingIdx(null);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      ttsQueueRef.current = [];
      ttsPlayingRef.current = false;
    };
  }, []);

  // Sync refs
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);

  // Auto-play TTS function (for voice mode) — kept for non-streaming uses
  const autoPlayTts = async (text: string, idx: number) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    try {
      const blob = await fetchTtsBlob(text);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { setPlayingIdx(null); audioRef.current = null; URL.revokeObjectURL(url); };
      audioRef.current = audio;
      setPlayingIdx(idx);
      await audio.play();
    } catch { /* TTS failed silently */ }
  };

  // Auto-play TTS with callback when audio finishes
  const autoPlayTtsWithCallback = async (text: string, idx: number, onDone: () => void) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    try {
      const blob = await fetchTtsBlob(text);
      if (!blob) { onDone(); return; }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        setPlayingIdx(null);
        audioRef.current = null;
        URL.revokeObjectURL(url);
        onDone();
      };
      audio.onerror = () => { onDone(); };
      audioRef.current = audio;
      setPlayingIdx(idx);
      await audio.play();
    } catch {
      onDone();
    }
  };

  // Session time tracking — starts when sessionStarted becomes true
  const sessionStartRef = useRef(initialMessages.length > 0 ? Date.now() : 0);
  const activeSecondsRef = useRef(initialActiveSeconds);

  // Tracks when the user last sent a message so we can show WhatsApp-style
  // "enviado" → "leído" ticks and enforce a silent "thinking" pause before
  // the first character appears, independent of how fast the server streams.
  const lastSentAtRef = useRef<number>(0);
  const [userTickStage, setUserTickStage] = useState<0 | 1 | 2>(0); // 0=none,1=enviado,2=leído
  // Minimum silent "thinking" window (ms). The server may respond faster
  // than this; we delay the typewriter so the student has a moment to
  // breathe before words start appearing. Kept small to avoid feeling laggy.
  const MIN_THINKING_MS = 1400;

  // Token buffer for slow typing effect
  const tokenBufferRef = useRef<string>("");
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamDoneRef = useRef(false);
  const lastAssistantMsgRef = useRef<string>("");

  // ═══ REALTIME (WebSocket) — Patient interruptions & typing detection ═══
  const realtimeUnsubRef = useRef<(() => void) | null>(null);

  // Subscribe to Realtime channel when conversationId is available
  useEffect(() => {
    if (!conversationId) return;

    let unsubscribe: (() => void) | null = null;

    import("@/lib/supabase/realtime-chat").then(({ subscribeToConversation }) => {
      unsubscribe = subscribeToConversation(conversationId, (event) => {
        if (event.type === "interrupt" || event.type === "reaction") {
          // Skip if currently streaming — the interrupt was already handled locally
          if (isStreamingRef.current) return;
          // Prevent duplicates: check if this content already exists in recent messages
          setMessages((prev) => {
            const isDuplicate = prev.some(m => m.role === "assistant" && m.content === event.content);
            if (isDuplicate) return prev;
            return [...prev, {
              role: "assistant",
              content: event.content,
              created_at: new Date().toISOString(),
            }];
          });
        }
      });
      realtimeUnsubRef.current = unsubscribe;
    });

    return () => {
      if (realtimeUnsubRef.current) realtimeUnsubRef.current();
      realtimeUnsubRef.current = null;
    };
  }, [conversationId]);

  // Typing detection — while the user has at least one character in
  // the compose box, pause the "¿estás ahí?" silence timers. Focus
  // alone (empty input) still counts as silence. When the input goes
  // back to empty (user backspaced everything) we restart the timers.
  // Legacy no-op signature is kept so existing call sites compile.
  const handleTypingActivity = useCallback(() => {}, []);

  const isTypingPausedRef = useRef(false);
  const applyTypingPause = (hasText: boolean) => {
    if (hasText && !isTypingPausedRef.current) {
      isTypingPausedRef.current = true;
      clearSilenceTimers();
    } else if (!hasText && isTypingPausedRef.current) {
      isTypingPausedRef.current = false;
      if (conversationId && sessionStarted && !isStreamingRef.current) {
        startSilenceTimers();
      }
    }
  };

  // Patient media
  const avatarSlug = patient.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
  const videoSrc = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/${avatarSlug}.mp4`;
  const imageSrc = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/${avatarSlug}.png`;
  const initials = patient.name.split(" ").map((n) => n[0]).join("").slice(0, 2);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    messagesEndRef.current?.scrollIntoView({ behavior: prefersReduced ? "instant" : "smooth" });
  }, [messages]);

  // Mobile keyboard coordination.
  // The layout root contracts via --app-vh (see SidebarContext). That
  // alone doesn't re-scroll the messages list, so the last message can
  // fall above the newly-visible area when the keyboard opens. This
  // effect nudges the scroll to the latest message whenever the visual
  // viewport size changes on touch devices. Desktop short-circuits.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    if (!window.matchMedia("(hover: none)").matches) return;
    const onResize = () => {
      messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  // Session timer — extracted to <SessionTimer /> component.
  // This callback syncs activeSeconds back into ChatInterface refs for
  // use by end-session logic and silence timers, without owning the interval.
  const handleTimerTick = useCallback((seconds: number) => {
    activeSecondsRef.current = seconds;
    activeSecondsExtRef.current = seconds;
    setDisplaySeconds(seconds);
  }, [activeSecondsExtRef]);

  // Multi-stage silence detection (timestamp-based, resistant to browser throttling).
  // Thresholds now come from the patient's pacing profile (silenceThresholdsRef);
  // voice mode keeps its own fixed thresholds since TTS latency dominates there.
  const SILENCE_THRESHOLDS_VOICE = [60_000, 120_000, 180_000];
  const silenceStartRef = useRef<number | null>(null);
  const silenceStageRef = useRef(0);
  const silenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearSilenceTimers = () => {
    if (silenceIntervalRef.current) {
      clearInterval(silenceIntervalRef.current);
      silenceIntervalRef.current = null;
    }
    silenceStartRef.current = null;
    silenceStageRef.current = 0;
  };

  const fireSilenceStage = async (stage: number) => {
    console.log(`[silence] fire stage ${stage}, isStreaming=${isStreamingRef.current}, voiceMode=${voiceModeRef.current}, ttsPlaying=${ttsPlayingRef.current}`);
    if (!conversationId || isStreamingRef.current) {
      console.log(`[silence] aborted: ${!conversationId ? "no conversationId" : "streaming"}`);
      return;
    }
    // Don't fire silence while TTS is playing (voice mode walkie-talkie)
    if (voiceModeRef.current && ttsPlayingRef.current) {
      console.log(`[silence] aborted: TTS playing in voice mode`);
      return;
    }

    // Voice mode has 3 stages; map stage 3 → closure prompt (stage 4 on server)
    const isVoice = voiceModeRef.current;
    const serverStage = (isVoice && stage === 3) ? 4 : stage;

    try {
      const res = await fetch("/api/chat/silence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: patient.id, conversationId, stage: serverStage }),
      });

      console.log(`[silence] response status=${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`[silence] received message="${data.message?.slice(0, 60)}...", sessionClosed=${data.sessionClosed}`);
        if (data.message) {
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: data.message,
            created_at: new Date().toISOString(),
          }]);

          // In voice mode, play TTS for silence messages (walkie-talkie: mute mic)
          if (voiceModeRef.current && patient.voice_id) {
            const msgIdx = messagesRef.current.length;
            autoPlayTtsAndResumeMic(data.message, msgIdx);
          }

          // Session closed by patient — show disconnect modal
          if (data.sessionClosed) {
            if (voiceModeRef.current) stopVoiceMode();
            clearSilenceTimers();
            setShowDisconnect(true);
          }
        }
      } else {
        console.error(`[silence] non-ok response: ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      console.error(`[silence] fetch error:`, err);
    }
  };

  const startSilenceTimers = () => {
    clearSilenceTimers();
    silenceStartRef.current = Date.now();
    silenceStageRef.current = 0;

    // Poll every 5s using timestamps — immune to browser tab throttling
    silenceIntervalRef.current = setInterval(() => {
      if (!silenceStartRef.current) return;
      const elapsed = Date.now() - silenceStartRef.current;
      const thresholds = voiceModeRef.current ? SILENCE_THRESHOLDS_VOICE : silenceThresholdsRef.current;
      const nextStage = silenceStageRef.current + 1;

      if (nextStage <= thresholds.length && elapsed >= thresholds[nextStage - 1]) {
        silenceStageRef.current = nextStage;
        fireSilenceStage(nextStage);
        // Stop polling after the last stage
        if (nextStage >= thresholds.length) {
          clearSilenceTimers();
        }
      }
    }, 5_000);
  };

  // Start silence timers when user SENDS a message.
  // Uses a dedicated counter so silence messages don't re-trigger/cancel timers.
  const [silenceTrigger, setSilenceTrigger] = useState(0);

  useEffect(() => {
    if (!conversationId || silenceTrigger === 0) return;

    startSilenceTimers();

    return () => clearSilenceTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [silenceTrigger, conversationId]);

  // Start silence timers when session starts (handles initial 60s silence)
  useEffect(() => {
    if (!sessionStarted || !conversationId) return;
    startSilenceTimers();
    return () => clearSilenceTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStarted, conversationId]);

  // Ctrl+Alt to toggle mic; double Ctrl+Alt to lock recording on
  const micLastPressRef = useRef<number>(0);
  const micLockedRef = useRef(false);
  const [micLocked, setMicLocked] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Alt combo (either order)
      if (e.ctrlKey && e.altKey && !e.repeat && sessionStarted && !isStreaming) {
        e.preventDefault();
        const now = Date.now();
        const timeSinceLast = now - micLastPressRef.current;
        micLastPressRef.current = now;

        if (isRecording) {
          // If recording → stop (and unlock if locked)
          micLockedRef.current = false;
          setMicLocked(false);
          stopRecording();
        } else {
          // Double press (< 500ms) → lock mode
          if (timeSinceLast < 500) {
            micLockedRef.current = true;
            setMicLocked(true);
          }
          startRecording();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecording, isStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drain buffer character by character
  const drainBuffer = useCallback(() => {
    // Enforce the minimum silent "thinking" window for text mode before
    // the first character is rendered. Voice mode is excluded because TTS
    // handles its own pacing (walkie-talkie).
    if (
      !voiceModeRef.current &&
      tokenBufferRef.current.length > 0 &&
      lastSentAtRef.current > 0
    ) {
      const wait = lastSentAtRef.current + MIN_THINKING_MS - Date.now();
      if (wait > 0) {
        drainTimerRef.current = setTimeout(drainBuffer, wait);
        return;
      }
    }
    if (tokenBufferRef.current.length > 0) {
      const chunk = tokenBufferRef.current.slice(0, 2);
      tokenBufferRef.current = tokenBufferRef.current.slice(chunk.length);

      // In voice mode: accumulate text silently, don't show it
      if (voiceModeRef.current && patient.voice_id) {
        lastAssistantMsgRef.current += chunk;
      } else {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            const newContent = last.content + chunk;
            updated[updated.length - 1] = { ...last, content: newContent };
            lastAssistantMsgRef.current = newContent;
          }
          return updated;
        });
      }

      // Natural cadence: pause a bit when we just finished a sentence.
      // We detect the pattern ".?!" followed by a space (or anything
      // non-letter). The gap is random within the profile's range so
      // it doesn't feel mechanical. Skipped in voice mode since TTS
      // handles its own prosody.
      let delay = charDelayRef.current;
      if (
        !voiceModeRef.current &&
        sentenceGapMaxRef.current > 0 &&
        /[.!?][\s"')\]]*$/.test(chunk)
      ) {
        const min = sentenceGapMinRef.current;
        const max = sentenceGapMaxRef.current;
        const extra = min + Math.random() * Math.max(1, max - min);
        delay += Math.round(extra);
      }

      drainTimerRef.current = setTimeout(drainBuffer, delay);
    } else if (streamDoneRef.current) {
      setPhase("idle");
      setIsStreaming(false);
      // Voice mode: streaming TTS already started during GPT streaming
      if (voiceModeRef.current && lastAssistantMsgRef.current && patient.voice_id) {
        const msgIdx = messagesRef.current.length - 1;

        // Show "Hablando..." indicator (text stays empty until audio finishes)
        setVoiceSpeaking(true);
        setPlayingIdx(msgIdx);

        // Flush remaining sentence buffer and signal stream done
        flushSentenceBuffer(true);
        ttsStreamDoneRef.current = true;

        // If TTS queue is already empty (all sentences already played), trigger finish
        if (!ttsPlayingRef.current && ttsQueueRef.current.length === 0) {
          drainTtsQueue();
        }
      }
    } else {
      drainTimerRef.current = setTimeout(drainBuffer, charDelayRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (drainTimerRef.current) clearTimeout(drainTimerRef.current);
    };
  }, []);

  const startRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.");
      return;
    }

    const recognition = new SR();
    recognition.lang = "es-CL";
    recognition.continuous = true;
    recognition.interimResults = true;

    const baseText = input; // Preserve existing text
    let processedUpTo = 0;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final_ = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final_ += result[0].transcript;
          processedUpTo = i + 1;
        } else if (i >= processedUpTo) {
          interim += result[0].transcript;
        }
      }
      setInput(baseText + final_ + interim);
    };

    recognition.onend = () => setIsRecording(false);
    recognition.onerror = (e: Event & { error?: string }) => {
      setIsRecording(false);
      if (e.error === "not-allowed") {
        alert("Permiso de micrófono denegado. Habilita el micrófono en la configuración de tu navegador.");
      } else if (e.error === "network") {
        alert("Error de red en el reconocimiento de voz. Verifica tu conexión a internet.");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const [correcting, setCorrecting] = useState(false);

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const correctText = async () => {
    const currentText = input.trim();
    if (!currentText) return;
    setCorrecting(true);
    try {
      const res = await fetch("/api/chat/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: currentText }),
      });
      if (res.ok) {
        const { corrected } = await res.json();
        if (corrected && corrected !== currentText) {
          setInput(corrected);
        }
      }
    } catch { /* keep original */ }
    setCorrecting(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // ═══ NOTES PANEL ═══
  const saveNotes = useCallback(async (text: string) => {
    if (!conversationId || !text.trim()) return;
    setNotesSaving(true);
    try {
      await fetch(`/api/sessions/${conversationId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: text }),
      });
    } catch { /* silent */ }
    setNotesSaving(false);
  }, [conversationId]);

  const handleNotesChange = (text: string) => {
    setNotesText(text);
    if (notesSaveTimerRef.current) clearTimeout(notesSaveTimerRef.current);
    notesSaveTimerRef.current = setTimeout(() => saveNotes(text), 2000);
  };

  const correctNotes = async () => {
    if (!notesText.trim() || notesCorrecting) return;
    setNotesCorrecting(true);
    try {
      const res = await fetch("/api/chat/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: notesText }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.corrected) {
          setNotesText(data.corrected);
          saveNotes(data.corrected);
        }
      }
    } catch { /* silent */ }
    setNotesCorrecting(false);
  };

  const toggleNotesRecording = () => {
    if (notesRecording) {
      notesRecognitionRef.current?.stop();
      setNotesRecording(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "es-CL";
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join(" ");
      setNotesText((prev) => (prev ? prev + " " + transcript : transcript));
    };
    recognition.onerror = () => setNotesRecording(false);
    recognition.onend = () => setNotesRecording(false);
    notesRecognitionRef.current = recognition;
    recognition.start();
    setNotesRecording(true);
  };

  // Fetch existing notes when panel opens for the first time
  useEffect(() => {
    if (!notesOpen || notesLoaded || !conversationId) return;
    setNotesLoaded(true);
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data } = await supabase
          .from("conversations")
          .select("student_notes_v2")
          .eq("id", conversationId)
          .single();
        if (data?.student_notes_v2) {
          setNotesText(data.student_notes_v2);
        }
      } catch { /* silent */ }
    })();
  }, [notesOpen, notesLoaded, conversationId]);

  // Cleanup notes save timer on unmount
  useEffect(() => {
    return () => {
      if (notesSaveTimerRef.current) clearTimeout(notesSaveTimerRef.current);
    };
  }, []);

  // ═══ VOICE MODE — continuous speech-to-text + auto-send + TTS response ═══
  const voiceAutoSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceRecognitionRef = useRef<SpeechRecognition | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendMessageRef = useRef<(text?: string) => Promise<void>>(null as any);

  const requestVoiceMode = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Tu navegador no soporta reconocimiento de voz."); return; }
    setShowVoiceConsent(true);
  };

  const startVoiceMode = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    setShowVoiceConsent(false);
    setVoiceMode(true);

    const recognition = new SR();
    recognition.lang = "es-CL";
    recognition.continuous = true;
    recognition.interimResults = true;

    let transcript = "";
    let processedUpTo = 0;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let finalText = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript;
          processedUpTo = i + 1;
        } else if (i >= processedUpTo) {
          interim += event.results[i][0].transcript;
        }
      }
      transcript = finalText;
      setInput(transcript + interim);

      // Auto-send after 2s of silence (reset timer on each result)
      if (voiceAutoSendTimerRef.current) clearTimeout(voiceAutoSendTimerRef.current);
      if (transcript.trim()) {
        voiceAutoSendTimerRef.current = setTimeout(async () => {
          const textToSend = transcript.trim();
          if (textToSend && !isStreamingRef.current && sendMessageRef.current) {
            transcript = "";
            setInput("");
            // Stop recognition and prevent restart until send completes
            isStreamingRef.current = true;
            try { recognition.stop(); } catch {}
            // Auto-correct before sending (adds ¿? and tildes)
            try {
              const r = await fetch("/api/chat/correct", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: textToSend }),
              });
              const data = r.ok ? await r.json() : null;
              const corrected = data?.corrected || textToSend;
              isStreamingRef.current = false;
              sendMessageRef.current(corrected);
            } catch {
              isStreamingRef.current = false;
              sendMessageRef.current(textToSend);
            }
          }
        }, 2000);
      }
    };

    recognition.onend = () => {
      // Restart if voice mode is still active and not streaming
      if (voiceModeRef.current && !isStreamingRef.current) {
        setTimeout(() => {
          try { recognition.start(); } catch { /* already started */ }
        }, 300);
      }
    };

    recognition.onerror = (e) => {
      console.log("Voice recognition error:", (e as Event & { error?: string }).error);
      if (voiceModeRef.current && !isStreamingRef.current) {
        setTimeout(() => { try { recognition.start(); } catch {} }, 1000);
      }
    };

    voiceRecognitionRef.current = recognition;
    try { recognition.start(); } catch {}
    setIsRecording(true);
  };

  const stopVoiceMode = () => {
    setVoiceMode(false);
    if (voiceAutoSendTimerRef.current) clearTimeout(voiceAutoSendTimerRef.current);
    voiceRecognitionRef.current?.stop();
    voiceRecognitionRef.current = null;
    setIsRecording(false);
    setInput("");
  };

  // Restart voice recognition after TTS playback ends (voice mode)
  const autoPlayTtsAndResumeMic = async (text: string, idx: number) => {
    // Pause mic during TTS
    voiceRecognitionRef.current?.stop();
    setIsRecording(false);

    await autoPlayTts(text, idx);

    // Wait for audio to finish, then restart mic
    if (audioRef.current) {
      audioRef.current.onended = () => {
        setPlayingIdx(null);
        audioRef.current = null;
        // Restart mic if voice mode still active
        if (voiceModeRef.current) {
          setTimeout(() => {
            if (voiceRecognitionRef.current && voiceModeRef.current) {
              try { voiceRecognitionRef.current.start(); setIsRecording(true); } catch {}
            }
          }, 500);
        }
      };
    }
  };

  const sendMessage = async (overrideText?: string) => {
    const trimmed = (overrideText || input).trim();
    if (!trimmed || isStreaming) return;

    // Pause voice recognition during streaming
    if (voiceMode) {
      voiceRecognitionRef.current?.stop();
      setIsRecording(false);
    }

    const now = new Date().toISOString();

    setInput("");
    // Reset textarea height immediately after clearing; otherwise the
    // auto-resized height persists until the next keystroke.
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setMessages((prev) => [...prev, { role: "user", content: trimmed, created_at: now }]);
    setIsStreaming(true);
    setPhase("thinking");
    // Typing no longer suppresses silence — we just cleared the input.
    isTypingPausedRef.current = false;
    // "Enviado" → "leído" ticks for the just-sent user message. Gets
    // cleared when the next assistant content starts rendering.
    lastSentAtRef.current = Date.now();
    setUserTickStage(1);
    setTimeout(() => {
      setUserTickStage((prev) => (prev === 1 ? 2 : prev));
    }, 500);
    streamDoneRef.current = false;
    // Reset interrupt flags on new message — trigger new silence countdown
    // In voice mode, silence timers start AFTER TTS finishes (walkie-talkie)
    if (!voiceModeRef.current) {
      setSilenceTrigger((c) => c + 1);
    } else {
      clearSilenceTimers();
    }
    tokenBufferRef.current = "";
    lastAssistantMsgRef.current = "";

    // Reset streaming TTS state
    ttsQueueRef.current = [];
    ttsSentenceBufferRef.current = "";
    ttsStreamDoneRef.current = false;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    ttsPlayingRef.current = false;

    // Add empty assistant message with timestamp
    setMessages((prev) => [...prev, { role: "assistant", content: "", created_at: new Date().toISOString() }]);

    // Start draining buffer
    drainTimerRef.current = setTimeout(drainBuffer, charDelayRef.current);

    try {
      console.log("[Chat] Sending message:", { patientId: patient.id, conversationId, messageLength: trimmed.length });
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          conversationId,
          message: trimmed,
        }),
      });

      console.log("[Chat] Response status:", response.status, response.statusText);
      if (!response.ok || !response.body) {
        const errorText = await response.text().catch(() => "no body");
        console.error("[Chat] Response error:", response.status, errorText);
        throw new Error("Error en la respuesta");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n\n");
        sseBuffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === "conversation_id") {
            console.log("[Chat] Got conversation_id:", data.value);
            setConversationId(data.value);
          } else if (data.type === "pacing") {
            // Server tells us the per-patient pacing profile so we can
            // tune the typewriter effect and silence thresholds.
            const p = data.value as {
              charDelayMs?: number;
              sentenceGapMinMs?: number;
              sentenceGapMaxMs?: number;
              silenceThresholdsMs?: number[];
            };
            if (typeof p.charDelayMs === "number" && p.charDelayMs >= 10 && p.charDelayMs <= 400) {
              charDelayRef.current = p.charDelayMs;
            }
            if (typeof p.sentenceGapMinMs === "number" && p.sentenceGapMinMs >= 0) {
              sentenceGapMinRef.current = p.sentenceGapMinMs;
            }
            if (typeof p.sentenceGapMaxMs === "number" && p.sentenceGapMaxMs >= 0) {
              sentenceGapMaxRef.current = p.sentenceGapMaxMs;
            }
            if (Array.isArray(p.silenceThresholdsMs) && p.silenceThresholdsMs.length >= 2) {
              silenceThresholdsRef.current = p.silenceThresholdsMs;
            }
          } else if (data.type === "token") {
            // First token received → switch from "thinking" to "writing"
            if (phase === "thinking" || tokenBufferRef.current.length === 0) {
              setPhase("writing");
              // In voice mode, show "Hablando..." immediately from first token
              if (voiceModeRef.current && patient.voice_id) {
                setVoiceSpeaking(true);
              }
            }
            tokenBufferRef.current += data.value;
            // Feed tokens to TTS sentence buffer in voice mode
            if (voiceModeRef.current && patient.voice_id) {
              ttsSentenceBufferRef.current += data.value;
              flushSentenceBuffer();
            }
          } else if (data.type === "correction") {
            // Post-stream polish from the server (e.g. "ahoraSí" →
            // "ahora sí"). We replace the content of the last
            // assistant message. Any tokens still in the typewriter
            // buffer are dropped — the polished text is the source
            // of truth now.
            const polished = String(data.value || "");
            if (polished) {
              tokenBufferRef.current = "";
              setMessages((prev) => {
                if (prev.length === 0) return prev;
                const last = prev[prev.length - 1];
                if (last.role !== "assistant") return prev;
                const updated = [...prev];
                updated[updated.length - 1] = { ...last, content: polished };
                return updated;
              });
            }
          } else if (data.type === "error") {
            console.error("[Chat] Stream error from API:", data.value);
            tokenBufferRef.current = "";
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: "assistant",
                content: "Error: " + data.value,
                created_at: new Date().toISOString(),
              };
              return updated;
            });
          }
        }
      }
    } catch (err) {
      console.error("[Chat] Fetch/stream error:", err);
      tokenBufferRef.current = "";
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[updated.length - 1]?.role === "assistant" && !updated[updated.length - 1]?.content) {
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Error de conexión. Intenta de nuevo.",
            created_at: new Date().toISOString(),
          };
        }
        return updated;
      });
      setPhase("idle");
      setIsStreaming(false);
    }

    streamDoneRef.current = true;
  };

  // Keep ref updated for voice mode closure
  sendMessageRef.current = sendMessage;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleEndSession = async () => {
    if (!conversationId) return;

    // Stop voice mode and any audio playback before navigating
    if (voiceMode) stopVoiceMode();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingIdx(null);
    }

    // Persist final active time BEFORE navigating to review
    if (activeSecondsRef.current > 0) {
      try {
        await fetch(`/api/sessions/${conversationId}/active-time`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active_seconds: activeSecondsRef.current }),
        });
      } catch { /* navigate anyway */ }
    }

    router.push(`/review/${conversationId}`);
  };

  const renderContent = (content: string) => {
    const html = content
      // Bold: **text**
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Italic: *text* (single asterisks, not inside bold)
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
      // Non-verbal cues: [action]
      .replace(/\[([^\]]*)\]/g, '<span class="text-gray-400 italic text-xs">[$1]</span>');
    return sanitizeHTML(html);
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  };

  const formatDateSeparator = (isoString?: string) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Hoy";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Ayer";
    return d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  const lastMsg = messages[messages.length - 1];
  // Thinking bubble intentionally disabled — during the silent "thinking"
  // window the user sees only the read-ticks on their own last message,
  // then words start appearing with the normal typewriter cadence. This
  // removes the noisy dots animation without touching streaming logic.
  const showThinkingBubble = false;
  void lastMsg;
  // Index of the most recent user message (used to render ticks only on that one).
  let lastUserMsgIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") { lastUserMsgIdx = i; break; }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header
          Mobile: stacks into 2 rows — (row 1) patient avatar + name,
          (row 2) session action buttons. Prevents the name from being
          truncated behind the buttons on narrow phones. Desktop (sm+)
          keeps the original single horizontal row. */}
      <header className="bg-white border-b border-gray-200 px-2 sm:px-4 py-2 sm:py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Row 1 on mobile / left side on desktop: avatar + name */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => setShowVideoModal(true)}
            className="flex-shrink-0 rounded-full overflow-hidden bg-sidebar w-11 h-11 sm:w-14 sm:h-14 cursor-pointer"
          >
            <PatientVideo videoSrc={videoSrc} imageSrc={imageSrc} initials={initials} size={56} />
          </button>

          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 truncate text-sm sm:text-base">{patient.name}</h2>
            <p className="text-[10px] sm:text-xs text-gray-500 truncate">
              {patient.age} años, {patient.occupation}
            </p>
          </div>
        </div>

        {/* Row 2 on mobile / right side on desktop: voice toggle + timer + end session. Hidden until session starts.
            Mobile: uniform h-9 buttons aligned to the right with a tight
            gap so the row looks balanced and organized. Desktop keeps
            its existing labels and spacing via sm: overrides. */}
        <div className={`flex items-center gap-1.5 sm:gap-3 flex-shrink-0 w-full sm:w-auto justify-end sm:ml-auto ${!sessionStarted ? "invisible" : ""}`}>
          {/* Notes toggle */}
          <button
            onClick={() => setNotesOpen(!notesOpen)}
            className={`flex items-center gap-1.5 h-9 sm:h-auto px-2.5 sm:px-2.5 py-0 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-colors cursor-pointer ${
              notesOpen
                ? "bg-amber-500 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
            title="Bloc de notas"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <span className="hidden sm:inline">Notas</span>
          </button>

          {patient.voice_id && (
            <button
              onClick={() => voiceMode ? stopVoiceMode() : requestVoiceMode()}
              className={`flex items-center gap-1.5 h-9 sm:h-auto px-2.5 sm:px-2.5 py-0 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-colors cursor-pointer ${
                voiceMode
                  ? "bg-green-500 text-white animate-pulse"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
              title={voiceMode ? "Desactivar modo voz" : "Activar conversación por voz"}
            >
              {voiceMode ? <Phone size={14} /> : <Mic size={14} />}
              <span className="hidden sm:inline">{voiceMode ? "Voz activa" : "Modo voz"}</span>
            </button>
          )}

          <SessionTimer
            sessionStarted={sessionStarted}
            conversationId={conversationId}
            initialActiveSeconds={initialActiveSeconds}
            onTick={handleTimerTick}
          />

          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1.5 h-9 sm:h-auto px-2.5 sm:px-3 py-0 sm:py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer"
            title="Esto te permite volver en otro momento sin afectar la relación con el paciente"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18" rx="1" /><rect x="15" y="3" width="4" height="18" rx="1" /></svg>
            <span className="hidden sm:inline">Pausar</span>
          </button>

          <button
            onClick={() => setShowEndConfirm(true)}
            disabled={isStreaming}
            className="flex items-center gap-1.5 h-9 sm:h-auto px-2.5 sm:px-3 py-0 sm:py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            title="Finalizar sesión"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Finalizar sesi&oacute;n</span>
          </button>
        </div>
      </header>

      {/* Video modal — fullscreen preview */}
      {showVideoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" onClick={() => setShowVideoModal(false)}>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowVideoModal(false)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white cursor-pointer"
            >
              <X size={24} />
            </button>
            <div className="rounded-2xl overflow-hidden w-[min(300px,85vw)] h-[min(300px,85vw)]">
              <PatientVideo videoSrc={videoSrc} imageSrc={imageSrc} initials={initials} size={300} />
            </div>
          </div>
        </div>
      )}

      {/* End session confirmation modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-4" onClick={() => setShowEndConfirm(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-pop max-h-[calc(100dvh-1.5rem)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${messages.length === 0 ? "bg-gray-100" : displaySeconds >= 300 ? "bg-red-50" : "bg-amber-50"}`}>
                <LogOut size={20} className={messages.length === 0 ? "text-gray-400" : displaySeconds >= 300 ? "text-red-500" : "text-amber-500"} />
              </div>
              <h3 className="text-base font-bold text-gray-900">
                {messages.length === 0
                  ? "¿Salir de la sesión?"
                  : displaySeconds >= 300
                    ? "¿Finalizar sesión?"
                    : "Sesión con menos de 5 minutos"
                }
              </h3>
            </div>

            {messages.length === 0 ? (
              <p className="text-sm text-gray-600 leading-relaxed">
                Aún no has enviado ningún mensaje. Si sales ahora, no se registrará nada.
              </p>
            ) : displaySeconds < 300 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <p className="text-sm text-amber-700 font-medium mb-1">
                  Si cierras ahora, no se generará evaluación de competencias.
                </p>
                <p className="text-xs text-amber-600">
                  Para recibir retroalimentación de la IA, necesitas al menos 5 minutos de conversación y 6 intervenciones.
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-600 leading-relaxed">
                La sesión se guardará y recibirás una evaluación de tus competencias clínicas.
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={messages.length === 0 ? () => router.push("/dashboard") : handleEndSession}
                className={`end-session-btn flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer ${
                  messages.length === 0
                    ? "bg-gray-500 text-white"
                    : displaySeconds >= 300
                      ? "bg-red-500 text-white"
                      : "bg-amber-500 text-white"
                }`}
              >
                {messages.length === 0
                  ? "Sí, salir"
                  : displaySeconds >= 300
                    ? "Sí, finalizar"
                    : "Cerrar sin evaluación"
                }
              </button>
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                {messages.length === 0 ? "Quedarme" : "Continuar sesión"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice mode consent modal */}
      {showVoiceConsent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-4" onClick={() => setShowVoiceConsent(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-pop max-h-[calc(100dvh-1.5rem)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                <Mic size={20} className="text-sidebar" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Activar modo voz</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Al activar el modo voz, tu micrófono se encenderá y todo lo que digas se enviará directamente al paciente, sin posibilidad de editar el texto antes del envío.
            </p>
            <p className="text-xs text-gray-400">
              Puedes desactivar el modo voz en cualquier momento.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={startVoiceMode}
                className="flex-1 bg-sidebar text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-sidebar-hover transition-colors cursor-pointer"
              >
                Aceptar y activar
              </button>
              <button
                onClick={() => setShowVoiceConsent(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient disconnected modal */}
      {showDisconnect && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 space-y-5 animate-pop text-center max-h-[calc(100dvh-1.5rem)] overflow-y-auto">
            {/* Patient photo */}
            <div className="w-20 h-20 rounded-full overflow-hidden mx-auto border-2 border-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc}
                alt={patient.name}
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-lg font-bold text-gray-900">{patient.name} se ha desconectado</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Debido a que no hubo respuesta por un tiempo prolongado, el paciente decidió retirarse de la sesión.
            </p>
            <p className="text-xs text-gray-400">
              Esto puede afectar el vínculo terapéutico en futuras sesiones.
            </p>
            <button
              onClick={() => router.push(`/review/${conversationId}`)}
              className="w-full bg-sidebar text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-sidebar-hover transition-colors cursor-pointer"
            >
              Ver resumen de sesión
            </button>
          </div>
        </div>
      )}

      {/* Mini tour for first-time users */}
      {showTour && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-start justify-center pt-16 p-3 sm:p-4" onClick={() => { setShowTour(false); localStorage.setItem("gloria_chat_tour_done", "1"); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 animate-pop max-h-[calc(100dvh-5rem)] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* ─── Step 0 — Barra superior: timer, pausar, finalizar ─── */}
            {tourStep === 0 && (
              <div className="space-y-3">
                <h3 className="text-base font-bold text-gray-900 mb-1">Barra superior</h3>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-sidebar/10 flex items-center justify-center flex-shrink-0">
                    <Clock size={18} className="text-sidebar" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Temporizador</p>
                    <p className="text-xs text-gray-500">Cuenta el tiempo de la sesi&oacute;n. Necesitas al menos 5 minutos para recibir evaluaci&oacute;n.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#6b7280"><rect x="5" y="3" width="4" height="18" rx="1" /><rect x="15" y="3" width="4" height="18" rx="1" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Pausar sesi&oacute;n</p>
                    <p className="text-xs text-gray-500">Puedes salir y volver despu&eacute;s sin afectar la relaci&oacute;n con el paciente.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                    <LogOut size={16} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Finalizar sesi&oacute;n</p>
                    <p className="text-xs text-gray-500">Cierra formalmente la sesi&oacute;n. Recibes retroalimentaci&oacute;n por IA al terminar.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <FileText size={16} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Notas de sesi&oacute;n</p>
                    <p className="text-xs text-gray-500">Abre el panel lateral para escribir tus observaciones cl&iacute;nicas mientras conversas. Se guardan autom&aacute;ticamente.</p>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Step 1 — Caja de texto: input, mic, autocorrector, send ─── */}
            {tourStep === 1 && (
              <div className="space-y-3">
                <h3 className="text-base font-bold text-gray-900 mb-1">Caja de mensaje</h3>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <MessageSquare size={16} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Escribe tu mensaje</p>
                    <p className="text-xs text-gray-500">Aqu&iacute; vas a escribir tus intervenciones. Enter para enviar, Shift+Enter para salto de l&iacute;nea.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-sidebar/10 flex items-center justify-center flex-shrink-0">
                    <Mic size={16} className="text-sidebar" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Bot&oacute;n del micr&oacute;fono</p>
                    <p className="text-xs text-gray-500">Dicta tu mensaje en voz alta. Tambi&eacute;n puedes presionar <strong>ALT + CTRL</strong>; doble pulsaci&oacute;n para anclar la grabaci&oacute;n.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 font-bold text-sm">Aa</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Autocorrector</p>
                    <p className="text-xs text-gray-500">Aparece cuando escribes m&aacute;s de 10 caracteres. Corrige tildes, signos de pregunta y typos antes de enviar.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-sidebar flex items-center justify-center flex-shrink-0">
                    <Send size={14} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Enviar</p>
                    <p className="text-xs text-gray-500">Manda tu mensaje al paciente. Tambi&eacute;n con la tecla Enter.</p>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Step 2 — Voz, silencios y consejos ─── */}
            {tourStep === 2 && (
              <div className="space-y-3">
                <h3 className="text-base font-bold text-gray-900 mb-1">Buenas pr&aacute;cticas</h3>
                {patient.voice_id && (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-sidebar/10 flex items-center justify-center flex-shrink-0">
                      <Mic size={16} className="text-sidebar" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Modo voz (walkie-talkie)</p>
                      <p className="text-xs text-gray-500">Este paciente soporta conversaci&oacute;n por voz. Act&iacute;valo desde la barra superior para una experiencia m&aacute;s realista.</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Clock size={16} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Silencios</p>
                    <p className="text-xs text-gray-500">Si no respondes, el paciente reaccionar&aacute; al silencio. Si pasan 5 minutos sin respuesta, se retirar&aacute;.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Consejo</p>
                    <p className="text-xs text-gray-500">Tr&aacute;tale como a un paciente real. Saluda, presenta el setting, escucha activamente. La IA eval&uacute;a tus intervenciones cl&iacute;nicas.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <span className="text-[10px] text-gray-400">{tourStep + 1} de 3</span>
              <div className="flex items-center gap-2">
                {tourStep > 0 && (
                  <button onClick={() => setTourStep(tourStep - 1)} className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">
                    &larr; Atr&aacute;s
                  </button>
                )}
                {tourStep < 2 ? (
                  <button onClick={() => setTourStep(tourStep + 1)} className="text-sm text-sidebar font-medium hover:underline cursor-pointer">
                    Siguiente &rarr;
                  </button>
                ) : (
                  <button onClick={() => { setShowTour(false); localStorage.setItem("gloria_chat_tour_done", "1"); }} className="bg-sidebar text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#354080] transition-colors cursor-pointer">
                    Entendido
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content: chat + notes panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Chat column */}
        <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300`}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 space-y-3 chat-pattern">
        {!sessionStarted && messages.length === 0 && (
          <div className="flex flex-col items-center justify-start sm:justify-center mt-0 sm:mt-16 animate-fade-in px-2 sm:px-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 sm:p-8 max-w-md w-full">
              {/* Two avatars — compact on mobile so the whole card sits
                  comfortably above the fold without scrolling. */}
              <div className="flex items-center justify-center gap-3 sm:gap-8 mb-3 sm:mb-6">
                <div className="flex flex-col items-center gap-1 sm:gap-2 min-w-0">
                  <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-gray-200 shadow-md flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageSrc} alt={patient.name} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-gray-700 text-center truncate max-w-[9rem]">{patient.name}</p>
                  <p className="text-[10px] sm:text-[11px] text-gray-500 text-center truncate max-w-[9rem]">{patient.age} {"años"}{patient.occupation ? `, ${patient.occupation}` : ""}</p>
                </div>

                <div className="w-5 sm:w-10 h-px bg-gray-300 -mt-6 sm:-mt-8 flex-shrink-0" />

                <div className="flex flex-col items-center gap-1 sm:gap-2 min-w-0">
                  <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-sidebar/30 shadow-md bg-sidebar/10 flex items-center justify-center flex-shrink-0">
                    {userAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={userAvatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg sm:text-2xl font-bold text-sidebar">{userInitials}</span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-gray-700 text-center truncate max-w-[9rem]">{userName?.trim() || "Tú"}</p>
                  <p className="text-[10px] sm:text-[11px] text-gray-500 text-center">Terapeuta</p>
                </div>
              </div>

              {/* Rules reminder */}
              <div className="bg-gray-50 rounded-xl p-3 sm:p-4 mb-4 sm:mb-5 space-y-1.5 sm:space-y-2">
                <p className="text-xs font-semibold text-gray-700">Antes de comenzar, recuerda:</p>
                <ul className="text-[11px] text-gray-500 space-y-1.5">
                  <li className="flex gap-2"><span className="text-sidebar font-bold">1.</span> {"Esta es una simulación con fines formativos, no una sesión real."}</li>
                  <li className="flex gap-2"><span className="text-sidebar font-bold">2.</span> {"El paciente reacciona a tus intervenciones como lo haría en la vida real."}</li>
                  <li className="flex gap-2"><span className="text-sidebar font-bold">3.</span> {"Intenta mantener al menos 5 minutos para recibir evaluación."}</li>
                  <li className="flex gap-2"><span className="text-sidebar font-bold">4.</span> {"Puedes pausar y retomar la sesión en cualquier momento."}</li>
                  <li className="flex gap-2"><span className="text-sidebar font-bold">5.</span> {"Cada paciente tiene su propio ritmo: unos responden más rápido, otros más pausados."}</li>
                </ul>
              </div>

              <button
                onClick={() => {
                  setSessionStarted(true);
                  if (!initialConvId && !localStorage.getItem("gloria_chat_tour_done")) {
                    setShowTour(true);
                    setTourStep(0);
                  }
                }}
                className="w-full bg-sidebar text-white py-2.5 sm:py-3 rounded-xl text-sm font-medium hover:bg-[#354080] transition-colors cursor-pointer"
              >
                {"Iniciar sesión"}
              </button>
            </div>
          </div>
        )}

        {/* The "cada paciente tiene su propio ritmo" tip now lives
            inside the pre-session reminders card above, so the chat
            itself stays focused on the conversation. */}

        {messages.map((msg, i) => {
          // Skip rendering empty assistant message when typing bubble is shown
          if (i === messages.length - 1 && msg.role === "assistant" && !msg.content && phase !== "idle") {
            return null;
          }

          // Date separator
          const prevMsg = i > 0 ? messages[i - 1] : null;
          const showDateSep =
            msg.created_at &&
            (!prevMsg?.created_at ||
              new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString());

          return (
            <div key={i}>
              {showDateSep && (
                <div className="flex justify-center my-4">
                  <span className="bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full">
                    {formatDateSeparator(msg.created_at)}
                  </span>
                </div>
              )}

              <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2.5 ${msg.role === "user" ? "animate-msg-right" : "animate-msg-left"}`}>
                {/* Patient avatar (assistant messages only) */}
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 mt-1">
                    <PatientAvatar src={imageSrc} initials={initials} size={32} />
                  </div>
                )}

                <div className="flex flex-col max-w-[92%] sm:max-w-[85%] md:max-w-[70%]">
                  <div
                    className={`chat-bubble px-4 py-3 rounded-2xl text-sm leading-relaxed break-words ${
                      msg.role === "user"
                        ? "bg-sidebar text-white rounded-br-md"
                        : "bg-white border border-gray-200 text-gray-800 rounded-bl-md"
                    }`}
                    dangerouslySetInnerHTML={
                      msg.role === "assistant"
                        ? { __html: renderContent(msg.content) || '<span class="animate-pulse text-gray-300">...</span>' }
                        : undefined
                    }
                  >
                    {msg.role === "user" ? msg.content : undefined}
                  </div>

                  {/* Timestamp + TTS button */}
                  <div className={`flex items-center gap-1.5 mt-1 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.created_at && (
                      <span className="text-[10px] text-gray-400">
                        {formatTime(msg.created_at)}
                      </span>
                    )}
                    {/* WhatsApp-style tick: enviado / leído. Only on the latest
                        user message while the patient is still thinking. */}
                    {msg.role === "user" && i === lastUserMsgIdx && userTickStage > 0 && phase !== "idle" && (
                      <span
                        className="text-[10px] text-gray-400"
                        aria-label={userTickStage === 1 ? "enviado" : "leído"}
                        title={userTickStage === 1 ? "Enviado" : "Leído"}
                      >
                        {userTickStage === 1 ? "✓ enviado" : "✓✓ leído"}
                      </span>
                    )}
                  </div>
                </div>

                {/* User avatar */}
                {msg.role === "user" && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-full bg-sidebar/20 flex items-center justify-center overflow-hidden">
                      {userAvatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={userAvatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-bold text-sidebar">{userInitials}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Thinking bubble — shown before first token */}
        {showThinkingBubble && (
          <div className="flex justify-start gap-2.5 animate-msg-left">
            <div className="flex-shrink-0 mt-1">
              <PatientAvatar src={imageSrc} initials={initials} size={32} />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <span className="inline-flex gap-1">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </span>
            </div>
          </div>
        )}

        {/* Voice speaking bubble — audio playing, text hidden */}
        {voiceSpeaking && (
          <div className="flex justify-start gap-2.5 animate-msg-left">
            <div className="flex-shrink-0 mt-1">
              <PatientAvatar src={imageSrc} initials={initials} size={32} />
            </div>
            <div className="bg-green-50 border border-green-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Volume2 size={14} className="text-green-600 animate-pulse" />
                <span className="text-xs text-green-700 font-medium">Hablando...</span>
              </div>
            </div>
          </div>
        )}


        <div ref={messagesEndRef} />
      </div>

      {/* Input — extra bottom padding on mobile absorbs the few pixels of
          lag between visualViewport.height updates and the actual keyboard
          position on iOS/Android, and respects the home indicator inset. */}
      <div
        className="bg-white border-t border-gray-200 px-3 sm:px-6 py-3 sm:py-4"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px) + 0.25rem)" }}
      >
        {isRecording && (
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-500 font-medium">
              {micLocked
                ? "Grabando audio (anclado) \u2014 Ctrl+Alt para detener"
                : "Grabando audio... Ctrl+Alt para detener"}
            </span>
          </div>
        )}
        {correcting && (
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-sidebar animate-pulse" />
            <span className="text-xs text-sidebar font-medium">Corrigiendo ortografía...</span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                const next = e.target.value;
                setInput(next);
                handleTypingActivity();
                applyTypingPause(next.length > 0);
                const el = e.target;
                el.style.height = "auto";
                if (next.length > 0) {
                  el.style.height = Math.min(el.scrollHeight, voiceMode ? 300 : 160) + "px";
                }
              }}
              onFocus={(e) => {
                // Mobile-only safeguard: when the virtual keyboard opens
                // on devices without hover, scroll the input into view so
                // it isn't hidden behind the keyboard. `block:"nearest"`
                // is a no-op on desktop (already visible).
                if (window.matchMedia("(hover: none)").matches) {
                  const el = e.currentTarget;
                  setTimeout(() => {
                    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
                  }, 300);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={sessionStarted ? "Escribe tu mensaje..." : "Presiona \"Iniciar sesión\" para comenzar"}
              rows={1}
              className={`w-full resize-none border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar disabled:bg-gray-100 disabled:text-gray-400 ${voiceMode ? "overflow-y-auto" : "overflow-hidden"}`}
              disabled={!sessionStarted}
            />
          </div>

          {/* Autocorrect button (next to mic) */}
          {input.trim().length > 10 && !correcting && !isStreaming && sessionStarted && (
            <button
              onClick={correctText}
              className="p-3 min-w-[44px] min-h-[44px] rounded-xl border border-gray-300 text-gray-400 hover:text-sidebar hover:border-sidebar/30 transition-colors flex-shrink-0 text-xs font-semibold cursor-pointer"
              title={"Corregir ortografía"}
            >
              Abc
            </button>
          )}
          {correcting && (
            <div className="p-3 min-w-[44px] min-h-[44px] rounded-xl border border-sidebar/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-sidebar animate-pulse font-semibold">Abc</span>
            </div>
          )}

          {/* Mic button */}
          <button
            onClick={toggleRecording}
            disabled={isStreaming}
            className={`p-3 min-w-[44px] min-h-[44px] rounded-xl transition-colors flex-shrink-0 cursor-pointer ${
              isRecording
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "border border-gray-300 text-gray-500 hover:text-sidebar hover:border-sidebar/30"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isRecording ? (micLocked ? "Anclado \u2014 Ctrl+Alt para detener" : "Ctrl+Alt para detener") : "Presiona ALT + CTRL para comenzar a grabar audio"}
          >
            {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <button
            data-send-btn
            onClick={() => sendMessage()}
            disabled={isStreaming || !input.trim()}
            className="bg-sidebar hover:bg-[#354080] text-white p-3 rounded-xl transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
        </div>{/* end Chat column */}

        {/* Notes panel — slides in from right */}
        <div className={`flex-shrink-0 bg-white border-l border-gray-200 transition-all duration-300 overflow-hidden ${
          notesOpen ? "w-72 sm:w-80" : "w-0 border-l-0"
        }`}>
          {notesOpen && (
            <div className="w-72 sm:w-80 h-full flex flex-col">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Mis notas</h3>
                <div className="flex items-center gap-1">
                  {notesSaving && (
                    <span className="text-[10px] text-gray-400">Guardando...</span>
                  )}
                  <button
                    onClick={() => setNotesOpen(false)}
                    className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors cursor-pointer"
                    title="Ocultar panel de notas (no borra el contenido)"
                  >
                    Ocultar
                  </button>
                </div>
              </div>
              <div className="flex-1 p-3 overflow-hidden flex flex-col">
                <textarea
                  value={notesText}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  placeholder="Escribe tus notas durante la sesión..."
                  className="flex-1 w-full resize-none border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30 placeholder:text-gray-400/70"
                />
              </div>
              <div className="px-3 pb-3 flex items-center gap-2">
                {notesText.trim().length > 10 && (
                  <button
                    onClick={correctNotes}
                    disabled={notesCorrecting}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:text-sidebar hover:border-sidebar/30 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {notesCorrecting ? "Corrigiendo..." : "Abc"}
                  </button>
                )}
                <button
                  onClick={toggleNotesRecording}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    notesRecording
                      ? "bg-red-500 text-white"
                      : "border border-gray-200 text-gray-500 hover:text-sidebar hover:border-sidebar/30"
                  }`}
                  title={notesRecording ? "Detener dictado" : "Dictar nota por voz"}
                >
                  {notesRecording ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
                {notesRecording && (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] text-red-500">Grabando</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>{/* end Main content flex */}
    </div>
  );
}

// ——— Patient Avatar (PNG) ———

function PatientAvatar({ src, initials, size }: { src: string; initials: string; size: number }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className="rounded-full overflow-hidden bg-sidebar flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {!imgFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={initials}
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="text-white font-bold" style={{ fontSize: size * 0.35 }}>
          {initials}
        </span>
      )}
    </div>
  );
}

// ——— Patient Video (MP4) ———

function PatientVideo({ videoSrc, imageSrc, initials, size }: { videoSrc: string; imageSrc: string; initials: string; size: number }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  if (!videoFailed) {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        src={videoSrc}
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover"
        style={{ width: size, height: size }}
        onError={() => setVideoFailed(true)}
      />
    );
  }

  if (!imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageSrc}
        alt={initials}
        className="w-full h-full object-cover"
        style={{ width: size, height: size }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center bg-sidebar"
      style={{ width: size, height: size }}
    >
      <span className="text-white font-bold" style={{ fontSize: size * 0.35 }}>
        {initials}
      </span>
    </div>
  );
}
